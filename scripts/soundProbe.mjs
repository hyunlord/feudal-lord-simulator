// F0-V gate 6: the 15 sounds in the browser. A fresh campaign game: the first goal-card press (an input intent)
// starts the audio; the tutorial's buttons are pressed for ~40 s (the well and the barn, 1x) and the sounds the game
// played by itself are listed; then each of the 15 is played once by hand, mute is switched on (nothing plays) and
// off, and the stored preference is read back.
//   PLAYWRIGHT_MODULE=/abs/playwright-core/index.mjs node scripts/soundProbe.mjs <out.json> [--url ...]
import { writeFile } from 'node:fs/promises';

const [out] = process.argv.slice(2);
const flags = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, all) => value.startsWith('--') ? [...pairs, [value.slice(2), all[index + 1]]] : pairs, []));
const url = flags.url ?? 'http://127.0.0.1:4241/';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
await page.routeWebSocket('**', socket => socket.close());
await page.goto(`${url}?phase10-proof=1`);
await page.waitForFunction(() => window.__FEUDAL_PHASE10_PROOF__ !== undefined, null, { timeout: 60_000 });
await page.locator('.welcome-parchment [data-scenario]').first().click();
await page.waitForTimeout(1_000);
const engine = () => page.evaluate(async () => { const m = await import('/src/audio/audioEngine.ts'); return { played: m.playedSounds().map(entry => entry.id), loops: m.activeLoops(), settings: m.audioSettings() }; });
for (let press = 0; press < 30; press += 1) {
  const cta = page.locator('[data-tutorial-cta]').first();
  if (await cta.count() === 0) break;
  await cta.click(); await page.waitForTimeout(1_300);
}
const natural = await engine();
const manual = await page.evaluate(async () => {
  const m = await import('/src/audio/audioEngine.ts');
  const ids = Object.keys(m.SOUND_BANK);
  const result = {};
  for (const id of ids) result[id] = m.playSound(id);
  m.setAudioSettings({ volume: 0.7, muted: true });
  const mutedSettings = m.audioSettings();
  const stored = localStorage.getItem('feudal-lord-simulator:audio:v1');
  m.setAudioSettings({ volume: 0.7, muted: false });
  return { result, mutedSettings, stored };
});
await browser.close();
const naturalCounts = natural.played.reduce((counts, id) => ({ ...counts, [id]: (counts[id] ?? 0) + 1 }), {});
const report = { url, naturalCounts, loops: natural.loops, manual: manual.result, manualPlayed: Object.values(manual.result).filter(Boolean).length,
  mute: { settings: manual.mutedSettings, stored: manual.stored } };
await writeFile(out, JSON.stringify(report, null, 1) + '\n');
console.log(JSON.stringify(report));
