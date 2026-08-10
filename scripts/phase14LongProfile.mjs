import { execFileSync as nodeExecFileSync, spawn } from "node:child_process";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  closeChrome,
  createCdpClient,
  createTarget,
  waitForChrome,
} from "./phase8Task10CdpClient.mjs";
import {
  assertPhase14LongProfileEvidence,
  summarizePhase14CallbackSamples,
  summarizeFrameDurations,
} from "./phase14LongProfileAssertions.mjs";
import {
  capturePhase14Checkpoints,
  preparePhase14LongProfilePage,
} from "./phase14LongProfileBrowser.mjs";
import { createPhase13ErrorCollector } from "./phase13FinalBrowserQaErrors.mjs";
import { PHASE13_DEFAULT_CHROME } from "./phase13FinalBrowserQaConstants.mjs";

const DEFAULT_URL = "http://127.0.0.1:4173/";
const DEFAULT_CHROME_PORT = 9264;

export {
  assertPhase14LongProfileEvidence,
  summarizePhase14CallbackSamples,
  summarizeFrameDurations,
};

export async function runPhase14LongProfile(config) {
  let evidence = null;
  const chromeSession = await launchPhase14Chrome({
    chromePath: config.chromePath,
    remoteDebuggingPort: config.chromePort,
    userDataPrefix: "phase14-long-profile-chrome-",
    extraArgs: chromeSandboxArgs(),
  });
  try {
    await waitForChrome(config.chromePort, chromeSession.stderr);
    bringChromeFrontmost(chromeSession.chrome.pid);
    const target = await createTarget(config.chromePort);
    const client = await createCdpClient(target.webSocketDebuggerUrl);
    try {
      await enableDomains(client);
      await mkdir(config.screenshotDir, { recursive: true });
      const errors = await createPhase13ErrorCollector(client);
      try {
        const setup = await preparePhase14LongProfilePage(client, config.url);
        const checkpoints = await capturePhase14Checkpoints({ client, screenshotDir: config.screenshotDir, errors });
        const observedErrors = await errors.read();
        evidence = buildEvidence(config, setup, checkpoints, observedErrors);
      } finally {
        errors.dispose();
      }
    } finally {
      client.close();
    }
  } finally {
    await closeChrome(chromeSession);
  }
  await writeEvidence(config.out, evidence);
  assertPhase14LongProfileEvidence(evidence);
  return evidence;
}

export function parsePhase14LongProfileArgs(args, repoRoot = process.cwd()) {
  const values = parsePairs(args);
  const evidenceDir = valueOrNull(values, "evidence-dir") ?? path.join("/tmp", `phase14-long-profile-${Date.now()}`);
  return {
    url: valueOrNull(values, "url") ?? process.env.PHASE14_PROFILE_URL ?? DEFAULT_URL,
    evidenceDir,
    out: valueOrNull(values, "out") ?? path.join(evidenceDir, "phase14_long_profile.json"),
    screenshotDir: valueOrNull(values, "screenshot-dir") ?? path.join(evidenceDir, "screens"),
    chromePath: valueOrNull(values, "chrome-path") ?? process.env.CHROME_PATH ?? PHASE13_DEFAULT_CHROME,
    chromePort: valueOrNull(values, "chrome-port") === null ? DEFAULT_CHROME_PORT : readInteger(required(values, "chrome-port"), "chrome-port"),
    ...resolvePhase14Revision({ revision: valueOrNull(values, "revision"), repoRoot, execFileSync: nodeExecFileSync }),
  };
}

export function resolvePhase14Revision(input) {
  if (input.revision !== null && input.revision !== undefined && input.revision.trim() !== "") {
    return { revision: input.revision.trim(), revisionSource: "argument", revisionDirty: input.revision.includes("+dirty") };
  }
  const head = input.execFileSync("git", ["rev-parse", "HEAD"], { cwd: input.repoRoot, encoding: "utf8" }).trim();
  if (!/^[0-9a-f]{40}$/i.test(head)) throw new Error("git HEAD did not resolve to a 40-hex revision");
  const status = input.execFileSync("git", ["status", "--porcelain"], { cwd: input.repoRoot, encoding: "utf8" }).trim();
  const revisionDirty = status.length > 0;
  return { revision: revisionDirty ? `${head}+dirty` : head, revisionSource: "git", revisionDirty };
}

function buildEvidence(config, setup, checkpoints, errors) {
  const candidate = {
    schemaVersion: 1,
    verdict: "PASS",
    url: config.url,
    revision: config.revision,
    revisionSource: config.revisionSource,
    revisionDirty: config.revisionDirty,
    capturedAt: new Date().toISOString(),
    startedAt: setup.startedAt,
    initialSnapshot: setup.initialSnapshot,
    controls: setup.controls,
    checkpoints,
    errors,
  };
  try {
    assertPhase14LongProfileEvidence(candidate);
    return candidate;
  } catch {
    return { ...candidate, verdict: "FAIL" };
  }
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

function chromeSandboxArgs(uid = process.getuid?.()) {
  return uid === 0 ? ["--no-sandbox"] : [];
}

async function launchPhase14Chrome({ chromePath, remoteDebuggingPort, userDataPrefix, extraArgs }) {
  const userDataDir = await mkdtemp(path.join("/tmp", userDataPrefix));
  const chrome = spawn(chromePath, [
    "--disable-dev-shm-usage",
    "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding",
    "--disable-backgrounding-occluded-windows",
    "--window-size=1440,900",
    "--window-position=0,0",
    ...extraArgs,
    "--no-first-run",
    "--no-default-browser-check",
    `--remote-debugging-port=${remoteDebuggingPort}`,
    `--user-data-dir=${userDataDir}`,
    "about:blank",
  ], { stdio: ["ignore", "ignore", "pipe"] });
  let stderr = "";
  chrome.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
  return { chrome, userDataDir, stderr: () => stderr };
}

function bringChromeFrontmost(pid) {
  if (process.platform !== "darwin" || pid === undefined) return;
  const script = `tell application "Google Chrome" to activate\n` +
    `tell application "System Events" to set frontmost of first process whose unix id is ${pid} to true`;
  nodeExecFileSync("osascript", ["-e", script], { stdio: "ignore" });
}

async function enableDomains(client) {
  await client.send("Page.enable");
  await client.send("Runtime.enable");
  await client.send("Log.enable");
  await client.send("Network.enable");
  await client.send("Performance.enable");
}

async function writeEvidence(out, evidence) {
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, `${JSON.stringify(evidence, null, 2)}\n`);
}

if (isDirectRun()) {
  try {
    const result = await runPhase14LongProfile(parsePhase14LongProfileArgs(process.argv.slice(2)));
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}

function isDirectRun() {
  const entryPath = process.argv[1];
  return entryPath !== undefined && import.meta.url === new URL(entryPath, "file:").href;
}
