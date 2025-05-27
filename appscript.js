function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const destino = (data.destino || "sheets").toLowerCase();
    const now = new Date();

    // ✅ Enviar para Sheets do usuário
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

    // ✅ Enviar para Notion do usuário
    if ((destino === "notion" || destino === "ambos") && data.notion_token && data.notion_database_id) {
      const payload = {
        parent: { database_id: data.notion_database_id },
        properties: {
          "Tema": { title: [{ text: { content: data.tema || "" } }] },
          "Tipo": { rich_text: [{ text: { content: data.tipo || "" } }] },
          "Resumo": { rich_text: [{ text: { content: data.resumo || "" } }] },
          "Observacoes": { rich_text: [{ text: { content: data.observacoes || "" } }] },
          "Tags": { multi_select: (data.tags || "").split(",").map(t => ({ name: t.trim() })) },
          "Data": { date: { start: new Date().toISOString() } }
        }
      };

      const response = UrlFetchApp.fetch("https://api.notion.com/v1/pages", {
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
  return ContentService.createTextOutput("🚀 Este endpoint aceita apenas chamadas POST com JSON. Tudo pronto para uso!");
}
