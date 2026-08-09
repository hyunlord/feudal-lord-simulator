import { readFileSync } from "node:fs";

export function readDeploymentProof(source, expected) {
  let value;
  try {
    value = JSON.parse(readFileSync(source, "utf8"));
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`deployment-proof could not be read: ${detail}`);
  }
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("deployment-proof must be a JSON object");
  }
  const url = requiredString(value, "url");
  const headSha = requiredString(value, "headSha");
  const conclusion = requiredString(value, "conclusion");
  if (url !== expected.url) throw new Error(`deployment-proof URL ${url} does not match ${expected.url}`);
  if (headSha !== expected.revision) throw new Error(`deployment-proof headSha ${headSha} does not match revision ${expected.revision}`);
  if (conclusion !== "success") throw new Error(`deployment-proof conclusion must be success, received ${conclusion}`);
  return { source, url, headSha, conclusion };
}

function requiredString(value, key) {
  const field = value[key];
  if (typeof field !== "string" || field.trim() === "") throw new Error(`deployment-proof missing ${key}`);
  return field;
}
