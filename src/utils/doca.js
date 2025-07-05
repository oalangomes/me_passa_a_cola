async function sendToDoca({ doca_token, baseUrl = 'https://api.doca.com', data }) {
  const res = await fetch(`${baseUrl}/conteudos`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${doca_token}`
    },
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    throw new Error(`Doca API error: ${res.status}`);
  }
  return res.json();
}

module.exports = { sendToDoca };
