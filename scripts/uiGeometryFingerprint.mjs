// RR26 shadow (a′, user rulings 2026-10-10): the audit's inputs git cannot recompute — the scene state folders, the
// Chromium, Playwright and node the DGX runs use, the system identity files that pick native binaries, the node_modules
// install. The audit binds them to its result (scripts/uiGeometryInputs.mjs, `declared`); check:merge reads them on the
// DGX once before a push (the fingerprint, scripts/checks/uiGeometryMeasured.mjs shadowStep) and records them beside the
// two judgements. Vite's dependency cache is not read here: it is made per run from the lock file and the config (git,
// measured) and node_modules (the install is compared). This file imports nothing of the repository: check:merge sends
// it to node on the DGX as it is.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/** The scene state sets scripts/remote/tasks.sh passes the audit (--state <set>=<folder>), by their default folders under $HOME. */
export const STATE_SETS = Object.freeze({ ui5: 'fls-ui5-states-v22', ui6: 'fls-ui6-states', ui8: 'fls-ui8-states', ui9: 'fls-ui9-states', ui10: 'fls-ui10-states',
  'ui10-extra': 'fls-ui10-states/extra', lands: 'fls-land-states', petitions: 'fls-lmr1-petition-states', lord: 'fls-lord-states', moments: 'fls-wave40-moment-states',
  lord2: 'fls-lmr2-states', deccard2: 'fls-deccard2-results-states', slice: 'fls-slice-end-states', variants: 'fls-variant-states',
  growplan: 'fls-growplan-states' });
/** The system identity files the task declares (--system). */
export const SYSTEM_FILES = Object.freeze(['/proc/version', '/usr/bin/ldd', '/etc/os-release']);
/** Where the DGX keeps the shadow records, one file per check:merge run (under $HOME). */
export const SHADOW_DIR = 'fls-runs/_shadow';

const sha256 = data => createHash('sha256').update(data).digest('hex');
const files = dir => {
  const out = [];
  const walk = sub => { for (const entry of readdirSync(join(dir, sub), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const rel = sub === '' ? entry.name : `${sub}/${entry.name}`;
    if (entry.isDirectory()) walk(rel); else if (entry.isFile()) out.push(rel);
  } };
  walk('');
  return out;
};

/** A folder's content as one hash: every file under it, by relative path and content, in order. */
export function folderHash(dir) {
  return sha256(files(dir).map(rel => `${rel}\0${sha256(readFileSync(join(dir, rel)))}`).join('\n'));
}

/** A folder's hash, reused from `cacheFile` while no file under it changed path, size or modification time (ns). */
export function cachedFolderHash(dir, cacheFile) {
  const signature = sha256(files(dir).map(rel => { const stat = statSync(join(dir, rel), { bigint: true }); return `${rel}\0${stat.size}\0${stat.mtimeNs}`; }).join('\n'));
  const read = () => { try { return JSON.parse(readFileSync(cacheFile, 'utf8')); } catch { return {}; } };
  if (read()[dir]?.signature === signature) return read()[dir].hash;
  const hash = folderHash(dir);
  try { const tmp = `${cacheFile}.${process.pid}`; writeFileSync(tmp, JSON.stringify({ ...read(), [dir]: { signature, hash } })); renameSync(tmp, cacheFile); } catch { /* the next run hashes again */ }
  return hash;
}

const tryOr = fn => { try { return fn(); } catch { return null; } };

/**
 * The DGX's values now: { node, chromium, playwright, system: { path: sha256 }, states: { set: folder hash }, nodeModules:
 * { key, inode } } — a value it cannot read is null. `nodeModulesKey` is the cache key the shared result's audit ran with
 * (node_modules/.fls-nm-key): the run's node_modules is a hard-linked copy of ~/fls-runs/_cache/nm-<key>, so the same
 * inode of its .package-lock.json means the same install.
 */
export function environmentFingerprint({ home = homedir(), nodeModulesKey = null, cache = join(home, SHADOW_DIR, '_folders.json') } = {}) {
  const tools = join(home, 'fls-runs/_tools');
  const chromiumPath = tryOr(() => readFileSync(join(tools, 'chromium-path'), 'utf8').trim());
  const chromium = chromiumPath ? tryOr(() => /(\d+(?:\.\d+){3})/.exec(execFileSync(chromiumPath, ['--version'], { encoding: 'utf8', timeout: 3000 }))?.[1] ?? null) : null;
  const playwright = tryOr(() => JSON.parse(readFileSync(join(tools, 'node_modules/playwright-core/package.json'), 'utf8')).version ?? null);
  const system = Object.fromEntries(SYSTEM_FILES.map(path => [path, tryOr(() => sha256(readFileSync(path)))]));
  tryOr(() => mkdirSync(join(home, SHADOW_DIR), { recursive: true }));
  const states = Object.fromEntries(Object.entries(STATE_SETS).map(([set, dir]) => [set, tryOr(() => cachedFolderHash(join(home, dir), cache))]));
  const nodeModules = nodeModulesKey === null ? null
    : { key: nodeModulesKey, inode: tryOr(() => String(statSync(join(home, 'fls-runs/_cache', `nm-${nodeModulesKey}`, 'node_modules/.package-lock.json')).ino)) };
  return { node: process.version, chromium, playwright, system, states, nodeModules };
}

/** One check:merge run's record, in a file of its own: <head 12>-<time>-<session>.json (written whole, then renamed). */
export function writeShadowRecord(record, { home = homedir() } = {}) {
  const dir = join(home, SHADOW_DIR); mkdirSync(dir, { recursive: true });
  const name = `${String(record.head).slice(0, 12)}-${String(record.time).replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')}-${String(record.session).replace(/[^A-Za-z0-9_.-]/g, '_')}.json`;
  const tmp = join(dir, `.${name}.${process.pid}`); writeFileSync(tmp, `${JSON.stringify(record)}\n`); renameSync(tmp, join(dir, name));
  return name;
}
