// UI-4b evidence: the season ledger card's three scenes (Wave 19 icons picked from the history ledger), JPEG, and one
// JSON of what each card showed.
//   PLAYWRIGHT_MODULE=... node scripts/ui4bCaptures.mjs <out-dir> --url <url> --states <dir from scripts/ui4bSeasonStates.ts>
// Each state is 30 ticks before a season closes; at 1x the card opens by itself. Recorded: the scenes (data-scene),
// whether each icon loaded (its image decoded), the scenes line and the title; a shot of the card.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadChromium, openScene } from './renderCommitProbe.mjs';

const [out] = process.argv.slice(2);
const flag = name => { const index = process.argv.indexOf(`--${name}`); return index > 0 ? process.argv[index + 1] : undefined; };
const url = flag('url') ?? 'http://127.0.0.1:4282/';
const statesDir = flag('states');
mkdirSync(out, { recursive: true });
const TUTORIAL_OFF = `try { localStorage.setItem('feudal-lord-simulator:tutorial:v1', JSON.stringify({ enabled: false, acks: [], pulsed: [], log: [] })); } catch (error) { void error; }`;
const chromium = await loadChromium();
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const result = { url, errors: [], cards: {} };
for (const file of readdirSync(statesDir).filter(name => name.startsWith('season-') && name.endsWith('.json')).sort()) {
  const name = file.replace(/\.json$/, '');
  const state = JSON.parse(readFileSync(join(statesDir, file), 'utf8'));
  const house = state.buildings.find(building => building.kind === 'house') ?? state.buildings[0];
  const { context, page } = await openScene(browser, { state, tile: [house.tx, house.ty], baseUrl: url, width: 1280, height: 800, zoom: 1, run: true, initScript: TUTORIAL_OFF, query: '&story-delay=600000' });
  page.on('pageerror', error => result.errors.push(`${name}: ${String(error)}`));
  const opened = await page.waitForSelector('.season-ledger-card', { timeout: 20_000 }).then(() => true).catch(() => false);
  await page.waitForTimeout(700);
  const card = await page.evaluate(async () => {
    const scenes = [...document.querySelectorAll('.season-ledger-scene')];
    const loaded = await Promise.all(scenes.map(scene => {
      const icon = scene.querySelector('.season-ledger-scene-icon'); const match = getComputedStyle(icon).backgroundImage.match(/url\("?(.*?)"?\)/);
      if (match === null) return false; const image = new Image(); image.src = match[1]; return image.decode().then(() => image.naturalWidth === 96).catch(() => false);
    }));
    return { title: document.querySelector('.season-ledger-card h2')?.textContent ?? null, scenes: scenes.map(scene => scene.getAttribute('data-scene')),
      values: scenes.map(scene => scene.querySelector('strong')?.textContent ?? null), iconsLoaded: loaded,
      line: document.querySelector('.season-ledger-scenes-line')?.textContent ?? null };
  });
  const box = await page.locator('.season-ledger-card').boundingBox().catch(() => null);
  if (box !== null) await page.screenshot({ path: join(out, `${name}.jpg`), type: 'jpeg', quality: 80, clip: { x: box.x - 8, y: box.y - 8, width: box.width + 16, height: box.height + 16 } });
  result.cards[name] = { tick: state.tick, opened, ...card };
  await context.close();
}
await browser.close();
writeFileSync(join(out, 'ui4b-captures.json'), JSON.stringify(result, null, 1) + '\n');
console.log(JSON.stringify(result, null, 1));
