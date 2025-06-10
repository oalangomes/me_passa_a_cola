const simpleGit = require('simple-git');
const fs = require('fs');
const path = require('path');

async function cloneRepo(repoUrl, credentials) {
    const authUrl = credentials
        ? repoUrl.replace('https://', `https://${credentials}@`)
        : repoUrl;
    const repoName = path.basename(repoUrl, '.git');
    const repoPath = path.join('/tmp', repoName);
    const git = simpleGit();

    if (!fs.existsSync(repoPath)) {
        await git.clone(authUrl, repoPath);
    }

    return repoPath;
}

async function commitAndPush(repoPath, message, files = [], branch = 'main') {
    const git = simpleGit(repoPath);
    await git.checkout(branch);
    if (files.length) {
        await git.add(files);
    } else {
        await git.add('.');
    }
    await git.commit(message);
    await git.push('origin', branch);
}

module.exports = { cloneRepo, commitAndPush };
