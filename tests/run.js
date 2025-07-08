const { app } = require('../src/index');
const { cloneRepo } = require('../src/utils/git');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

async function main() {
  await testBasicEndpoints();
  await testCloneRepoPull();
  await testGitFileRoute();
  await testGithubProjectRoutes();
  await testGithubMilestoneRoutes();
  await testGithubIssueDefaults();
  await testGithubIssueRules();
  await testGithubPullAuto();
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
  assert(spec.paths['/github-projects/columns/cards']);
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

async function testGitFileRoute() {
  execSync('rm -rf /tmp/origin3.git');
  execSync('git init --bare /tmp/origin3.git');

  execSync('rm -rf /tmp/work3');
  execSync('git clone /tmp/origin3.git /tmp/work3');
  fs.writeFileSync('/tmp/work3/readme.txt', 'hello');
  execSync('cd /tmp/work3 && git add readme.txt && git commit -m init && git push origin master');

  const server = startServer();
  const port = server.address().port;

  const res = await fetch(`http://localhost:${port}/git-file?repoUrl=/tmp/origin3.git&credentials=&file=readme.txt&x-api-token=`, {});
  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert.strictEqual(data.content.trim(), 'hello');

  server.close();
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

  const columnRes = await fetch(`http://localhost:${port}/github-projects/columns`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: 't', project_id: projectId, name: 'Col' })
  });
  assert.strictEqual(columnRes.status, 200);
  const columnData = await columnRes.json();
  assert(columnData.column);
  const columnId = columnData.column.id;

  const cardRes = await fetch(`http://localhost:${port}/github-projects/columns/cards`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: 't', column_id: columnId, issue_id: 'issue1' })
  });
  assert.strictEqual(cardRes.status, 200);
  const cardData = await cardRes.json();
  assert(cardData.card);

  server.close();
  global.fetch = originalFetch;
}

async function testGithubPullAuto() {
  execSync('rm -rf /tmp/pr.git');
  execSync('git init --bare /tmp/pr.git');

  execSync('rm -rf /tmp/workpr');
  execSync('git clone /tmp/pr.git /tmp/workpr');
  fs.writeFileSync('/tmp/workpr/.cola-config.json', JSON.stringify({ pullRequestTemplates: { feature: 'pr-feature.md' } }));
  fs.writeFileSync('/tmp/workpr/pr-feature.md', '# Titulo\nCorpo');
  execSync('cd /tmp/workpr && git add . && git commit -m init && git push origin master');

  const server = startServer();
  const port = server.address().port;

  let createCalled = false;
  let mergeCalled = false;
  let closeCalled = false;
  const originalFetch = global.fetch;
  global.fetch = async (url, options) => {
    if (url === 'https://api.github.com/repos/o/r/pulls' && options.method === 'POST') {
      createCalled = true;
      return { ok: true, json: async () => ({ number: 9 }) };
    }
    if (url === 'https://api.github.com/repos/o/r/pulls/9/merge' && options.method === 'PUT') {
      mergeCalled = true;
      return { ok: true, json: async () => ({ merged: true }) };
    }
    if (url.startsWith('https://api.github.com/repos/o/r/pulls/9') && options.method === 'PATCH') {
      closeCalled = true;
      return { ok: true, json: async () => ({}) };
    }
    return originalFetch(url, options);
  };

  const res = await fetch(`http://localhost:${port}/github-pulls/auto`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token: 't',
      owner: 'o',
      repo: 'r',
      head: 'feat',
      base: 'main',
      repoUrl: '/tmp/pr.git',
      credentials: '',
      type: 'feature',
      autoClose: true
    })
  });
  assert.strictEqual(res.status, 200);
  assert(createCalled && mergeCalled && closeCalled);

  server.close();
  global.fetch = originalFetch;
}

async function testGithubMilestoneRoutes() {
  const server = startServer();
  const port = server.address().port;

  const originalFetch = global.fetch;
  global.fetch = async (url, options) => {
    if (url.startsWith('https://api.github.com/repos/o/r/milestones')) {
      if (options.method === 'POST') {
        return { ok: true, json: async () => ({ number: 1, title: 'M1' }) };
      }
      if (options.method === 'GET') {
        return { ok: true, json: async () => ([{ number: 1, title: 'M1' }]) };
      }
      if (options.method === 'PATCH') {
        return { ok: true, json: async () => ({ number: 1, title: 'M1 edit' }) };
      }
    }
    if (url.startsWith('https://api.github.com/repos/o/r/issues')) {
      return { ok: true, json: async () => ({ node_id: 'n1' }) };
    }
    return originalFetch(url, options);
  };

  const mRes = await fetch(`http://localhost:${port}/github-milestones`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: 't', owner: 'o', repo: 'r', title: 'M1' })
  });
  assert.strictEqual(mRes.status, 200);
  const mData = await mRes.json();
  assert(mData.milestone);

  const issueRes = await fetch(`http://localhost:${port}/github-issues`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: 't', owner: 'o', repo: 'r', title: 'I', milestone: 'M1' })
  });
  assert.strictEqual(issueRes.status, 200);

  const listRes = await fetch(`http://localhost:${port}/github-milestones?token=t&owner=o&repo=r`);
  assert.strictEqual(listRes.status, 200);
  const listData = await listRes.json();
  assert(Array.isArray(listData.milestones));

  server.close();
  global.fetch = originalFetch;
}

async function testGithubIssueDefaults() {
  execSync('rm -rf /tmp/default.git');
  execSync('git init --bare /tmp/default.git');

  execSync('rm -rf /tmp/workdef');
  execSync('git clone /tmp/default.git /tmp/workdef');
  fs.writeFileSync('/tmp/workdef/.cola-config.yml', 'defaultIssueMilestone: 2\ndefaultIssueColumn: colX');
  execSync('cd /tmp/workdef && git add .cola-config.yml && git commit -m init && git push origin master');

  const server = startServer();
  const port = server.address().port;

  let createdIssueBody = null;
  let projectColumnUsed = null;
  const originalFetch = global.fetch;
  global.fetch = async (url, options) => {
    if (url.startsWith('https://api.github.com/repos/o/r/issues')) {
      createdIssueBody = JSON.parse(options.body);
      return { ok: true, json: async () => ({ node_id: 'iss1' }) };
    }
    if (url === 'https://api.github.com/graphql') {
      const { query, variables } = JSON.parse(options.body);
      if (query.includes('addProjectCard')) {
        projectColumnUsed = variables.projectColumnId;
        return { ok: true, json: async () => ({ data: { addProjectCard: { cardEdge: { node: { id: 'c1' } } } } }) };
      }
    }
    return originalFetch(url, options);
  };

  const res = await fetch(`http://localhost:${port}/github-issues`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token: 't',
      owner: 'o',
      repo: 'r',
      title: 'Def',
      repoUrl: '/tmp/default.git',
      credentials: ''
    })
  });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(createdIssueBody.milestone, 2);
  assert.strictEqual(projectColumnUsed, 'colX');

  server.close();
  global.fetch = originalFetch;
}

async function testGithubIssueRules() {
  execSync('rm -rf /tmp/rules.git');
  execSync('git init --bare /tmp/rules.git');

  execSync('rm -rf /tmp/workrules');
  execSync('git clone /tmp/rules.git /tmp/workrules');
  fs.writeFileSync('/tmp/workrules/.cola-config.yml', 'defaultIssueProject: proj1\nissueRules:\n  - if:\n      labels: [bug]\n    set:\n      milestone: M1\n      column: Bugs\n');
  execSync('cd /tmp/workrules && git add .cola-config.yml && git commit -m init && git push origin master');

  const server = startServer();
  const port = server.address().port;

  let patchedMilestone = null;
  let movedColumn = null;
  const originalFetch = global.fetch;
  global.fetch = async (url, options) => {
    if (url.startsWith('https://api.github.com/repos/o/r/issues') && options.method === 'POST') {
      return { ok: true, json: async () => ({ number: 1, node_id: 'n2', labels: [{ name: 'bug' }] }) };
    }
    if (url.startsWith('https://api.github.com/repos/o/r/issues/1') && options.method === 'PATCH') {
      patchedMilestone = JSON.parse(options.body).milestone;
      return { ok: true, json: async () => ({}) };
    }
    if (url.startsWith('https://api.github.com/repos/o/r/milestones')) {
      return { ok: true, json: async () => ([{ number: 10, title: 'M1' }]) };
    }
    if (url === 'https://api.github.com/graphql') {
      const { query, variables } = JSON.parse(options.body);
      if (query.includes('addProjectCard')) {
        movedColumn = variables.projectColumnId;
        return { ok: true, json: async () => ({ data: { addProjectCard: { cardEdge: { node: { id: 'c2' } } } } }) };
      }
      if (query.includes('columns(')) {
        return { ok: true, json: async () => ({ data: { node: { columns: { nodes: [{ id: 'colBug', name: 'Bugs' }] } } } }) };
      }
    }
    return originalFetch(url, options);
  };

  const res = await fetch(`http://localhost:${port}/github-issues`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token: 't',
      owner: 'o',
      repo: 'r',
      title: 'Bug',
      labels: ['bug'],
      repoUrl: '/tmp/rules.git',
      credentials: ''
    })
  });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(patchedMilestone, 10);
  assert.strictEqual(movedColumn, 'colBug');

  server.close();
  global.fetch = originalFetch;
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
