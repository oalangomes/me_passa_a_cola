#!/usr/bin/env node
const fs = require('fs');

function checkExists(path) {
  if (!fs.existsSync(path)) {
    console.error(`Arquivo ausente: ${path}`);
    process.exit(1);
  }
  if (fs.statSync(path).size === 0) {
    console.error(`Arquivo vazio: ${path}`);
    process.exit(1);
  }
}

function checkJson(path, key) {
  checkExists(path);
  try {
    const data = JSON.parse(fs.readFileSync(path, 'utf8'));
    if (key && !(key in data)) {
      console.error(`Chave \\"${key}\\" ausente em ${path}`);
      process.exit(1);
    }
  } catch (err) {
    console.error(`JSON invalido em ${path}: ${err.message}`);
    process.exit(1);
  }
}

checkJson('gpt/actions.json', 'openapi');
checkExists('gpt/prompt.md');
checkExists('gpt/prompt_auxiliar_projetos.md');

