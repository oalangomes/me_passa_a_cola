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

// Utilidade: Buscar página pelo título dentro do database
async function searchPageByTitle(notion, databaseId, title) {
  const response = await notion.databases.query({
    database_id: databaseId,
    filter: {
      property: "title",
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
                color: "default"
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

module.exports = { getOrCreateTags };



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

    // 2. Cria a página “Flashcards [Tema]” como subpágina do tema
    const flashcardsPage = await getOrCreatePage({
      notion,
      databaseName: nome_database,
      pageTitle: subtitulo,
      tags,
      parentTitle: tema,
      asSubpage: true,
      contentMd: "Lista de flashcards",
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


// Para rodar local
if (require.main === module) {
  const port = process.env.PORT || 3333;
  app.listen(port, () => console.log(`API up at http://localhost:${port}`));
}

module.exports = app;
