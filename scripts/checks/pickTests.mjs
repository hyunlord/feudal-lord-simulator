// test:changed's pick (decision RR16, RR24, RR25): which tests a set of changed files touches. Its own module so that
// changedTests.mjs (the command) and testedChanges.mjs (check:merge, the reuse rule) both use it without importing each
// other (a cycle with changedTests.mjs's top-level await never settles).
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, extname, join } from "node:path";
import { SOURCE_SCAN_GUARD, SOURCE_SCAN_TESTS } from "./sourceScanTests.mjs";

export const SOURCE_SCAN_WHY = "walks src/ (decision RR24)";
const CODE = new Set([".ts", ".tsx", ".mts", ".mjs", ".js", ".cjs"]);
const SCAN = ["src", "tests", "scripts", "tools"];
const ALL_TRIGGERS = new Set(["package.json", "package-lock.json", "tsconfig.json"]);
const IMPORT = /(?:import|export)\s[^'"`;]*?from\s*["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)|import\s+["']([^"']+)["']|require\(\s*["']([^"']+)["']\s*\)/g;
const isTest = (f) => f.startsWith("tests/") && /\.test\.(ts|tsx|mts|mjs|js)$/.test(f);

export const gitIn = (root) => (...a) => execFileSync("git", a, { cwd: root, encoding: "utf8", maxBuffer: 256 << 20, stdio: ["ignore", "pipe", "ignore"] }).trim();

// root: a checkout whose files are the content to judge. head: undefined = the working tree (vs base, plus untracked);
// a commit or a tree = base..head (root must hold head's files; base and head may be trees, decision RR25).
// Returns picked (test -> the first reason) and causes (test -> every changed file that picks it). A deleted file picks
// the tests that still import it by an import that no longer resolves, or name its path. A rename is its old path
// deleted and its new path added (--no-renames). Any file a module imports (a .json too) picks that module's tests.
export function pickTests({ root, base, head }) {
  const git = gitIn(root);
  const changed = new Set((head
    ? git("diff", "--name-only", "--no-renames", base, head).split("\n")
    : [...git("diff", "--name-only", "--no-renames", base).split("\n"), ...git("ls-files", "--others", "--exclude-standard").split("\n")]
  ).filter(Boolean));

  const walk = (dir, out = []) => {
    for (const e of readdirSync(join(root, dir), { withFileTypes: true })) {
      if (e.name === "node_modules" || e.name.startsWith(".")) continue;
      const rel = join(dir, e.name);
      if (e.isDirectory()) walk(rel, out); else if (CODE.has(extname(e.name))) out.push(rel);
    }
    return out;
  };
  const files = SCAN.filter(d => existsSync(join(root, d))).flatMap(d => walk(d));
  const candidates = (from, spec) => {
    const raw = join(dirname(from), spec);
    const stem = raw.replace(/\.(js|mjs|cjs|ts|tsx)$/, "");
    return [raw, `${stem}.ts`, `${stem}.tsx`, `${stem}.mts`, `${stem}.mjs`, `${stem}.js`, join(raw, "index.ts"), join(raw, "index.js")];
  };
  const resolveSpec = (from, spec) => {
    if (!spec.startsWith(".")) return null;
    for (const c of candidates(from, spec)) if (existsSync(join(root, c)) && statSync(join(root, c)).isFile()) return c;
    return null;
  };
  const importers = new Map();   // file -> the files that import it (an import that resolves to nothing: every candidate)
  const link = (dep, f) => { if (!importers.has(dep)) importers.set(dep, new Set()); importers.get(dep).add(f); };
  const text = new Map();
  for (const f of files) {
    const src = readFileSync(join(root, f), "utf8"); text.set(f, src);
    for (const m of src.matchAll(IMPORT)) {
      const spec = m[1] ?? m[2] ?? m[3] ?? m[4];
      const dep = resolveSpec(f, spec);
      if (dep) link(dep, f); else if (spec.startsWith(".")) for (const c of candidates(f, spec)) link(c, f);
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
  const picked = new Map();   // test -> why (the first reason)
  const causes = new Map();   // test -> every changed file that picks it
  const add = (t, why, f) => { if (!picked.has(t)) picked.set(t, why); if (!causes.has(t)) causes.set(t, new Set()); causes.get(t).add(f); };
  const everything = [...changed].find(f => ALL_TRIGGERS.has(f) && (f !== "package.json" || depsChanged()));
  if (everything) for (const t of tests) add(t, `${everything} changed`, everything);
  for (const f of changed) {
    if (isTest(f)) { if (existsSync(join(root, f))) add(f, "the test changed", f); continue; }
    if (CODE.has(extname(f)) || importers.has(f)) {
      const seen = new Set([f]); const queue = [f];
      while (queue.length) {
        const cur = queue.shift();
        for (const imp of importers.get(cur) ?? []) {
          if (seen.has(imp)) continue; seen.add(imp); queue.push(imp);
          if (isTest(imp)) add(imp, `imports ${f}`, f);
        }
      }
    }
    if (CODE.has(extname(f))) {
      // A test that reads the file as text by its path (readFileSync("../src/App.tsx")) imports nothing: by its path only
      // (decision RR24; e77841161 changed App.tsx's onNewGame and tests/chapterLoadingStore.test.ts went unpicked).
      for (const t of tests) if (text.get(t).includes(f)) add(t, `names ${f}`, f);
    } else {
      // By its path; by its bare name only when no other tracked file has that name (REPORT.md, index.json … are many).
      const name = basename(f);
      const byName = name.length >= 5 && (nameCount.get(name) ?? 0) <= 1;
      for (const t of tests) if (text.get(t).includes(f) || (byName && text.get(t).includes(name))) add(t, `names ${f}`, f);
    }
  }
  const testChanged = [...changed].find(f => isTest(f) && f !== SOURCE_SCAN_GUARD);
  if (testChanged && existsSync(join(root, SOURCE_SCAN_GUARD))) add(SOURCE_SCAN_GUARD, `${SOURCE_SCAN_WHY}: the list's guard; ${testChanged} changed`, testChanged);
  const srcChanged = [...changed].filter(f => f.startsWith("src/"));
  if (srcChanged.length > 0) for (const t of SOURCE_SCAN_TESTS) if (existsSync(join(root, t))) for (const f of srcChanged) add(t, `${SOURCE_SCAN_WHY}; ${srcChanged[0]} changed`, f);
  return { changed, picked, causes, total: tests.length };
}
