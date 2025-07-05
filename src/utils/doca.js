async function sendToDoca(data) {
  const url = process.env.DOCA_API_URL;
  const key = process.env.DOCA_API_KEY;
  if (!url) throw new Error('DOCA_API_URL nao definido');
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(key ? { 'Authorization': `Bearer ${key}` } : {})
    },
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Erro DOCA: ${text}`);
  }
  try {
    return await response.json();
  } catch {
    return {};
  }
}

module.exports = { sendToDoca };
