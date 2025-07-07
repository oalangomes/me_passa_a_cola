const fs = require('fs');
const path = require('path');

function loadTemplate(type, name = '') {
    try {
        if (type === 'issue') {
            const file = path.join(__dirname, '..', '..', '.github', 'ISSUE_TEMPLATE', `${name}.md`);
            return fs.readFileSync(file, 'utf8');
        }
        if (type === 'pr') {
            const file = name
                ? path.join(__dirname, '..', '..', '.github', 'pr_templates', `${name}.md`)
                : path.join(__dirname, '..', '..', '.github', 'PULL_REQUEST_TEMPLATE.md');
            return fs.readFileSync(file, 'utf8');
        }
        return '';
    } catch (err) {
        return '';
    }
}

module.exports = { loadTemplate };
