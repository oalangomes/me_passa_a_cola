const fs = require('fs');
const path = require('path');

function parseYaml(content) {
    const lines = content.split(/\r?\n/);
    const result = {};
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const [key, ...rest] = trimmed.split(':');
        if (key) {
            const value = rest.join(':').trim();
            result[key.trim()] = value.replace(/^['"]|['"]$/g, '');
        }
    }
    return result;
}

function loadColaConfig(repoPath) {
    const ymlPath = path.join(repoPath, '.cola-config.yml');
    const jsonPath = path.join(repoPath, '.cola-config.json');
    let config = {};
    try {
        if (fs.existsSync(ymlPath)) {
            const content = fs.readFileSync(ymlPath, 'utf8');
            config = parseYaml(content);
        } else if (fs.existsSync(jsonPath)) {
            const content = fs.readFileSync(jsonPath, 'utf8');
            config = JSON.parse(content);
        }
    } catch (err) {
        console.warn('Falha ao ler configuração:', err.message);
    }
    return config || {};
}

function loadCommitTemplate(repoPath, templatePath = '.github/commit-template.md') {
    try {
        const filePath = path.join(repoPath, templatePath);
        return fs.readFileSync(filePath, 'utf8').trim();
    } catch (err) {
        return '';
    }
}

module.exports = { loadColaConfig, loadCommitTemplate };
