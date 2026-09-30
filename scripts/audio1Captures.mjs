// AUDIO-1 gates ①② in the browser (headless Chrome, autoplay allowed): the sound bank loaded and each of its sounds
// played by hand; then three moments opened at 1x with the view on them — a season's change (its stinger, the
// ambience crossfading), a market day (the murmur with the crowd), a house on fire, a wet summer (the rain) — each logged every 250 ms: the
// master output in eight octave bands (dB) and its level (the analyser on the master), the loops playing (key, sound,
// level asked) and the sounds started since the last sample; then 5x (loops sink), and the town's bus at 0 (the world
// goes quiet, the rest stays). JSON logs, one JPEG of each moment.
//   PLAYWRIGHT_MODULE=... node scripts/audio1Captures.mjs <out-dir> --url <url> --states <dir from scripts/audio1States.ts>
import { refuseHeavyOnMac } from "./remote/localGuard.mjs";
refuseHeavyOnMac("브라우저 캡처(scripts/audio1Captures.mjs)", { remote: "scripts/remote/run.sh <세션>-<작업ID> -- node scripts/audio1Captures.mjs …", entry: import.meta.url });
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadChromium } from './renderCommitProbe.mjs';
import { routeSceneState } from './sceneInjection.mjs';

const [out] = process.argv.slice(2);
const flag = name => { const index = process.argv.indexOf(`--${name}`); return index > 0 ? process.argv[index + 1] : undefined; };
const url = flag('url') ?? 'http://127.0.0.1:4282/';
const statesDir = flag('states');
mkdirSync(out, { recursive: true });
const TUTORIAL_OFF = `try { localStorage.setItem('feudal-lord-simulator:tutorial:v1', JSON.stringify({ enabled: false, acks: [], pulsed: [], log: [] })); } catch (error) { void error; }`;
const chromium = await loadChromium();
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
const result = { url, errors: [] };
const load = name => JSON.parse(readFileSync(join(statesDir, `${name}.json`), 'utf8'));
const engine = page => page.evaluate(async () => {
  const m = await import('/src/audio/audioEngine.ts');
  return { probe: m.audioProbe(), loops: m.loopLevels(), played: m.playedSounds().map(entry => entry.id), settings: m.audioSettings() };
});

async function open(name, state, tile, zoom = 1.1) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await context.addInitScript(TUTORIAL_OFF);
  const page = await context.newPage();
  page.on('pageerror', error => result.errors.push(`${name}: ${String(error)}`));
  await page.routeWebSocket('**', socket => socket.close());
  await routeSceneState(page, state);
  const camera = { zoom, panX: 640 - (tile[0] - tile[1]) * 32 * zoom, panY: 360 - (tile[0] + tile[1]) * 16 * zoom };
  await page.route('**/src/render/canvasRuntime.ts*', async route => {
    const response = await route.fetch(); const text = await response.text(); const anchor = 'const house = startingHouse(state.buildings);';
    if (!text.includes(anchor)) throw new Error('Camera injection anchor changed');
    await route.fulfill({ response, body: text.replace(anchor, `return ${JSON.stringify(camera)};` + anchor) });
  });
  await page.goto(`${url}?phase10-proof=1`);
  await page.waitForFunction(() => window.__FEUDAL_PHASE10_PROOF__ !== undefined, null, { timeout: 60_000 });
  if (await page.locator('.welcome-dismiss-layer').count()) await page.locator('.welcome-dismiss-layer').click();
  await page.keyboard.press('Escape'); // an input intent: the audio starts
  if (await page.locator('.pause-menu').count()) await page.keyboard.press('Escape');
  for (const selector of ['.chronicle-page .chronicle-keep', '.famine-decision .story-modal-later', '.petition-card .story-modal-later']) {
    if (await page.locator(selector).count()) await page.locator(selector).click();
  }
  await page.waitForFunction(async () => { const m = await import('/src/audio/audioEngine.ts'); return Object.keys(m.loadedSounds()).length === Object.keys(m.SOUND_BANK).length; }, null, { timeout: 30_000 });
  return { context, page };
}

/** Samples every 250 ms for `seconds`: bands, level, loops and the sounds started since the sample before. */
async function sample(page, seconds) {
  const rows = []; let seen = (await engine(page)).played.length;
  for (let index = 0; index < seconds * 4; index += 1) {
    await page.waitForTimeout(250);
    const now = await engine(page);
    const tick = await page.evaluate(() => window.__FEUDAL_PHASE10_PROOF__.state().tick);
    rows.push({ t: (index + 1) / 4, tick, bandsDb: now.probe?.bandsDb ?? null, rmsDb: now.probe?.rmsDb ?? null,
      loops: now.loops.map(loop => `${loop.key}=${loop.level}`), started: now.played.slice(seen) });
    seen = now.played.length;
  }
  return rows;
}
const buildingTile = (state, test) => { const building = state.buildings.find(test); return building === undefined ? [state.buildings[0].tx, state.buildings[0].ty] : [building.tx, building.ty]; };
const summary = rows => ({ started: [...new Set(rows.flatMap(row => row.started))], loops: [...new Set(rows.flatMap(row => row.loops.map(loop => loop.split('=')[0])))],
  rmsDb: { min: Math.min(...rows.map(row => row.rmsDb ?? -200)), max: Math.max(...rows.map(row => row.rmsDb ?? -200)) } });

// ① The bank: every sound loaded, and each played once by hand.
{
  const state = load('season-end');
  const { context, page } = await open('bank', state, buildingTile(state, building => building.kind === 'mill'));
  result.bank = await page.evaluate(async () => {
    const m = await import('/src/audio/audioEngine.ts');
    const loaded = m.loadedSounds(); const played = {};
    for (const id of Object.keys(m.SOUND_BANK)) played[id] = m.playSound(id);
    return { count: Object.keys(m.SOUND_BANK).length, loaded, played, playedCount: Object.values(played).filter(Boolean).length, running: m.audioProbe()?.running ?? false };
  });
  await context.close();
}

// ② Three moments at 1x.
const moments = [
  ['season', 'season-end', state => buildingTile(state, building => building.kind === 'mill'), 8],
  ['market', 'market-day', state => buildingTile(state, building => building.kind === 'market'), 6],
  ['fire', 'fire', state => { const id = state.events?.burning?.[0]?.buildingId; return buildingTile(state, building => building.id === id); }, 6],
  ['rain', 'wet-summer', state => buildingTile(state, building => building.kind === 'house'), 4],
];
result.moments = {};
for (const [key, name, focus, seconds] of moments) {
  const state = load(name);
  const { context, page } = await open(key, state, focus(state));
  await page.getByRole('button', { name: '1배속', exact: true }).click();
  const rows = await sample(page, seconds);
  await page.screenshot({ path: join(out, `a-${key}.jpg`), type: 'jpeg', quality: 70 });
  result.moments[key] = { state: name, tick: state.tick, summary: summary(rows), rows };
  if (key === 'season') {
    // The season's close opened its ledger card (a modal: time stopped); close it, then 5x: the loops sink; then the
    // town's bus at 0: the world goes quiet.
    result.moments[key].ledgerCard = await page.locator('.season-ledger-card').count();
    if (result.moments[key].ledgerCard > 0) await page.keyboard.press('Escape');
    await page.getByRole('button', { name: '5배속', exact: true }).click();
    const fast = await sample(page, 2);
    await page.getByRole('button', { name: '1배속', exact: true }).click();
    await page.waitForTimeout(3_000);
    const normal = await sample(page, 1);
    await page.evaluate(async () => { const m = await import('/src/audio/audioEngine.ts'); const s = m.audioSettings(); m.setAudioSettings({ ...s, buses: { ...s.buses, world: 0 } }); });
    const worldOff = await sample(page, 2);
    await page.evaluate(async () => { const m = await import('/src/audio/audioEngine.ts'); const s = m.audioSettings(); m.setAudioSettings({ ...s, buses: { ...s.buses, world: 1 } }); });
    // The mixer in the pause menu (Esc on the idle screen): master on / off and volume, a slider per bus.
    await page.keyboard.press('Escape');
    await page.locator('.pause-menu').waitFor();
    const menu = await page.locator('.pause-menu').boundingBox();
    await page.screenshot({ path: join(out, 'a-mixer.jpg'), type: 'jpeg', quality: 72, ...(menu ? { clip: menu } : {}) });
    result.mixer = await page.evaluate(() => [...document.querySelectorAll('.audio-bus')].map(bus => ({ bus: bus.getAttribute('data-bus'),
      label: bus.querySelector('input')?.getAttribute('aria-label'), value: bus.querySelector('input')?.value, height: Math.round(bus.querySelector('input')?.getBoundingClientRect().height ?? 0) })));
    const level = rows => rows.at(-1).loops.map(loop => Number(loop.split('=')[1]));
    result.fast = { fast: fast.at(-1).loops, normal: normal.at(-1).loops, fastMax: Math.max(0, ...level(fast)), normalMax: Math.max(0, ...level(normal)),
      worldOffRmsDb: worldOff.at(-1).rmsDb, normalRmsDb: normal.at(-1).rmsDb };
  }
  await context.close();
}
await browser.close();
writeFileSync(join(out, 'audio-captures.json'), `${JSON.stringify(result, null, 1)}\n`);
console.log(JSON.stringify({ errors: result.errors.length, bank: `${result.bank.playedCount}/${result.bank.count}`,
  season: result.moments.season.summary, market: result.moments.market.summary, fire: result.moments.fire.summary, rain: result.moments.rain.summary,
  fast: result.fast, mixer: result.mixer }));
