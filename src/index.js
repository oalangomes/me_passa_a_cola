// index.js
const express = require('express');
const { Client } = require('@notionhq/client');
const { createEnhancedNotionBlocks, getEmojiForCallout } = require('./formatter');
const natural = require('natural');

const app = express();
app.use(express.json());

// Utilidade: Buscar database pelo nome
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
// Stopwords comuns (você pode expandir)
const STOPWORDS = [
    // Gerais
    "exemplo", "conclusão", "introdução", "vantagens", "desvantagens", "quando usar",
    "referências", "objetivo", "casos", "caso", "prático", "práticos", "teórico", "leitura",
    "resumo", "tema", "passos", "pontos", "importante", "dica", "nota", "final", "etc",
    // Artigos, preposições, conectivos
    "e", "de", "com", "como", "a", "o", "os", "as", "um", "uma", "para", "em", "no", "na", "nos", "nas", "dos", "das", "do", "da", "por", "pelos", "pelas", "pelo", "pela",
    // 1ª pessoa singular
    "eu", "meu", "minha", "meus", "minhas", "mim", "comigo",
    // 2ª pessoa singular
    "você", "vc", "teu", "tua", "teus", "tuas", "te", "contigo", "seu", "sua", "seus", "suas",
    // 1ª pessoa plural
    "nós", "nosso", "nossa", "nossos", "nossas", "conosco",
    // 2ª pessoa plural (pouco usado, mas por garantia)
    "vocês", "vossos", "vossas", "vosso", "vossa", "convosco",
    // 3ª pessoa (feminino/masculino/plural)
    "ele", "ela", "eles", "elas", "lhe", "lhes", "deles", "delas", "dele", "dela", "se", "si", "consigo",
    // Verbos auxiliares/frequentes
    "é", "são", "foi", "foram", "era", "eram", "ser", "está", "estão", "estava", "estavam", "estar",
    "tem", "têm", "tenho", "temos", "tinha", "tinham", "havia", "houveram", "vai", "vão", "vamos", "ir",
    // Genéricos
    "que", "isso", "aquilo", "isto", "deste", "desta", "daquele", "daquela", "desse", "dessa", "nesse", "nessa", "neste", "nesta", "qual", "quais", "onde", "quando", "quem", "porquê", "porque", "por que", "cujo", "cuja", "cujos", "cujas", "seja", "sejam", "foi", "fui", "sou", "são", "tudo", "cada"
    // Inclua mais se quiser, ou traduções para inglês!
    , "the", "a", "an", "and", "but", "or", "if", "in", "on", "at", "to", "for", "with", "by", "about",
    "this", "that", "these", "those", "it", "its", "they", "them", "their", "there", "where", "when", "who", "whom", "which", "what"
    , "is", "are", "was", "were", "be", "been", "being", "have", "has", "had", "do", "does", "did",
    "will", "shall", "can", "could", "may", "might", "must", "should", "ought", "need", "dare"
    , "just", "only", "even", "still", "yet", "already",
];

const EXTRA_STOPWORDS = [
    "teste", "tessssss", "preliminar", "conclusão preliminar", "lises", "ajustes",
    "estrutura", "estrutura esperada", "evolu", "justificativa", "introdução",
    "considerações finais", "detalhada", "atual", "observações", "sessão",
    "diretórios", "pergunta", "resposta", "sessão", "nota", "importante", "finais",
    "detalhes", "dados", "real", "mais", "conta", "email", "perfil", "dados",
    "complementar", "sessão", "temas", "alertas", "feedback", "registro", "opção", "Sistema", "Home", "Configurações", "Configuração", "Configurações do Sistema",
];
const ALL_STOPWORDS = STOPWORDS.concat(EXTRA_STOPWORDS);
const stopSet = new Set(ALL_STOPWORDS.map(w => w.toLowerCase()));

function isTagOk(tag) {
    // Remove tags de stopwords, de menos de 4 letras e só números
    if (!tag || typeof tag !== "string") return false;
    const tagClean = tag.trim().toLowerCase();

    // Remove se for stopword, só número ou genérica
    if (stopSet.has(tagClean)) return false;
    if (tagClean.length < 4 && !["mvp", "api", "crm", "sql"].includes(tagClean)) return false; // exceção: siglas famosas

    // Remove tags que são frases genéricas ou muito longas
    const palavras = tag.split(/\s+/).filter(w => !stopSet.has(w));
    if (palavras.length > 3) return false;
    if (palavras.length === 0) return false;

    // Remove tags que só tem palavras comuns
    if (palavras.every(w => stopSet.has(w.toLowerCase()))) return false;

    // Remove tags só de maiúsculas (exceto siglas permitidas)
    if (/^[A-Z]{4,}$/.test(tag) && !["MVP", "API"].includes(tag)) return false;

    // Remove tags repetidas
    if (new Set(palavras).size < palavras.length) return false;

    // Pode criar mais regras se quiser

    return true;
}


function reconcileTags(tagsDesejadas, options) {
    return tagsDesejadas.map(t => {
        // Se já tem ID e está entre as opções válidas
        if (t.id && options.some(opt => opt.id === t.id)) {
            return { id: t.id };
        }
        // Se não tem id, busca na lista pelo nome (case-insensitive)
        const opt = options.find(opt => opt.name.toLowerCase() === t.name.toLowerCase());
        if (opt) return { id: opt.id };
        // Se não achar, manda só o nome (será criada nova)
        return { name: t.name };
    });
}

// Helper: Conta só palavras "relevantes" (sem stopword)
function countRelevantWords(tag) {
    return tag.split(/\s+/).filter(w => !stopSet.has(w.toLowerCase())).length;
}

function cleanHeading(heading) {
    // Remove emojis, pontuação, múltiplos espaços
    let text = heading.replace(/[\u{1F600}-\u{1F64F}]/gu, '') // remove emojis
        .replace(/[^\wÀ-ÿ ]/g, '') // remove pontuação, mantendo acentos
        .replace(/\s+/g, ' ')
        .trim();
    // Split em palavras e filtra stopwords
    let words = text.split(/\s+/).filter(word =>
        word.length > 2 && !stopSet.has(word.toLowerCase())
    );
    // Junta como tag curta
    if (words.length > 3) words = words.slice(0, 3);
    return words.join(' ');
}

function extractTagsSmart(blocks, maxTags = 5) {
    let contextTag = null;
    const headings = [];

    // 1. Encontra headings e principal (H1)
    blocks.forEach(b => {
        if (b.type === 'heading_1') {
            const texto = (b.heading_1?.rich_text || [])
                .map(r => r.plain_text || r.text?.content || "").join(" ");
            if (!contextTag) contextTag = cleanHeading(texto);
            headings.push(texto);
        }
        if (b.type === 'heading_2') {
            const texto = (b.heading_2?.rich_text || [])
                .map(r => r.plain_text || r.text?.content || "").join(" ");
            headings.push(texto);
        }
    });

    // 2. Keywords via NLP para complementar (evitar repetidas)
    let fullText = headings.join(" ");
    blocks.forEach(b => {
        if (b.type === 'paragraph') {
            const texto = (b.paragraph?.rich_text || []).map(r => r.plain_text || r.text?.content || "").join(" ");
            fullText += " " + texto;
        }
    });

    const tfidf = new natural.TfIdf();
    tfidf.addDocument(fullText);

    let keywords = [];
    tfidf.listTerms(0).forEach(item => {
        const palavra = item.term.trim().toLowerCase();
        if (
            palavra.length > 2 &&
            !stopSet.has(palavra) &&
            !palavra.match(/^[0-9]+$/)
        ) {
            keywords.push(palavra);
        }
    });

    // 3. Headings como tags (limpos)
    let headingTags = headings.map(cleanHeading)
        .filter(t => t.length > 2 && !stopSet.has(t.toLowerCase()));

    // Remove duplicatas, mantem contexto principal primeiro
    let tags = [contextTag, ...headingTags, ...keywords]
        .map(tag => tag && tag.trim())
        .filter(Boolean)
        .map(tag => tag.charAt(0).toUpperCase() + tag.slice(1)); // Capitaliza

    console.log("Contexto principal:", contextTag);
    console.log("Headings encontrados:", headingTags);
    console.log("Keywords extraídas:", keywords);

    tags = Array.from(new Set(tags));

    console.log("Tags únicas:", tags);

    // Limita a 5
    tags = tags.map(t => t.trim())
        .filter(isTagOk)
        .slice(0, maxTags);

    console.log("Tags finais:", tags);

    return tags;
}



// Utilidade: Buscar página pelo título dentro do database
// Corrigido para detectar dinamicamente o nome do campo do tipo "title"
async function searchPageByTitle(notion, databaseId, title) {
    // Busca o schema do database para descobrir o campo de título correto
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

/**
 * Limpa tags ruins do banco Notion, deixando apenas tags que:
 * - Não são stopwords
 * - Têm pelo menos 3 letras
 * - Têm no máximo 3 palavras relevantes
 * - Só contém letras/números/espaço/hífen
 * - Mantém obrigatoriamente o contexto principal, se passado
 */
async function limparTagsRuins(notion, databaseId, stopwords, contextoObrigatorio = null) {
    // 1. Busca o schema do banco
    const db = await notion.databases.retrieve({ database_id: databaseId });
    const tagPropEntry = Object.entries(db.properties).find(
        ([key, val]) => val.type === "multi_select" && key.toLowerCase().includes("tag")
    );
    if (!tagPropEntry) throw new Error("Campo de tags não encontrado.");

    const tagPropName = tagPropEntry[0];
    let options = tagPropEntry[1].multi_select.options || [];

    const stopSet = new Set(stopwords.map(s => s.toLowerCase()));

    // Função que conta só as palavras relevantes
    function countRelevantWords(tag) {
        return tag.split(/\s+/).filter(w => !stopSet.has(w.toLowerCase())).length;
    }

    // Nova: mantém até 3 palavras "úteis" (ignorando stopwords)
    function isTagBoa(opt) {
        if (!opt.name || opt.name.trim().length < 3) return false;
        if (!/^[a-zA-ZÀ-ÿ0-9\s\-]+$/.test(opt.name)) return false;
        if (stopSet.has(opt.name.toLowerCase())) return false;
        // Limita a 3 palavras relevantes (ignorando de, do, da, etc)
        if (countRelevantWords(opt.name) > 3) return false;
        // Não permite tags só de números ou hífens
        if (/^[\d\s\-]+$/.test(opt.name)) return false;
        return true;
    }

    let tagsBoas = options.filter(isTagBoa);

    // 3. Mantém contexto principal como primeira, mesmo se seria removida
    if (contextoObrigatorio) {
        const found = options.find(opt =>
            opt.name.toLowerCase() === contextoObrigatorio.toLowerCase()
        );
        if (found && !tagsBoas.some(t => t.name.toLowerCase() === found.name.toLowerCase())) {
            tagsBoas.unshift(found);
        }
    }

    // 4. Remove duplicadas
    const seen = new Set();
    tagsBoas = tagsBoas.filter(opt => {
        if (seen.has(opt.name.toLowerCase())) return false;
        seen.add(opt.name.toLowerCase());
        return true;
    });

    // 5. Atualiza o schema no Notion
    await notion.databases.update({
        database_id: databaseId,
        properties: {
            [tagPropName]: {
                multi_select: {
                    options: tagsBoas
                }
            }
        }
    });

    // 6. Relatório detalhado
    return {
        totalAntes: options.length,
        totalDepois: tagsBoas.length,
        removidas: options.length - tagsBoas.length,
        tagsRemovidas: options.filter(opt => !tagsBoas.find(t => t.id === opt.id)).map(opt => opt.name),
        tagsMantidas: tagsBoas.map(opt => opt.name)
    };
}



// Utilidade: Buscar/cadastrar tags por nome (usando options do banco)
/**
 * Busca/cria opções de multi_select (tags) por nome, sempre retornando com ID e name.
 * Se alguma tag não existir, cria antes no schema do banco e retorna já pronta pra página.
 *
 * @param {Client} notion - Instância do Notion API.
 * @param {string} databaseId - ID do database.
 * @param {string[]|string} tagNames - Lista de nomes de tags ou string única/com vírgula.
 * @returns {Promise<Array<{id: string, name: string}>>}
 */
async function getOrCreateTags(notion, databaseId, tagNames) {
    // Garante array limpo
    if (!Array.isArray(tagNames)) {
        if (!tagNames) tagNames = [];
        else if (typeof tagNames === "string") tagNames = tagNames.split(",").map(t => t.trim()).filter(Boolean);
        else tagNames = [String(tagNames)];
    }

    // 1. Busca o schema do banco
    const db = await notion.databases.retrieve({ database_id: databaseId });

    // 2. Encontra o campo multi_select de tags
    const tagPropEntry = Object.entries(db.properties).find(
        ([key, val]) => val.type === "multi_select" && key.toLowerCase().includes("tag")
    );
    if (!tagPropEntry) return [];

    const tagPropName = tagPropEntry[0];
    let options = tagPropEntry[1].multi_select.options || [];

    // 3. Descobre quais tags faltam (ainda não existem)
    const tagsQueFaltam = tagNames.filter(tagName =>
        !options.some(opt => opt.name.toLowerCase() === tagName.toLowerCase())
    );

    // 4. Se precisar criar novas tags, atualiza o schema
    if (tagsQueFaltam.length) {
        await notion.databases.update({
            database_id: databaseId,
            properties: {
                [tagPropName]: {
                    multi_select: {
                        options: [
                            ...options,
                            ...tagsQueFaltam.map(t => ({
                                name: t,
                                color: getRandomNotionColor()
                            }))
                        ]
                    }
                }
            }
        });
        // Atualiza as opções, agora já com os novos IDs
        const dbAtualizado = await notion.databases.retrieve({ database_id: databaseId });
        options = dbAtualizado.properties[tagPropName].multi_select.options;
    }

    // 5. Sempre retorna a lista de tags com id+name (usando options atualizadas)
    return tagNames.map(tagName => {
        const found = options.find(o => o.name.toLowerCase() === tagName.toLowerCase());
        return found ? { id: found.id, name: found.name } : { name: tagName };
    });
}

function getRandomNotionColor() {
    const colors = [
        "default", "gray", "brown", "orange",
        "yellow", "green", "blue", "purple", "pink", "red"
    ];
    // Pega uma cor aleatória
    return colors[Math.floor(Math.random() * colors.length)];
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Helper para garantir que só manda propriedades válidas
function filterValidProperties(inputProps, dbProperties) {
    if (!inputProps) return {};
    const dbPropKeys = Object.keys(dbProperties);
    return Object.fromEntries(
        Object.entries(inputProps)
            .filter(([key]) => dbPropKeys.includes(key))
    );
}

// Criação de páginas, subpáginas e artigos (mantendo a hierarquia)
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
    // 1. Busca o database principal pelo nome
    const db = await searchDatabaseByName(notion, databaseName);
    if (!db) throw new Error("Database não encontrado: " + databaseName);

    // 2. Nome do campo de título (title)
    const titlePropName = Object.entries(db.properties).find(
        ([, val]) => val.type === "title"
    )[0];

    // 3. Nome do campo tags (multi_select)
    const tagPropName = Object.entries(db.properties).find(
        ([, val]) => val.type === "multi_select"
    )?.[0];

    // 4. Nome do campo relation correto (página principal)
    const relationPropName = Object.entries(db.properties).find(
        ([key, val]) => val.type === "relation" && key === "página principal"
    )?.[0];

    // 5. Busca parent (tema, se for subpágina)
    let parentPage = null;
    if (parentTitle) parentPage = await searchPageByTitle(notion, db.id, parentTitle);

    // 6. Busca página pelo título (já existente)
    let page = await searchPageByTitle(notion, db.id, pageTitle);

    // 7. Garante as tags (ou array vazio)
    const tagsReady = tagPropName ? await getOrCreateTags(notion, db.id, tags) : [];

    // 8. Filtra outros campos para garantir que só manda o que o banco aceita
    const validOtherProps = filterValidProperties(otherProps, db.properties);

    const emoji = getEmojiForCallout(pageTitle);
    const titleWithEmoji = emoji && !pageTitle.startsWith(emoji) ? `${emoji} ${pageTitle}` : pageTitle;

    // 9. Monta as propriedades de forma dinâmica
    const properties = {
        [titlePropName]: { title: [{ text: { content: titleWithEmoji } }] },
        ...(tagPropName && { [tagPropName]: { multi_select: tagsReady } }),
        ...validOtherProps
    };

    // Só adiciona relation se for subpágina E parentPage E campo relation certo
    if (asSubpage && parentPage && relationPropName) {
        properties[relationPropName] = { relation: [{ id: parentPage.id }] };
    }

    // Debug visual (log bonito do que está indo pro Notion)
    console.log("🚩 Properties enviadas para o Notion:", JSON.stringify(properties, null, 2));

    // 10. Conteúdo como blocks Notion (usando formatter)
    const childrenBlocks = contentMd ? createEnhancedNotionBlocks(contentMd) : [];

    // 11. Cria se não existir, retorna sempre a página
    if (!page) {
        page = await notion.pages.create({
            parent: { database_id: db.id },
            properties,
            children: childrenBlocks
        });
    }
    return page;
}

// Endpoint principal
app.post("/create-notion-content", async (req, res) => {
    try {
        const {
            notion_token,
            nome_database = "Me Passa A Cola (GPT)",
            tema,
            subtitulo,
            tipo = "Resumo",
            resumo,
            tags = [],
            data,
            as_subpage = false, // pode ignorar, vamos garantir pela lógica
            parent_title,
            ...outrasProps
        } = req.body;

        if (!notion_token) return res.status(400).json({ error: "Token do Notion é obrigatório." });
        if (!tema && !subtitulo) return res.status(400).json({ error: "Tema ou subtítulo são obrigatórios." });

        const notion = new Client({ auth: notion_token });

        // 1. SEMPRE busca ou cria o tema (página principal), se informado
        let temaPage = null;
        if (tema) {
            temaPage = await getOrCreatePage({
                notion,
                databaseName: nome_database,
                pageTitle: tema,
                tags,
            });
        }

        // 2. Cria subpágina SOMENTE se subtítulo for enviado
        let contentPage = null;
        if (subtitulo) {
            let parentTitle = null;
            let subpageFlag = false;

            // Se tem tema, obrigatoriamente a subpágina será filha dele
            if (temaPage) {
                // Usa o mesmo título do tema encontrado/criado como parentTitle
                parentTitle = temaPage.properties[Object.keys(temaPage.properties).find(k => temaPage.properties[k].type === "title")].title[0].plain_text;
                subpageFlag = true;
            }

            // Se NÃO tem tema, cria página normalmente (root do banco)
            contentPage = await getOrCreatePage({
                notion,
                databaseName: nome_database,
                pageTitle: subtitulo,
                tags,
                parentTitle: parentTitle,
                asSubpage: subpageFlag,
                contentMd: resumo,
                otherProps: {
                    ...(data && { Data: { date: { start: data } } }),
                    Tipo: { select: { name: tipo } },
                    ...outrasProps
                }
            });
        }

        res.json({
            ok: true,
            temaUrl: temaPage ? temaPage.url : undefined,
            pageUrl: contentPage ? contentPage.url : undefined,
            id: contentPage ? contentPage.id : temaPage ? temaPage.id : undefined,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

app.post("/create-notion-flashcards", async (req, res) => {
    try {
        const {
            notion_token,
            nome_database = "Me Passa A Cola (GPT)",
            tema,
            subtitulo = "Flashcards",
            tags = [],
            flashcards = [],
            data,
            ...outrasProps
        } = req.body;

        if (!notion_token) return res.status(400).json({ error: "Token do Notion é obrigatório." });
        if (!tema) return res.status(400).json({ error: "Tema é obrigatório." });

        const notion = new Client({ auth: notion_token });

        // 1. Busca/cria o tema (página principal)
        const temaPage = await getOrCreatePage({
            notion,
            databaseName: nome_database,
            pageTitle: tema,
            tags
        });

        const flashcardsMd = (flashcards || []).map(
            card => `**Q:** ${card.pergunta}\n\n**A:** ${card.resposta}\n---`
        ).join('\n');

        // 2. Cria a página “Flashcards [Tema]” como subpágina do tema
        const flashcardsPage = await getOrCreatePage({
            notion,
            databaseName: nome_database,
            pageTitle: subtitulo,
            tags,
            parentTitle: tema,
            asSubpage: true,
            contentMd: flashcardsMd,
            otherProps: {
                ...(data && { Data: { date: { start: data } } }),
                Tipo: { select: { name: "Flashcards" } },
                ...outrasProps
            }
        });

        // 3. Para cada flashcard, cria uma subpágina dentro da FlashcardsPage
        const promises = (flashcards || []).map(async (card, i) => {
            if (!card.pergunta || !card.resposta) return null;
            const cardTitle = card.pergunta.length > 45 ? card.pergunta.substring(0, 45) + "..." : card.pergunta;

            // Adiciona tags de flashcard, pode personalizar
            const cardTags = [...tags, "Flashcard"];

            // Corpo do flashcard em markdown
            const cardMd = `**Pergunta:** ${card.pergunta}\n\n**Resposta:** ${card.resposta}`;
            return getOrCreatePage({
                notion,
                databaseName: nome_database,
                pageTitle: cardTitle,
                tags: cardTags,
                parentTitle: subtitulo,
                asSubpage: true,
                contentMd: cardMd,
                otherProps: {
                    ...(data && { Data: { date: { start: data } } }),
                    Tipo: { select: { name: "Flashcard" } },
                }
            });
        });

        const createdCards = await Promise.all(promises);

        res.json({
            ok: true,
            temaUrl: temaPage.url,
            flashcardsUrl: flashcardsPage.url,
            flashcardIds: createdCards.filter(Boolean).map(card => card.id)
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

app.get("/notion-content", async (req, res) => {
    try {
        const {
            notion_token,
            nome_database = "Me Passa A Cola (GPT)",
            tema,
            subtitulo,
            tipo,       // "Resumo", "Flashcards", etc.
            limit = 10
        } = req.query;

        if (!notion_token) return res.status(400).json({ error: "Token do Notion é obrigatório." });

        const notion = new Client({ auth: notion_token });

        // Busca o banco de dados
        const db = await searchDatabaseByName(notion, nome_database);
        if (!db) return res.status(404).json({ error: "Database não encontrado." });

        // Monta o filtro dinâmico
        const filters = [];
        if (tema) {
            filters.push({
                property: Object.entries(db.properties).find(([, v]) => v.type === "title")[0],
                title: { equals: tema }
            });
        }
        if (subtitulo) {
            filters.push({
                property: Object.entries(db.properties).find(([, v]) => v.type === "title")[0],
                title: { equals: subtitulo }
            });
        }
        if (tipo) {
            filters.push({
                property: "Tipo",
                select: { equals: tipo }
            });
        }

        // Consulta as páginas
        const response = await notion.databases.query({
            database_id: db.id,
            filter: filters.length === 1 ? filters[0] : (filters.length > 1 ? { and: filters } : undefined),
            page_size: Number(limit) || 10,
        });

        // Monta o array de resultados
        const results = await Promise.all(response.results.map(async page => {
            const titleProp = Object.entries(page.properties).find(([, v]) => v.type === "title")[0];
            const tagsProp = Object.entries(page.properties).find(([, v]) => v.type === "multi_select")?.[0];
            const tipoProp = page.properties.Tipo?.select?.name || null;
            const dataProp = page.properties.Data?.date?.start || null;

            // Busca blocos do conteúdo
            let blocks = [];
            try {
                const blockRes = await notion.blocks.children.list({ block_id: page.id });
                blocks = blockRes.results.map(block => {
                    if (block.type === "paragraph" || block.type === "bulleted_list_item" || block.type === "numbered_list_item") {
                        return block[block.type].rich_text.map(r => r.plain_text).join("");
                    }
                    if (block.type === "table") {
                        // (Opcional: tratar tabelas com mais detalhes)
                        return "[tabela]";
                    }
                    if (block.type === "heading_1" || block.type === "heading_2" || block.type === "heading_3") {
                        return "#".repeat(Number(block.type.replace("heading_", ""))) + " " +
                            block[block.type].rich_text.map(r => r.plain_text).join("");
                    }
                    if (block.type === "quote") {
                        return "> " + block[block.type].rich_text.map(r => r.plain_text).join("");
                    }
                    if (block.type === "code") {
                        return "```" + (block[block.type].language || "") + "\n" +
                            block[block.type].rich_text.map(r => r.plain_text).join("") + "\n```";
                    }
                    // Outros tipos...
                    return "[bloco não tratado]";
                });
            } catch { /* ignora erro */ }

            return {
                id: page.id,
                title: page.properties[titleProp]?.title?.[0]?.plain_text || "",
                tags: tagsProp ? page.properties[tagsProp]?.multi_select?.map(t => t.name) : [],
                tipo: tipoProp,
                data: dataProp,
                url: page.url,
                blocks
            };
        }));

        res.json({ ok: true, results });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

app.post("/atualizar-titulos-e-tags", async (req, res) => {
    try {
        const {
            notion_token,
            nome_database = "Me Passa A Cola (GPT)",
            tema
        } = req.body;

        if (!notion_token) return res.status(400).json({ error: "Token do Notion é obrigatório." });
        if (!tema) return res.status(400).json({ error: "Tema é obrigatório." });

        const notion = new Client({ auth: notion_token });

        // 1. Busca o database
        const db = await searchDatabaseByName(notion, nome_database);
        if (!db) return res.status(404).json({ error: "Database não encontrado." });

        // Props
        const titleProp = Object.entries(db.properties).find(([, v]) => v.type === "title")[0];
        const tagProp = Object.entries(db.properties).find(([, v]) => v.type === "multi_select")?.[0];

        // 2. Busca página tema
        const temaPage = await searchPageByTitle(notion, db.id, tema);
        if (!temaPage) return res.status(404).json({ error: "Página do tema não encontrada." });

        // 3. Pega IDs das subpáginas (via campo "Subpágina")
        const subpaginasIds = (temaPage.properties['Subpágina']?.relation || []).map(r => r.id);
        if (!subpaginasIds.length) return res.json({ ok: true, atualizadas: [], msg: "Nenhuma subpágina encontrada." });

        const atualizadas = [];
        for (const subId of subpaginasIds) {
            const subpage = await notion.pages.retrieve({ page_id: subId });
            const verifObj = subpage.properties.Verificação?.verification;
            if (!verifObj || verifObj.state !== "unverified") continue;

            // Busca primeiro H1 dos blocks
            const blocksResp = await notion.blocks.children.list({ block_id: subId, page_size: 20 });
            const h1block = blocksResp.results.find(b => b.type === "heading_1");
            const novoTitulo = h1block
                ? h1block.heading_1.rich_text.map(rt => rt.plain_text).join("").trim()
                : subpage.properties[titleProp]?.title?.[0]?.plain_text || "";

            // Tags: mantem as atuais
            const resultado = await limparTagsRuins(notion, db.id, STOPWORDS);
            console.log("Limpeza de tags:", resultado);
            const dbAtual = await notion.databases.retrieve({ database_id: db.id });
            const tagOptions = dbAtual.properties[tagProp].multi_select.options;

            const blockRes = await notion.blocks.children.list({ block_id: subpage.id });
            const tagsAuto = extractTagsSmart(blockRes.results, 2);

            let tags = subpage.properties[tagProp]?.multi_select?.map(t => ({ id: t.id, name: t.name })) || [];
            const dbTagsOptions = Object.values(db.properties[tagProp].multi_select.options);

            tagsAuto.forEach(t => {
                const found = dbTagsOptions.find(opt => opt.name.toLowerCase() === t.toLowerCase());
                if (!tags.some(tag => tag.name.toLowerCase() === t.toLowerCase())) {
                    tags.push(found ? { id: found.id, name: found.name } : { name: t });
                }


            });
            await getOrCreateTags(notion, db.id, tags.map(t => t.name));

            await sleep(500); // Aguardar 500ms para evitar rate limit

            const tagsParaPagina = reconcileTags(tags, tagOptions);

            console.log(
                `Atualizado: ${subId} - Novo título: ${novoTitulo}, Tags:`,
                tagsParaPagina.map(t => t.name).join(", ")
            );

            await notion.pages.update({
                page_id: subId,
                properties: {
                    [titleProp]: { title: [{ text: { content: novoTitulo } }] },
                    ...(tagProp ? { [tagProp]: { multi_select: tagsParaPagina } } : {})
                }
            });
            atualizadas.push({ pageId: subId, newTitle: novoTitulo });
        }

        res.json({ ok: true, total: atualizadas.length, atualizadas });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// Para rodar local
if (require.main === module) {
    const port = process.env.PORT || 3333;
    app.listen(port, () => console.log(`API up at http://localhost:${port}`));
}

// Exporta o app juntamente com utilidades
module.exports = { app, getOrCreateTags };
