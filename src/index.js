try {
    require('dotenv').config();
} catch (err) {
    console.warn('dotenv not found, skipping');
}
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
const { cloneRepo, commitAndPush, listRepoFiles, readRepoFile } = require('./utils/git');
const {
    createIssue,
    updateIssue,
    closeIssue,
    listIssues,
    dispatchWorkflow,
    getWorkflowRun,
    createLabel,
    createMilestone,
    createProject,
    createProjectColumn,
    listProjects,
    listProjectColumns,
    addIssueToProject,
    createPullRequest,
    updatePullRequest,
    closePullRequest
} = require('./utils/github');
const { updateIssueProject } = require('./utils/linear');
const pdfParse = require('pdf-parse');
const fs = require('fs');
const path = require('path');
const swaggerUi = require('swagger-ui-express');
const { loadColaConfig, loadCommitTemplate } = require('./utils/cola-config');

function loadSwaggerDocs() {
    const dir = path.join(__dirname, '..', 'gpt');
    const files = fs.readdirSync(dir).filter(f => /^actions.*\.json$/.test(f));
    const specs = files.map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
    if (specs.length === 0) return {};
    const base = specs.shift();
    for (const spec of specs) {
        Object.assign(base.paths, spec.paths);
        if (spec.components && spec.components.schemas) {
            base.components = base.components || { schemas: {} };
            base.components.schemas = {
                ...base.components.schemas,
                ...spec.components.schemas,
            };
        }
    }
    return base;
}

const swaggerDocument = loadSwaggerDocs();

const app = express();
const API_TOKEN = process.env.API_TOKEN || '';
app.use(express.json());
// Expose Swagger documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
app.get('/api-docs.json', (req, res) => {
    res.json(swaggerDocument);
});
// Health check simples para validacao de deploy
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});
// Documentação estática gerada com Doca
app.use('/doca', express.static(path.join(__dirname, '..', 'docs')));

function loadTemplate(type, name = '') {
    try {
        const file = type === 'issue'
            ? path.join(__dirname, '..', '.github', 'ISSUE_TEMPLATE', `${name}.md`)
            : path.join(__dirname, '..', '.github', 'PULL_REQUEST_TEMPLATE.md');
        return fs.readFileSync(file, 'utf8');
    } catch (err) {
        return '';
    }
}

function parseGitHubRepo(url) {
    const match = url && url.match(/github\.com[:\/](.+?)\/(.+?)(?:\.git)?$/);
    if (!match) return { owner: '', repo: '' };
    return { owner: match[1], repo: match[2].replace(/\.git$/, '') };
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

            const extraProps = {
                ...(item.tipoEvento !== undefined && {
                    'Tipo de Evento': { select: { name: item.tipoEvento } }
                }),
                ...(item.participantes !== undefined && {
                    Participantes: { rich_text: [{ text: { content: String(item.participantes) } }] }
                }),
                ...(item.prioridade !== undefined && {
                    Prioridade: { select: { name: item.prioridade } }
                }),
                ...(item.lembrete !== undefined && {
                    Lembrete: { rich_text: [{ text: { content: String(item.lembrete) } }] }
                }),
                ...(item.status !== undefined && {
                    Status: { select: { name: item.status } }
                }),
                ...(item.notas !== undefined && {
                    Notas: { rich_text: [{ text: { content: String(item.notas) } }] }
                }),
                ...(item.local !== undefined && {
                    Local: { rich_text: [{ text: { content: String(item.local) } }] }
                }),
                ...(item.linkRelacionado !== undefined && {
                    'Link Relacionado': { url: String(item.linkRelacionado) }
                })
            };

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
                    ...extraProps,
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

app.post('/pdf-to-notion', async (req, res) => {
    try {
        const {
            notion_token,
            nome_database = 'Me Passa A Cola (GPT)',
            tema,
            subtitulo,
            pdf_base64,
            tags = [],
            data,
            ...outrasProps
        } = req.body;

        if (!notion_token) return res.status(400).json({ error: 'Token do Notion é obrigatório.' });
        if (!pdf_base64) return res.status(400).json({ error: 'PDF é obrigatório.' });
        if (!tema && !subtitulo) return res.status(400).json({ error: 'Tema ou subtítulo são obrigatórios.' });

        const notion = new Client({ auth: notion_token });

        const pdfBuffer = Buffer.from(pdf_base64, 'base64');
        const parsed = await pdfParse(pdfBuffer);
        const md = (parsed.text || '').trim();

        let temaPage = null;
        if (tema) {
            temaPage = await getOrCreatePage({
                notion,
                databaseName: nome_database,
                pageTitle: tema,
                tags
            });
        }

        const page = await getOrCreatePage({
            notion,
            databaseName: nome_database,
            pageTitle: subtitulo || 'Arquivo PDF',
            tags,
            parentTitle: temaPage ? tema : null,
            asSubpage: !!temaPage,
            contentMd: md,
            otherProps: {
                ...(data && { Data: { date: { start: data } } }),
                Tipo: { select: { name: 'PDF' } },
                ...outrasProps
            }
        });

        res.json({
            ok: true,
            temaUrl: temaPage ? temaPage.url : undefined,
            pageUrl: page.url,
            id: page.id
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

app.get('/git-files', async (req, res) => {
    if (req.header('x-api-token') !== API_TOKEN) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const { repoUrl, credentials, path: dir = '.' } = req.query;

    if (!repoUrl || !credentials) {
        return res.status(400).json({ error: 'repoUrl e credentials são obrigatórios' });
    }

    try {
        const repoPath = await cloneRepo(repoUrl, credentials);
        const files = await listRepoFiles(repoPath, dir);
        res.json({ ok: true, files });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/git-file', async (req, res) => {
    if (req.header('x-api-token') !== API_TOKEN) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const { repoUrl, credentials, file } = req.query;

    if (!repoUrl || !credentials || !file) {
        return res.status(400).json({ error: 'repoUrl, credentials e file são obrigatórios' });
    }

    try {
        const repoPath = await cloneRepo(repoUrl, credentials);
        const content = await readRepoFile(repoPath, file);
        res.json({ ok: true, content });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

app.patch('/git-file', async (req, res) => {
    if (req.header('x-api-token') !== API_TOKEN) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const {
        repoUrl,
        credentials,
        filePath,
        content,
        commitMessage,
        branch = 'main'
    } = req.body;

    if (!repoUrl || !credentials || !filePath) {
        return res.status(400).json({ error: 'repoUrl, credentials e filePath são obrigatórios' });
    }

    try {
        const repoPath = await cloneRepo(repoUrl, credentials);
        const config = loadColaConfig(repoPath);
        let finalMsg = commitMessage;
        if (!finalMsg) {
            const templatePath = config.commitTemplate || '.github/commit-template.md';
            finalMsg = loadCommitTemplate(repoPath, templatePath) || 'chore: update file';
        }
        const fullPath = path.join(repoPath, filePath);
        fs.mkdirSync(path.dirname(fullPath), { recursive: true });
        fs.writeFileSync(fullPath, content);

        await commitAndPush(repoPath, finalMsg, [fullPath], branch);

        const workflowId = config.commitWorkflow || config.workflow || config.workflow_id;
        if (workflowId) {
            const repoInfo = parseGitHubRepo(repoUrl);
            const owner = req.body.githubOwner || config.githubOwner || repoInfo.owner;
            const repo = req.body.githubRepo || config.githubRepo || repoInfo.repo;
            const token = req.body.githubToken || config.githubToken;
            if (token && owner && repo) {
                try {
                    await dispatchWorkflow({ token, owner, repo, workflow_id: workflowId, ref: branch });
                } catch (wErr) {
                    console.warn('Falha ao acionar workflow:', wErr.message);
                }
            }
        }

        res.json({ ok: true });
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

    if (!repoUrl || !credentials) {
        return res.status(400).json({ error: 'repoUrl and credentials are required' });
    }

    try {
        const repoPath = await cloneRepo(repoUrl, credentials);
        const config = loadColaConfig(repoPath);
        let finalMsg = message;
        if (!finalMsg) {
            const templatePath = config.commitTemplate || '.github/commit-template.md';
            finalMsg = loadCommitTemplate(repoPath, templatePath) || 'chore: update files';
        }

        for (const [filePath, fileContent] of Object.entries(content)) {
            const fullPath = path.join(repoPath, filePath);
            fs.mkdirSync(path.dirname(fullPath), { recursive: true });
            fs.writeFileSync(fullPath, fileContent);
        }

        const pathsToAdd = files.map(f => path.join(repoPath, f));
        await commitAndPush(repoPath, finalMsg, pathsToAdd, branch);

        const workflowId = config.commitWorkflow || config.workflow || config.workflow_id;
        if (workflowId) {
            const repoInfo = parseGitHubRepo(repoUrl);
            const owner = req.body.githubOwner || config.githubOwner || repoInfo.owner;
            const repo = req.body.githubRepo || config.githubRepo || repoInfo.repo;
            const token = req.body.githubToken || config.githubToken;
            if (token && owner && repo) {
                try {
                    await dispatchWorkflow({ token, owner, repo, workflow_id: workflowId, ref: branch });
                } catch (wErr) {
                    console.warn('Falha ao acionar workflow:', wErr.message);
                }
            }
        }

        res.json({ ok: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/create-notion-content-git', async (req, res) => {
    if (req.header('x-api-token') !== API_TOKEN) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const {
            repoUrl,
            credentials,
            commitMessage,
            filePath,
            branch = 'main',
            ...notionData
        } = req.body;

        const {
            notion_token,
            nome_database = 'Me Passa A Cola (GPT)',
            tema,
            subtitulo,
            tipo = 'Resumo',
            resumo,
            tags = [],
            data,
            ...outrasProps
        } = notionData;

        if (!repoUrl || !credentials || !filePath) {
            return res.status(400).json({ error: 'repoUrl, credentials e filePath são obrigatórios' });
        }
        if (!notion_token) return res.status(400).json({ error: 'Token do Notion é obrigatório.' });
        if (!tema && !subtitulo) return res.status(400).json({ error: 'Tema ou subtítulo são obrigatórios.' });

        const notion = new Client({ auth: notion_token });

        let temaPage = null;
        if (tema) {
            temaPage = await getOrCreatePage({
                notion,
                databaseName: nome_database,
                pageTitle: tema,
                tags
            });
        }

        const blocks = createEnhancedNotionBlocks(resumo);
        const autoTags = extractTagsSmart(blocks, 5);
        const finalTags = Array.from(new Set([...(tags || []), ...autoTags]));

        let contentPage = null;
        if (subtitulo) {
            let parentTitle = null;
            let subpageFlag = false;

            if (temaPage) {
                parentTitle = temaPage.properties[Object.keys(temaPage.properties).find(k => temaPage.properties[k].type === 'title')].title[0].plain_text;
                subpageFlag = true;
            }

            contentPage = await getOrCreatePage({
                notion,
                databaseName: nome_database,
                pageTitle: subtitulo,
                tags: finalTags,
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

        const repoPath = await cloneRepo(repoUrl, credentials);
        const config = loadColaConfig(repoPath);
        let finalMsg = commitMessage;
        if (!finalMsg) {
            const templatePath = config.commitTemplate || '.github/commit-template.md';
            finalMsg = loadCommitTemplate(repoPath, templatePath) || 'chore: add content';
        }
        const fullPath = path.join(repoPath, filePath);
        fs.mkdirSync(path.dirname(fullPath), { recursive: true });
        fs.writeFileSync(fullPath, resumo);

        await commitAndPush(repoPath, finalMsg, [fullPath], branch);

        const workflowId = config.commitWorkflow || config.workflow || config.workflow_id;
        if (workflowId) {
            const repoInfo = parseGitHubRepo(repoUrl);
            const owner = req.body.githubOwner || config.githubOwner || repoInfo.owner;
            const repo = req.body.githubRepo || config.githubRepo || repoInfo.repo;
            const token = req.body.githubToken || config.githubToken;
            if (token && owner && repo) {
                try {
                    await dispatchWorkflow({ token, owner, repo, workflow_id: workflowId, ref: branch });
                } catch (wErr) {
                    console.warn('Falha ao acionar workflow:', wErr.message);
                }
            }
        }

        res.json({
            ok: true,
            pageUrl: contentPage ? contentPage.url : temaPage ? temaPage.url : undefined,
            gitFile: filePath,
            autoTags: finalTags
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// ----- GitHub Issues -----
app.post('/github-issues', async (req, res) => {
    const { token, owner, repo, title, body = '', labels = [], assignees = [], template, column_id } = req.body;
    if (!token || !owner || !repo || !title) {
        return res.status(400).json({ error: 'token, owner, repo e title são obrigatórios' });
    }
    try {
        const issueBody = body || (template ? loadTemplate('issue', template) : '');
        const issue = await createIssue({ token, owner, repo, title, body: issueBody, labels, assignees });
        let finalColumnId = column_id;
        if (!finalColumnId) {
            try {
                const projects = await listProjects({ token, owner, repo });
                if (projects.length > 0) {
                    const cols = await listProjectColumns({ token, project_id: projects[0].id });
                    if (cols.length > 0) finalColumnId = cols[0].id;
                }
            } catch (projErr) {
                console.warn('Falha ao obter projeto:', projErr.message);
            }
        }
        if (finalColumnId) {
            try {
                await addIssueToProject({ token, column_id: finalColumnId, issue_id: issue.node_id });
            } catch (projErr) {
                console.warn('Falha ao adicionar issue ao projeto:', projErr.message);
            }
        }
        res.json({ ok: true, issue });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

app.patch('/github-issues/:number', async (req, res) => {
    const { token, owner, repo } = req.body;
    const { number } = req.params;
    if (!token || !owner || !repo) {
        return res.status(400).json({ error: 'token, owner e repo são obrigatórios' });
    }
    try {
        const issue = await updateIssue({ token, owner, repo, issue_number: number, ...req.body });
        res.json({ ok: true, issue });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

app.delete('/github-issues/:number', async (req, res) => {
    const { token, owner, repo } = req.body;
    const { number } = req.params;
    if (!token || !owner || !repo) {
        return res.status(400).json({ error: 'token, owner e repo são obrigatórios' });
    }
    try {
        const issue = await closeIssue({ token, owner, repo, issue_number: number });
        res.json({ ok: true, issue });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/github-issues', async (req, res) => {
    const { token, owner, repo, state = 'open', labels = '' } = req.query;
    if (!token || !owner || !repo) {
        return res.status(400).json({ error: 'token, owner e repo são obrigatórios' });
    }
    try {
        const issues = await listIssues({ token, owner, repo, state, labels });
        res.json({ ok: true, issues });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/github-labels', async (req, res) => {
    const { token, owner, repo, name, color = 'ffffff', description = '' } = req.body;
    if (!token || !owner || !repo || !name) {
        return res.status(400).json({ error: 'token, owner, repo e name são obrigatórios' });
    }
    try {
        const label = await createLabel({ token, owner, repo, name, color, description });
        res.json({ ok: true, label });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/github-milestones', async (req, res) => {
    const { token, owner, repo, title, state = 'open', description = '', due_on } = req.body;
    if (!token || !owner || !repo || !title) {
        return res.status(400).json({ error: 'token, owner, repo e title são obrigatórios' });
    }
    try {
        const milestone = await createMilestone({ token, owner, repo, title, state, description, due_on });
        res.json({ ok: true, milestone });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/github-projects', async (req, res) => {
    const { token, owner, repo, name, body = '' } = req.body;
    if (!token || !owner || !repo || !name) {
        return res.status(400).json({ error: 'token, owner, repo e name são obrigatórios' });
    }
    try {
        const project = await createProject({ token, owner, repo, name, body });
        res.json({ ok: true, project });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/github-projects/:project_id/columns', async (req, res) => {
    const { token, name } = req.body;
    const { project_id } = req.params;
    if (!token || !project_id || !name) {
        return res.status(400).json({ error: 'token, project_id e name são obrigatórios' });
    }
    try {
        const column = await createProjectColumn({ token, project_id, name });
        res.json({ ok: true, column });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/github-projects/columns/:column_id/cards', async (req, res) => {
    const { token, issue_id } = req.body;
    const { column_id } = req.params;
    if (!token || !column_id || !issue_id) {
        return res.status(400).json({ error: 'token, column_id e issue_id são obrigatórios' });
    }
    try {
        const card = await addIssueToProject({ token, column_id, issue_id });
        res.json({ ok: true, card });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/github-projects', async (req, res) => {
    const { token, owner, repo } = req.query;
    if (!token || !owner || !repo) {
        return res.status(400).json({ error: 'token, owner e repo são obrigatórios' });
    }
    try {
        const projects = await listProjects({ token, owner, repo });
        res.json({ ok: true, projects });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/github-projects/:project_id/columns', async (req, res) => {
    const { token } = req.query;
    const { project_id } = req.params;
    if (!token || !project_id) {
        return res.status(400).json({ error: 'token e project_id são obrigatórios' });
    }
    try {
        const columns = await listProjectColumns({ token, project_id });
        if (!columns.length) {
            return res.json({ ok: true, columns: [], msg: 'Nenhuma coluna encontrada.' });
        }
        res.json({ ok: true, columns });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/github-pulls', async (req, res) => {
    const { token, owner, repo, title, head, base, body = '' } = req.body;
    if (!token || !owner || !repo || !title || !head || !base) {
        return res.status(400).json({ error: 'token, owner, repo, title, head e base são obrigatórios' });
    }
    try {
        const prBody = body || loadTemplate('pr');
        const pull = await createPullRequest({ token, owner, repo, title, head, base, body: prBody });
        res.json({ ok: true, pull });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

app.patch('/github-pulls/:number', async (req, res) => {
    const { token, owner, repo } = req.body;
    const { number } = req.params;
    if (!token || !owner || !repo) {
        return res.status(400).json({ error: 'token, owner e repo são obrigatórios' });
    }
    try {
        const pull = await updatePullRequest({ token, owner, repo, pull_number: number, ...req.body });
        res.json({ ok: true, pull });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

app.delete('/github-pulls/:number', async (req, res) => {
    const { token, owner, repo } = req.body;
    const { number } = req.params;
    if (!token || !owner || !repo) {
        return res.status(400).json({ error: 'token, owner e repo são obrigatórios' });
    }
    try {
        const pull = await closePullRequest({ token, owner, repo, pull_number: number });
        res.json({ ok: true, pull });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// ----- GitHub Workflows -----
app.post('/github-workflows/dispatch', async (req, res) => {
    const { token, owner, repo, workflow_id, ref = 'main', inputs = {} } = req.body;
    if (!token || !owner || !repo || !workflow_id) {
        return res.status(400).json({ error: 'token, owner, repo e workflow_id são obrigatórios' });
    }
    try {
        await dispatchWorkflow({ token, owner, repo, workflow_id, ref, inputs });
        res.json({ ok: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/github-workflows/status', async (req, res) => {
    const { token, owner, repo, run_id } = req.query;
    if (!token || !owner || !repo || !run_id) {
        return res.status(400).json({ error: 'token, owner, repo e run_id são obrigatórios' });
    }
    try {
        const run = await getWorkflowRun({ token, owner, repo, run_id });
        res.json({ ok: true, run });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/linear-issues/project', async (req, res) => {
    const { token, issue_id, project_id } = req.body;
    if (!token || !issue_id || !project_id) {
        return res.status(400).json({ error: 'token, issue_id e project_id são obrigatórios' });
    }
    try {
        const result = await updateIssueProject({ token, issueId: issue_id, projectId: project_id });
        res.json({ ok: true, result });
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
