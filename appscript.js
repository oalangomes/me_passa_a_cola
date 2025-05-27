function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const destino = (data.destino || "sheets").toLowerCase();
    const now = new Date();

    // ✅ Enviar para Google Sheets
    if ((destino === "sheets" || destino === "ambos") && data.sheet_id) {
      const sheet = SpreadsheetApp.openById(data.sheet_id).getActiveSheet();
      sheet.appendRow([
        now,
        data.tema || "",
        data.tipo || "",
        data.resumo || "",
        data.observacoes || "",
        data.tags || ""
      ]);
    }

    // ✅ Enviar para Notion com busca de banco por nome (se ID não for enviado)
    if ((destino === "notion" || destino === "ambos") && data.notion_token) {
      let databaseId = data.notion_database_id;

      // 🔍 Se o ID não foi enviado, tenta buscar pelo nome
      if (!databaseId && data.nome_database) {
        const searchResponse = UrlFetchApp.fetch("https://api.notion.com/v1/search", {
          method: "post",
          contentType: "application/json",
          headers: {
            "Authorization": "Bearer " + data.notion_token,
            "Notion-Version": "2022-06-28"
          },
          payload: JSON.stringify({
            query: data.nome_database,
            filter: { property: "object", value: "database" }
          })
        });

        const results = JSON.parse(searchResponse).results;
        if (!results || results.length === 0) {
          throw new Error("Banco de dados não encontrado com o nome fornecido.");
        }

        databaseId = results[0].id;
      }

      if (!databaseId) {
        throw new Error("ID do banco do Notion não fornecido nem localizado por nome.");
      }

      // ✅ Monta payload do conteúdo
      const payload = {
        parent: { database_id: databaseId },
        properties: {
          "Tema": { title: [{ text: { content: data.tema || "" } }] },
          "Tipo": { rich_text: [{ text: { content: data.tipo || "" } }] },
          "Resumo": { rich_text: [{ text: { content: data.resumo || "" } }] },
          "Observacoes": { rich_text: [{ text: { content: data.observacoes || "" } }] },
          "Tags": { multi_select: (data.tags || "").split(",").map(t => ({ name: t.trim() })) },
          "Data": { date: { start: new Date().toISOString() } }
        }
      };

      // 📤 Envia para Notion
      UrlFetchApp.fetch("https://api.notion.com/v1/pages", {
        method: "post",
        contentType: "application/json",
        headers: {
          "Authorization": "Bearer " + data.notion_token,
          "Notion-Version": "2022-06-28"
        },
        payload: JSON.stringify(payload)
      });
    }

    return ContentService.createTextOutput("✅ Conteúdo enviado com sucesso!");
  } catch (err) {
    return ContentService.createTextOutput("❌ Erro: " + err.message);
  }
}

function doGet(e) {
  return ContentService.createTextOutput("🚀 Este endpoint aceita apenas chamadas POST com JSON.");
}
