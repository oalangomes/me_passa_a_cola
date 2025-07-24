#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const actionsPath = path.join(__dirname, '..', 'gpt', 'actions.json');
const promptsPath = path.join(__dirname, '..', 'gpt', 'prompts.json');

const actions = JSON.parse(fs.readFileSync(actionsPath, 'utf8'));
let prompts = {};
if (fs.existsSync(promptsPath)) {
  prompts = JSON.parse(fs.readFileSync(promptsPath, 'utf8'));
}

function mdEscape(text) {
  return String(text).replace(/_/g, '\\_');
}

function generateSummary(paths) {
  let md = '## Sumário\n';
  for (const [route, methods] of Object.entries(paths)) {
    for (const [method] of Object.entries(methods)) {
      const anchor = `${method}-${route}`.replace(/[^a-zA-Z0-9]/g, '');
      md += `- [${method.toUpperCase()} ${route}](#${anchor})\n`;
    }
  }
  return md + '\n';
}

function sectionForMethod(route, method, info) {
  const anchor = `${method}-${route}`.replace(/[^a-zA-Z0-9]/g, '');
  let md = `### <a id="${anchor}"></a> ${method.toUpperCase()} ${route}\n\n`;
  if (info.description) {
    md += info.description + '\n\n';
  }
  if (info.parameters && info.parameters.length) {
    md += 'Parâmetros:\n';
    for (const p of info.parameters) {
      const req = p.required ? ' (obrigatório)' : '';
      const type = p.schema ? p.schema.type : 'string';
      md += `- \`${p.name}\` (${p.in}, ${type})${req}`;
      if (p.description) md += ` - ${mdEscape(p.description)}`;
      md += '\n';
    }
    md += '\n';
  }
  if (info.requestBody) {
    md += 'Corpo da requisição:\n';
    const schema = info.requestBody.content?.['application/json']?.schema;
    if (schema && schema['$ref']) {
      const ref = schema['$ref'].split('/').pop();
      const def = actions.components?.schemas?.[ref];
      if (def && def.properties) {
        for (const [prop, val] of Object.entries(def.properties)) {
          const req = def.required && def.required.includes(prop) ? ' (obrigatório)' : '';
          md += `- \`${prop}\` (${val.type})${req}\n`;
        }
      }
    }
    md += '\n';
  }
  const opId = info.operationId;
  const example = prompts[opId]?.example;
  if (example) {
    md += 'Exemplo:\n';
    md += '```json\n';
    md += JSON.stringify(example, null, 2) + '\n';
    md += '```\n\n';
  }
  return md;
}

function generateDocs() {
  let md = '# API\n\n';
  md += generateSummary(actions.paths);
  for (const [route, methods] of Object.entries(actions.paths)) {
    for (const [method, info] of Object.entries(methods)) {
      md += sectionForMethod(route, method, info);
    }
  }
  return md;
}

if (require.main === module) {
  const outDir = path.join(__dirname, '..', 'docs');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);
  fs.writeFileSync(path.join(outDir, 'API.md'), generateDocs());
}

module.exports = generateDocs;
