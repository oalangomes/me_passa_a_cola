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

    if (fs.existsSync(repoPath)) {
        fs.rmSync(repoPath, { recursive: true, force: true });
    }
    await git.clone(authUrl, repoPath);

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

async function listRepoFiles(repoPath, dir = '.') {
    const target = path.join(repoPath, dir);
    const entries = await fs.promises.readdir(target, { withFileTypes: true });
    return entries.map(e => ({ name: e.name, isDirectory: e.isDirectory() }));
}

async function readRepoFile(repoPath, filePath) {
    const target = path.join(repoPath, filePath);
    return fs.promises.readFile(target, 'utf8');
}

module.exports = { cloneRepo, commitAndPush, listRepoFiles, readRepoFile };
