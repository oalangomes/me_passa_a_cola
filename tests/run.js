const { app } = require('../src/index');
const { cloneRepo } = require('../src/utils/git');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

async function main() {
  await testBasicEndpoints();
  await testCloneRepoPull();
  await testGithubProjectRoutes();
}

function startServer() {
  const server = app.listen(0);
  return server;
}

async function testBasicEndpoints() {
  const server = startServer();
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

async function testGithubProjectRoutes() {
  const server = startServer();
  const port = server.address().port;

  const originalFetch = global.fetch;
  global.fetch = async (url, options) => {
    if (url === 'https://api.github.com/graphql') {
      const { query, variables } = JSON.parse(options.body);
      if (query.includes('repository(')) {
        return {
          ok: true,
          json: async () => ({ data: { repository: { id: 'repo1' } } })
        };
      }
      if (query.includes('createProject')) {
        return {
          ok: true,
          json: async () => ({
            data: { createProject: { project: { id: 'proj1', name: variables.name, body: variables.body } } }
          })
        };
      }
      if (query.includes('addProjectColumn')) {
        return {
          ok: true,
          json: async () => ({
            data: { addProjectColumn: { columnEdge: { node: { id: 'col1', name: variables.name } } } }
          })
        };
      }
      if (query.includes('addProjectCard')) {
        return {
          ok: true,
          json: async () => ({
            data: { addProjectCard: { cardEdge: { node: { id: 'card1' } } } }
          })
        };
      }
    }
    return originalFetch(url, options);
  };

  const projectRes = await fetch(`http://localhost:${port}/github-projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: 't', owner: 'o', repo: 'r', name: 'Test', body: '' })
  });
  assert.strictEqual(projectRes.status, 200);
  const projectData = await projectRes.json();
  assert(projectData.project);
  const projectId = projectData.project.id;

  const columnRes = await fetch(`http://localhost:${port}/github-projects/${projectId}/columns`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: 't', name: 'Col' })
  });
  assert.strictEqual(columnRes.status, 200);
  const columnData = await columnRes.json();
  assert(columnData.column);
  const columnId = columnData.column.id;

  const cardRes = await fetch(`http://localhost:${port}/github-projects/columns/${columnId}/cards`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: 't', issue_id: 'issue1' })
  });
  assert.strictEqual(cardRes.status, 200);
  const cardData = await cardRes.json();
  assert(cardData.card);

  server.close();
  global.fetch = originalFetch;
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
