const API_URL = 'https://api.github.com';

async function githubRequest(token, method, url, body, extraHeaders = {}) {
    const headers = {
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'me-passa-a-cola',
        ...extraHeaders
    };
    const res = await fetch(`${API_URL}${url}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
    });
    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`GitHub API ${res.status}: ${errText}`);
    }
    if (res.status === 204) return {};
    return await res.json();
}

async function createIssue({ token, owner, repo, title, body = '', labels = [], assignees = [] }) {
    return githubRequest(token, 'POST', `/repos/${owner}/${repo}/issues`, {
        title, body, labels, assignees
    });
}

async function updateIssue({ token, owner, repo, issue_number, title, body, state, labels, assignees }) {
    return githubRequest(token, 'PATCH', `/repos/${owner}/${repo}/issues/${issue_number}`, {
        title, body, state, labels, assignees
    });
}

async function closeIssue(params) {
    return updateIssue({ ...params, state: 'closed' });
}

async function listIssues({ token, owner, repo, state = 'open', labels = '' }) {
    const searchParams = new URLSearchParams({ state, labels });
    return githubRequest(token, 'GET', `/repos/${owner}/${repo}/issues?${searchParams.toString()}`);
}

async function dispatchWorkflow({ token, owner, repo, workflow_id, ref = 'main', inputs = {} }) {
    return githubRequest(token, 'POST', `/repos/${owner}/${repo}/actions/workflows/${workflow_id}/dispatches`, {
        ref,
        inputs
    });
}

async function getWorkflowRun({ token, owner, repo, run_id }) {
    return githubRequest(token, 'GET', `/repos/${owner}/${repo}/actions/runs/${run_id}`);
}

async function createLabel({ token, owner, repo, name, color = 'ffffff', description = '' }) {
    return githubRequest(token, 'POST', `/repos/${owner}/${repo}/labels`, { name, color, description });
}

async function createMilestone({ token, owner, repo, title, state = 'open', description = '', due_on }) {
    return githubRequest(token, 'POST', `/repos/${owner}/${repo}/milestones`, { title, state, description, due_on });
}

async function createProject({ token, owner, repo, name, body = '' }) {
    return githubRequest(token, 'POST', `/repos/${owner}/${repo}/projects`, { name, body }, { 'Accept': 'application/vnd.github.inertia-preview+json' });
}

async function createProjectColumn({ token, project_id, name }) {
    return githubRequest(token, 'POST', `/projects/${project_id}/columns`, { name }, { 'Accept': 'application/vnd.github.inertia-preview+json' });
}

async function listProjects({ token, owner, repo }) {
    return githubRequest(token, 'GET', `/repos/${owner}/${repo}/projects`, null, { 'Accept': 'application/vnd.github.inertia-preview+json' });
}

async function listProjectColumns({ token, project_id }) {
    return githubRequest(token, 'GET', `/projects/${project_id}/columns`, null, { 'Accept': 'application/vnd.github.inertia-preview+json' });
}

async function addIssueToProject({ token, column_id, issue_id }) {
    return githubRequest(token, 'POST', `/projects/columns/${column_id}/cards`, { content_id: issue_id, content_type: 'Issue' }, { 'Accept': 'application/vnd.github.inertia-preview+json' });
}

async function createPullRequest({ token, owner, repo, title, head, base, body = '' }) {
    return githubRequest(token, 'POST', `/repos/${owner}/${repo}/pulls`, { title, head, base, body });
}

async function updatePullRequest({ token, owner, repo, pull_number, title, body, state }) {
    return githubRequest(token, 'PATCH', `/repos/${owner}/${repo}/pulls/${pull_number}`, { title, body, state });
}

async function closePullRequest(params) {
    return updatePullRequest({ ...params, state: 'closed' });
}

module.exports = {
    createIssue,
    updateIssue,
    closeIssue,
    listIssues,
    dispatchWorkflow,
    getWorkflowRun,
    createLabel,
    createMilestone,
    createProject,
    createProjectColumn,
    listProjects,
    listProjectColumns,
    addIssueToProject,
    createPullRequest,
    updatePullRequest,
    closePullRequest
};
