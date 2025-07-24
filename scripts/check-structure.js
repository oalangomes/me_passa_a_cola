#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function loadJSON(file) {
    const content = fs.readFileSync(file, 'utf8');
    try {
        return JSON.parse(content);
    } catch (err) {
        console.error(`JSON inválido em ${file}: ${err.message}`);
        process.exit(1);
    }
}

const root = path.join(__dirname, '..');
const actionsPath = path.join(root, 'gpt', 'actions.json');
const promptsPath = path.join(root, 'gpt', 'prompts.json');
const prTemplateDir = path.join(root, '.github', 'PULL_REQUEST_TEMPLATE');

if (!fs.existsSync(actionsPath)) {
    console.error('Arquivo gpt/actions.json não encontrado');
    process.exit(1);
}
const actions = loadJSON(actionsPath);
if (!actions.paths) {
    console.error('gpt/actions.json não possui a chave "paths"');
    process.exit(1);
}

if (!fs.existsSync(promptsPath)) {
    console.error('Arquivo gpt/prompts.json não encontrado');
    process.exit(1);
}
loadJSON(promptsPath);

if (!fs.existsSync(prTemplateDir) || fs.readdirSync(prTemplateDir).length === 0) {
    console.error('Templates de Pull Request não encontrados em .github/PULL_REQUEST_TEMPLATE');
    process.exit(1);
}

console.log('Estrutura de arquivos validada com sucesso');
