#!/usr/bin/env node
// The tests a change touches (user decision 2026-10-06: before a trunk push, check:merge + these tests + the geometry
// audit of the changed UI rows; the full clean-clone suite runs on the trunk every few hours, bundled).
//   node scripts/checks/changedTests.mjs [--base <ref>] [--run] [--list]
// Changed files: <base>...HEAD plus the working tree (default base: the merge base with origin/<trunk>). A test is picked
// when it changed itself, when it imports a changed file directly or through other files (static import / export from /
// import() / require, relative paths in src, tests, scripts, tools), or when its text names a changed non-code file
// (a fixture, JSON, CSV or document it reads). A change to package.json, package-lock.json or a tsconfig picks every
// test. --run runs the picked tests with tsx --test (on the Mac only when they are few; else use the runner).
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");
const TRUNK = "codex/phase15-organic-ground";
const CODE = new Set([".ts", ".tsx", ".mts", ".mjs", ".js", ".cjs"]);
const SCAN = ["src", "tests", "scripts", "tools"];
const ALL_TRIGGERS = new Set(["package.json", "package-lock.json", "tsconfig.json"]);
const MAC_LIMIT = 30;

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const git = (...a) => execFileSync("git", a, { cwd: ROOT, encoding: "utf8", maxBuffer: 256 << 20 }).trim();

function mergeBase() {
  for (const ref of [`origin/${TRUNK}`, TRUNK, `refs/remote-runs/${TRUNK}`]) {
    try { return git("merge-base", "HEAD", ref); } catch { /* try the next name */ }
  }
  console.error(`no trunk ref to compare with; pass --base <commit>`); process.exit(2);
}
const base = opt("--base") ?? mergeBase();
const changed = new Set([
  ...git("diff", "--name-only", base).split("\n"),
  ...git("ls-files", "--others", "--exclude-standard").split("\n"),
].filter(Boolean).filter(f => existsSync(join(ROOT, f))));

function walk(dir, out = []) {
  for (const e of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name.startsWith(".")) continue;
    const rel = join(dir, e.name);
    if (e.isDirectory()) walk(rel, out); else if (CODE.has(extname(e.name))) out.push(rel);
  }
  return out;
}
const files = SCAN.filter(d => existsSync(join(ROOT, d))).flatMap(d => walk(d));
const IMPORT = /(?:import|export)\s[^'"`;]*?from\s*["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)|import\s+["']([^"']+)["']|require\(\s*["']([^"']+)["']\s*\)/g;
function resolveSpec(from, spec) {
  if (!spec.startsWith(".")) return null;
  const raw = join(dirname(from), spec);
  const stem = raw.replace(/\.(js|mjs|cjs|ts|tsx)$/, "");
  for (const c of [raw, `${stem}.ts`, `${stem}.tsx`, `${stem}.mts`, `${stem}.mjs`, `${stem}.js`, join(raw, "index.ts"), join(raw, "index.js")]) {
    if (existsSync(join(ROOT, c)) && statSync(join(ROOT, c)).isFile()) return c;
  }
  return null;
}
// Reverse graph: file -> the files that import it.
const importers = new Map();
const text = new Map();
for (const f of files) {
  const src = readFileSync(join(ROOT, f), "utf8"); text.set(f, src);
  for (const m of src.matchAll(IMPORT)) {
    const dep = resolveSpec(f, m[1] ?? m[2] ?? m[3] ?? m[4]);
    if (!dep) continue;
    if (!importers.has(dep)) importers.set(dep, new Set());
    importers.get(dep).add(f);
  }
}
const isTest = (f) => f.startsWith("tests/") && /\.test\.(ts|tsx|mts|mjs|js)$/.test(f);
const tests = files.filter(isTest);

const nameCount = new Map();
for (const f of git("ls-files").split("\n")) nameCount.set(basename(f), (nameCount.get(basename(f)) ?? 0) + 1);
const picked = new Map();   // test -> why
// package.json picks everything only when what is installed changes (a new npm script changes no test).
function depsChanged() {
  const keys = ["dependencies", "devDependencies", "optionalDependencies", "overrides", "type", "imports"];
  const pick = (json) => JSON.stringify(keys.map(k => json?.[k] ?? null));
  let before = null;
  try { before = JSON.parse(git("show", `${base}:package.json`)); } catch { return true; }
  return pick(before) !== pick(JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")));
}
const everything = [...changed].find(f => ALL_TRIGGERS.has(f) && (f !== "package.json" || depsChanged()));
if (everything) for (const t of tests) picked.set(t, `${everything} changed`);
for (const f of changed) {
  if (isTest(f)) { picked.set(f, picked.get(f) ?? "the test changed"); continue; }
  if (CODE.has(extname(f))) {
    const seen = new Set([f]); const queue = [f];
    while (queue.length) {
      const cur = queue.shift();
      for (const imp of importers.get(cur) ?? []) {
        if (seen.has(imp)) continue; seen.add(imp); queue.push(imp);
        if (isTest(imp) && !picked.has(imp)) picked.set(imp, `imports ${f}`);
      }
    }
  } else {
    // By its path; by its bare name only when no other tracked file has that name (REPORT.md, index.json … are many).
    const name = basename(f);
    const byName = name.length >= 5 && (nameCount.get(name) ?? 0) <= 1;
    for (const t of tests) if (!picked.has(t) && (text.get(t).includes(f) || (byName && text.get(t).includes(name)))) picked.set(t, `names ${f}`);
  }
}
const list = [...picked.keys()].sort();

if (args.includes("--list")) { for (const t of list) console.log(t); process.exit(0); }
console.log(`changed: ${changed.size} file(s) since ${base.slice(0, 8)}; tests picked: ${list.length} of ${tests.length}`);
for (const t of list) console.log(`  ${t}  (${picked.get(t)})`);
if (!args.includes("--run") || list.length === 0) process.exit(0);
const mac = process.platform === "darwin" && !process.env.FLS_ALLOW_LOCAL;
if (mac && list.length > MAC_LIMIT) {
  console.error(`${list.length} tests is more than the Mac runs (${MAC_LIMIT}); run them on the runner:\n  scripts/remote/run.sh <label> --light -- npm run -s test:changed -- --run`);
  process.exit(3);
}
const r = spawnSync(join(ROOT, "node_modules/.bin/tsx"), ["--test", ...list], { cwd: ROOT, stdio: "inherit" });
process.exit(r.status ?? 1);
