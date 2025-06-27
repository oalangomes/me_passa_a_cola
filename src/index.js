// index.js
const express = require('express');
const { Client } = require('@notionhq/client');
const { createEnhancedNotionBlocks, getEmojiForCallout } = require('./formatter');
const { STOPWORDS, reconcileTags, extractTagsSmart } = require('./utils/tags');
const {
    searchDatabaseByName,
    searchPageByTitle,
    limparTagsRuins,
    removerTagsOrfas,
    getOrCreateTags,
    filterValidProperties,
    getOrCreatePage,
    sleep
} = require('./utils/notion');
const { cloneRepo, commitAndPush } = require('./utils/git');
const fs = require('fs');
const path = require('path');
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('../gpt/actions.json');

const app = express();
const API_TOKEN = process.env.API_TOKEN || '';
app.use(express.json());
// Expose Swagger documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

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

app.post('/create-notion-cronograma', async (req, res) => {
    try {
        const {
            notion_token,
            nome_database = 'Me Passa A Cola (GPT)',
            tema,
            cronograma = [],
            tags = [],
            ...outrasProps
        } = req.body;

        if (!notion_token) return res.status(400).json({ error: 'Token do Notion é obrigatório.' });
        if (!tema) return res.status(400).json({ error: 'Tema é obrigatório.' });
        if (!Array.isArray(cronograma) || cronograma.length === 0) return res.status(400).json({ error: 'Cronograma deve ser uma lista.' });

        const notion = new Client({ auth: notion_token });

        const temaPage = await getOrCreatePage({
            notion,
            databaseName: nome_database,
            pageTitle: tema,
            tags
        });

        const created = [];
        for (const item of cronograma) {
            if (!item.atividade) continue;
            const page = await getOrCreatePage({
                notion,
                databaseName: nome_database,
                pageTitle: item.atividade,
                tags: [...tags, 'Cronograma'],
                parentTitle: tema,
                asSubpage: true,
                contentMd: item.descricao || '',
                otherProps: {
                    ...(item.data && { Data: { date: { start: item.data } } }),
                    Tipo: { select: { name: 'Cronograma' } },
                    ...outrasProps
                }
            });
            created.push(page.id);
        }

        res.json({ ok: true, temaUrl: temaPage.url, atividades: created });
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

        const titlePropName = Object.entries(db.properties).find(([, v]) => v.type === "title")[0];
        const relationPropName = Object.entries(db.properties).find(
            ([key, val]) => val.type === "relation" && key === "página principal"
        )?.[0];

        if (subtitulo) {
            filters.push({
                property: titlePropName,
                title: { equals: subtitulo }
            });
        }

        if (tema && relationPropName) {
            const temaPage = await searchPageByTitle(notion, db.id, tema);
            if (temaPage) {
                filters.push({
                    property: relationPropName,
                    relation: { contains: temaPage.id }
                });
            }
        } else if (tema) {
            filters.push({
                property: titlePropName,
                title: { equals: tema }
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

app.post('/limpar-tags-orfas', async (req, res) => {
    try {
        const {
            notion_token,
            nome_database = 'Me Passa A Cola (GPT)'
        } = req.body;

        if (!notion_token) return res.status(400).json({ error: 'Token do Notion é obrigatório.' });

        const notion = new Client({ auth: notion_token });
        const db = await searchDatabaseByName(notion, nome_database);
        if (!db) return res.status(404).json({ error: 'Database não encontrado.' });

        const resultado = await removerTagsOrfas(notion, db.id);
        res.json({ ok: true, ...resultado });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/git-commit', async (req, res) => {
    if (req.header('x-api-token') !== API_TOKEN) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const {
        repoUrl,
        credentials,
        message,
        files = [],
        branch = 'main',
        content = {}
    } = req.body;

    if (!repoUrl || !credentials || !message) {
        return res.status(400).json({ error: 'repoUrl, credentials and message are required' });
    }

    try {
        const repoPath = await cloneRepo(repoUrl, credentials);

        for (const [filePath, fileContent] of Object.entries(content)) {
            const fullPath = path.join(repoPath, filePath);
            fs.mkdirSync(path.dirname(fullPath), { recursive: true });
            fs.writeFileSync(fullPath, fileContent);
        }

        const pathsToAdd = files.map(f => path.join(repoPath, f));
        await commitAndPush(repoPath, message, pathsToAdd, branch);

        res.json({ ok: true });
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
