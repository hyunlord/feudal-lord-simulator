import { readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { lintPhase10Report } from "./phase10ReportLint.mjs";

const REQUIRED_COMMITS = [
  "5cc8b1f5c2978aad9d5198fd08bcee84d8b43ef6",
  "ece059ea700555adffc20ba53741d3fab3453a8e",
  "fc3dc601b390e4b678b32d0063901c68faba4099",
  "2e355e8d611b8f46ea1c95b39348d91b1c1109ff",
  "4d6fe5a02507c183c1db087cdef7212b24835e29",
  "504b0b16e90c94995fada38d2ae38cb0cb54b784",
];

const REQUIRED_OBJECTION = "fresh no-road flow proves construction sites persist with roadRevision 0→0 and idle economy for 600+ actual 1x ticks; exact `🚧 길이 필요합니다` marker is proven in a separate completed-then-disconnected flow, not the same fresh flow.";

export function auditPhase10PlanCompliance({ report, evidenceRoot }) {
  const text = readFileSync(report, "utf8");
  const lint = lintPhase10Report({ report, allowPending: false });
  const playthrough = JSON.parse(readFileSync(path.join(evidenceRoot, "task-6-playthrough/playthrough.json"), "utf8"));
  const frame = JSON.parse(readFileSync(path.join(evidenceRoot, "task-6-playthrough/frame-budget.json"), "utf8"));
  const errors = [...lint.errors];
  for (const commit of REQUIRED_COMMITS) {
    if (!text.includes(commit)) errors.push(`report missing commit ${commit}`);
  }
  if (!text.includes(REQUIRED_OBJECTION)) errors.push("report missing required Part6 bounded objection");
  if (!text.includes("CARTER_SPEED: 0.14") || !text.includes("DISTRIBUTOR_SPEED: 0.11")) errors.push("report missing final walker speeds");
  if (playthrough.ticks !== 3001) errors.push(`playthrough ticks ${playthrough.ticks} !== 3001`);
  if (playthrough.logsTransferred !== 3) errors.push(`logsTransferred ${playthrough.logsTransferred} !== 3`);
  if (playthrough.timberAccumulated !== 3) errors.push(`timberAccumulated ${playthrough.timberAccumulated} !== 3`);
  if (playthrough.walkerStartHash === playthrough.walkerFinalHash) errors.push("same carter movement hash did not change");
  if (playthrough.omittedRoad?.tick !== 601) errors.push(`omitted road ticks ${playthrough.omittedRoad?.tick} !== 601`);
  if (playthrough.omittedRoad?.initialRoadRevision !== 0 || playthrough.omittedRoad?.finalRoadRevision !== 0) errors.push("omitted road revision was not 0 to 0");
  if (frame.p95Ms !== 6 || frame.ok !== true) errors.push(`frame p95 ${frame.p95Ms} not exactly the recorded 6ms pass`);
  return {
    ok: errors.length === 0,
    errors,
    commits: REQUIRED_COMMITS,
    part6: {
      ticks: playthrough.ticks,
      logsTransferred: playthrough.logsTransferred,
      timberAccumulated: playthrough.timberAccumulated,
      omittedRoadTicks: playthrough.omittedRoad?.tick,
      frameP95Ms: frame.p95Ms,
    },
  };
}

if (isDirectRun()) {
  const args = parseArgs(process.argv.slice(2));
  const result = auditPhase10PlanCompliance(args);
  if (args.out !== null) await writeJson(args.out, result);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.ok) process.exitCode = 1;
}

function parseArgs(argv) {
  const args = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || value === undefined) throw new Error(`invalid argument near ${key ?? "<end>"}`);
    args.set(key.slice(2), value);
  }
  return { report: required(args, "report"), evidenceRoot: required(args, "evidence-root"), plan: args.get("plan") ?? null, out: args.get("out") ?? null };
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
