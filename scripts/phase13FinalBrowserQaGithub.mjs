import { Phase13FinalBrowserQaError } from "./phase13FinalBrowserQaAssertions.mjs";
import { isExpectedGithubJobLogUrl } from "./phase13FinalBrowserQaConstants.mjs";

const REPO = "hyunlord/feudal-lord-simulator";
const WORKFLOW_NAME = "Deploy to GitHub Pages";
const EVENT = "workflow_dispatch";
const ENVIRONMENT = "github-pages";

export async function verifyPhase13GithubDeployment(input, fetchImpl = globalThis.fetch) {
  if (typeof fetchImpl !== "function") throw new Phase13FinalBrowserQaError("GitHub verification requires fetch");
  const proof = normalizeGithubProof(input.proof, input.publicUrl);
  const headers = githubHeaders(input.token ?? process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN ?? "");
  const run = await fetchJson(proof.workflowRun.apiUrl, headers, fetchImpl, "workflow run");
  const deployment = await fetchJson(proof.deployment.apiUrl, headers, fetchImpl, "deployment");
  const statuses = await fetchJson(deployment.statuses_url, headers, fetchImpl, "deployment statuses");
  const status = Array.isArray(statuses) ? statuses.find((entry) => entry?.id === proof.deploymentStatus.id) : null;
  if (status === null || status === undefined) throw new Phase13FinalBrowserQaError("GitHub deployment status id was not returned");
  assertWorkflowRun(run, proof, input.revision);
  assertDeployment(deployment, proof, input.revision);
  assertDeploymentStatus(status, proof, input.publicUrl);
  return {
    capturedAt: proof.capturedAt,
    verifiedAt: new Date().toISOString(),
    authHeaderUsed: headers.authorization !== undefined,
    workflowRun: {
      id: run.id,
      htmlUrl: run.html_url,
      name: run.name,
      event: run.event,
      status: run.status,
      conclusion: run.conclusion,
      headSha: run.head_sha,
      repository: run.repository?.full_name ?? run.head_repository?.full_name,
    },
    deployment: {
      id: deployment.id,
      url: deployment.url,
      sha: deployment.sha,
      environment: deployment.environment,
      statusesUrl: deployment.statuses_url,
    },
    deploymentStatus: {
      id: status.id,
      url: status.url,
      state: status.state,
      environment: status.environment,
      environmentUrl: status.environment_url,
      logUrl: status.log_url,
    },
  };
}

export function normalizeGithubProof(value, publicUrl) {
  const proof = object(value, "deployment-proof");
  const workflowRun = object(proof.workflowRun, "deployment-proof.workflowRun");
  const deployment = object(proof.deployment, "deployment-proof.deployment");
  const deploymentStatus = object(proof.deploymentStatus, "deployment-proof.deploymentStatus");
  const workflowRunId = positiveInteger(workflowRun.id, "workflowRun.id");
  const workflowRunHtmlUrl = stringValue(workflowRun.html_url, "workflowRun.html_url");
  const deploymentId = positiveInteger(deployment.id, "deployment.id");
  const deploymentUrl = stringValue(deployment.url, "deployment.url");
  const statusId = positiveInteger(deploymentStatus.id, "deploymentStatus.id");
  const statusUrl = stringValue(deploymentStatus.url, "deploymentStatus.url");
  if (workflowRunHtmlUrl !== `https://github.com/${REPO}/actions/runs/${workflowRunId}`) throw new Phase13FinalBrowserQaError("deployment-proof workflow run URL mismatch");
  if (deploymentUrl !== `https://api.github.com/repos/${REPO}/deployments/${deploymentId}`) throw new Phase13FinalBrowserQaError("deployment-proof deployment URL mismatch");
  if (statusUrl !== `${deploymentUrl}/statuses/${statusId}`) throw new Phase13FinalBrowserQaError("deployment-proof deployment status URL mismatch");
  if (stringField(proof, "pageUrl") !== publicUrl) throw new Phase13FinalBrowserQaError("deployment-proof pageUrl mismatch");
  if (!Number.isFinite(Date.parse(stringField(proof, "capturedAt")))) throw new Phase13FinalBrowserQaError("deployment-proof capturedAt invalid");
  return {
    source: proof.source,
    workflowRun: { id: workflowRunId, htmlUrl: workflowRunHtmlUrl, apiUrl: `https://api.github.com/repos/${REPO}/actions/runs/${workflowRunId}` },
    deployment: { id: deploymentId, apiUrl: deploymentUrl },
    deploymentStatus: { id: statusId, apiUrl: statusUrl },
    pageUrl: proof.pageUrl,
    capturedAt: proof.capturedAt,
  };
}

function assertWorkflowRun(run, proof, revision) {
  if (run.id !== proof.workflowRun.id || run.html_url !== proof.workflowRun.htmlUrl) throw new Phase13FinalBrowserQaError("GitHub workflow run identity mismatch");
  if (run.name !== WORKFLOW_NAME || run.event !== EVENT) throw new Phase13FinalBrowserQaError("GitHub workflow run name/event mismatch");
  if (run.status !== "completed" || run.conclusion !== "success") throw new Phase13FinalBrowserQaError("GitHub workflow run must be completed/success");
  if (run.head_sha !== revision) throw new Phase13FinalBrowserQaError("GitHub workflow run head SHA mismatch");
  const repo = run.repository?.full_name ?? run.head_repository?.full_name;
  if (repo !== REPO) throw new Phase13FinalBrowserQaError("GitHub workflow run repo mismatch");
}

function assertDeployment(deployment, proof, revision) {
  if (deployment.id !== proof.deployment.id || deployment.url !== proof.deployment.apiUrl) throw new Phase13FinalBrowserQaError("GitHub deployment identity mismatch");
  if (deployment.sha !== revision) throw new Phase13FinalBrowserQaError("GitHub deployment SHA mismatch");
  if (deployment.environment !== ENVIRONMENT) throw new Phase13FinalBrowserQaError("GitHub deployment environment mismatch");
  if (deployment.statuses_url !== `${proof.deployment.apiUrl}/statuses`) throw new Phase13FinalBrowserQaError("GitHub deployment statuses URL mismatch");
}

function assertDeploymentStatus(status, proof, publicUrl) {
  if (status.id !== proof.deploymentStatus.id || status.url !== proof.deploymentStatus.apiUrl) throw new Phase13FinalBrowserQaError("GitHub deployment status identity mismatch");
  if (status.state !== "success") throw new Phase13FinalBrowserQaError("GitHub deployment status state must be success");
  if (status.environment !== ENVIRONMENT || status.environment_url !== publicUrl) throw new Phase13FinalBrowserQaError("GitHub deployment status environment mismatch");
  if (!isExpectedGithubJobLogUrl(status.log_url, proof.workflowRun.id)) throw new Phase13FinalBrowserQaError("GitHub deployment status log_url mismatch");
}

async function fetchJson(url, headers, fetchImpl, label) {
  const response = await fetchImpl(url, { headers });
  if (response?.ok !== true) throw new Phase13FinalBrowserQaError(`GitHub ${label} fetch failed: HTTP ${response?.status ?? "unknown"}`);
  return response.json();
}

function githubHeaders(token) {
  const headers = { accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28" };
  if (token.trim() !== "") headers.authorization = `Bearer ${token}`;
  return headers;
}

function object(value, label) {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) return value;
  throw new Phase13FinalBrowserQaError(`${label} must be an object`);
}

function stringField(value, key) {
  const field = value[key];
  return stringValue(field, key);
}

function stringValue(field, key) {
  if (typeof field !== "string" || field.trim() === "") throw new Phase13FinalBrowserQaError(`deployment-proof missing ${key}`);
  return field;
}

function positiveInteger(value, key) {
  if (!Number.isInteger(value) || value <= 0) throw new Phase13FinalBrowserQaError(`deployment-proof ${key} must be a positive integer`);
  return value;
}
