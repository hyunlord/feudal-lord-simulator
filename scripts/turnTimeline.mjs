// INSTALL-15 gate 4 evidence: per-frame work by render stage around the pop176 season turn (1x, autumn to winter at
// tick 27,000), with the chunk cache's staging and fades and the idle callbacks the page got.
//   PLAYWRIGHT_MODULE=... node scripts/turnTimeline.mjs <out.json> --url <url>
import { writeFileSync } from 'node:fs';
import { loadChromium, openScene, sceneStates } from './renderCommitProbe.mjs';
const [out] = process.argv.slice(2);
const flag = name => { const index = process.argv.indexOf(`--${name}`); return index > 0 ? process.argv[index + 1] : undefined; };
const states = await sceneStates();
const chromium = await loadChromium(); const browser = await chromium.launch({ channel: 'chrome', headless: true });
const { context, page } = await openScene(browser, { state: states.pop176turn, tile: [46, 39], baseUrl: flag('url'), width: 1280, height: 800, query: '&story-delay=600000',
  initScript: `window.__IDLE__ = 0; const tick = d => { window.__IDLE__ += 1; window.__IDLE_MAX__ = Math.max(window.__IDLE_MAX__ ?? 0, d.timeRemaining()); requestIdleCallback(tick); }; requestIdleCallback(tick);` });
const result = await page.evaluate(() => new Promise(done => {
  const port = window.__FEUDAL_PHASE10_PROOF__; const rows = [];
  const frame = () => {
    const d = port.diagnosis(); const c = d.boundary?.chunks ?? {};
    rows.push({ tick: port.state().tick, prefetched: c.prefetched, idle: window.__IDLE__ ?? 0, staged: c.staged, used: c.stagedUsed, content: c.contentRasters, deferred: c.deferredContent, fades: c.fades });
    if (rows.length < 300) requestAnimationFrame(frame);
    else { const stages = port.diagnosis().renderStages; done({ idleMax: window.__IDLE_MAX__, rows, names: stages?.stages ?? [], frames: (stages?.frames ?? []).slice(-300).map(f => f.stageMs.map(v => Math.round(v * 10) / 10)) }); }
  };
  requestAnimationFrame(frame);
}));
await context.close();
await browser.close();
writeFileSync(out, JSON.stringify(result) + '\n');
