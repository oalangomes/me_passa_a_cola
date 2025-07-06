const API_URL = 'https://api.linear.app/graphql';

async function linearRequest(token, query, variables = {}) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': token
    },
    body: JSON.stringify({ query, variables })
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Linear API ${res.status}: ${text}`);
  }
  return await res.json();
}

async function updateIssueProject({ token, issueId, projectId }) {
  const mutation = `mutation UpdateIssue($issueId: String!, $projectId: String!) {\n  issueUpdate(id: $issueId, input: { projectId: $projectId }) {\n    success\n  }\n}`;
  return linearRequest(token, mutation, { issueId, projectId });
}

module.exports = { updateIssueProject };
