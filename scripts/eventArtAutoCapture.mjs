// EVA-AUTO (user order 2026-10-06): every live event's picture drawn by the real registry card, headless — the browser
// half of `npm run eventart:auto` (scripts/eventArtAuto.ts runs it, then writes the rows from what it found).
// For each event the build ships a picture for (scripts/keyartDerivatives.ts EVENT_ART_DERIVATIVES: the registry's live
// entries with a picture, never a hand list): the lord's slice at its start with that entry's offer open (bound to its
// first targets there when it has them, as tests/eventArtCard.test.ts `offered` writes one; injected), the game opened
// in Chrome, the card waited for (anything that opened first put off as a player would), and the card checked:
//  - the card and its picture element name this event id (data-registry-offer, data-art);
//  - the picture's url is this id's derivative, and the bytes the page fetched from it have the derivative's SHA-256;
//  - it decoded (naturalWidth > 0) and is not blank: the luminance spread over the drawn box ≥ BLANK_FLOOR.
// Writes <out>/captures.json (per id: ok, or why not; the derivative's SHA and size) and a few 1280 × 800 JPEGs
// (shot-<id>.jpg: the first, the last and two between), nothing per event. No times or dates in captures.json: the same
// tree gives the same file.
// (the card opened by itself, or from its story chip when it was put off first).
//   tsx scripts/eventArtAutoCapture.mjs [out] [--url <running server>] [--jobs N] [--only <id,id> (a trial; apply refuses it)]
// Without --url it starts the dev server itself (spawnServer: it stops with the script) on $FLS_REMOTE_PORT.
import { refuseHeavyOnMac } from './remote/localGuard.mjs';
refuseHeavyOnMac('사건 그림 자동 캡처(scripts/eventArtAutoCapture.mjs)', { remote: 'npm run eventart:auto (Mac에서는 DGX로 보냄)', entry: import.meta.url });
import { mkdirSync, openSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadChromium, openScene } from './renderCommitProbe.mjs';
import { spawnServer } from './serverProcess.ts';
import { buildKeyartDerivative, decodePng, EVENT_ART_DERIVATIVES, sha256 } from './keyartDerivatives.ts';
import { eventCardEntryIds } from '../src/ui/eventArtSelection.ts';
import { LORD_SLICE_SCENARIO_ID } from '../src/content/lordSliceConfig.ts';
import { newGameState } from '../src/state/newGame.ts';
import { registryOf } from '../src/engine/registry.ts';
import { bindEntry, boundIdentities, v4Entry } from '../src/engine/registryV4.ts';

export const BLANK_FLOOR = 8;
const args = process.argv.slice(2);
const flag = name => { const at = args.indexOf(`--${name}`); return at < 0 ? undefined : args[at + 1]; };
const out = args[0] !== undefined && !args[0].startsWith('--') ? args[0] : 'docs/verification/eventart/auto';
const jobs = Math.max(1, Number(flag('jobs') ?? process.env.EVENTART_AUTO_JOBS ?? 4));
const CARD = '.lord-card[data-registry-offer]';
const OTHERS = ['.petition-card:not([data-registry-offer]) .story-modal-later', '.season-ledger-resume', '.chronicle-page .chronicle-keep'];
const INIT = `globalThis.__name = globalThis.__name || (target => target); try { localStorage.setItem('feudal-lord-simulator:tutorial:v1', JSON.stringify({ enabled: false, acks: [], pulsed: [], log: [] })); } catch (error) { void error; }`;
const started = Date.now();

let url = flag('url');
if (url === undefined) {
  const port = process.env.FLS_REMOTE_PORT ?? '4300';
  mkdirSync('.remote', { recursive: true });
  const log = openSync('.remote/eventart-auto-vite.log', 'w');
  spawnServer('node_modules/.bin/vite', ['--config', 'scripts/remote/viteNoWatch.config.ts', '--host', '127.0.0.1', '--port', port, '--strictPort'], { stdio: ['ignore', log, log] });
  url = `http://127.0.0.1:${port}/`;
  let up = false;
  for (let tries = 0; tries < 120 && !up; tries++) { up = await fetch(url).then(response => response.ok, () => false); if (!up) await new Promise(done => setTimeout(done, 1000)); }
  if (!up) throw new Error(`vite did not come up on ${url} (.remote/eventart-auto-vite.log)`);
}

/** The lord's slice at its start with `entryId`'s offer open, as the registry writes one (a season to answer). */
const base = newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed: 1 });
function offered(entryId) {
  const bound = bindEntry(base, v4Entry(entryId));
  const occurrence = { id: `registry:${entryId}:auto:0`, entryId, boundId: '', offeredTick: base.tick, deadline: base.tick + 1000, status: 'offered',
    receipt: { draw: 0, chancePermille: 1000, conditions: [] }, source: 'v4', bound: bound === null ? {} : boundIdentities(bound), key: entryId, context: '' };
  const registry = registryOf(base);
  return { state: { ...base, registry: { ...registry, occurrences: [...registry.occurrences, occurrence] } }, bound: bound !== null };
}
const seat = state => { const building = state.buildings.find(b => b.kind === 'manor_house') ?? state.buildings[0]; return building === undefined ? [32, 32] : [building.tx, building.ty]; };

/** Luminance standard deviation of a PNG's pixels (0 for one flat colour). */
function spread(png) {
  const { data } = decodePng(png);
  let sum = 0; let squares = 0; const count = data.length / 4;
  for (let at = 0; at < data.length; at += 4) { const y = 0.2126 * data[at] + 0.7152 * data[at + 1] + 0.0722 * data[at + 2]; sum += y; squares += y * y; }
  return Math.sqrt(Math.max(0, squares / count - (sum / count) ** 2));
}

const chromium = await loadChromium();
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const live = eventCardEntryIds();
const only = flag('only')?.split(',');
const items = EVENT_ART_DERIVATIVES.map(item => ({ id: item.id.slice('event_'.length), item })).filter(entry => only === undefined || only.includes(entry.id));
const shotIds = new Set(items.length === 0 ? [] : [0, Math.floor(items.length / 3), Math.floor((2 * items.length) / 3), items.length - 1].map(index => items[index].id));
mkdirSync(out, { recursive: true });
for (const name of readdirSync(out)) if (/^shot-.+\.jpg$/.test(name)) rmSync(join(out, name));

/** One event's card: opened, checked; `why` is the first check that failed. */
async function capture({ id, item }) {
  const derivative = buildKeyartDerivative(item);
  const expected = { derivativeSha: sha256(derivative), derivativeBytes: derivative.length };
  const { state, bound } = offered(id);
  const { context, page } = await openScene(browser, { state, tile: seat(state), baseUrl: url, run: false, initScript: INIT, width: 1280, height: 800,
    query: '&story-delay=1500', loadTimeout: 90_000 });
  try {
    let opened = false;
    for (let waited = 0; waited < 30_000 && !opened; waited += 500) {
      opened = await page.locator(`${CARD} >> visible=true`).count() > 0;
      if (opened) break;
      // Put off before it was seen (openScene's Escape after the load can land on a card that opened early): its story
      // chip's [결정하기] opens the same card, as a player's would.
      const chip = page.locator('.event-chip[data-story="registry_event"] >> visible=true');
      if (await chip.count() > 0) {
        await chip.first().click();
        await page.locator('.event-card .event-card-decide').first().click({ timeout: 5_000 }).catch(() => {});
      }
      for (const selector of OTHERS) {
        const other = page.locator(`${selector} >> visible=true`);
        if (await other.count() > 0) { await other.first().click(); break; }
      }
      await page.waitForTimeout(500);
    }
    if (!opened) {
      await page.screenshot({ path: `.remote/eventart-auto-unopened-${id}.jpg`, type: 'jpeg', quality: 40 }).catch(() => {});
      const shown = await page.locator('.story-modal, .season-ledger-card, [role=dialog], .event-chip').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-story') ?? node.className)).catch(() => []);
      return { ...expected, bound, ok: false, why: `the card did not open (on screen: ${shown.join(', ') || 'nothing'})` };
    }
    // The card's opening transition, then the picture's own load.
    await page.waitForTimeout(800);
    const shown = await page.evaluate(async selector => {
      const root = document.querySelector(selector);
      const art = root?.querySelector('.lord-card-art') ?? null;
      const background = art === null ? null : getComputedStyle(art).backgroundImage;
      const src = background?.match(/url\("?([^")]+)"?\)/)?.[1] ?? null;
      const natural = src === null ? null : await new Promise(done => { const image = new Image(); image.onload = () => done([image.naturalWidth, image.naturalHeight]); image.onerror = () => done(null); image.src = src; });
      let fetched = null;
      if (src !== null) {
        const bytes = await (await fetch(src)).arrayBuffer();
        fetched = { bytes: bytes.byteLength, sha: [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(value => value.toString(16).padStart(2, '0')).join('') };
      }
      const box = art?.getBoundingClientRect();
      return { entry: root?.getAttribute('data-registry-offer') ?? null, art: art?.getAttribute('data-art') ?? null, path: src === null ? null : new URL(src).pathname, natural, fetched,
        box: box === undefined ? null : { x: box.x, y: box.y, width: box.width, height: box.height } };
    }, CARD);
    await page.waitForTimeout(300);
    const box = shown.box !== null && shown.box.width >= 1 && shown.box.height >= 1 ? shown.box : null;
    const luminance = box === null ? null : Math.round(10 * spread(await page.screenshot({ clip: box, type: 'png' }))) / 10;
    const why = shown.entry !== id ? `the card names ${shown.entry}` : shown.art !== id ? `the picture element names ${shown.art}`
      : shown.path !== `/${item.url}` ? `the picture's url is ${shown.path}, not /${item.url}`
      : shown.fetched?.sha !== expected.derivativeSha ? `the page got ${shown.fetched?.bytes ?? 0} bytes that are not this id's derivative`
      : !(Array.isArray(shown.natural) && shown.natural[0] > 0) ? 'the picture did not decode'
      : box === null ? 'the picture has no box on screen'
      : luminance < BLANK_FLOOR ? `blank: luminance spread ${luminance} < ${BLANK_FLOOR}` : null;
    if (shotIds.has(id)) await page.screenshot({ path: join(out, `shot-${id}.jpg`), type: 'jpeg', quality: 45 });
    return { ...expected, bound, ok: why === null, why, natural: shown.natural, box: box === null ? null : [Math.round(box.width), Math.round(box.height)], luminance };
  } finally {
    await context.close();
  }
}

const pictures = {};
const queue = [...items];
await Promise.all(Array.from({ length: Math.min(jobs, queue.length) }, async () => {
  for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
    // One more try for a busy shared machine (a page that timed out or a card that did not open); both are recorded.
    let row = await capture(next).catch(error => ({ ok: false, why: `error: ${String(error?.message ?? error).split('\n')[0]}` }));
    if (!row.ok) row = { ...(await capture(next).catch(error => ({ ok: false, why: `error: ${String(error?.message ?? error).split('\n')[0]}` }))), firstTry: row.why };
    pictures[next.id] = row;
    console.log(`${row.ok ? 'ok ' : 'BAD'} ${next.id}${row.ok ? ` spread ${row.luminance}` : `: ${row.why}`}`);
  }
}));
await browser.close();
const sorted = Object.fromEntries(Object.entries(pictures).sort(([left], [right]) => (left < right ? -1 : 1)));
const shipped = items.map(entry => entry.id);
const result = { what: 'EVA-AUTO: each live event picture drawn by the real registry card (scripts/eventArtAutoCapture.mjs; rows by scripts/eventArtAuto.ts)',
  blankFloor: BLANK_FLOOR, live, shipped, shots: [...shotIds].sort().map(id => `shot-${id}.jpg`), pictures: sorted };
writeFileSync(join(out, 'captures.json'), `${JSON.stringify(result, null, 1)}\n`);
const drawn = Object.values(sorted).filter(row => row.ok).length;
console.log(`eventart:auto capture: ${drawn} of ${shipped.length} pictures drawn (${live.length} live entries), ${jobs} at once, ${((Date.now() - started) / 1000).toFixed(0)} s → ${join(out, 'captures.json')}`);
process.exit(drawn === shipped.length ? 0 : 1);
