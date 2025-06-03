// index.js
const express = require('express');
const { Client } = require('@notionhq/client');
const { createEnhancedNotionBlocks, getEmojiForCallout } = require('./formatter');

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

function extractTagsSmart(blocks) {
    // Stopwords comuns (você pode expandir)
    const stopwords = [
        'de', 'a', 'o', 'e', 'do', 'da', 'os', 'as', 'em', 'um', 'uma', 'para', 'com', 'no', 'na', 'por', 'que', 'se', 'é', 'ao', 'dos',
        'das', 'ou', 'pelo', 'pela', 'ser', 'ter', 'mais', 'menos', 'sobre', 'entre', 'muito', 'pouco', 'como', 'até'
    ];

    // Junta textos de headings e parágrafos
    const allTexts = blocks
        .filter(b => ['heading_1', 'heading_2', 'paragraph'].includes(b.type))
        .flatMap(b => (b[b.type]?.rich_text || []))
        .map(rt => rt.plain_text)
        .join(' ')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // Remove acentos

    // Divide em palavras e filtra stopwords, números, palavras curtas
    const keywords = allTexts
        .split(/\W+/)
        .map(w => w.toLowerCase().trim())
        .filter(w =>
            w.length > 2 &&
            !stopwords.includes(w) &&
            !/^\d+$/.test(w)
        );

    // Conta frequência de cada palavra
    const freq = {};
    keywords.forEach(word => { freq[word] = (freq[word] || 0) + 1; });

    // Seleciona as top palavras mais frequentes (você pode ajustar o limite)
    const top = Object.entries(freq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6) // top 6 tags
        .map(([w]) => w);

    // Remove duplicadas
    return Array.from(new Set(top));
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
            const blockRes = await notion.blocks.children.list({ block_id: subpage.id });
            const tagsAuto = extractTagsSmart(blockRes.results);

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

            // Atualiza a página
            await notion.pages.update({
                page_id: subId,
                properties: {
                    [titleProp]: { title: [{ text: { content: novoTitulo } }] },
                    ...(tagProp ? { [tagProp]: { multi_select: tags } } : {})
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
