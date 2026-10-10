// UI-AUDIT-1: the geometry audit's gate (check:merge), on a baseline. The DGX audit (npm run remote:ui-geometry,
// scripts/uiGeometryAudit.mjs) writes its report with the commit it measured and every failure's key (row |
// viewport/copy/numbers | check | element path — stable across runs, no px). RR26 (user ruling 2026-10-09): a result
// counts on a newer commit only when every file changed since its measured commit (an ancestor of <head>) is on the
// small safe list (isSafePath: docs/**, *.md outside src/ public/ assets-inbox/, tests/** nothing of the UI or the
// audit imports); any other change, known or not, needs a new audit. A range that changes only safe files passes; only
// the lists' shrink rules are checked then. The shared result (docs/verification/uiaudit1/geometry.json) counts only
// when it is a full audit (`full: true`; a changed-rows or narrowed run does not write it unless --summary names it, and
// then says `full: false`). A result that leaves out what it must say (dirty, opened conditions, framed roots) fails. Otherwise the step fails when:
//  - the result is missing, not a full audit, measured at a commit not in the pushed history, measured from a tree with
//    uncommitted changes off the safe list, or followed by changes off the safe list;
//  - a surface condition could not be opened, or a framed root (data-frame) on screen is in no registry row;
//  - a failure is neither in the baseline (docs/verification/uiaudit1/geometry-baseline.json) nor matched by an
//    exception (docs/verification/uiaudit1/geometry-exceptions.json: row + check + element path fragment + reason);
//  - a baseline entry no longer fails ("N fixed, drop them": npm run ui-geometry:baseline), or an exception matches
//    nothing — both lists only shrink;
//  - base..head adds baseline entries without a recorded reason (the baseline script's --reason), or adds exceptions.
// A changed-rows audit (`--only`) counts in place of a missing or stale shared result when a commit in base..head names
// it with a `UI-Geometry-Run: <run>` trailer and its report (docs/verification/uiaudit1/geometry/<run>/geometry.json at
// <head>) is that run's, measured at an ancestor of <head> from a clean tree in every condition (not narrowed), opened
// every condition, has no framed root outside the registry, no failure of its rows outside the baseline and the
// exceptions, no baseline entry of its rows left unfailing, and only safe changes since. A newer named run that measured
// all its rows supersedes it. The import closure (geometryInputs) stays for the report only.
// The thresholds are the audit's (8 px gap, 40 % empty warning, 0.5–1 px tolerance); an exemption is an exception entry,
// never a looser check. Mode: UI_GEOMETRY_GATE ('enforce' fails check:merge, 'warn' only reports);
// FLS_UI_GEOMETRY_GATE=warn lets a failing result through only with a reason: FLS_UI_GEOMETRY_REASON="<one line>" (a few
// words), and the head commit carrying the same reason as a `UI-Geometry-Override: <reason>` trailer (the record every
// worktree sees; the refusal prints the `git commit --amend --trailer` command). The override also prints the line a
// report must carry and appends it to .remote-runs/local-heavy.log. check:merge states how many commits in the range
// carry the trailer ("ui-geometry: warn overrides in this range: N"). RR26 shadow (user rulings 2026-10-10): check:merge
// also computes what the measured judgement (a′, scripts/checks/uiGeometryMeasured.mjs) would decide and records it
// beside this verdict; it never changes it.
//   node scripts/checks/uiGeometry.mjs [--base <rev>] [--head <rev>]
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { hostname } from 'node:os';
import { join, posix } from 'node:path';
import { git, isMain, resolveRange } from './gitRange.mjs';

export const UI_GEOMETRY_SUMMARY = 'docs/verification/uiaudit1/geometry.json';
export const UI_GEOMETRY_BASELINE = 'docs/verification/uiaudit1/geometry-baseline.json';
export const UI_GEOMETRY_EXCEPTIONS = 'docs/verification/uiaudit1/geometry-exceptions.json';
/** What can change UI geometry: path roots, each with the files under it that count (null: every file). */
export const UI_INPUT_ROOTS = Object.freeze([
  ['src/ui', null], ['src/styles', null], ['src/render', /\.tsx$/], ['src/content', /\.ko\.ts$/], ['src/App.tsx', null], ['src/main.tsx', null],
  ['index.html', null], ['vite.config.ts', null], ['public/assets', null],
  ['scripts/uiGeometryAudit.mjs', null], ['scripts/uiGeometryMeasure.ts', null], ['scripts/uiGeometryScene.ts', null],
  ['scripts/renderCommitProbe.mjs', null], ['scripts/sceneInjection.mjs', null], ['scripts/remote/viteNoWatch.config.ts', null],
].map(([root, only]) => Object.freeze({ root, only })));
// UI-AUDIT-1 (the user's decision): enforcing on the baseline — no new failure, the baseline and the exceptions only
// shrink.
export const UI_GEOMETRY_GATE = 'enforce';

/**
 * RR26 as ruled 2026-10-09 (the user, after four reviews found inputs the import closure missed): a geometry result
 * counts on a newer commit only when every file changed since it was measured is on this small safe list; anything
 * else, known or not, may move the screen and needs a new audit. The import closure below is kept for the report only
 * (how many of the unsafe changes reach the UI by import), never for the judgement.
 *   docs/**   ·   *.md outside src/, public/ and assets-inbox/   ·   tests/** that nothing of the UI or the audit imports
 * A path to add needs a case and its reason on the decision line (seeds/, fixtures/, perf/ and the like stay off: the
 * game or the audit can read them).
 */
/** Whether a changed path is on the safe list; `importedTests` null (the closure could not be read) makes no test safe. */
export function isSafePath(path, importedTests = new Set()) {
  if (path.startsWith('docs/')) return true;
  if (path.endsWith('.md') && !/^(src|public|assets-inbox)\//.test(path)) return true;
  return path.startsWith('tests/') && importedTests !== null && !importedTests.has(path);
}

/** The entry the UI is built from: every file it reaches by import is a UI input too (user ruling 2026-10-09, RR26 (가)). */
export const UI_ENTRY = 'src/main.tsx';
/**
 * Where the import closure starts: the UI's entry, the dev server's config (its plugins serve fonts and pictures) and the
 * audit's own scripts (what measures is an input too, RR26 review 4).
 */
export const CLOSURE_ENTRIES = Object.freeze([UI_ENTRY, 'vite.config.ts', 'scripts/uiGeometryAudit.mjs', 'scripts/uiGeometryMeasure.ts', 'scripts/uiGeometryScene.ts',
  'scripts/renderCommitProbe.mjs', 'scripts/sceneInjection.mjs', 'scripts/remote/viteNoWatch.config.ts']);
/** Inputs whatever the closure says: the packages the UI and the dev server load (fonts, React, Vite) are pinned here. */
export const UI_INPUT_FILES = Object.freeze(['package.json', 'package-lock.json']);
const IMPORT = /(?:import|export)\s[^'"`;]*?from\s*["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)|import\s+["']([^"']+)["']|require\s*\(\s*["']([^"']+)["']\s*\)|new\s+URL\s*\(\s*["']([^"']+)["']\s*,\s*import\.meta\.url/g;
const CSS_REF = /@import\s+(?:url\(\s*)?["']?([^"')\s;]+)|url\(\s*["']?([^"')\s]+)["']?\s*\)/g;
/**
 * An import the closure cannot follow, in the UI's own code (src/): then every file under that file's folder counts. The
 * audit's scripts compute imports only for tools outside the repository (Playwright, sharp): those are not followed.
 */
const UNFOLLOWED = /import\.meta\.glob|import\s*\(\s*`|import\s*\(\s*[^"'`\s)]|require\s*\(\s*[^"'`\s)]/;
const INBOX = /assets-inbox\/[A-Za-z0-9_.\-/]+/g;
const CODE = /\.(ts|tsx|mts|cts|mjs|cjs|js|jsx|css)$/;

/** Source text without comments (strings, template literals and regular expressions kept), so a quote in a comment hides no import. */
export function withoutComments(text) {
  let out = ''; let i = 0; const n = text.length; let last = '';   // last significant character, to tell a regex from a division
  while (i < n) {
    const c = text[i]; const d = text[i + 1];
    if (c === '/' && d === '/') { while (i < n && text[i] !== '\n') i++; continue; }
    if (c === '/' && d === '*') { i += 2; while (i < n && !(text[i] === '*' && text[i + 1] === '/')) i++; i += 2; out += ' '; continue; }
    if (c === '"' || c === "'" || c === '`') {
      const start = i; i++;
      while (i < n && text[i] !== c) { if (text[i] === '\\') i++; i++; }
      i++; out += text.slice(start, i); last = c; continue;
    }
    if (c === '/' && (last === '' || /[(,=:[!&|?{};+\-*%<>~^]/.test(last))) {   // a regular expression literal
      const start = i; i++; let inClass = false;
      while (i < n && text[i] !== '\n' && (text[i] !== '/' || inClass)) { if (text[i] === '\\') i++; else if (text[i] === '[') inClass = true; else if (text[i] === ']') inClass = false; i++; }
      i++; out += text.slice(start, i); last = '/'; continue;
    }
    out += c; if (!/\s/.test(c)) last = c; i++;
  }
  return out;
}
const CANDIDATES = ['', '.ts', '.tsx', '.mts', '.mjs', '.js', '.jsx', '.json', '/index.ts', '/index.tsx', '/index.js'];

/** Every file of <rev> (path -> blob id), paths unquoted (-z: Korean letters and spaces stay as they are). */
export function treeFiles(rev, cwd = process.cwd()) {
  const out = execFileSync('git', ['ls-tree', '-r', '-z', '--full-tree', rev], { cwd, maxBuffer: 2 ** 30, stdio: ['ignore', 'pipe', 'ignore'] }).toString('utf8');
  const files = new Map();
  for (const row of out.split('\0')) { const tab = row.indexOf('\t'); if (tab < 0) continue; const [, type, blob] = row.slice(0, tab).split(' '); if (type === 'blob') files.set(row.slice(tab + 1), blob); }
  return files;
}

/** The contents of `blobs` (one `git cat-file --batch`): id -> Buffer. */
function readBlobs(blobs, cwd) {
  const out = new Map(); if (blobs.length === 0) return out;
  const batch = execFileSync('git', ['cat-file', '--batch'], { cwd, input: `${blobs.join('\n')}\n`, maxBuffer: 2 ** 31 - 1 });
  let at = 0;
  while (at < batch.length) {
    const end = batch.indexOf(0x0a, at); const [id, type, size] = batch.subarray(at, end).toString().split(' ');
    // A blob that cannot be read fails the caller (no closure cut short, no picture left unchecked).
    if (type === 'missing' || !/^\d+$/.test(size ?? '')) throw new Error(`git cat-file: cannot read ${id}`);
    out.set(id, batch.subarray(end + 1, end + 1 + Number(size))); at = end + 1 + Number(size) + 1;
  }
  return out;
}

/**
 * The files of <rev> the closure entries reach: relative imports (static, dynamic, side effect, require, new URL(…,
 * import.meta.url)), CSS @import and url(), and every file under an assets-inbox path a reached file names (the dev
 * server's plugins serve those pictures). A reached file of src/ with an import the closure cannot follow
 * (import.meta.glob, a computed import or require) brings in every file under its folder.
 */
export function uiImportClosure(rev, cwd = process.cwd(), files = treeFiles(rev, cwd)) {
  const reached = new Set(); let layer = CLOSURE_ENTRIES.filter(path => files.has(path));
  const all = [...files.keys()];
  const under = prefix => all.filter(path => path === prefix || path.startsWith(`${prefix}/`));
  while (layer.length > 0) {
    for (const path of layer) reached.add(path);
    const texts = readBlobs(layer.filter(path => CODE.test(path)).map(path => files.get(path)), cwd);
    const next = new Set();
    const take = path => { if (files.has(path) && !reached.has(path)) next.add(path); };
    const resolveFrom = (path, spec) => {
      if (!spec.startsWith('.')) return;
      const raw = posix.normalize(posix.join(posix.dirname(path), spec.split(/[?#]/)[0]));
      const stem = raw.replace(/\.(js|mjs|jsx)$/, '');
      const hit = [...CANDIDATES.map(ext => raw + ext), ...CANDIDATES.map(ext => stem + ext)].find(candidate => files.has(candidate));
      if (hit !== undefined) take(hit);
    };
    for (const path of layer) {
      if (!CODE.test(path)) continue;
      const raw = texts.get(files.get(path))?.toString('utf8') ?? '';
      const text = path.endsWith('.css') ? raw.replace(/\/\*[\s\S]*?\*\//g, ' ') : withoutComments(raw);
      if (path.endsWith('.css')) { for (const m of text.matchAll(CSS_REF)) resolveFrom(path, m[1] ?? m[2]); }
      else {
        for (const m of text.matchAll(IMPORT)) resolveFrom(path, m[1] ?? m[2] ?? m[3] ?? m[4] ?? m[5]);
        if (path.startsWith('src/') && UNFOLLOWED.test(text)) for (const other of under(posix.dirname(path))) take(other);
      }
      for (const m of raw.matchAll(INBOX)) for (const other of under(m[0].replace(/[/.]+$/, ''))) take(other);
    }
    layer = [...next];
  }
  return reached;
}

/** Whether `path` is a UI input by the roots (the closure adds the rest). */
const underRoots = path => UI_INPUT_ROOTS.some(item => (path === item.root || path.startsWith(`${item.root}/`)) && (item.only === null || item.only.test(path)));

/** The UI inputs at `rev`: one line per counted file (`<blob> <path>`), from git objects — the roots and every file UI_ENTRY reaches by import. */
export function geometryInputs(rev, cwd = process.cwd()) {
  const files = treeFiles(rev, cwd);
  const closure = uiImportClosure(rev, cwd, files);
  return [...files].filter(([path]) => underRoots(path) || closure.has(path) || UI_INPUT_FILES.includes(path)).map(([path, blob]) => `${blob} ${path}`).sort();
}

/** The tests/ files the UI or the audit imports at <rev> (not safe), from the import closure. */
export function importedTests(rev, cwd = process.cwd(), files = treeFiles(rev, cwd)) {
  return new Set([...uiImportClosure(rev, cwd, files)].filter(path => path.startsWith('tests/')));
}

/**
 * The uncommitted changes of the working tree a geometry run would measure although <rev> does not hold them: every
 * changed, staged, deleted, renamed or untracked (not ignored) path off the safe list. An LFS picture is compared by
 * content with its pointer's sha256 (a run folder without git-lfs shows every LFS file as changed), and the pointer text
 * left in place of the picture is dirty. Paths are read with -z (Korean letters and spaces stay as they are).
 */
export function uiInputsDirty(cwd = process.cwd(), rev = 'HEAD') {
  const files = treeFiles(rev, cwd);
  const tests = importedTests(rev, cwd, files);
  const status = execFileSync('git', ['status', '--porcelain=v1', '-z', '--untracked-files=all'], { cwd, encoding: 'utf8', maxBuffer: 256 * 2 ** 20, stdio: ['ignore', 'pipe', 'ignore'] }).split('\0');
  const candidates = [];
  for (let k = 0; k < status.length; k++) {
    const entry = status[k]; if (entry.length < 4) continue;
    candidates.push({ path: entry.slice(3), code: entry.slice(0, 2) });
    if (/[RC]/.test(entry.slice(0, 2))) candidates.push({ path: status[++k], code: 'D ' });   // the old path of a rename or copy
  }
  const pointers = candidates.filter(({ path, code }) => code === ' M' && files.has(path)).map(({ path }) => ({ path, blob: files.get(path) }));
  const blobs = readBlobs(pointers.map(entry => entry.blob), cwd);
  const dirty = new Set();
  for (const { path, code } of candidates) {
    if (path === undefined || isSafePath(path, tests)) continue;
    if (code === ' M' && files.has(path)) {
      const pointer = /^version https:\/\/git-lfs\.github\.com\/spec\/v1\noid sha256:([0-9a-f]{64})\nsize (\d+)/.exec((blobs.get(files.get(path)) ?? Buffer.alloc(0)).toString('latin1'));
      const file = join(cwd, path);
      if (pointer !== null && existsSync(file) && createHash('sha256').update(readFileSync(file)).digest('hex') === pointer[1]) continue;   // the picture itself
    }
    dirty.add(path);
  }
  // An LFS picture git sees as unchanged may still be its pointer text (a run folder whose pictures were never fetched):
  // every LFS pointer under public/ and assets-inbox/ whose file is not the size it names is compared by content.
  const lfs = [...files].filter(([path]) => /^(public|assets-inbox)\//.test(path) && !dirty.has(path));
  const lfsBlobs = readBlobs(lfs.map(([, blob]) => blob), cwd);
  for (const [path, blob] of lfs) {
    const pointer = /^version https:\/\/git-lfs\.github\.com\/spec\/v1\noid sha256:([0-9a-f]{64})\nsize (\d+)/.exec((lfsBlobs.get(blob) ?? Buffer.alloc(0)).toString('latin1'));
    if (pointer === null) continue;
    const file = join(cwd, path);
    if (!existsSync(file)) { dirty.add(path); continue; }
    if (statSync(file).size === Number(pointer[2])) continue;
    if (createHash('sha256').update(readFileSync(file)).digest('hex') !== pointer[1]) dirty.add(path);
  }
  return [...dirty].sort();
}

/**
 * The changes between two commits judged against the safe list: { changed, unsafe, reaching } — every changed path, the
 * ones off the safe list, and (report only) how many of those the UI or the audit reaches by import at `to`.
 */
export function unsafeChanges(from, to, cwd = process.cwd(), cache = new Map()) {
  const key = `${from}..${to}`; if (cache.has(key)) return cache.get(key);
  const changed = execFileSync('git', ['diff', '--name-only', '--no-renames', '-z', from, to], { cwd, encoding: 'utf8', maxBuffer: 256 * 2 ** 20, stdio: ['ignore', 'pipe', 'ignore'] }).split('\0').filter(Boolean);
  // The closure only names the tests the UI or the audit imports; when it cannot be read, no test is safe (fails closed).
  let closure = null; try { if (!cache.has(`closure:${to}`)) cache.set(`closure:${to}`, uiImportClosure(to, cwd)); closure = cache.get(`closure:${to}`); } catch { /* closure stays null */ }
  const tests = closure === null ? null : new Set([...closure].filter(path => path.startsWith('tests/')));
  const unsafe = changed.filter(path => !isSafePath(path, tests));
  const result = { changed: changed.length, unsafe, reaching: closure === null ? null : unsafe.filter(path => closure.has(path)).length };
  cache.set(key, result);
  return result;
}

/** The reason line for unsafe changes since a measurement. */
const unsafeLine = (what, commit, changes) => `${what}: ${changes.unsafe.length} file(s) off the safe list changed since it was measured at ${commit.slice(0, 8)} (${changes.reaching === null ? 'the import closure could not be read' : `${changes.reaching} of them reach the UI or the audit by import`}): ${changes.unsafe.slice(0, 6).join(', ')}${changes.unsafe.length > 6 ? ` … ${changes.unsafe.length - 6} more` : ''} — audit again`;

/**
 * RR26 covered (user ruling 2026-10-10 — a full audit takes 5 hours and the trunk moves meanwhile, so a result was
 * refused for changes the trunk's own pushes had already audited): the changes since a result's commit `from` that leave
 * it stale at `head`, less what the trunk's own pushes covered. Only the commits this push brings (base..head) are
 * judged: a file they change stays a reason. A file they do not change comes as the trunk has it at `base`. Its
 * changers are the commits in `base ^from` (every commit the trunk took since the result, whatever the merge shape —
 * sessions merge the trunk into their branch and push fast-forward, so earlier pushes sit on second parents) that
 * changed it (a merge only where it differs from every parent; none at all: not covered). The file is covered (per
 * file content, approved 2026-10-10) by a measurement pushed with its own report: a commit of `base ^from` that carries
 * a UI-Geometry-Run trailer and adds or changes that run's report, or adds a new full shared result with its report —
 * valid as the gate takes it at that commit (its measured commit an ancestor of it, clean, every condition, all opened,
 * no framed root outside the registry, no failure outside that commit's baseline and exceptions) — whose measured tree
 * has the file exactly as at `base` and holds every changer of it (a revert to old content after it, a change it never
 * saw, content brought back from a commit the trunk never measured: not covered). An override never covers (user
 * ruling 2026-10-10, amending the first ruling's "covered but recorded"): it is an exception and must not spread to the
 * next push as evidence; the overrides the trunk took since the result are listed (`overrides`), and a measured cover
 * names those on the commit carrying it. Without a base, or when the history cannot be read (an unrelated or shallow
 * `from`), nothing is covered. What this gives up: a later push no longer re-measures an
 * earlier push's rows by chance, catching their cross effects — the nightly full audit does.
 */
export function coveredChanges(from, base, head, cwd = process.cwd(), cache = new Map()) {
  const changes = unsafeChanges(from, head, cwd, cache);
  if (base === null || changes.unsafe.length === 0) return { ...changes, covered: [] };
  const memo = (key, make) => { if (!cache.has(key)) cache.set(key, make()); return cache.get(key); };
  const run = args => execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 1024 * 2 ** 20, stdio: ['ignore', 'pipe', 'ignore'] });
  const brought = new Set(run(['diff', '--name-only', '--no-renames', '-z', base, head]).split('\0').filter(Boolean));
  // Every blob of a commit at once (the whole tree, wherever the gate runs from), a missing path null.
  const tree = rev => memo(`tree:${rev}`, () => { const map = new Map(); try { for (const entry of run(['ls-tree', '-r', '-z', '--full-tree', rev]).split('\0')) { const tab = entry.indexOf('\t'); if (tab > 0) map.set(entry.slice(tab + 1), entry.slice(0, tab).split(' ')[2]); } } catch { /* no such commit */ } return map; });
  const blob = (rev, path) => tree(rev).get(path) ?? null;
  // The commits the trunk took since the result: their parents, trailers, subject, and the files each changed.
  let history;
  try {
    history = memo(`cover-history:${base}^${from}`, () => {
      const commits = new Map();
      for (const record of run(['log', '-z', `--format=%H%x1f%P%x1f%s%x1f%(trailers:key=UI-Geometry-Run,valueonly,separator=%x1e)%x1f%(trailers:key=UI-Geometry-Override,valueonly,separator=%x1e)`, base, `^${from}`]).split('\0').filter(Boolean)) {
        const [sha, parents, subject, runs, overrides] = record.split('\x1f');
        commits.set(sha.trim(), { sha: sha.trim(), parents: parents.split(' ').filter(Boolean), subject, runs: runs.split('\x1e').map(item => item.trim()).filter(Boolean),
          overrides: overrides.split('\x1e').map(item => item.replace(/\s+/g, ' ').trim()).filter(Boolean), files: new Set() });
      }
      // -z: paths exactly as stored (no quoting of non-ASCII names). Each commit: \x01<sha>\0, then \n<path>\0 …
      let current = null;
      for (const token of run(['log', '-z', '--cc', '--no-renames', '--name-only', '--format=%x01%H', base, `^${from}`]).split('\0')) {
        if (token.startsWith('\x01')) current = commits.get(token.slice(1).trim()) ?? null;
        else { const path = token.replace(/^\n/, ''); if (path !== '' && current !== null) current.files.add(path); }
      }
      return commits;
    });
  } catch { return { ...changes, covered: [], why: 'the history since the result cannot be read' }; }
  const since = commit => memo(`cover-since:${commit}^${from}`, () => new Set(run(['rev-list', commit, `^${from}`]).split('\n').filter(Boolean)));
  const sha = value => /^[0-9a-f]{40}$/.test(String(value ?? '')) ? value : '';
  const clean = (commit, keys, rows) => {
    const baseline = readJson(commit, UI_GEOMETRY_BASELINE, cwd)?.entries ?? []; const exceptions = readJson(commit, UI_GEOMETRY_EXCEPTIONS, cwd)?.exceptions ?? [];
    return compareBaseline({ keys, baseline: rows === null ? baseline : baseline.filter(key => rows.has(splitKey(key).row)), exceptions: rows === null ? exceptions : exceptions.filter(entry => rows.has(entry.row)) }).added.length === 0;
  };
  // The valid measurements pushed with their own reports: [{ commit, what, at }].
  const measurements = memo(`cover-evidence:${base}^${from}`, () => {
    const out = [];
    for (const commit of history.values()) {
      for (const name of commit.runs) {
        const path = `${UI_GEOMETRY_RUNS}/${name}/geometry.json`;
        if (!commit.files.has(path)) continue;   // a trailer naming a report this commit did not add or change is no new evidence
        const report = readJson(commit.sha, path, cwd); const at = sha(report?.commit);
        if (report?.run !== name || at === '' || measuredAt(at, commit.sha, cwd) !== 'ok') continue;
        const { keys, measured } = reportFailures(report);
        if (report.dirty !== false || report.axesNarrowed !== false || typeof report.totals?.unopened !== 'number' || report.totals.unopened !== 0 || reportNotOpened(report) !== 0
          || !Array.isArray(report.unregisteredFramed) || report.unregisteredFramed.length !== 0 || measured.size === 0 || !clean(commit.sha, keys, new Set(measured.keys()))) continue;
        out.push({ commit: commit.sha, what: `UI-Geometry-Run ${name}`, at });
      }
      if (commit.files.has(UI_GEOMETRY_SUMMARY)) {
        const summary = readJson(commit.sha, UI_GEOMETRY_SUMMARY, cwd); const at = sha(summary?.commit);
        // A new full result comes with its report: restoring an old one, or naming a report already there, is no new evidence.
        if (summary?.full === true && at !== '' && typeof summary.report === 'string' && commit.files.has(summary.report) && measuredAt(at, commit.sha, cwd) === 'ok'
          && summary.dirty === false && summary.unopened === 0 && summary.unregisteredFramed === 0 && Array.isArray(summary.failureKeys) && clean(commit.sha, summary.failureKeys, null)) out.push({ commit: commit.sha, what: `full audit ${summary.run}`, at });
      }
    }
    return out;
  });
  const coverOf = path => {
    const changers = [...history.values()].filter(commit => commit.files.has(path)).map(commit => commit.sha);
    if (changers.length === 0) return null;
    const want = blob(base, path);
    for (const item of measurements) if (blob(item.at, path) === want && changers.every(changer => changer === item.at || since(item.at).has(changer))) {
      const recorded = history.get(item.commit).overrides;
      return { commit: item.commit, what: `${item.what}${recorded.length > 0 ? `; override, recorded: ${recorded.join(' | ')}` : ''}` };
    }
    return null;
  };
  const left = []; const covers = new Map();
  for (const path of changes.unsafe) {
    const cover = brought.has(path) ? null : coverOf(path);
    if (cover === null) { left.push(path); continue; }
    const key = `${cover.commit} ${cover.what}`; covers.set(key, { ...cover, files: (covers.get(key)?.files ?? 0) + 1 });
  }
  const closure = cache.get(`closure:${head}`) ?? null;
  const overrides = [...history.values()].filter(commit => commit.overrides.length > 0).map(commit => ({ commit: commit.sha, reasons: commit.overrides }));
  return { changed: changes.changed, unsafe: left, reaching: closure === null ? changes.reaching : left.filter(path => closure.has(path)).length, covered: [...covers.values()], overrides };
}

/** The line naming the trunk pushes that covered changes since a result (RR26 covered). */
const coveredLine = (what, covered, overrides = []) => [
  ...(covered.length === 0 ? [] : [`    ${what}: changes since covered by trunk pushes — ${covered.map(item => `${item.commit.slice(0, 8)} (${item.what}; ${item.files} file(s))`).join(', ')}`]),
  ...(overrides.length === 0 ? [] : [`    ${what}: overrides the trunk took since, recorded — an override covers nothing: ${overrides.map(item => `${item.commit.slice(0, 8)} (${item.reasons.join(' | ')})`).join(', ')}`])];

/** Whether `commit` is a commit here and an ancestor of `head`: 'ok' | 'missing' | 'not-ancestor'. */
export function measuredAt(commit, head, cwd) {
  try { execFileSync('git', ['cat-file', '-e', `${commit}^{commit}`], { cwd, stdio: 'ignore' }); } catch { return 'missing'; }
  try { execFileSync('git', ['merge-base', '--is-ancestor', commit, head], { cwd, stdio: 'ignore' }); return 'ok'; } catch { return 'not-ancestor'; }
}

export function geometryInputHash(inputs) {
  return createHash('sha256').update(inputs.join('\n')).digest('hex');
}

export function gateMode(env = process.env) {
  const value = env.FLS_UI_GEOMETRY_GATE;
  return value === 'enforce' || value === 'warn' ? value : UI_GEOMETRY_GATE;
}

/** A failure key's parts: row | condition | check | path. */
export const splitKey = key => { const [row, condition, check, ...path] = key.split('|'); return { row, condition, check, path: path.join('|') }; };
export const exceptionId = entry => `${entry.row}|${entry.check}|${entry.match}`;

/**
 * Pure: a run's failure keys against the baseline and the exceptions. An exception covers every condition of its row
 * and check whose element path contains `match`.
 */
export function compareBaseline({ keys, baseline = [], exceptions = [] }) {
  const used = new Set();
  const excepted = []; const counted = [];
  for (const key of new Set(keys)) {
    const { row, check, path } = splitKey(key);
    const entry = exceptions.find(item => item.row === row && item.check === check && path.includes(item.match));
    if (entry === undefined) counted.push(key); else { excepted.push(key); used.add(exceptionId(entry)); }
  }
  const inBaseline = new Set(baseline); const now = new Set(counted);
  return {
    failures: counted.length, excepted: excepted.length, baseline: inBaseline.size, exceptions: exceptions.length, counted: counted.sort(),
    added: counted.filter(key => !inBaseline.has(key)).sort(),
    fixed: [...inBaseline].filter(key => !now.has(key)).sort(),
    staleExceptions: exceptions.filter(entry => !used.has(exceptionId(entry))),
  };
}

export const readJson = (rev, path, cwd) => {
  try { return JSON.parse(execFileSync('git', ['show', `${rev}:${path}`], { cwd, encoding: 'utf8', maxBuffer: 256 * 2 ** 20, stdio: ['ignore', 'pipe', 'ignore'] })); } catch { return null; }
};
export const sample = list => list.slice(0, 5).map(item => `    ${typeof item === 'string' ? item : exceptionId(item)}`);

export const UI_GEOMETRY_RUNS = 'docs/verification/uiaudit1/geometry';

/** Where an audit writes the shared result: only a full audit does, unless --summary names a path (RR26). */
export function defaultSummaryPath({ explicit, full }) {
  return explicit ?? (full ? UI_GEOMETRY_SUMMARY : 'none');
}

/** The UI-Geometry-Run trailers of base..head: the changed-rows audit runs a push names (RR26). */
export function rowRunsInRange(base, head, cwd = process.cwd()) {
  const range = base === null ? ['-1', head] : [`${base}..${head}`];
  const out = git(['log', '--format=%(trailers:key=UI-Geometry-Run,valueonly,separator=%x01)%x02', ...range], cwd);
  return [...new Set(out.split('\x02').flatMap(row => row.split('\x01')).map(value => value.trim()).filter(Boolean))];
}

/** The conditions of a run report that were neither measured nor unreachable by design (error, not found, …). */
export function reportNotOpened(report) {
  const rows = report?.rows !== null && typeof report?.rows === 'object' ? report.rows : {};
  return Object.values(rows).reduce((sum, entry) => sum + Object.values(entry?.conditions ?? {}).filter(record => record?.status !== 'measured' && record?.status !== 'unreachable').length, 0);
}

/** A run report's failure keys (row | condition | check | path), its measured rows and their conditions. */
export function reportFailures(report) {
  const keys = []; const measured = new Map();
  const rows = report?.rows !== null && typeof report?.rows === 'object' ? report.rows : {};
  for (const [row, entry] of Object.entries(rows)) {
    for (const [condition, record] of Object.entries(entry?.conditions ?? {})) {
      if (record?.status !== 'measured') continue;
      if (!measured.has(row)) measured.set(row, new Set());
      measured.get(row).add(condition);
      for (const key of Array.isArray(record.keys) ? record.keys : []) keys.push(`${row}|${condition}|${key}`);
    }
  }
  return { keys: keys.sort(), measured };
}

/** One changed-rows run against <head> (RR26): ok, the reasons it is not, and the evidence. */
export function checkRowRun({ run, head, baseline, exceptions, cwd = process.cwd(), cache = new Map(), base = null }) {
  const report = readJson(head, `${UI_GEOMETRY_RUNS}/${run}/geometry.json`, cwd);
  if (report === null) return { run, ok: false, reasons: [`run ${run}: no ${UI_GEOMETRY_RUNS}/${run}/geometry.json at ${head.slice(0, 8)} (commit the run's report)`] };
  const reasons = [];
  const commit = /^[0-9a-f]{40}$/.test(String(report.commit ?? '')) ? report.commit : '';
  if (report.run !== run) reasons.push(`run ${run}: its report names another run (${report.run ?? 'none'})`);
  if (commit === '') reasons.push(`run ${run}: its report has no measured commit`);
  let changes = null;
  if (commit !== '') {
    const at = measuredAt(commit, head, cwd);
    if (at === 'missing') reasons.push(`run ${run}: its measured commit ${commit.slice(0, 8)} is not here`);
    else if (at === 'not-ancestor') reasons.push(`run ${run}: its measured commit ${commit.slice(0, 8)} is not in the pushed history (amended or rebased away): audit again`);
    else { changes = coveredChanges(commit, base, head, cwd, cache); if (changes.unsafe.length > 0) reasons.push(unsafeLine(`run ${run}`, commit, changes)); }
  }
  if (report.axesNarrowed !== false) reasons.push(`run ${run}: ${report.axesNarrowed === true ? 'narrowed by --viewports, --copy or --numbers' : 'its report does not say it measured every condition (an audit from before RR26)'}: audit the rows in every condition`);
  // A report that leaves out what it must say fails (the audit always writes these fields).
  if (report.dirty !== false) reasons.push(`run ${run}: ${report.dirty === true ? 'measured from a tree with uncommitted changes' : 'its report does not say whether the tree was clean'}`);
  const notOpened = reportNotOpened(report);
  if (typeof report.totals?.unopened !== 'number') reasons.push(`run ${run}: its report does not count the surface conditions not opened`);
  else if (Math.max(report.totals.unopened, notOpened) !== 0) reasons.push(`run ${run}: ${Math.max(report.totals.unopened, notOpened)} surface condition(s) could not be opened`);
  if (!Array.isArray(report.unregisteredFramed)) reasons.push(`run ${run}: its report does not list the framed roots no registry row measures`);
  else if (report.unregisteredFramed.length !== 0) reasons.push(`run ${run}: ${report.unregisteredFramed.length} framed root(s) on screen that no registry row measures`);
  const { keys, measured } = reportFailures(report);
  if (measured.size === 0) reasons.push(`run ${run}: no row was measured`);
  const ofRun = key => { const { row, condition } = splitKey(key); return measured.get(row)?.has(condition) === true; };
  const comparison = compareBaseline({ keys, baseline: baseline.filter(ofRun), exceptions: exceptions.filter(entry => measured.has(entry.row)) });
  if (comparison.added.length > 0) reasons.push(`run ${run}: ${comparison.added.length} new failure(s), in no baseline entry or exception:`, ...sample(comparison.added));
  if (comparison.fixed.length > 0) reasons.push(`run ${run}: ${comparison.fixed.length} baseline entr(ies) of its rows fixed, drop them (npm run ui-geometry:baseline):`, ...sample(comparison.fixed));
  const moved = changes === null ? null : changes.changed;
  const cells = [...measured.values()].reduce((sum, set) => sum + set.size, 0);
  return { run, ok: reasons.length === 0, reasons, commit, rows: [...measured.keys()].sort(), cells, failures: comparison.failures, moved, covered: changes?.covered ?? [], overrides: changes?.overrides ?? [] };
}

/** The UI-Geometry-Override trailers of base..head (the head alone without a base): [{ commit, reason }]. */
export function overridesInRange(base, head, cwd = process.cwd()) {
  const range = base === null ? ['-1', head] : [`${base}..${head}`];
  const out = git(['log', '--format=%H%x00%(trailers:key=UI-Geometry-Override,valueonly,separator=%x01)%x02', ...range], cwd);
  return out.split('\x02').map(row => row.trim()).filter(Boolean).flatMap(row => {
    const [commit, values = ''] = row.split('\x00');
    return values.split('\x01').map(value => value.trim()).filter(Boolean).map(reason => ({ commit, reason }));
  });
}

/** The shared result's retries, and the rows retried in it and in the shared result before it (user order 2026-10-09). */
export function retryNotes(summary, head, cwd = process.cwd()) {
  const retries = summary?.retries;
  if (retries === undefined || retries === null || typeof retries !== 'object') return null;
  let again = []; let previousRun = null;
  try {
    const commits = git(['log', '--format=%H', '-n', '2', head, '--', UI_GEOMETRY_SUMMARY], cwd).split('\n').filter(Boolean);
    const previous = commits.length > 1 ? readJson(commits[1], UI_GEOMETRY_SUMMARY, cwd) : null;
    if (previous?.retries?.rows && previous.run !== summary.run) { previousRun = previous.run ?? null; again = Object.keys(retries.rows ?? {}).filter(row => row in previous.retries.rows).sort(); }
  } catch { /* no history */ }
  return { run: summary.run ?? null, timeouts: retries.timeouts ?? 0, failedThrice: retries.failedThrice ?? 0, cellsRetried: retries.cellsRetried ?? 0,
    treesRetried: retries.treesRetried ?? 0, conditions: summary.conditions ?? null, rows: Object.keys(retries.rows ?? {}).sort(), again, previousRun };
}

export function checkUiGeometry({ base = null, head, cwd = process.cwd(), mode = gateMode(), env = process.env }) {
  try { execFileSync('git', ['cat-file', '-e', `${head}:scripts/uiGeometryAudit.mjs`], { cwd, stdio: 'ignore' }); } catch { return { skipped: true, mode, ok: true, pass: true, reasons: [] }; }
  const cache = new Map();
  // A range that changes only files on the safe list cannot move the screen: only the lists' shrink rules apply.
  const rangeChanges = base === null ? null : unsafeChanges(base, head, cwd, cache);
  const unchanged = rangeChanges !== null && rangeChanges.unsafe.length === 0;
  const summary = readJson(head, UI_GEOMETRY_SUMMARY, cwd);
  const baselineFile = readJson(head, UI_GEOMETRY_BASELINE, cwd);
  const exceptions = readJson(head, UI_GEOMETRY_EXCEPTIONS, cwd)?.exceptions ?? [];
  const reasons = [];
  let comparison = null;
  const sharedFull = summary !== null && summary.full === true;
  if (!unchanged && summary === null) reasons.push(`no ${UI_GEOMETRY_SUMMARY} at ${head.slice(0, 8)}`);
  else if (!unchanged && !sharedFull) reasons.push(`the shared result (run ${summary.run ?? '?'}, ${summary.rows ?? '?'} row(s)) is not a full audit: a changed-rows run counts only through its own report and a UI-Geometry-Run trailer (RR26)`);
  let sharedStale = false; let sharedCovered = []; let sharedOverrides = [];
  if (!unchanged && sharedFull) {
    const commit = /^[0-9a-f]{40}$/.test(String(summary.commit ?? '')) ? summary.commit : '';
    const at = commit === '' ? 'missing' : measuredAt(commit, head, cwd);
    if (at !== 'ok') { sharedStale = true; reasons.push(`the shared result (run ${summary.run ?? '?'}): its measured commit ${commit.slice(0, 8) || '(none)'} is ${at === 'missing' ? 'not here' : 'not in the pushed history'}: refresh it — npm run remote:ui-geometry`); }
    else {
      const changes = coveredChanges(commit, base, head, cwd, cache); sharedCovered = changes.covered; sharedOverrides = changes.overrides ?? [];
      if (changes.unsafe.length > 0) { sharedStale = true; reasons.push(`${unsafeLine(`the shared result (run ${summary.run ?? '?'})`, commit, changes)}: refresh it — npm run remote:ui-geometry, commit docs/verification/uiaudit1/geometry.json (and npm run ui-geometry:baseline if something was fixed)`); }
    }
  }
  if (!unchanged && sharedFull) {
    if (summary.dirty !== false) reasons.push(summary.dirty === true ? 'the result was measured from a tree with uncommitted changes' : 'the result does not say whether the tree was clean');
    if (typeof summary.unopened !== 'number') reasons.push('the result does not count the surface conditions not opened');
    else if (summary.unopened !== 0) reasons.push(`${summary.unopened} surface condition(s) could not be opened`);
    if (typeof summary.unregisteredFramed !== 'number') reasons.push('the result does not count the framed roots no registry row measures');
    else if (summary.unregisteredFramed !== 0) reasons.push(`${summary.unregisteredFramed} framed root(s) (data-frame) on screen that no registry row measures`);
    if (!Array.isArray(summary.failureKeys)) reasons.push('the result has no failure keys (an audit from before the baseline): run the audit again');
    else {
      if (baselineFile === null) reasons.push(`no ${UI_GEOMETRY_BASELINE}: npm run ui-geometry:baseline -- --reason "…"`);
      comparison = compareBaseline({ keys: summary.failureKeys, baseline: baselineFile?.entries ?? [], exceptions });
      if (comparison.added.length > 0) reasons.push(`${comparison.added.length} new failure(s), in no baseline entry or exception:`, ...sample(comparison.added));
      if (comparison.fixed.length > 0) reasons.push(`${comparison.fixed.length} fixed, drop them from the baseline (npm run ui-geometry:baseline):`, ...sample(comparison.fixed));
      if (comparison.staleExceptions.length > 0) reasons.push(`${comparison.staleExceptions.length} exception(s) match no failure, drop them:`, ...sample(comparison.staleExceptions));
    }
  }
  // RR26: a stale or missing shared result (not a current one with its own failures) gives way to the changed-rows runs
  // the range names, when every one holds.
  let rowRuns = null;
  if (!unchanged && reasons.length > 0 && (!sharedFull || sharedStale)) {
    const runs = rowRunsInRange(base, head, cwd);
    if (runs.length > 0) {
      // Newest first: a run whose rows a newer named run measured again is superseded (the remedy for a stale run is a
      // new one, so the old trailer must not keep refusing).
      const covered = new Set(); rowRuns = [];
      for (const run of runs) {
        const entry = checkRowRun({ run, head, baseline: baselineFile?.entries ?? [], exceptions, cwd, cache, base });
        const rows = entry.rows ?? [];
        if (rows.length > 0 && rows.every(row => covered.has(row))) { rowRuns.push({ ...entry, ok: true, superseded: true, reasons: [] }); continue; }
        // A named run with no report or no measured row counts for nothing; a newer valid named run supersedes it.
        if (rows.length === 0 && rowRuns.some(newer => newer.ok && !newer.superseded)) { rowRuns.push({ ...entry, rows: [], ok: true, superseded: true, reasons: [] }); continue; }
        for (const row of rows) covered.add(row);
        rowRuns.push(entry);
      }
      reasons.length = 0; comparison = null;
      for (const entry of rowRuns) reasons.push(...entry.reasons);
    }
  }
  // Only shrink: what base..head adds.
  if (base !== null && baselineFile !== null) {
    const before = readJson(base, UI_GEOMETRY_BASELINE, cwd);
    if (before !== null) {
      const had = new Set(before.entries ?? []); const grown = (baselineFile.entries ?? []).filter(key => !had.has(key));
      if (grown.length > 0 && (baselineFile.reasons?.length ?? 0) <= (before.reasons?.length ?? 0)) reasons.push(`the baseline grew by ${grown.length} entr(ies) with no recorded reason (npm run ui-geometry:baseline -- --reason "…")`);
    }
    const exceptionsBefore = readJson(base, UI_GEOMETRY_EXCEPTIONS, cwd);
    if (exceptionsBefore !== null) {
      const had = new Set((exceptionsBefore.exceptions ?? []).map(exceptionId)); const addedExceptions = exceptions.filter(entry => !had.has(exceptionId(entry)));
      if (addedExceptions.length > 0) reasons.push(`${addedExceptions.length} exception(s) added (the list only shrinks):`, ...sample(addedExceptions));
    }
  }
  const ok = reasons.length === 0;
  // The override: only from the environment, with a reason the head commit records as a trailer.
  let override = null;
  if (!ok && mode === 'warn' && env.FLS_UI_GEOMETRY_GATE === 'warn') {
    const reason = (env.FLS_UI_GEOMETRY_REASON ?? '').replace(/\s+/g, ' ').trim();
    const recorded = overridesInRange(null, head, cwd).map(item => item.reason);
    if (reason.split(' ').filter(Boolean).length < 3) override = { refused: 'FLS_UI_GEOMETRY_GATE=warn needs FLS_UI_GEOMETRY_REASON="<one line: why, in a few words>"' };
    else if (!recorded.includes(reason)) override = { refused: `the head commit does not record the override: git commit --amend --no-edit --trailer "UI-Geometry-Override: ${reason}"` };
    else override = { reason };
  }
  const pass = ok || (mode === 'warn' && env.FLS_UI_GEOMETRY_GATE !== 'warn') || override?.reason !== undefined;
  return { skipped: false, mode, ok, pass, reasons: override?.refused === undefined ? reasons : [...reasons, `override refused: ${override.refused}`], summary, comparison, unchanged, rangeChanges, override, rowRuns, sharedCovered, sharedOverrides,
    // The retries of a shared result this range brings (a new audit): its rate and the rows it retried again.
    retries: summary !== null && (base === null || readJson(base, UI_GEOMETRY_SUMMARY, cwd)?.run !== summary.run) ? retryNotes(summary, head, cwd) : null };
}

/** An accepted override: the line a report must carry, also appended (time, host, commit, reason) to .remote-runs/local-heavy.log. */
export function logWarnOverride(result, { top = process.cwd(), head = '' } = {}) {
  if (result.override?.reason === undefined) return null;
  const line = `${new Date().toISOString()}\t${hostname()}\t${head.slice(0, 8)}\tui-geometry gate overridden (FLS_UI_GEOMETRY_GATE=warn)\t${result.override.reason}`;
  try { mkdirSync(join(top, '.remote-runs'), { recursive: true }); appendFileSync(join(top, '.remote-runs', 'local-heavy.log'), `${line}\n`); } catch { /* read-only tree */ }
  return `[FLS_UI_GEOMETRY_GATE=warn] 기하 감사 관문을 우회했다(${head.slice(0, 8)}): ${result.override.reason}. 보고서에 반드시 적는다. 기록: 커밋 트레일러 UI-Geometry-Override, .remote-runs/local-heavy.log`;
}

/** check:merge's count line: the commits of base..head carrying a UI-Geometry-Override trailer, with their reasons. */
export function formatOverrideCount(base, head, cwd = process.cwd()) {
  const overrides = overridesInRange(base, head, cwd);
  return [`ui-geometry: warn overrides in this range: ${overrides.length}`, ...overrides.map(item => `  ${item.commit.slice(0, 8)} ${item.reason}`)].join('\n');
}

/** The retry lines (user order 2026-10-09): the rate, and the rows retried again since the shared result before. */
export function retryLines(retries) {
  if (retries === null || retries === undefined) return [];
  const rate = retries.conditions ? ` of ${retries.conditions} (${(100 * retries.cellsRetried / retries.conditions).toFixed(1)} %)` : '';
  const lines = [`ui-geometry: retries in run ${retries.run}: ${retries.cellsRetried} condition(s) needed another attempt${rate}, ${retries.timeouts} first-attempt timeout(s), ${retries.failedThrice} failed three times, ${retries.treesRetried} tree(s) re-run${retries.rows.length > 0 ? ` — ${retries.rows.slice(0, 6).join(', ')}${retries.rows.length > 6 ? ' …' : ''}` : ''}`];
  if (retries.again.length > 0) lines.push(`ui-geometry: retried again (also in ${retries.previousRun}): ${retries.again.join(', ')} — a wait condition to fix (docs/verification/uiaudit1/RETRIES.md)`);
  return lines;
}

export function formatUiGeometryResult(result) {
  if (result.skipped) return 'ui-geometry: skipped (no geometry audit at this commit)';
  const tag = result.override?.reason !== undefined ? ` (overridden: ${result.override.reason})` : result.mode === 'warn' && result.pass ? ' (report only: UI_GEOMETRY_GATE = warn)' : '';
  const counts = result.comparison === null || result.comparison === undefined ? ''
    : ` — ${result.comparison.failures} failure(s): ${result.comparison.baseline} in the baseline, ${result.comparison.excepted} under ${result.comparison.exceptions} exception(s)`;
  if (result.ok && result.unchanged) return [`ui-geometry: only files on the safe list changed (${result.rangeChanges.changed}): no audit needed (RR26)${tag}`, ...retryLines(result.retries)].join('\n');
  if (result.ok && result.rowRuns) return [`ui-geometry: changed rows accepted (decision RR26)${tag}`, ...result.rowRuns.map(entry => entry.superseded
    ? `  run ${entry.run}: superseded — ${entry.rows.length > 0 ? `a newer named run measured its rows (${entry.rows.join(', ')}) again` : 'it has no report or no measured row, and a newer named run holds'}`
    : `  run ${entry.run} (commit ${entry.commit.slice(0, 8)}): ${entry.rows.length} row(s), ${entry.cells} cell(s), no new failure; ${entry.moved} file(s) changed since it was measured, all on the safe list — ${entry.rows.slice(0, 4).join(', ')}${entry.rows.length > 4 ? ' …' : ''}`), ...result.rowRuns.flatMap(entry => coveredLine(`run ${entry.run}`, entry.covered ?? [], entry.overrides ?? [])), ...retryLines(result.retries)].join('\n');
  if (result.ok) return [`ui-geometry: run ${result.summary.run}, no new failure${counts}${tag}`, ...coveredLine(`the shared result (run ${result.summary.run})`, result.sharedCovered ?? [], result.sharedOverrides ?? []), ...retryLines(result.retries)].join('\n');
  const lines = [`ui-geometry: ${result.pass ? 'not green' : 'FAILED'}${counts}${tag}`];
  for (const reason of result.reasons) lines.push(reason.startsWith('    ') ? reason : `  ${reason}`);
  return [...lines, ...(result.summary ? coveredLine(`the shared result (run ${result.summary.run})`, result.sharedCovered ?? [], result.sharedOverrides ?? []) : []), ...retryLines(result.retries)].join('\n');
}

if (isMain(import.meta.url)) {
  const { base, head } = resolveRange();
  const result = checkUiGeometry({ base, head });
  console.log(formatUiGeometryResult(result));
  const override = logWarnOverride(result, { head }); if (override !== null) console.error(override);
  console.log(formatOverrideCount(base, head));
  process.exitCode = result.pass ? 0 : 1;
}
