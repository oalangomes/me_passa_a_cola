const {
    updateIssue,
    listMilestones,
    listProjects,
    listProjectColumns,
    addIssueToProject
} = require('./github');

/**
 * Aplica regras configuradas para issues.
 * @param {object} issue Objeto retornado pela API do GitHub
 * @param {object} opts Parâmetros com token, owner, repo e issueRules
 */
async function applyIssueRules(issue, opts = {}) {
    const { token, owner, repo, issueRules = [], defaultIssueProject } = opts;
    if (!token || !owner || !repo || !Array.isArray(issueRules)) return;

    for (const rule of issueRules) {
        const cond = rule.if || {};
        const actions = rule.set || {};
        let match = true;
        if (cond.labels && cond.labels.length) {
            const labels = (issue.labels || []).map(l => typeof l === 'string' ? l : l.name);
            for (const l of cond.labels) {
                if (!labels.includes(l)) {
                    match = false;
                    break;
                }
            }
        }
        if (!match) continue;

        let milestoneNumber = actions.milestone;
        if (milestoneNumber && isNaN(Number(milestoneNumber))) {
            try {
                const ms = await listMilestones({ token, owner, repo, state: 'all' });
                const found = ms.find(m => m.title === milestoneNumber);
                if (found) milestoneNumber = found.number;
            } catch (err) {
                console.warn('Falha ao buscar milestone:', err.message);
            }
        }
        if (milestoneNumber !== undefined) {
            try {
                await updateIssue({ token, owner, repo, issue_number: issue.number, milestone: milestoneNumber });
            } catch (err) {
                console.warn('Falha ao atualizar issue:', err.message);
            }
        }

        if (actions.column) {
            let columnId = actions.column;
            if (isNaN(Number(columnId))) {
                try {
                    let projectId = defaultIssueProject;
                    if (!projectId) {
                        const projects = await listProjects({ token, owner, repo });
                        if (projects.length > 0) projectId = projects[0].id;
                    }
                    if (projectId) {
                        const cols = await listProjectColumns({ token, project_id: projectId });
                        const found = cols.find(c => c.name === columnId);
                        if (found) columnId = found.id;
                    }
                } catch (err) {
                    console.warn('Falha ao obter coluna do projeto:', err.message);
                }
            }
            if (columnId) {
                try {
                    await addIssueToProject({ token, column_id: columnId, issue_id: issue.node_id });
                } catch (err) {
                    console.warn('Falha ao mover issue para coluna:', err.message);
                }
            }
        }
    }
}

module.exports = { applyIssueRules };
