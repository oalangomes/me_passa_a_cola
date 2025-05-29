// index.js - Com endpoint para Flashcards
require("dotenv").config();
const express = require("express");
const { Client } = require("@notionhq/client");
const { createEnhancedNotionBlocks, parseRichText } = require("./formatter"); // Importar parseRichText se Verso for bloco

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const ROOT_PAGE_TITLE = "Me Passa A Cola (GPT)";

// --- Funções Auxiliares (findOrCreatePage, getDatabaseSchema, findOrCreateDatabase - sem alterações) --- //

/**
 * Encontra ou cria uma página no Notion.
 * @param {Client} notionClient - Instância do cliente Notion autenticado.
 * @param {string} title - Título da página a ser encontrada/criada.
 * @param {string|null} parentPageId - ID da página pai (null para criar na raiz do workspace).
 * @returns {Promise<string>} - ID da página encontrada ou criada.
 */
async function findOrCreatePage(notionClient, title, parentPageId = null) {
    try {
        const searchResponse = await notionClient.search({
            query: title,
            filter: { property: "object", value: "page" },
            page_size: 10
        });

        let foundPage = searchResponse.results.find(page =>
            page.properties &&
            page.properties.title &&
            page.properties.title.title &&
            page.properties.title.title[0] &&
            page.properties.title.title[0].plain_text === title &&
            (parentPageId ? page.parent && page.parent.page_id === parentPageId : page.parent && page.parent.type === "workspace")
        );

        if (foundPage) {
            console.log(`Página encontrada: '${title}' (ID: ${foundPage.id})`);
            return foundPage.id;
        } else {
            console.log(`Página '${title}' não encontrada. Criando...`);
            const createParams = {
                parent: parentPageId ? { page_id: parentPageId } : { type: "workspace", workspace: true },
                properties: {
                    title: {
                        title: [{ type: "text", text: { content: title } }]
                    }
                }
            };
            const newPage = await notionClient.pages.create(createParams);
            console.log(`Página criada: '${title}' (ID: ${newPage.id})`);
            return newPage.id;
        }
    } catch (error) {
        console.error(`Erro ao encontrar/criar página '${title}':`, error.body || error.message);
        throw new Error(`Falha ao processar página '${title}'`);
    }
}

/**
 * Define o esquema padrão para um tipo de base de dados.
 * @param {string} type - Tipo de conteúdo (Resumo, Flashcard, Código, etc.).
 * @returns {object} - Objeto de propriedades para a criação da base de dados.
 */
function getDatabaseSchema(type) {
    const normalizedType = type.toLowerCase().includes("resumo") ? "resumo" :
        type.toLowerCase().includes("flashcard") ? "flashcard" :
            type.toLowerCase().includes("código") || type.toLowerCase().includes("aplicação") ? "código" :
                "padrão";

    switch (normalizedType) {
        case "flashcard":
            // Schema para Flashcards
            return {
                Frente: { title: {} }, // Coluna Title obrigatória
                Verso: { rich_text: {} }, // Coluna para o verso
                Tema: { multi_select: { options: [] } }, // Opcional, pode ser preenchido com o 'tema' geral
                "Data Revisão": { date: {} }, // Para controle de revisão espaçada, se desejado
                Tags: { multi_select: { options: [] } }, // Tags gerais
                Data: { date: {} } // Data de criação/referência
            };
        case "código":
            return {
                Nome: { title: {} },
                Linguagem: { select: { options: [] } },
                Descrição: { rich_text: {} },
                Tags: { multi_select: { options: [] } },
                Data: { date: {} }
            };
        case "resumo":
        default:
            return {
                Título: { title: {} },
                Subtítulo: { rich_text: {} },
                Tags: { multi_select: { options: [] } },
                Data: { date: {} }
            };
    }
}

/**
 * Encontra ou cria uma base de dados no Notion.
 * @param {Client} notionClient - Instância do cliente Notion autenticado.
 * @param {string} dbTitle - Título EXATO da base de dados (vem do request.nome_database).
 * @param {string} parentPageId - ID da página pai onde a base será criada.
 * @param {string} contentType - Tipo de conteúdo original do request (usado APENAS para definir o schema se precisar criar).
 * @returns {Promise<string>} - ID da base de dados encontrada ou criada.
 */
async function findOrCreateDatabase(notionClient, dbTitle, parentPageId, contentType) {
    try {
        const searchResponse = await notionClient.search({
            query: dbTitle,
            filter: { property: "object", value: "database" },
            page_size: 10
        });

        let foundDb = searchResponse.results.find(db =>
            db.title &&
            db.title[0] &&
            db.title[0].plain_text === dbTitle &&
            db.parent &&
            db.parent.page_id === parentPageId
        );


        if (foundDb) {
            console.log(`Base de dados encontrada: '${dbTitle}' (ID: ${foundDb.id})`);
            return foundDb.id;
        } else {
            console.log(`Base de dados '${dbTitle}' não encontrada. Criando...`);
            const newDb = await notionClient.databases.create({
                parent: { page_id: parentPageId },
                title: [{ type: "text", text: { content: dbTitle } }],
                properties: getDatabaseSchema(contentType),
                is_inline: false
            });
            console.log(`Base de dados criada: '${dbTitle}' (ID: ${newDb.id})`);
            return newDb.id;
        }
    } catch (error) {
        console.error(`Erro ao encontrar/criar base de dados '${dbTitle}':`, error.body || error.message);
        throw new Error(`Falha ao processar base de dados '${dbTitle}'`);
    }
}

// --- Rota para Resumos e Conteúdo Geral --- //

app.post("/create-notion-content", async (req, res) => {
    console.log("Recebida requisição para /create-notion-content");
    const {
        notion_token,
        nome_database,
        tema,
        subtitulo,
        tipo = "Resumo",
        resumo,
        tags,
        data
    } = req.body;

    if (!notion_token || !nome_database || !tema || !subtitulo || !resumo) {
        return res.status(400).json({
            error: "Dados incompletos: notion_token, nome_database, tema, subtitulo e resumo são obrigatórios.",
        });
    }

    const notion = new Client({ auth: notion_token });

    try {
        console.log(`Iniciando processo para DB: ${nome_database}, Tema: ${tema}, Tipo: ${tipo}, Subtítulo: ${subtitulo}`);
        const rootPageId = await findOrCreatePage(notion, ROOT_PAGE_TITLE);
        const themePageId = await findOrCreatePage(notion, tema, rootPageId);
        const databaseId = await findOrCreateDatabase(notion, nome_database, themePageId, tipo);

        const pageProperties = {};
        const dbSchema = getDatabaseSchema(tipo);
        const titlePropertyName = Object.keys(dbSchema).find(key => dbSchema[key].title);
        const pageTitleContent = `${tipo} - ${subtitulo} - ${(data ? new Date(data) : new Date()).toLocaleDateString("pt-BR")}`;

        if (titlePropertyName) {
            pageProperties[titlePropertyName] = { title: [{ text: { content: pageTitleContent } }] };
        } else {
            pageProperties["Nome"] = { title: [{ text: { content: pageTitleContent } }] };
        }

        const datePropertyName = Object.keys(dbSchema).find(key => dbSchema[key].date);
        if (datePropertyName) {
            try {
                pageProperties[datePropertyName] = { date: { start: data ? new Date(data).toISOString() : new Date().toISOString() } };
            } catch (dateError) {
                console.warn(`Data inválida fornecida ('${data}'). Usando data atual.`);
                pageProperties[datePropertyName] = { date: { start: new Date().toISOString() } };
            }
        }

        const tagsPropertyName = Object.keys(dbSchema).find(key => key.toLowerCase() === 'tags' && dbSchema[key].multi_select);
        if (tagsPropertyName && tags && typeof tags === 'string') {
            const tagArray = tags.split(',').map(tag => ({ name: tag.trim() })).filter(tagObj => tagObj.name);
            if (tagArray.length > 0) {
                pageProperties[tagsPropertyName] = { multi_select: tagArray };
            }
        }

        const subtitlePropertyName = Object.keys(dbSchema).find(key => key.toLowerCase() === 'subtítulo' && dbSchema[key].rich_text);
        if (subtitlePropertyName && tipo.toLowerCase().includes("resumo")) {
            pageProperties[subtitlePropertyName] = { rich_text: [{ text: { content: subtitulo } }] };
        }

        console.log("Processando conteúdo para blocos Notion...");
        const contentBlocks = createEnhancedNotionBlocks(resumo);

        console.log(`Criando página '${pageTitleContent}' na base de dados ID: ${databaseId}`);
        const newPage = await notion.pages.create({
            parent: { database_id: databaseId },
            properties: pageProperties,
            children: contentBlocks,
        });
        console.log(`Página de conteúdo criada com sucesso: ID ${newPage.id}, URL: ${newPage.url}`);
        res.status(201).json({ message: "Conteúdo criado no Notion com sucesso!", url: newPage.url });

    } catch (error) {
        console.error("Erro durante o processamento da requisição /create-notion-content:", error.body || error.message || error);
        res.status(500).json({
            error: "Erro interno ao processar a requisição.",
            details: error.message || "Detalhes indisponíveis",
        });
    }
});

// --- Nova Rota para Flashcards --- //

app.post("/create-notion-flashcards", async (req, res) => {
    console.log("Recebida requisição para /create-notion-flashcards");
    const {
        notion_token,
        nome_database,
        tema,
        tipo = "Flashcards", // Esperado que seja 'Flashcards' ou similar
        Flashcards, // Array de objetos { frente, verso }
        tags,
        data
        // subtitulo é ignorado para flashcards
    } = req.body;

    // Validação dos campos obrigatórios para flashcards
    if (!notion_token || !nome_database || !tema || !Flashcards || !Array.isArray(Flashcards) || Flashcards.length === 0) {
        console.error("Erro: Dados incompletos ou inválidos na requisição de flashcards.", req.body);
        return res.status(400).json({
            error: "Dados incompletos ou inválidos: notion_token, nome_database, tema e um array 'Flashcards' não vazio são obrigatórios.",
        });
    }

    // Valida se cada item no array Flashcards tem 'frente' e 'verso'
    if (!Flashcards.every(fc => fc && typeof fc.frente === 'string' && typeof fc.verso === 'string')) {
        return res.status(400).json({ error: "Formato inválido no array 'Flashcards'. Cada item deve ter 'frente' e 'verso' como strings." });
    }

    // Inicializa cliente Notion com o token do request
    const notion = new Client({ auth: notion_token });

    try {
        console.log(`Iniciando processo para criar ${Flashcards.length} flashcards em DB: ${nome_database}, Tema: ${tema}`);

        // 1. Encontrar/Criar Página Root e Tema (reutiliza lógica)
        const rootPageId = await findOrCreatePage(notion, ROOT_PAGE_TITLE);
        const themePageId = await findOrCreatePage(notion, tema, rootPageId);

        // 2. Encontrar/Criar Base de Dados (reutiliza lógica, passando 'Flashcards' como tipo para schema)
        const databaseId = await findOrCreateDatabase(notion, nome_database, themePageId, "Flashcards");

        // 3. Preparar propriedades comuns (Tags e Data)
        const commonProperties = {};
        const dbSchema = getDatabaseSchema("Flashcards"); // Pega o schema específico

        // -- Data Comum --
        const datePropertyName = Object.keys(dbSchema).find(key => key.toLowerCase() === 'data'); // Procura por 'Data'
        if (datePropertyName) {
            try {
                commonProperties[datePropertyName] = { date: { start: data ? new Date(data).toISOString() : new Date().toISOString() } };
            } catch (dateError) {
                console.warn(`Data inválida fornecida ('${data}'). Usando data atual para flashcards.`);
                commonProperties[datePropertyName] = { date: { start: new Date().toISOString() } };
            }
        }

        // -- Tags Comuns --
        const tagsPropertyName = Object.keys(dbSchema).find(key => key.toLowerCase() === 'tags' && dbSchema[key].multi_select);
        let commonTagArray = [];
        if (tagsPropertyName && tags && typeof tags === 'string') {
            commonTagArray = tags.split(',').map(tag => ({ name: tag.trim() })).filter(tagObj => tagObj.name);
            if (commonTagArray.length > 0) {
                commonProperties[tagsPropertyName] = { multi_select: commonTagArray };
            }
        }

        // Identificar nomes das propriedades 'Frente' (Title) e 'Verso' (Rich Text)
        const frentePropertyName = Object.keys(dbSchema).find(key => dbSchema[key].title); // Propriedade Title
        const versoPropertyName = Object.keys(dbSchema).find(key => key.toLowerCase() === 'verso' && dbSchema[key].rich_text);

        if (!frentePropertyName || !versoPropertyName) {
            throw new Error("Schema da base de dados de Flashcards inválido. Propriedades 'Frente' (title) e 'Verso' (rich_text) não encontradas.");
        }

        // 4. Iterar e Criar cada Flashcard
        const createdFlashcardsInfo = [];
        for (const flashcard of Flashcards) {
            const flashcardProperties = { ...commonProperties }; // Copia propriedades comuns

            // Adiciona Frente (Title)
            flashcardProperties[frentePropertyName] = { title: [{ text: { content: flashcard.frente } }] };

            // Adiciona Verso (Rich Text)
            // Usando parseRichText para permitir links simples no verso, mas não formatação complexa
            flashcardProperties[versoPropertyName] = { rich_text: parseRichText(flashcard.verso) };

            try {
                console.log(`Criando flashcard '${flashcard.frente}' na base de dados ID: ${databaseId}`);
                const newFlashcardPage = await notion.pages.create({
                    parent: { database_id: databaseId },
                    properties: flashcardProperties,
                    // Flashcards geralmente não têm 'children' blocos, o verso está na propriedade
                });
                console.log(`Flashcard criado: ID ${newFlashcardPage.id}, URL: ${newFlashcardPage.url}`);
                createdFlashcardsInfo.push({ frente: flashcard.frente, url: newFlashcardPage.url });
            } catch (flashcardError) {
                console.error(`Erro ao criar flashcard '${flashcard.frente}':`, flashcardError.body || flashcardError.message);
                // Decide se continua ou para em caso de erro em um flashcard
                // Por enquanto, loga o erro e continua com os próximos
                createdFlashcardsInfo.push({ frente: flashcard.frente, error: flashcardError.message || "Erro desconhecido" });
            }
        }

        // 5. Retornar Resposta de Sucesso
        res.status(201).json({
            message: `Processamento de flashcards concluído. ${createdFlashcardsInfo.filter(info => info.url).length} criados com sucesso.`,
            results: createdFlashcardsInfo
        });

    } catch (error) {
        console.error("Erro durante o processamento da requisição /create-notion-flashcards:", error.body || error.message || error);
        res.status(500).json({
            error: "Erro interno ao processar a requisição de flashcards.",
            details: error.message || "Detalhes indisponíveis",
        });
    }
});


// --- Iniciar Servidor --- //

app.listen(PORT, () => {
    console.log(`Serviço Notion Proxy rodando na porta ${PORT}`);
    console.log(`Endpoints disponíveis:`);
    console.log(`  POST /create-notion-content (para resumos/conteúdo geral)`);
    console.log(`  POST /create-notion-flashcards (para flashcards)`);
    console.warn("AVISO: O serviço está configurado para usar o 'notion_token' do corpo da requisição. Considere usar variáveis de ambiente por segurança.");
});

