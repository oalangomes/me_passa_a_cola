const { app } = require('../src/index');
const { cloneRepo } = require('../src/utils/git');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

async function main() {
  const server = app.listen(0);
  const port = server.address().port;

  const res = await fetch(`http://localhost:${port}/pdf-to-notion`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });

  assert.strictEqual(res.status, 400);

  const specRes = await fetch(`http://localhost:${port}/api-docs.json`);
  assert.strictEqual(specRes.status, 200);
  const spec = await specRes.json();
  assert(spec.paths['/create-notion-content']);
  assert(spec.paths['/github-issues']);
  assert(spec.paths['/github-projects']);
  assert(spec.paths['/github-projects/columns/{column_id}/cards']);
  server.close();

  await testCloneRepoPull();
}

async function testCloneRepoPull() {
  execSync('rm -rf /tmp/origin.git');
  execSync('git init --bare /tmp/origin.git');

  execSync('rm -rf /tmp/work1');
  execSync('git clone /tmp/origin.git /tmp/work1');
  fs.writeFileSync('/tmp/work1/file.txt', 'v1');
  execSync('cd /tmp/work1 && git add file.txt && git commit -m init && git push origin master');

  const repoPath1 = await cloneRepo('/tmp/origin.git');
  assert(fs.existsSync(path.join(repoPath1, 'file.txt')));

  execSync('rm -rf /tmp/work2');
  execSync('git clone /tmp/origin.git /tmp/work2');
  fs.writeFileSync('/tmp/work2/file.txt', 'v2');
  execSync('cd /tmp/work2 && git add file.txt && git commit -m update && git push origin master');

  const repoPath2 = await cloneRepo('/tmp/origin.git');
  const content = fs.readFileSync(path.join(repoPath2, 'file.txt'), 'utf8');
  assert.strictEqual(content.trim(), 'v2');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
