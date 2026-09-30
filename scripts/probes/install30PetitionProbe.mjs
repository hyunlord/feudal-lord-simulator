// INSTALL-30 probe: why the skin audit's petition steps time out. Opens the petition states on this build ($URL) and
// the trunk before ($BASE_URL), then records what the page shows at 5 s, 20 s and 60 s (chips, modals, errors, shots).
//   node scripts/probes/install30PetitionProbe.mjs <out-dir>
import { refuseHeavyOnMac } from "../remote/localGuard.mjs";
refuseHeavyOnMac("브라우저 캡처(install30PetitionProbe)", { entry: import.meta.url });
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadChromium, openScene } from '../renderCommitProbe.mjs';
const out = process.argv[2]; mkdirSync(out, { recursive: true });
const TUTORIAL_OFF = `try { localStorage.setItem('feudal-lord-simulator:tutorial:v1', JSON.stringify({ enabled: false, acks: [], pulsed: [], log: [] })); } catch (error) { void error; }`;
const houseTile = state => { const house = state.buildings.find(building => building.kind === 'house') ?? state.buildings[0]; return [house.tx, house.ty]; };
const chromium = await loadChromium();
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const home = process.env.HOME;
const cases = [['reorg', `${home}/fls-ui9-states/borough_charter.json`], ['legacy', `${home}/fls-ui10-states/borough_autonomy.json`]];
const report = [];
for (const [label, baseUrl] of [['this', process.env.URL], ['base', process.env.BASE_URL]]) {
  for (const [name, file] of cases) {
    const state = JSON.parse(readFileSync(file, 'utf8'));
    const { context, page } = await openScene(browser, { state, tile: houseTile(state), baseUrl, width: 1280, height: 800, zoom: 1.1, run: false, initScript: TUTORIAL_OFF, query: '&story-delay=0' });
    const errors = []; page.on('pageerror', error => errors.push(String(error).slice(0, 300))); page.on('console', m => { if (m.type() === 'error') errors.push(`console: ${m.text().slice(0, 200)}`); });
    for (const at of [5, 20, 60]) {
      await new Promise(r => setTimeout(r, at === 5 ? 5000 : at === 20 ? 15000 : 40000));
      const seen = await page.evaluate(`(() => ({ card: document.querySelectorAll('.petition-card').length, chips: [...document.querySelectorAll('.event-chip')].map(c => (c.textContent || '').trim().slice(0, 40)), dialogs: [...document.querySelectorAll('[role=dialog]')].map(d => d.className.slice(0, 60)), loading: document.body.innerText.slice(0, 120) }))()`);
      report.push({ label, name, at, ...seen, errors: [...errors] });
      await page.screenshot({ path: join(out, `${label}-${name}-${at}s.jpg`), type: 'jpeg', quality: 50 });
    }
    await context.close();
  }
}
writeFileSync(join(out, 'probe.json'), JSON.stringify(report, null, 1));
await browser.close();
