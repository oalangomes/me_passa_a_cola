const { getCache, setCache } = require("./cache");
const API_URL = 'https://api.github.com';
const GRAPHQL_URL = 'https://api.github.com/graphql';

async function githubGraphqlRequest(token, query, variables = {}, ttl) {
    const cacheKey = `gh-graphql:${query}:${JSON.stringify(variables)}`;
    const cached = getCache(cacheKey);
    if (cached) return cached;
    const res = await fetch(GRAPHQL_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'User-Agent': 'me-passa-a-cola'
        },
        body: JSON.stringify({ query, variables })
    });
    const data = await res.json();
    if (!res.ok) {
        throw new Error(`GitHub GraphQL ${res.status}: ${JSON.stringify(data)}`);
    }
    if (data.errors) {
        const msg = data.errors.map(e => e.message).join('; ');
        throw new Error(msg);
    }
    setCache(cacheKey, data, ttl);
    return data;
}

async function githubRequest(token, method, url, body, extraHeaders = {}, ttl) {
    const cacheKey = `gh-rest:${method}:${url}:${JSON.stringify(body)}`;
    const cached = getCache(cacheKey);
    if (cached) return cached;
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
    if (res.status === 204) {
        setCache(cacheKey, {}, ttl);
        return {};
    }
    const json = await res.json();
    setCache(cacheKey, json, ttl);
    return json;
}

async function createIssue({ token, owner, repo, title, body = '', labels = [], assignees = [], milestone }) {
    return githubRequest(token, 'POST', `/repos/${owner}/${repo}/issues`, {
        title, body, labels, assignees, milestone
    });
}

async function updateIssue({ token, owner, repo, issue_number, title, body, state, labels, assignees, milestone }) {
    return githubRequest(token, 'PATCH', `/repos/${owner}/${repo}/issues/${issue_number}`, {
        title, body, state, labels, assignees, milestone
    });
}

async function closeIssue(params) {
    return updateIssue({ ...params, state: 'closed' });
}

async function listIssues({ token, owner, repo, state = 'open', labels = '', page, per_page }) {
    const params = { state, labels };
    if (page !== undefined) params.page = page;
    if (per_page !== undefined) params.per_page = per_page;
    const searchParams = new URLSearchParams(params);
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

async function listMilestones({ token, owner, repo, state = 'open' }) {
    const searchParams = new URLSearchParams({ state });
    return githubRequest(token, 'GET', `/repos/${owner}/${repo}/milestones?${searchParams.toString()}`);
}

async function updateMilestone({ token, owner, repo, milestone_number, ...data }) {
    return githubRequest(token, 'PATCH', `/repos/${owner}/${repo}/milestones/${milestone_number}`, data);
}

async function createProject({ token, owner, repo, name, body = '' }) {
    const repoQuery = `query ($owner: String!, $name: String!) { repository(owner: $owner, name: $name) { id } }`;
    const repoRes = await githubGraphqlRequest(token, repoQuery, { owner, name: repo });
    const repositoryId = repoRes.data.repository.id;
    const mutation = `mutation ($repositoryId: ID!, $name: String!, $body: String!) {\n  createProject(input: {repositoryId: $repositoryId, name: $name, body: $body}) {\n    project { id name body }\n  }\n}`;
    const result = await githubGraphqlRequest(token, mutation, { repositoryId, name, body });
    return result.data.createProject.project;
}

async function createProjectColumn({ token, project_id, name }) {
    const mutation = `mutation ($projectId: ID!, $name: String!) {\n  addProjectColumn(input: {projectId: $projectId, name: $name}) {\n    columnEdge { node { id name } }\n  }\n}`;
    const result = await githubGraphqlRequest(token, mutation, { projectId: project_id, name });
    return result.data.addProjectColumn.columnEdge.node;
}

async function listProjects({ token, owner, repo, cursor }) {
    const query = `query ($owner: String!, $name: String!, $cursor: String) {\n  repository(owner: $owner, name: $name) {\n    projects(first: 100, after: $cursor) { nodes { id name body } }\n  }\n}`;
    const result = await githubGraphqlRequest(token, query, { owner, name: repo, cursor });
    return result.data.repository.projects.nodes;
}

async function listProjectColumns({ token, project_id }) {
    const query = `query ($projectId: ID!) {\n  node(id: $projectId) {\n    ... on Project {\n      columns(first: 100) { nodes { id name } }\n    }\n  }\n}`;
    const result = await githubGraphqlRequest(token, query, { projectId: project_id });
    if (!result.data.node) {
        throw new Error('Projeto não encontrado ou ID inválido');
    }
    if (!result.data.node.columns) {
        return [];
    }
    return result.data.node.columns.nodes || [];
}

async function addIssueToProject({ token, column_id, issue_id }) {
    const mutation = `mutation ($projectColumnId: ID!, $contentId: ID!) {\n  addProjectCard(input: {projectColumnId: $projectColumnId, contentId: $contentId}) {\n    cardEdge { node { id } }\n  }\n}`;
    const result = await githubGraphqlRequest(token, mutation, { projectColumnId: column_id, contentId: issue_id });
    return result.data.addProjectCard.cardEdge.node;
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

async function mergePullRequest({ token, owner, repo, pull_number, method = 'merge' }) {
    return githubRequest(token, 'PUT', `/repos/${owner}/${repo}/pulls/${pull_number}/merge`, {
        merge_method: method
    });
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
    listMilestones,
    updateMilestone,
    createProject,
    createProjectColumn,
    listProjects,
    listProjectColumns,
    addIssueToProject,
    createPullRequest,
    updatePullRequest,
    closePullRequest,
    mergePullRequest,
    githubGraphqlRequest
};
