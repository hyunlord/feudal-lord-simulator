import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const PROTECTED_PREFIXES = [`.o${"mo"}/`, `.o${"mx"}/`];

export function auditPhase10ScopeFidelity({ allowDirtyProtected = true, allowDirtyProduct = true } = {}) {
  const status = execFileSync("git", ["status", "--porcelain", "--untracked-files=all"], { encoding: "utf8" })
    .split("\n")
    .filter(Boolean);
  const protectedChanges = status.filter((line) => PROTECTED_PREFIXES.some((prefix) => line.slice(3).startsWith(prefix)));
  const productDirty = status.filter((line) => !PROTECTED_PREFIXES.some((prefix) => line.slice(3).startsWith(prefix)));
  const errors = [];
  if (!allowDirtyProduct && productDirty.length > 0) errors.push(`product dirty files: ${productDirty.join(", ")}`);
  if (!allowDirtyProtected && protectedChanges.length > 0) errors.push(`protected dirty files: ${protectedChanges.join(", ")}`);
  return { ok: errors.length === 0, productDirty, protectedChanges, errors };
}

if (isDirectRun()) {
  const result = auditPhase10ScopeFidelity({
    allowDirtyProtected: !process.argv.includes("--strict-protected"),
    allowDirtyProduct: !process.argv.includes("--strict-product"),
  });
  const out = readOut(process.argv.slice(2));
  if (out !== null) await writeJson(out, result);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.ok) process.exitCode = 1;
}

function readOut(argv) {
  const index = argv.indexOf("--out");
  return index >= 0 ? argv[index + 1] ?? null : null;
}

async function writeJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
}

function isDirectRun() {
  return process.argv[1] !== undefined && import.meta.url === new URL(process.argv[1], "file:").href;
}
