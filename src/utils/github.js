const API_URL = 'https://api.github.com';

async function githubRequest(token, method, url, body) {
    const headers = {
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'me-passa-a-cola'
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

module.exports = { createIssue, updateIssue, closeIssue, listIssues };
