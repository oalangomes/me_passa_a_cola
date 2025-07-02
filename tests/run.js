const { app } = require('../src/index');
const assert = require('assert');

async function main() {
  const server = app.listen(0);
  const port = server.address().port;

  const res = await fetch(`http://localhost:${port}/pdf-to-notion`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });

  assert.strictEqual(res.status, 400);
  server.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
