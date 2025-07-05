const fs = require('fs');
const path = require('path');
const spec = require('../gpt/actions.json');

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
