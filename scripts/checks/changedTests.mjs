#!/usr/bin/env node
// The tests a change touches, run (user decision 2026-10-06, decision RR16: before a trunk push, check:merge + these
// tests + the geometry audit of the changed UI rows; the full clean-clone suite runs on the trunk every few hours).
//   npm run test:changed                     pick and RUN them; writes a result record (below)
//   npm run test:changed -- --list           only print the picked tests and why (runs nothing)
//   npm run test:changed -- --base <ref>     compare with <ref> instead of the merge base with the trunk
// Changed files: <base> against the working tree, tracked and untracked (default base: the merge base with the trunk).
// A test is picked when it changed itself, when it imports a changed file directly or through other files (static
// import / export from / import() / require, relative paths in src, tests, scripts, tools), or when its text names a
// changed non-code file by its path (or by its bare name when no other tracked file has it). A change to
// package-lock.json, tsconfig.json or the dependencies in package.json picks every test.
// On the Mac at most MAC_LIMIT tests run; more fail (exit 3) with the runner command to use instead.
// The record: {tree, head, base, picked, pass, fail, passed, where, at} in .remote-runs/test-changed/<tree>.json, or
// .remote/test-changed.json in a DGX run (run.sh brings it back under .remote-runs/<run>/). <tree> is the tree of the
// content that was tested (what `git add -A` would commit now, built in a copy of the index). check:merge looks for
// a passing record of the pushed head's tree that covers the tests its range picks (scripts/checks/mergeChecks.mjs).
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, extname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const TRUNK = "codex/phase15-organic-ground";
const CODE = new Set([".ts", ".tsx", ".mts", ".mjs", ".js", ".cjs"]);
const SCAN = ["src", "tests", "scripts", "tools"];
const ALL_TRIGGERS = new Set(["package.json", "package-lock.json", "tsconfig.json"]);
export const MAC_LIMIT = 30;
const IMPORT = /(?:import|export)\s[^'"`;]*?from\s*["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)|import\s+["']([^"']+)["']|require\(\s*["']([^"']+)["']\s*\)/g;
const isTest = (f) => f.startsWith("tests/") && /\.test\.(ts|tsx|mts|mjs|js)$/.test(f);

const gitIn = (root) => (...a) => execFileSync("git", a, { cwd: root, encoding: "utf8", maxBuffer: 256 << 20, stdio: ["ignore", "pipe", "ignore"] }).trim();

export function trunkMergeBase(root) {
  const git = gitIn(root);
  const refs = [`origin/${TRUNK}`, TRUNK];
  // A DGX run folder borrows the mirror's objects but has none of its refs: take the trunk's commit from the mirror.
  const mirror = process.env.FLS_REMOTE_MIRROR;
  if (mirror) try { refs.push(execFileSync("git", ["-C", mirror, "rev-parse", `refs/heads/${TRUNK}`], { encoding: "utf8" }).trim()); } catch { /* no mirror */ }
  for (const ref of refs) {
    try { return git("merge-base", "HEAD", ref); } catch { /* try the next name */ }
  }
  return null;
}

// root: a checkout whose files are the content to judge. head: undefined = the working tree (vs base, plus untracked);
// a commit = the committed range base..head (root must hold that commit's files).
export function pickTests({ root, base, head }) {
  const git = gitIn(root);
  const changed = new Set((head
    ? git("diff", "--name-only", base, head).split("\n")
    : [...git("diff", "--name-only", base).split("\n"), ...git("ls-files", "--others", "--exclude-standard").split("\n")]
  ).filter(Boolean).filter(f => existsSync(join(root, f))));

  const walk = (dir, out = []) => {
    for (const e of readdirSync(join(root, dir), { withFileTypes: true })) {
      if (e.name === "node_modules" || e.name.startsWith(".")) continue;
      const rel = join(dir, e.name);
      if (e.isDirectory()) walk(rel, out); else if (CODE.has(extname(e.name))) out.push(rel);
    }
    return out;
  };
  const files = SCAN.filter(d => existsSync(join(root, d))).flatMap(d => walk(d));
  const resolveSpec = (from, spec) => {
    if (!spec.startsWith(".")) return null;
    const raw = join(dirname(from), spec);
    const stem = raw.replace(/\.(js|mjs|cjs|ts|tsx)$/, "");
    for (const c of [raw, `${stem}.ts`, `${stem}.tsx`, `${stem}.mts`, `${stem}.mjs`, `${stem}.js`, join(raw, "index.ts"), join(raw, "index.js")]) {
      if (existsSync(join(root, c)) && statSync(join(root, c)).isFile()) return c;
    }
    return null;
  };
  const importers = new Map();   // file -> the files that import it
  const text = new Map();
  for (const f of files) {
    const src = readFileSync(join(root, f), "utf8"); text.set(f, src);
    for (const m of src.matchAll(IMPORT)) {
      const dep = resolveSpec(f, m[1] ?? m[2] ?? m[3] ?? m[4]);
      if (!dep) continue;
      if (!importers.has(dep)) importers.set(dep, new Set());
      importers.get(dep).add(f);
    }
  }
  const tests = files.filter(isTest);
  const nameCount = new Map();
  for (const f of git("ls-files").split("\n")) nameCount.set(basename(f), (nameCount.get(basename(f)) ?? 0) + 1);
  // package.json picks everything only when what is installed changes (a new npm script changes no test).
  const depsChanged = () => {
    const keys = ["dependencies", "devDependencies", "optionalDependencies", "overrides", "type", "imports"];
    const pick = (json) => JSON.stringify(keys.map(k => json?.[k] ?? null));
    let before = null;
    try { before = JSON.parse(git("show", `${base}:package.json`)); } catch { return true; }
    return pick(before) !== pick(JSON.parse(readFileSync(join(root, "package.json"), "utf8")));
  };
  const picked = new Map();   // test -> why
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
  return { changed, picked, total: tests.length };
}

// The tree of what the working tree holds now — tracked changes and new files not ignored, as `git add -A` would commit
// them — built in a copy of the index (the real one is not touched).
export function testedTree(root) {
  const git = gitIn(root);
  const index = resolve(root, git("rev-parse", "--git-path", "index"));
  const scratch = join(tmpdir(), `fls-tested-index-${process.pid}-${Date.now()}`);
  try {
    if (existsSync(index)) copyFileSync(index, scratch);
    const env = { ...process.env, GIT_INDEX_FILE: scratch };
    execFileSync("git", ["add", "-A"], { cwd: root, env, stdio: "ignore" });
    return execFileSync("git", ["write-tree"], { cwd: root, env, encoding: "utf8" }).trim();
  } finally { rmSync(scratch, { force: true }); }
}

function summary(raw) {
  const text = raw.replace(/\x1b\[[0-9;]*m/g, "");   // the reporter colours its totals when FORCE_COLOR is set
  const n = (k) => Number((text.match(new RegExp(`^(?:ℹ|#) ${k} (\\d+)`, "m")) ?? [])[1] ?? 0);
  return { tests: n("tests"), pass: n("pass"), fail: n("fail") };
}

async function main() {
  const ROOT = resolve(import.meta.dirname, "../..");
  const args = process.argv.slice(2);
  const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
  const base = opt("--base") ?? trunkMergeBase(ROOT);
  if (!base) { console.error("no trunk ref to compare with; pass --base <commit>"); process.exit(2); }
  const { changed, picked, total } = pickTests({ root: ROOT, base });
  const list = [...picked.keys()].sort();
  if (args.includes("--list")) {
    console.log(`changed: ${changed.size} file(s) since ${base.slice(0, 8)}; tests picked: ${list.length} of ${total} (listed only, not run)`);
    for (const t of list) console.log(`  ${t}  (${picked.get(t)})`);
    process.exit(0);
  }
  console.log(`changed: ${changed.size} file(s) since ${base.slice(0, 8)}; tests picked: ${list.length} of ${total} — running them`);
  for (const t of list) console.log(`  ${t}  (${picked.get(t)})`);
  const mac = process.platform === "darwin" && !process.env.FLS_ALLOW_LOCAL;
  if (mac && list.length > MAC_LIMIT) {
    console.error(`${list.length} tests is more than the Mac runs (${MAC_LIMIT}); run them on the runner:\n  scripts/remote/run.sh <label> --light -- npm run -s test:changed`);
    process.exit(3);
  }
  const tree = testedTree(ROOT);
  let rc = 0, counts = { tests: 0, pass: 0, fail: 0 };
  if (list.length) {
    const r = spawnSync(join(ROOT, "node_modules/.bin/tsx"), ["--test", ...list], { cwd: ROOT, encoding: "utf8", maxBuffer: 1 << 30 });
    process.stdout.write(r.stdout ?? ""); process.stderr.write(r.stderr ?? "");
    rc = r.status ?? 1; counts = summary(r.stdout ?? "");
  }
  const record = {
    tree, head: gitIn(ROOT)("rev-parse", "HEAD"), base, picked: list, ...counts, passed: rc === 0,
    where: process.env.FLS_REMOTE ? `DGX ${process.env.FLS_REMOTE_RUN ?? ""}`.trim() : `${process.platform === "darwin" ? "Mac" : "local"}`,
    at: new Date().toISOString(),
  };
  const file = process.env.FLS_REMOTE ? join(ROOT, ".remote/test-changed.json") : join(ROOT, ".remote-runs/test-changed", `${tree}.json`);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(record, null, 1));
  console.log(`test:changed ${record.passed ? "passed" : "FAILED"}: ${counts.pass}/${counts.tests} in ${list.length} file(s), tree ${tree.slice(0, 12)} (${record.where}) — recorded for check:merge`);
  process.exit(rc);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) await main();
