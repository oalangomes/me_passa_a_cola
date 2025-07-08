const fs = require('fs');
const path = require('path');
const gptDir = path.join(__dirname, '..', 'gpt');
const specs = fs.readdirSync(gptDir)
  .filter(f => /^actions.*\.json$/.test(f))
  .map(f => JSON.parse(fs.readFileSync(path.join(gptDir, f), 'utf8')));
const spec = specs.reduce((base, s) => {
  if (!base) return { ...s };
  for (const [route, methods] of Object.entries(s.paths)) {
    base.paths[route] = base.paths[route] || {};
    Object.assign(base.paths[route], methods);
  }
  if (s.components && s.components.schemas) {
    base.components = base.components || { schemas: {} };
    base.components.schemas = {
      ...base.components.schemas,
      ...s.components.schemas,
    };
  }
  return base;
}, null);

function generateDocs() {
  let md = `# API\n\n`;
  for (const [route, methods] of Object.entries(spec.paths)) {
    for (const [verb, info] of Object.entries(methods)) {
      md += `## ${verb.toUpperCase()} ${route}\n\n`;
      if (info.description) {
        md += info.description + '\n\n';
      }
    }
  }
  return md;
}

function main() {
  const docsDir = path.join(__dirname, '..', 'docs');
  if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir);
  const md = generateDocs();
  fs.writeFileSync(path.join(docsDir, 'API.md'), md);
}

if (require.main === module) {
  main();
}

module.exports = { generateDocs };
