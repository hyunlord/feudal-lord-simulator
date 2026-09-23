#!/usr/bin/env node
// External QA observer for a normal Chrome game session. It never sends play input.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve, relative, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = parseArgs(process.argv.slice(2));
const mode = args._[0];
if (mode === 'help' || mode === undefined) {
  process.stdout.write('Usage: node scripts/a4SnapshotCapture.mjs capture --first-screen-utc 2026-09-23T20:00:00.000Z --cdp-port 9223 --out output/playtest-a-quadruple-prime/replay-prep/raw [--minutes 60]\n       node scripts/a4SnapshotCapture.mjs restore --cdp-port 9223 --snapshot FILE --manifest FILE --out DIR\n       node scripts/a4SnapshotCapture.mjs verify --snapshot FILE --manifest FILE\n');
  process.exit(mode === 'help' ? 0 : 2);
}
if (!['capture', 'restore', 'verify'].includes(mode)) throw new Error(`Unknown mode: ${mode}`);

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const stateSha = state => sha256(JSON.stringify(state));
const isGameState = state => state && typeof state === 'object' && Number.isInteger(state.tick)
  && Number.isInteger(state.seed) && Array.isArray(state.tiles) && Array.isArray(state.buildings)
  && Array.isArray(state.houses) && Array.isArray(state.walkers) && Array.isArray(state.constructionSites)
  && Number.isInteger(state.width) && Number.isInteger(state.height);

function parseArgs(argv) {
  const result = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const word = argv[i];
    if (!word.startsWith('--')) { result._.push(word); continue; }
    if (word.length === 2 || i + 1 >= argv.length || argv[i + 1].startsWith('--')) throw new Error(`Missing value for ${word}`);
    if (Object.hasOwn(result, word.slice(2))) throw new Error(`Duplicate flag ${word}`);
    result[word.slice(2)] = argv[++i];
  }
  return result;
}

async function digestDist() {
  const dist = join(repo, 'dist');
  const files = [];
  async function visit(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile()) files.push(path);
    }
  }
  await visit(dist);
  files.sort();
  const pairs = [];
  for (const path of files) pairs.push(`${relative(dist, path)}\0${sha256(await readFile(path))}\n`);
  return sha256(pairs.join(''));
}

async function provenance() {
  return {
    gitHead: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim(),
    distSha256: await digestDist(),
    scriptSha256: sha256(await readFile(fileURLToPath(import.meta.url))),
  };
}

class Cdp {
  constructor(url) { this.url = url; this.serial = 0; this.pending = new Map(); }
  async open() {
    this.socket = new WebSocket(this.url);
    await new Promise((accept, reject) => {
      const timeout = setTimeout(() => reject(new Error('CDP WebSocket open timed out')), 10000);
      this.socket.addEventListener('open', () => { clearTimeout(timeout); accept(); }, { once: true });
      this.socket.addEventListener('error', event => { clearTimeout(timeout); reject(new Error(`CDP WebSocket error: ${event.message ?? 'unknown'}`)); }, { once: true });
    });
    this.socket.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (message.id === undefined) return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      clearTimeout(pending.timeout);
      if (message.error) pending.reject(new Error(`CDP ${pending.method}: ${message.error.message}`));
      else pending.resolve(message.result);
    });
    this.socket.addEventListener('close', () => {
      for (const pending of this.pending.values()) { clearTimeout(pending.timeout); pending.reject(new Error('CDP connection closed')); }
      this.pending.clear();
    });
  }
  send(method, params = {}) {
    const id = ++this.serial;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => { this.pending.delete(id); reject(new Error(`CDP ${method} timed out`)); }, 20000);
      this.pending.set(id, { resolve, reject, timeout, method });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
  close() { this.socket?.close(); }
}

async function selectPage() {
  const port = Number(args['cdp-port'] ?? 9223);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid --cdp-port');
  const response = await fetch(`http://127.0.0.1:${port}/json/list`);
  if (!response.ok) throw new Error(`CDP target list HTTP ${response.status}`);
  const targets = (await response.json()).filter(target => target.type === 'page' && target.webSocketDebuggerUrl);
  const expected = args['url-prefix'] ?? 'http://127.0.0.1:4173/';
  const matches = targets.filter(target => target.url.startsWith(expected) && (!args['target-id'] || target.id === args['target-id']));
  if (matches.length !== 1) throw new Error(`Expected one game page at ${expected}; found ${matches.length}. Supply --target-id if needed.`);
  if (new URL(matches[0].url).searchParams.has('phase10-proof')) throw new Error('Normal screen required; phase10-proof instrumentation is not allowed');
  const cdp = new Cdp(matches[0].webSocketDebuggerUrl);
  await cdp.open();
  return { cdp, target: { id: matches[0].id, url: matches[0].url } };
}

// React 19 provider value is read through the current fiber, outside the player agent.
// Fail closed if this internal shape changes or more than one game provider is found.
const providerSource = `(() => {
  const root = document.getElementById('root');
  const key = root && Object.keys(root).find(k => k.startsWith('__reactContainer$'));
  const current = key && root[key]?.stateNode?.current;
  if (!current) throw new Error('Current React root unavailable');
  const stack = [current], found = [];
  while (stack.length) {
    const fiber = stack.pop();
    const v = fiber.memoizedProps?.value;
    if (v && typeof v.dispatch === 'function' && typeof v.setSpeed === 'function'
      && v.state && Number.isInteger(v.state.tick) && Array.isArray(v.state.tiles)
      && Array.isArray(v.state.buildings) && Array.isArray(v.state.houses)) found.push(v);
    if (fiber.sibling) stack.push(fiber.sibling);
    if (fiber.child) stack.push(fiber.child);
  }
  if (found.length !== 1) throw new Error('Expected exactly one game provider, got ' + found.length);
  return found[0];
})()`;

async function evaluate(cdp, expression) {
  const result = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, userGesture: false });
  if (result.exceptionDetails) throw new Error(`Browser evaluation failed: ${result.exceptionDetails.text} ${result.exceptionDetails.exception?.description ?? ''}`);
  return result.result.value;
}

async function observe(cdp) {
  const observed = await evaluate(cdp, `(() => { const v = ${providerSource}; return { state: JSON.parse(JSON.stringify(v.state)), speed: v.speed }; })()`);
  if (!isGameState(observed?.state) || !Number.isInteger(observed.speed)) throw new Error('Incomplete or malformed live game state');
  return observed;
}

async function loadVerifiedSnapshot() {
  if (!args.snapshot || !args.manifest) throw new Error('Both --snapshot and --manifest are required');
  const snapshotPath = resolve(args.snapshot);
  const manifestPath = resolve(args.manifest);
  const entries = (await readFile(manifestPath, 'utf8')).trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
  const entry = entries.find(row => resolve(dirname(manifestPath), row.file) === snapshotPath);
  if (!entry) throw new Error('Snapshot is absent from manifest');
  const bytes = await readFile(snapshotPath);
  if (sha256(bytes) !== entry.sha256) throw new Error('Snapshot SHA-256 differs from manifest');
  const snapshot = JSON.parse(bytes);
  if (snapshot.schema !== 'a4-full-game-state-v1' || !isGameState(snapshot.game?.state)) throw new Error('Invalid full-state snapshot');
  if (stateSha(snapshot.game.state) !== entry.stateSha256 || snapshot.game.state.tick !== entry.tick) throw new Error('Snapshot state digest/tick mismatch');
  return { snapshot, entry };
}

async function capture() {
  const out = resolve(args.out ?? join(repo, 'output/playtest-a-quadruple-prime/replay-prep/raw'));
  const minutes = Number(args.minutes ?? 60);
  const interval = Number(args['interval-minutes'] ?? 5);
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > 240 || !Number.isInteger(interval) || interval < 1 || minutes % interval !== 0) throw new Error('Invalid minutes/interval');
  const firstScreenUtc = args['first-screen-utc'];
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(firstScreenUtc ?? '')) throw new Error('An exact UTC --first-screen-utc is required');
  const firstScreenMs = Date.parse(firstScreenUtc);
  if (!Number.isFinite(firstScreenMs)) throw new Error('Invalid first-screen UTC time');
  await mkdir(out, { recursive: true, mode: 0o700 });
  if ((await readdir(out)).length !== 0) throw new Error('Output directory must be empty; original evidence is never overwritten');
  const product = await provenance();
  const { cdp, target } = await selectPage();
  const manifest = join(out, 'manifest.jsonl');
  const observerStartedAtUtc = new Date().toISOString();
  const start = performance.now() + firstScreenMs - Date.now();
  try {
    for (let minute = 0; minute <= minutes; minute += interval) {
      const due = start + minute * 60000;
      const wait = due - performance.now();
      if (wait > 0) await new Promise(resolveWait => setTimeout(resolveWait, wait));
      const captureStartedAtUtc = new Date().toISOString();
      const observed = await observe(cdp);
      const actualUtc = new Date().toISOString();
      const row = {
        schema: 'a4-full-game-state-v1',
        firstScreenAtUtc: new Date(firstScreenMs).toISOString(),
        observerStartedAtUtc,
        scheduledAtUtc: new Date(firstScreenMs + minute * 60000).toISOString(),
        captureStartedAtUtc,
        capturedAtUtc: actualUtc,
        actualElapsedMs: Math.round(performance.now() - start),
        scheduledMinute: minute,
        product,
        browser: target,
        game: observed,
      };
      const file = `minute-${String(minute).padStart(3, '0')}.json`;
      const bytes = Buffer.from(JSON.stringify(row) + '\n');
      await writeFile(join(out, file), bytes, { flag: 'wx', mode: 0o600 });
      const receipt = { file, sha256: sha256(bytes), stateSha256: stateSha(observed.state), tick: observed.state.tick,
        scheduledMinute: minute, scheduledAtUtc: row.scheduledAtUtc, capturedAtUtc: actualUtc, actualElapsedMs: row.actualElapsedMs };
      await writeFile(manifest, JSON.stringify(receipt) + '\n', { flag: 'a', mode: 0o600 });
      process.stdout.write(`${file} sha256=${receipt.sha256} capturedAtUtc=${actualUtc}\n`);
    }
  } finally { cdp.close(); }
}

async function restore() {
  const { snapshot, entry } = await loadVerifiedSnapshot();
  const product = await provenance();
  if (product.gitHead !== snapshot.product.gitHead || product.distSha256 !== snapshot.product.distSha256) throw new Error('Product HEAD or complete dist digest changed; restore refused');
  if (snapshot.game.state.settlement?.outcome === 'abandoned') throw new Error('Abandoned settlement cannot be injected through the existing reducer');
  const { cdp, target } = await selectPage();
  try {
    const fresh = await observe(cdp);
    if (fresh.state.tick !== 0 || fresh.speed !== 0) throw new Error('Restore target must be a fresh, paused screen at tick 0');
    const stateLiteral = JSON.stringify(snapshot.game.state);
    const outcome = await evaluate(cdp, `(async () => {
      const provider = ${providerSource};
      provider.dispatch({ type: 'commit_simulation_state', previousState: provider.state, nextState: ${stateLiteral} });
      await new Promise(resolve => setTimeout(resolve, 250));
      return { tick: (${providerSource}).state.tick };
    })()`);
    const observed = await observe(cdp);
    const actualSha = stateSha(observed.state);
    if (outcome.tick !== snapshot.game.state.tick || actualSha !== entry.stateSha256 || observed.speed !== 0) throw new Error('Restored screen state failed exact digest/tick/pause verification');
    const out = resolve(args.out ?? join(repo, 'output/playtest-a-quadruple-prime/replay-prep/restoration'));
    await mkdir(out, { recursive: true, mode: 0o700 });
    const receipt = { restoredAtUtc: new Date().toISOString(), snapshot: resolve(args.snapshot), sourceSha256: entry.sha256,
      stateSha256: actualSha, tick: observed.state.tick, sourceProduct: snapshot.product, targetProduct: product, targetBrowser: target,
      speed: observed.speed, result: 'full game state matched; screen remains paused' };
    const receiptPath = join(out, `restore-${Date.now()}.json`);
    await writeFile(receiptPath, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    process.stdout.write(`${receiptPath} stateSha256=${actualSha} tick=${observed.state.tick}\n`);
  } finally { cdp.close(); }
}

if (mode === 'capture') await capture();
if (mode === 'restore') await restore();
if (mode === 'verify') {
  const { snapshot, entry } = await loadVerifiedSnapshot();
  process.stdout.write(`VALID ${entry.file} sha256=${entry.sha256} tick=${snapshot.game.state.tick}\n`);
}
