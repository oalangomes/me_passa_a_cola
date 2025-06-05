// Utilities for interacting with Notion API
const { createEnhancedNotionBlocks, getEmojiForCallout } = require('../formatter');

// Busca database pelo nome
async function searchDatabaseByName(notion, dbName) {
    const response = await notion.search({
        query: dbName,
        filter: { property: "object", value: "database" }
    });
    return response.results.find(db =>
        db.object === "database" &&
        db.title &&
        db.title[0] &&
        db.title[0].plain_text === dbName
    );
}

// Busca página pelo título
async function searchPageByTitle(notion, databaseId, title) {
    const db = await notion.databases.retrieve({ database_id: databaseId });
    const titlePropName = Object.entries(db.properties).find(
        ([, val]) => val.type === "title"
    )?.[0];
    if (!titlePropName) return null;

    const response = await notion.databases.query({
        database_id: databaseId,
        filter: {
            property: titlePropName,
            title: { equals: title }
        }
    });
    return response.results.length > 0 ? response.results[0] : null;
}

// Remove tags inválidas do banco
async function limparTagsRuins(notion, databaseId, stopwords, contextoObrigatorio = null) {
    const db = await notion.databases.retrieve({ database_id: databaseId });
    const tagPropEntry = Object.entries(db.properties).find(
        ([key, val]) => val.type === "multi_select" && key.toLowerCase().includes("tag")
    );
    if (!tagPropEntry) throw new Error("Campo de tags não encontrado.");

    const tagPropName = tagPropEntry[0];
    let options = tagPropEntry[1].multi_select.options || [];

    const stopSet = new Set(stopwords.map(s => s.toLowerCase()));

    function countRelevantWords(tag) {
        return tag.split(/\s+/).filter(w => !stopSet.has(w.toLowerCase())).length;
    }

    function isTagBoa(opt) {
        if (!opt.name || opt.name.trim().length < 3) return false;
        if (!/^[a-zA-ZÀ-ÿ0-9\s\-]+$/.test(opt.name)) return false;
        if (stopSet.has(opt.name.toLowerCase())) return false;
        if (countRelevantWords(opt.name) > 3) return false;
        if (/^[\d\s\-]+$/.test(opt.name)) return false;
        return true;
    }

    let tagsBoas = options.filter(isTagBoa);

    if (contextoObrigatorio) {
        const found = options.find(opt =>
            opt.name.toLowerCase() === contextoObrigatorio.toLowerCase()
        );
        if (found && !tagsBoas.some(t => t.name.toLowerCase() === found.name.toLowerCase())) {
            tagsBoas.unshift(found);
        }
    }

    const seen = new Set();
    tagsBoas = tagsBoas.filter(opt => {
        if (seen.has(opt.name.toLowerCase())) return false;
        seen.add(opt.name.toLowerCase());
        return true;
    });

    await notion.databases.update({
        database_id: databaseId,
        properties: {
            [tagPropName]: {
                multi_select: { options: tagsBoas }
            }
        }
    });

    return {
        totalAntes: options.length,
        totalDepois: tagsBoas.length,
        removidas: options.length - tagsBoas.length,
        tagsRemovidas: options.filter(opt => !tagsBoas.find(t => t.id === opt.id)).map(opt => opt.name),
        tagsMantidas: tagsBoas.map(opt => opt.name)
    };
}

// Cria ou retorna tags existentes
async function getOrCreateTags(notion, databaseId, tagNames) {
    if (!Array.isArray(tagNames)) {
        if (!tagNames) tagNames = [];
        else if (typeof tagNames === "string") tagNames = tagNames.split(",").map(t => t.trim()).filter(Boolean);
        else tagNames = [String(tagNames)];
    }

    const db = await notion.databases.retrieve({ database_id: databaseId });
    const tagPropEntry = Object.entries(db.properties).find(
        ([key, val]) => val.type === "multi_select" && key.toLowerCase().includes("tag")
    );
    if (!tagPropEntry) return [];

    const tagPropName = tagPropEntry[0];
    let options = tagPropEntry[1].multi_select.options || [];

    const tagsQueFaltam = tagNames.filter(tagName =>
        !options.some(opt => opt.name.toLowerCase() === tagName.toLowerCase())
    );

    if (tagsQueFaltam.length) {
        await notion.databases.update({
            database_id: databaseId,
            properties: {
                [tagPropName]: {
                    multi_select: {
                        options: [
                            ...options,
                            ...tagsQueFaltam.map(t => ({ name: t, color: getRandomNotionColor() }))
                        ]
                    }
                }
            }
        });
        const dbAtualizado = await notion.databases.retrieve({ database_id: databaseId });
        options = dbAtualizado.properties[tagPropName].multi_select.options;
    }

    return tagNames.map(tagName => {
        const found = options.find(o => o.name.toLowerCase() === tagName.toLowerCase());
        return found ? { id: found.id, name: found.name } : { name: tagName };
    });
}

function getRandomNotionColor() {
    const colors = ["default", "gray", "brown", "orange", "yellow", "green", "blue", "purple", "pink", "red"];
    return colors[Math.floor(Math.random() * colors.length)];
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function filterValidProperties(inputProps, dbProperties) {
    if (!inputProps) return {};
    const dbPropKeys = Object.keys(dbProperties);
    return Object.fromEntries(
        Object.entries(inputProps).filter(([key]) => dbPropKeys.includes(key))
    );
}

async function getOrCreatePage({
    notion,
    databaseName,
    pageTitle,
    tags = [],
    parentTitle = null,
    asSubpage = false,
    contentMd = "",
    otherProps = {}
}) {
    const db = await searchDatabaseByName(notion, databaseName);
    if (!db) throw new Error("Database não encontrado: " + databaseName);

    const titlePropName = Object.entries(db.properties).find(([, val]) => val.type === "title")[0];
    const tagPropName = Object.entries(db.properties).find(([, val]) => val.type === "multi_select")?.[0];
    const relationPropName = Object.entries(db.properties).find(
        ([key, val]) => val.type === "relation" && key === "página principal"
    )?.[0];

    let parentPage = null;
    if (parentTitle) parentPage = await searchPageByTitle(notion, db.id, parentTitle);

    let page = await searchPageByTitle(notion, db.id, pageTitle);

    const tagsReady = tagPropName ? await getOrCreateTags(notion, db.id, tags) : [];
    const validOtherProps = filterValidProperties(otherProps, db.properties);

    const emoji = getEmojiForCallout(pageTitle);
    const titleWithEmoji = emoji && !pageTitle.startsWith(emoji) ? `${emoji} ${pageTitle}` : pageTitle;

    const properties = {
        [titlePropName]: { title: [{ text: { content: titleWithEmoji } }] },
        ...(tagPropName && { [tagPropName]: { multi_select: tagsReady } }),
        ...validOtherProps
    };

    if (asSubpage && parentPage && relationPropName) {
        properties[relationPropName] = { relation: [{ id: parentPage.id }] };
    }

    const childrenBlocks = contentMd ? createEnhancedNotionBlocks(contentMd) : [];

    if (!page) {
        page = await notion.pages.create({
            parent: { database_id: db.id },
            properties,
            children: childrenBlocks
        });
    }
    return page;
}

module.exports = {
    searchDatabaseByName,
    searchPageByTitle,
    limparTagsRuins,
    getOrCreateTags,
    filterValidProperties,
    getOrCreatePage,
    sleep
};
