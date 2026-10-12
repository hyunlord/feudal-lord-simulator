// RR26 measured (a′, user ruling 2026-10-10): what a geometry audit read, bound to its result. scripts/remote/tasks.sh
// ui-geometry runs the dev server and the audit under the RR25 recorder (scripts/checks/testInputs/traceReads.mjs, roles
// `vite` and `audit`), stops the server, then runs this:
//   node scripts/uiGeometryInputs.mjs <out> <trace dir> [--state <set>=<dir> …] [--declared <dir> …] [--system <file> …]
// It writes <out>/inputs.json — the files, folders and missing paths the two processes read in the repository (the same
// form as a test's record, { files, dirs, missing, untraceable }), what could not be followed, and the declared inputs
// that are bound by value instead of measured: the scene state folders the audit read (a hash of each set's folder),
// the lock file, Vite's dependency cache, the Chromium and Playwright it ran — and adds `measuredInputs` (the file, its
// sha256, the counts, untraceable, declared) to <out>/geometry.json and to the shared summary this run wrote. The same
// declared values are read on the DGX before a push (scripts/uiGeometryFingerprint.mjs) for the shadow judgement.
// A record missing for either process, or a dev server whose config files were not written (viteNoWatch.config.ts's
// plugin), is untraceable: the gate then judges the result by the safe list.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { isMain } from './checks/gitRange.mjs';
import { collectTestInputs, packInputs } from './checks/testInputs/testInputs.mjs';
import { UI_GEOMETRY_SUMMARY } from './checks/uiGeometry.mjs';
import { folderHash } from './uiGeometryFingerprint.mjs';

export { folderHash };

export const INPUTS_FILE = 'inputs.json';
/** The audit's own records (results, failure shots, the baseline and exceptions): what it writes or compares after measuring, never what it measures. */
export const AUDIT_RECORDS = 'docs/verification/uiaudit1/';
export const DEV_SERVER_CONFIG = 'scripts/remote/viteNoWatch.config.ts';

const sha256 = data => createHash('sha256').update(data).digest('hex');

/** The measured inputs of one audit from its trace folder: { inputs, untraceable, roles, declaredPaths }. */
export function auditInputs({ root, traceDir, declared = [] }) {
  const byRole = collectTestInputs({ root, traceDir, declared });
  const roles = { vite: byRole.get('role:vite'), audit: byRole.get('role:audit') };
  const merged = { files: new Set(), dirs: new Set(), lists: new Set(), missing: new Set(), untraceable: new Set(), declared: new Set() };
  for (const [name, inputs] of Object.entries(roles)) {
    if (inputs === undefined) { merged.untraceable.add(`no record of the ${name === 'vite' ? 'dev server' : 'audit'}`); continue; }
    for (const key of ['files', 'dirs', 'lists', 'missing', 'declared']) for (const value of inputs[key] ?? []) merged[key].add(value);
    for (const reason of inputs.untraceable) merged.untraceable.add(`${name === 'vite' ? 'dev server' : 'audit'}: ${reason}`);
  }
  if (roles.vite !== undefined && !roles.vite.files.includes(DEV_SERVER_CONFIG)) merged.untraceable.add(`dev server: the files its config was bundled from were not recorded (${DEV_SERVER_CONFIG})`);
  for (const key of ['files', 'dirs', 'lists', 'missing']) for (const path of [...merged[key]]) if (path.startsWith(AUDIT_RECORDS)) merged[key].delete(path);
  // import.meta.glob is expanded by Vite natively: the folders it lists are not recorded.
  for (const path of merged.files) if (/\.(m?[jt]sx?)$/.test(path) && path.startsWith('src/')) { let text = ''; try { text = readFileSync(join(root, path), 'utf8'); } catch { continue; } if (text.includes('import.meta.glob')) merged.untraceable.add(`dev server: ${path} uses import.meta.glob (Vite lists its folders natively)`); }
  const inputs = Object.fromEntries(['files', 'dirs', 'lists', 'missing', 'untraceable'].map(key => [key, [...merged[key]].sort()]));
  return { inputs, declaredPaths: [...merged.declared].sort(),
    roles: Object.fromEntries(Object.entries(roles).map(([name, role]) => [name, role === undefined ? null : { files: role.files.length, dirs: role.dirs.length, lists: role.lists?.length ?? 0, missing: role.missing.length, children: role.children ?? [] }])) };
}

/** The declared inputs: what the audit read outside the repository, bound by value. */
export function declaredInputs({ root, states, declaredPaths, chromium, system = [] }) {
  const real = dir => { try { return realpathSync(dir); } catch { return dir; } };
  const under = (path, dir) => path === dir || path.startsWith(`${dir}/`);
  const read = Object.entries(states).filter(([, dir]) => declaredPaths.some(path => under(path, dir) || under(path, real(dir))));
  const file = path => existsSync(join(root, path)) ? sha256(readFileSync(join(root, path))) : null;
  // Vite's own hash and browserHash cover config.root, the run folder's absolute path: they differ on every run. Bound
  // instead: its lock file hash and the pre-bundled dependencies by id and path in the folder.
  const viteDeps = join(root, 'node_modules/.vite/deps/_metadata.json');
  let deps = null; try { const meta = JSON.parse(readFileSync(viteDeps, 'utf8')); deps = { lockfileHash: meta.lockfileHash ?? null,
    optimized: sha256(Object.entries(meta.optimized ?? {}).map(([id, info]) => `${id}\0${relative(root, info?.src ?? '')}`).sort().join('\n')) }; } catch { /* no cache */ }
  // The install: node_modules is a hard-linked copy of the DGX's cache for its key (scripts/remote/remote-exec.sh).
  let nodeModules = null; try { nodeModules = { key: readFileSync(join(root, 'node_modules/.fls-nm-key'), 'utf8').trim(), inode: String(statSync(join(root, 'node_modules/.package-lock.json')).ino) }; } catch { /* not a DGX run */ }
  let playwright = null; try { playwright = JSON.parse(readFileSync(join(dirname(process.env.FLS_PLAYWRIGHT_CORE ?? ''), 'package.json'), 'utf8')).version ?? null; } catch { /* not known */ }
  // The system identity files read (they pick native binaries), by content.
  const systemRead = system.filter(path => declaredPaths.some(read => read === path || read === real(path))).sort();
  const systemHashes = Object.fromEntries(systemRead.map(path => { try { return [path, sha256(readFileSync(path))]; } catch { return [path, null]; } }));
  return { states: Object.fromEntries(read.map(([set, dir]) => [set, folderHash(dir)]).sort(([a], [b]) => a.localeCompare(b))),
    lock: file('package-lock.json'), viteDeps: deps, chromium: chromium ?? null, playwright, node: process.version, nodeModules, system: systemHashes };
}

if (isMain(import.meta.url)) {
  const [out, traceDir, ...rest] = process.argv.slice(2);
  if (!out || !traceDir) { console.error('usage: node scripts/uiGeometryInputs.mjs <out> <trace dir> [--state <set>=<dir> …] [--declared <dir> …]'); process.exit(2); }
  const states = {}; const declared = []; const system = [];
  for (let k = 0; k < rest.length; k += 2) {
    if (rest[k] === '--state') { const [set, dir] = rest[k + 1].split('='); states[set] = dir; declared.push(dir); }
    else if (rest[k] === '--declared') declared.push(rest[k + 1]);
    else if (rest[k] === '--system') { declared.push(rest[k + 1]); system.push(rest[k + 1]); }
  }
  const root = process.cwd();
  const report = JSON.parse(readFileSync(join(out, 'geometry.json'), 'utf8'));
  const measured = auditInputs({ root, traceDir, declared });
  const declaredValues = declaredInputs({ root, states, declaredPaths: measured.declaredPaths, chromium: report.browser?.chromium, system });
  const body = `${JSON.stringify({ schema: 1, kind: 'ui-geometry-inputs', run: report.run, commit: report.commit, roles: measured.roles, declared: declaredValues,
    inputs: packInputs(new Map([['audit', measured.inputs]])) })}\n`;
  writeFileSync(join(out, INPUTS_FILE), body);
  const link = { file: relative(root, join(out, INPUTS_FILE)), sha256: sha256(body), files: measured.inputs.files.length, dirs: measured.inputs.dirs.length, lists: measured.inputs.lists.length,
    missing: measured.inputs.missing.length, untraceable: measured.inputs.untraceable, declared: declaredValues };
  writeFileSync(join(out, 'geometry.json'), `${JSON.stringify({ ...report, measuredInputs: link })}\n`);
  if (existsSync(UI_GEOMETRY_SUMMARY)) {
    const summary = JSON.parse(readFileSync(UI_GEOMETRY_SUMMARY, 'utf8'));
    if (summary.run === report.run) writeFileSync(UI_GEOMETRY_SUMMARY, `${JSON.stringify({ ...summary, measuredInputs: link }, null, 1)}\n`);
  }
  console.log(`ui-geometry inputs: ${link.files} file(s), ${link.dirs} folder(s), ${link.missing} missing path(s) read; untraceable ${link.untraceable.length === 0 ? 'none' : link.untraceable.join('; ')}; declared states ${Object.keys(declaredValues.states).join(', ') || 'none'} — ${link.file}`);
}
