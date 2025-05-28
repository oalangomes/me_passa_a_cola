function doPost(e) {
  try {
        const data = JSON.parse(e.postData.contents);


    const now = new Date();

    if (!data.notion_token || !data.nome_database || !data.tema) {
      throw new Error("Token, nome do banco e tema são obrigatórios.");
    }

    const headers = {
      "Authorization": "Bearer " + data.notion_token,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json"
    };

    // 1️⃣ Buscar página root "Me Passa A Cola (GPT)" com validação exata
    const rootSearch = UrlFetchApp.fetch("https://api.notion.com/v1/search", {
      method: "post",
      headers: headers,
      payload: JSON.stringify({
        query: "Me Passa A Cola (GPT)",
        filter: { property: "object", value: "page" }
      })
    });

    const rootResults = JSON.parse(rootSearch.getContentText()).results.filter(r => {
      const titleProp = r.properties?.title || r.properties?.Name;
      return r.object === "page" && titleProp?.title?.[0]?.text?.content === "Me Passa A Cola (GPT)";
    });

    if (!rootResults.length) {
      return ContentService.createTextOutput("❌ Página root 'Me Passa A Cola (GPT)' não encontrada. Por favor, crie essa página manualmente no Notion e vincule a integração.");
    }

    const rootPageId = rootResults[0].id;

    // 2️⃣ Buscar se o banco já existe (validação por nome exato)
    const dbSearch = UrlFetchApp.fetch("https://api.notion.com/v1/search", {
      method: "post",
      headers: headers,
      payload: JSON.stringify({
        query: data.nome_database,
        filter: { property: "object", value: "database" }
      })
    });

    const dbResults = JSON.parse(dbSearch.getContentText()).results.filter(r => r.object === "database" && r.title?.[0]?.text?.content === data.nome_database);
    let databaseId;

    if (dbResults.length) {
      databaseId = dbResults[0].id;
    } else {
      // Criar banco de dados dentro da página root
      const dbPayload = {
        parent: { page_id: rootPageId },
        title: [
          {
            text: { content: data.nome_database }
          }
        ],
        properties: {
          "Página": { title: {} },
          "Tags": { multi_select: {} },
          "Última edição": { last_edited_time: {} }
        }
      };

      const createDB = UrlFetchApp.fetch("https://api.notion.com/v1/databases", {
        method: "post",
        headers: headers,
        payload: JSON.stringify(dbPayload)
      });

      databaseId = JSON.parse(createDB.getContentText()).id;
    }

    // 3️⃣ Criar subpágina com nome tipo + data atual
    const today = new Date().toISOString().slice(0, 10);
    const pageTitle = `${data.tipo || "Resumo"} - ${today}`;

    const children = [];

    if (data.subtitulo) {
      children.push({
        object: "block",
        type: "heading_2",
        heading_2: {
          rich_text: [{ type: "text", text: { content: data.subtitulo } }]
        }
      });
    }

    // Adicionar índice se o resumo contiver múltiplos tópicos (baseado em marcadores)
    if (data.resumo && data.resumo.includes("\n- ")) {
      const topicos = data.resumo.split("\n").filter(l => l.startsWith("- ")).map((l, i) => `• ${l.substring(2)}`);
      if (topicos.length > 1) {
        children.push({
          object: "block",
          type: "bulleted_list_item",
          bulleted_list_item: {
            rich_text: [{ type: "text", text: { content: "📑 Índice" } }]
          }
        });
        topicos.forEach(topico => {
          children.push({
            object: "block",
            type: "bulleted_list_item",
            bulleted_list_item: {
              rich_text: [{ type: "text", text: { content: topico } }]
            }
          });
        });
      }
    }

    if (data.resumo) {
      children.push({
        object: "block",
        type: "paragraph",
        paragraph: {
          rich_text: [{ type: "text", text: { content: data.resumo } }]
        }
      });
    }

    if (data.observacoes) {
      children.push({
        object: "block",
        type: "paragraph",
        paragraph: {
          rich_text: [{ type: "text", text: { content: "🔍 Observações: " + data.observacoes } }]
        }
      });
    }

    const pagePayload = {
      parent: { database_id: databaseId },
      properties: {
        "Página": { title: [{ text: { content: pageTitle } }] },
        "Tags": {
          multi_select: data.tags ? data.tags.split(",").map(t => ({ name: t.trim() })) : []
        }
      },
      children: children
    };

    UrlFetchApp.fetch("https://api.notion.com/v1/pages", {
      method: "post",
      headers: headers,
      payload: JSON.stringify(pagePayload)
    });

    return ContentService.createTextOutput("✅ Conteúdo enviado com sucesso!");
  } catch (err) {
    return ContentService.createTextOutput("❌ Erro: " + err.message);
  }
}

function doGet(e) {
  return ContentService.createTextOutput("🚀 Este endpoint aceita apenas chamadas POST com JSON.");
}
