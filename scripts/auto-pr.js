#!/usr/bin/env node
const { createPullRequest, listPullRequests, updateRepo } = require('../src/utils/github');
const { loadTemplate } = require('../src/utils/templates');

async function main() {
    const token = process.env.GITHUB_TOKEN;
    const repoFull = process.env.GITHUB_REPOSITORY;
    const branch = process.env.BRANCH || process.env.GITHUB_REF?.replace('refs/heads/','');
    const base = process.env.BASE || 'main';
    const autoDelete = process.env.AUTO_DELETE === 'true';
    if (!token || !repoFull || !branch) {
        console.error('GITHUB_TOKEN, GITHUB_REPOSITORY e BRANCH são obrigatórios');
        process.exit(1);
    }
    const [owner, repo] = repoFull.split('/');
    const type = branch.split('/')[0];
    const prTitle = branch;
    const template = loadTemplate('pr', type);

    const existing = await listPullRequests({ token, owner, repo, head: `${owner}:${branch}` });
    if (existing.length === 0) {
        const pr = await createPullRequest({ token, owner, repo, title: prTitle, head: branch, base, body: template });
        if (autoDelete) {
            await updateRepo({ token, owner, repo, delete_branch_on_merge: true });
        }
        console.log(`PR criado: ${pr.html_url}`);
    } else {
        console.log('Pull request já existe para este branch');
    }
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
