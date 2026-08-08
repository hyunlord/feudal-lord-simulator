import { writeFile } from "node:fs/promises";
import path from "node:path";

export async function runPhase10DeployProof({ publicUrl, localSha, remoteSha, out }) {
  if (!/^[0-9a-f]{40}$/i.test(localSha)) throw new Error("localSha must be a 40-hex revision");
  if (!/^[0-9a-f]{40}$/i.test(remoteSha)) throw new Error("remoteSha must be a 40-hex revision");
  const startedAt = new Date().toISOString();
  const response = await fetch(cacheBusted(publicUrl));
  const body = await response.text();
  const contentType = response.headers.get("content-type") ?? "";
  const assetRefs = [...body.matchAll(/(?:src|href)="([^"]+)"/g)].map((match) => match[1]);
  const result = {
    schemaVersion: 1,
    publicUrl,
    startedAt,
    checkedAt: new Date().toISOString(),
    localSha,
    remoteSha,
    shaMatch: localSha === remoteSha,
    httpStatus: response.status,
    contentType,
    ok: response.ok && contentType.includes("text/html") && localSha === remoteSha && /<div id="root">/.test(body) && assetRefs.length > 0,
    rootDivPresent: /<div id="root">/.test(body),
    assetRefs,
  };
  if (out !== null) {
    await writeFileJson(out, result);
  }
  if (!result.ok) throw new Error(`deploy proof failed: ${JSON.stringify(result)}`);
  return result;
}

if (isDirectRun()) {
  const args = parseArgs(process.argv.slice(2));
  if (args.mode === "resolve-public-url") {
    process.stdout.write(`${resolvePublicUrl(args.repo)}\n`);
  } else {
  const result = await runPhase10DeployProof(args);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  }
}

export function resolvePublicUrl(repo) {
  const [owner, name] = repo.split("/");
  if (!owner || !name) throw new Error("--repo must be owner/name");
  return `https://${owner}.github.io/${name}/`;
}

function cacheBusted(value) {
  const url = new URL(value);
  url.searchParams.set("phase10DeployProof", Date.now().toString());
  return url.href;
}

async function writeFileJson(file, value) {
  await import("node:fs/promises").then(({ mkdir }) => mkdir(path.dirname(file), { recursive: true }));
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
}

function parseArgs(argv) {
  const args = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || value === undefined) throw new Error(`invalid argument near ${key ?? "<end>"}`);
    args.set(key.slice(2), value);
  }
  const mode = args.get("mode") ?? "fetch-public";
  if (mode === "resolve-public-url") {
    return { mode, repo: required(args, "repo"), publicUrl: "", localSha: "0".repeat(40), remoteSha: "0".repeat(40), out: null };
  }
  return { mode, repo: args.get("repo") ?? "", publicUrl: required(args, "public-url"), localSha: args.get("local-sha") ?? "0".repeat(40), remoteSha: args.get("remote-sha") ?? "0".repeat(40), out: args.get("out") ?? null };
}

function required(args, key) {
  const value = args.get(key);
  if (value === undefined || value.trim() === "") throw new Error(`missing --${key}`);
  return value;
}

function isDirectRun() {
  return process.argv[1] !== undefined && import.meta.url === new URL(process.argv[1], "file:").href;
}
