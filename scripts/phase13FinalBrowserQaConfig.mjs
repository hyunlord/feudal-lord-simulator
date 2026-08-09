import { readFileSync } from "node:fs";
import path from "node:path";

import {
  PHASE13_DEFAULT_CHROME,
  PHASE13_DEFAULT_CHROME_PORT,
  PHASE13_DEFAULT_PUBLIC_URL,
  PHASE13_FRAME_DURATION_MS,
} from "./phase13FinalBrowserQaConstants.mjs";
import { normalizeGithubProof } from "./phase13FinalBrowserQaGithub.mjs";

export function parsePhase13FinalBrowserQaArgs(args) {
  const values = parsePairs(args);
  const publicUrl = valueOrNull(values, "public-url") ?? valueOrNull(values, "url") ?? PHASE13_DEFAULT_PUBLIC_URL;
  const revision = readCleanRevision(required(values, "revision"));
  const proofSource = required(values, "deployment-proof");
  const evidenceDir = required(values, "evidence-dir");
  return {
    publicUrl,
    revision,
    deploymentProof: readAuthoritativeDeploymentProof(proofSource, { publicUrl, revision }),
    evidenceDir,
    out: valueOrNull(values, "out") ?? path.join(evidenceDir, "browser_qa.json"),
    screenshotDir: valueOrNull(values, "screenshot-dir") ?? path.join(evidenceDir, "screens"),
    chromePath: valueOrNull(values, "chrome-path") ?? process.env.CHROME_PATH ?? PHASE13_DEFAULT_CHROME,
    chromePort: valueOrNull(values, "chrome-port") === null
      ? PHASE13_DEFAULT_CHROME_PORT
      : readInteger(required(values, "chrome-port"), "chrome-port"),
    frameDurationMs: PHASE13_FRAME_DURATION_MS,
    token: process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN ?? "",
  };
}

export function readCleanRevision(value) {
  const normalized = value.trim();
  if (!/^[0-9a-f]{40}$/i.test(normalized)) {
    throw new Error("Set --revision to a clean 40-hex revision.");
  }
  return normalized;
}

export function readAuthoritativeDeploymentProof(source, expected) {
  const value = readJsonObject(source);
  const normalized = normalizeGithubProof({ source, ...value }, expected.publicUrl);
  const proof = {
    source,
    workflowRun: { id: normalized.workflowRun.id, html_url: normalized.workflowRun.htmlUrl },
    deployment: { id: normalized.deployment.id, url: normalized.deployment.apiUrl },
    deploymentStatus: { id: normalized.deploymentStatus.id, url: normalized.deploymentStatus.apiUrl },
    pageUrl: normalized.pageUrl,
    capturedAt: normalized.capturedAt,
  };
  validateDeploymentProof(proof, expected);
  return proof;
}

function validateDeploymentProof(proof, expected) {
  if (proof.pageUrl !== expected.publicUrl) throw new Error(`deployment-proof pageUrl ${proof.pageUrl} does not match ${expected.publicUrl}`);
  if (!Number.isFinite(Date.parse(proof.capturedAt))) throw new Error("deployment-proof capturedAt must be an ISO timestamp");
}

function readJsonObject(source) {
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(source, "utf8"));
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`deployment-proof could not be read: ${detail}`);
  }
  return asObject(parsed, "deployment-proof");
}

function asObject(value, key) {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) return value;
  throw new Error(`${key} must be an object`);
}

function parsePairs(args) {
  const values = new Map();
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    const value = args[index + 1];
    if (!key?.startsWith("--") || value === undefined) throw new Error(`Invalid argument near ${key ?? "<end>"}`);
    values.set(key.slice(2), value);
  }
  return values;
}

function required(values, key) {
  const value = values.get(key);
  if (value === undefined || value.trim() === "") throw new Error(`Missing --${key}`);
  return value;
}

function valueOrNull(values, key) {
  return values.get(key) ?? null;
}

function readInteger(value, label) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed.toString() !== value) throw new Error(`--${label} must be an integer`);
  return parsed;
}
