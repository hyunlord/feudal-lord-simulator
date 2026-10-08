#!/usr/bin/env node
// The tests a change touches, run (user decision 2026-10-06, decision RR16: before a trunk push, check:merge + these
// tests + the geometry audit of the changed UI rows; the full clean-clone suite runs on the trunk every few hours).
//   npm run test:changed                     pick and RUN them; writes a result record (below)
//   npm run test:changed -- --list           only print the picked tests and why (runs nothing)
//   npm run test:changed -- --base <ref>     compare with <ref> instead of the merge base with the trunk
//   npm run test:changed -- --all            run every picked test, even those an earlier passing record covers
// RR25: a picked test that a passing record ran is not run again when no file changed since that record's content is
// one the test reads (scripts/checks/testedChanges.mjs testCoverage); the run says which it reuses and why it runs the
// rest. On the DGX the Mac's records come with the run (run.sh: .remote-in/tested-records.json). The record keeps the
// evidence as `reused`: per source record its tests, tree, commit, run, time, the files changed since and why.
// Changed files: <base> against the working tree, tracked and untracked (default base: the merge base with the trunk).
// A test is picked when it changed itself, when it imports a changed file directly or through other files (static
// import / export from / import() / require, relative paths in src, tests, scripts, tools), or when its text names a
// changed non-code file by its path (or by its bare name when no other tracked file has it). A change to
// package-lock.json, tsconfig.json or the dependencies in package.json picks every test. A change in src/ also picks
// the tests that walk src/'s folders instead of importing (sourceScanTests.mjs, decision RR24); a test naming a changed
// code file by its path (it reads it as text) is picked too.
// On the Mac at most MAC_LIMIT tests run (the source scans, ~11 s together, not counted); more fail (exit 3) with the
// runner command to use instead.
// The record: {tree, head, base, picked, pass, fail, passed, where, at} in .remote-runs/test-changed/<tree>.json, or
// .remote/test-changed.json in a DGX run (run.sh brings it back under .remote-runs/<run>/). <tree> is the tree of the
// content that was tested (what `git add -A` would commit now, built in a copy of the index). check:merge looks for
// a passing record of the pushed head's tree that covers the tests its range picks (scripts/checks/mergeChecks.mjs).
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, extname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { gitIn, pickTests, SOURCE_SCAN_WHY } from "./pickTests.mjs";
import { coverageLines, overlapLines, reuseEvidence, testCoverage, testedRecords } from "./testedChanges.mjs";

export { pickTests, SOURCE_SCAN_WHY };

export const TRUNK = "codex/phase15-organic-ground";
export const MAC_LIMIT = 30;

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
  const tree = testedTree(ROOT);
  let run = list; let reused = [];
  if (!args.includes("--all") && list.length > 0) {
    const carried = join(ROOT, ".remote-in/tested-records.json");
    const extra = process.env.FLS_REMOTE && existsSync(carried) ? JSON.parse(readFileSync(carried, "utf8")) : [];
    const records = [...testedRecords(ROOT), ...extra].sort((a, b) => String(b.at).localeCompare(String(a.at)));
    const coverage = testCoverage({ top: ROOT, work: ROOT, required: list, headTree: tree, records });
    run = coverage.uncovered; reused = reuseEvidence(coverage.covered);
    if (coverage.covered.size > 0) console.log([`reused (decision RR25): ${coverage.covered.size} of ${list.length}`, ...coverageLines(coverage.covered)].join("\n"));
    if (coverage.covered.size > 0 && run.length > 0) console.log([`to run (${run.length}):`, ...overlapLines(run, coverage.overlaps, 40)].join("\n"));
  }
  console.log(`changed: ${changed.size} file(s) since ${base.slice(0, 8)}; tests picked: ${list.length} of ${total} — running ${run.length}`);
  for (const t of run) console.log(`  ${t}  (${picked.get(t)})`);
  const mac = process.platform === "darwin" && !process.env.FLS_ALLOW_LOCAL;
  const counted = run.filter(t => !picked.get(t).startsWith(SOURCE_SCAN_WHY)).length;
  if (mac && counted > MAC_LIMIT) {
    console.error(`${counted} tests (besides the source scans) is more than the Mac runs (${MAC_LIMIT}); run them on the runner:\n  scripts/remote/run.sh <label> --light -- npm run -s test:changed`);
    process.exit(3);
  }
  let rc = 0, counts = { tests: 0, pass: 0, fail: 0 };
  const where = process.env.FLS_REMOTE ? `DGX ${process.env.FLS_REMOTE_RUN ?? ""}`.trim() : `${process.platform === "darwin" ? "Mac" : "local"}`;
  // Nothing to run: the reuse evidence alone, in a file of its own (a <tree>.json of tests that ran stays as it is).
  if (run.length === 0) {
    const evidence = { tree, head: gitIn(ROOT)("rev-parse", "HEAD"), base, picked: [], tests: 0, pass: 0, fail: 0, passed: true, where, at: new Date().toISOString(), reused };
    const file = process.env.FLS_REMOTE ? join(ROOT, ".remote/test-changed.json") : join(ROOT, ".remote-runs/test-changed", `${tree}.reuse.json`);
    mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, JSON.stringify(evidence, null, 1));
    console.log(`test:changed: nothing to run — every picked test is covered; the reuse evidence is in ${file.slice(ROOT.length + 1)}`);
    process.exit(0);
  }
  {
    const r = spawnSync(join(ROOT, "node_modules/.bin/tsx"), ["--test", ...run], { cwd: ROOT, encoding: "utf8", maxBuffer: 1 << 30 });
    process.stdout.write(r.stdout ?? ""); process.stderr.write(r.stderr ?? "");
    rc = r.status ?? 1; counts = summary(r.stdout ?? "");
  }
  const record = {
    tree, head: gitIn(ROOT)("rev-parse", "HEAD"), base, picked: run, ...counts, passed: rc === 0, where, at: new Date().toISOString(), reused,
  };
  const file = process.env.FLS_REMOTE ? join(ROOT, ".remote/test-changed.json") : join(ROOT, ".remote-runs/test-changed", `${tree}.json`);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(record, null, 1));
  console.log(`test:changed ${record.passed ? "passed" : "FAILED"}: ${counts.pass}/${counts.tests} in ${run.length} file(s), tree ${tree.slice(0, 12)} (${record.where}) — recorded for check:merge`);
  process.exit(rc);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) await main();
