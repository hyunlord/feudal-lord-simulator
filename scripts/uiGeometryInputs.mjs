// RR26 measured (a′, user ruling 2026-10-10): what a geometry audit read, bound to its result. scripts/remote/tasks.sh
// ui-geometry runs the dev server and the audit under the RR25 recorder (scripts/checks/testInputs/traceReads.mjs, roles
// `vite` and `audit`), stops the server, then runs this:
//   node scripts/uiGeometryInputs.mjs <out> <trace dir> [--state <set>=<dir> …] [--declared <dir> …]
// It writes <out>/inputs.json — the files, folders and missing paths the two processes read in the repository (the same
// form as a test's record, { files, dirs, missing, untraceable }), what could not be followed, and the declared inputs
// that are bound by value instead of measured: the scene state folders the audit read (a hash of each set's folder),
// the lock file, Vite's dependency cache, the Chromium and Playwright it ran — and adds `measuredInputs` (the file, its
// sha256, the counts, untraceable, declared) to <out>/geometry.json and to the shared summary this run wrote.
// A record missing for either process, or a dev server whose config files were not written (viteNoWatch.config.ts's
// plugin), is untraceable: the gate then judges the result by the safe list.
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { isMain } from './checks/gitRange.mjs';
import { collectTestInputs, packInputs } from './checks/testInputs/testInputs.mjs';
import { UI_GEOMETRY_SUMMARY } from './checks/uiGeometry.mjs';

export const INPUTS_FILE = 'inputs.json';
export const DEV_SERVER_CONFIG = 'scripts/remote/viteNoWatch.config.ts';

const sha256 = data => createHash('sha256').update(data).digest('hex');

/** A folder's content as one hash: every file under it, by relative path and content, in order. */
export function folderHash(dir) {
  const files = [];
  const walk = sub => { for (const entry of readdirSync(join(dir, sub), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const rel = sub === '' ? entry.name : `${sub}/${entry.name}`;
    if (entry.isDirectory()) walk(rel); else if (entry.isFile()) files.push(`${rel}\0${sha256(readFileSync(join(dir, rel)))}`);
  } };
  walk('');
  return sha256(files.join('\n'));
}

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
  const inputs = Object.fromEntries(['files', 'dirs', 'lists', 'missing', 'untraceable'].map(key => [key, [...merged[key]].sort()]));
  return { inputs, declaredPaths: [...merged.declared].sort(),
    roles: Object.fromEntries(Object.entries(roles).map(([name, role]) => [name, role === undefined ? null : { files: role.files.length, dirs: role.dirs.length, lists: role.lists?.length ?? 0, missing: role.missing.length, children: role.children ?? [] }])) };
}

/** The declared inputs: what the audit read outside the repository, bound by value. */
export function declaredInputs({ root, states, declaredPaths, chromium }) {
  const real = dir => { try { return realpathSync(dir); } catch { return dir; } };
  const under = (path, dir) => path === dir || path.startsWith(`${dir}/`);
  const read = Object.entries(states).filter(([, dir]) => declaredPaths.some(path => under(path, dir) || under(path, real(dir))));
  const file = path => existsSync(join(root, path)) ? sha256(readFileSync(join(root, path))) : null;
  const viteDeps = join(root, 'node_modules/.vite/deps/_metadata.json');
  let deps = null; try { const meta = JSON.parse(readFileSync(viteDeps, 'utf8')); deps = { hash: meta.hash ?? null, browserHash: meta.browserHash ?? null }; } catch { /* no cache */ }
  let playwright = null; try { playwright = JSON.parse(readFileSync(join(dirname(process.env.FLS_PLAYWRIGHT_CORE ?? ''), 'package.json'), 'utf8')).version ?? null; } catch { /* not known */ }
  return { states: Object.fromEntries(read.map(([set, dir]) => [set, folderHash(dir)]).sort(([a], [b]) => a.localeCompare(b))),
    lock: file('package-lock.json'), viteDeps: deps, chromium: chromium ?? null, playwright };
}

if (isMain(import.meta.url)) {
  const [out, traceDir, ...rest] = process.argv.slice(2);
  if (!out || !traceDir) { console.error('usage: node scripts/uiGeometryInputs.mjs <out> <trace dir> [--state <set>=<dir> …] [--declared <dir> …]'); process.exit(2); }
  const states = {}; const declared = [];
  for (let k = 0; k < rest.length; k += 2) {
    if (rest[k] === '--state') { const [set, dir] = rest[k + 1].split('='); states[set] = dir; declared.push(dir); }
    else if (rest[k] === '--declared') declared.push(rest[k + 1]);
  }
  const root = process.cwd();
  const report = JSON.parse(readFileSync(join(out, 'geometry.json'), 'utf8'));
  const measured = auditInputs({ root, traceDir, declared });
  const declaredValues = declaredInputs({ root, states, declaredPaths: measured.declaredPaths, chromium: report.browser?.chromium });
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
