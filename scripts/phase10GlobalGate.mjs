import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { auditPhase10CodeQuality } from "./phase10CodeQualityAudit.mjs";
import { auditPhase10PlanCompliance } from "./phase10PlanComplianceAudit.mjs";
import { lintPhase10Report } from "./phase10ReportLint.mjs";
import { auditPhase10ScopeFidelity } from "./phase10ScopeFidelityAudit.mjs";

export function runPhase10GlobalGate({ report, evidenceRoot, skipCommands = false }) {
  const checks = {
    reportLint: lintPhase10Report({ report, allowPending: false }),
    planCompliance: auditPhase10PlanCompliance({ report, evidenceRoot }),
    codeQuality: auditPhase10CodeQuality(),
    scopeFidelity: auditPhase10ScopeFidelity(),
  };
  const commands = [];
  if (!skipCommands) {
    commands.push(run("npm", ["run", "typecheck"]));
    commands.push(run("npx", ["tsx", "--test", "tests/phase10ReportGate.test.ts", "tests/phase10BrowserProof.test.ts", "tests/phase10BrowserProofReview.test.ts", "tests/phase10BrowserProofSourceGuard.test.ts"]));
    commands.push(run("npm", ["run", "build"]));
  }
  const errors = Object.entries(checks).flatMap(([name, result]) => result.ok ? [] : [`${name}: ${result.errors.join("; ")}`]);
  for (const command of commands) {
    if (command.status !== "PASS") errors.push(`${command.command}: ${command.status}`);
  }
  return { ok: errors.length === 0, errors, checks, commands };
}

if (isDirectRun()) {
  const args = parseArgs(process.argv.slice(2));
  const result = runPhase10GlobalGate(args);
  if (args.out !== null) await writeJson(args.out, result);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.ok) process.exitCode = 1;
}

function run(command, args) {
  try {
    const stdout = execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return { command: [command, ...args].join(" "), status: "PASS", stdout: tail(stdout) };
  } catch (error) {
    return { command: [command, ...args].join(" "), status: `FAIL ${error.status ?? ""}`.trim(), stdout: tail(error.stdout?.toString() ?? ""), stderr: tail(error.stderr?.toString() ?? "") };
  }
}

function tail(text) {
  return text.split("\n").slice(-20).join("\n").trim();
}

function parseArgs(argv) {
  const args = new Map();
  let skipCommands = false;
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (key === "--skip-commands") {
      skipCommands = true;
      continue;
    }
    if (!key?.startsWith("--")) throw new Error(`invalid argument ${key ?? "<end>"}`);
    const value = argv[index + 1];
    if (value === undefined) throw new Error(`missing value for ${key}`);
    args.set(key.slice(2), value);
    index += 1;
  }
  return {
    report: required(args, "report"),
    evidenceRoot: required(args, "evidence-root"),
    skipCommands,
    maxReviewRounds: args.has("max-review-rounds") ? Number.parseInt(required(args, "max-review-rounds"), 10) : null,
    out: args.get("out") ?? null,
  };
}

function required(args, key) {
  const value = args.get(key);
  if (value === undefined || value.trim() === "") throw new Error(`missing --${key}`);
  return value;
}

async function writeJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
}

function isDirectRun() {
  return process.argv[1] !== undefined && import.meta.url === new URL(process.argv[1], "file:").href;
}
