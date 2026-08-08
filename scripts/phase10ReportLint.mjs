import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export const REQUIRED_SECTIONS = [
  "1. Implemented scope by part and skipped work",
  "2. Why the missing tick loop was not caught",
  "3. Owner decisions",
  "4. Review objections overridden",
  "5. Final walker speeds",
  "6. Part 6 browser screenshots and playthrough",
  "7. Tree and terrain candidate selections",
  "8. Determinism hashes",
  "9. Test output and frame budget",
  "10. Commit hashes and publication proof",
  "11. Public URL honest-read proof",
];

export function lintPhase10Report({ report, allowPending = false }) {
  const text = readFileSync(report, "utf8");
  const sections = [...text.matchAll(/^## (.+)$/gm)].map((match) => ({ title: match[1], index: match.index ?? -1 }));
  const titles = sections.map((section) => section.title);
  const errors = [];
  if (titles.length !== REQUIRED_SECTIONS.length) {
    errors.push(`expected ${REQUIRED_SECTIONS.length} top-level sections, found ${titles.length}`);
  }
  for (const [index, expected] of REQUIRED_SECTIONS.entries()) {
    if (titles[index] !== expected) errors.push(`section ${index + 1} must be ${JSON.stringify(expected)}, found ${JSON.stringify(titles[index] ?? null)}`);
  }
  const pendingCount = (text.match(/\bPENDING[A-Z0-9_-]*\b|TBD|TODO_PUBLIC_URL/gi) ?? []).length;
  if (!allowPending && pendingCount > 0) errors.push(`pending placeholders found: ${pendingCount}`);
  return { ok: errors.length === 0, report, sectionCount: titles.length, sections, pendingCount, errors };
}

export function parseReportLintArgs(argv) {
  const args = parsePairs(argv);
  return {
    report: args.get("_positional_0") ?? required(args, "report"),
    allowPending: args.has("allow-pending"),
    exactSections: args.has("exact-sections") ? Number.parseInt(required(args, "exact-sections"), 10) : null,
    out: args.get("out") ?? null,
  };
}

if (isDirectRun()) {
  const args = parseReportLintArgs(process.argv.slice(2));
  const result = lintPhase10Report(args);
  if (args.exactSections !== null && result.sectionCount !== args.exactSections) {
    result.ok = false;
    result.errors.push(`expected --exact-sections ${args.exactSections}, found ${result.sectionCount}`);
  }
  if (args.out !== null) writeJson(args.out, result);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.ok) process.exitCode = 1;
}

function parsePairs(argv) {
  const args = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key?.startsWith("--")) {
      args.set(`_positional_${[...args.keys()].filter((item) => item.startsWith("_positional_")).length}`, key);
      continue;
    }
    const name = key.slice(2);
    if (name === "allow-pending") {
      args.set(name, "true");
      continue;
    }
    const value = argv[index + 1];
    if (value === undefined) throw new Error(`missing value for ${key}`);
    args.set(name, value);
    index += 1;
  }
  return args;
}

function required(args, key) {
  const value = args.get(key);
  if (value === undefined || value.trim() === "") throw new Error(`missing --${key}`);
  return value;
}

function writeJson(file, value) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function isDirectRun() {
  return process.argv[1] !== undefined && import.meta.url === new URL(process.argv[1], "file:").href;
}
