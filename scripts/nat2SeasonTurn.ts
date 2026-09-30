// NAT-2 QA-012: the season turn frame by frame — when the calendar's season word changes and when the picture does, and
// how the picture's change spreads over the view (the turn's wave at 1x; at 5x it is at once by design). Biggest town.
//   PLAYWRIGHT_MODULE=... tsx scripts/nat2SeasonTurn.ts <url> <out.json> [speed=1] [into season=3 winter]
import { refuseHeavyOnMac } from "./remote/localGuard.mjs";
refuseHeavyOnMac("브라우저 캡처(scripts/nat2SeasonTurn.ts)", { remote: "scripts/remote/run.sh <세션>-<작업ID> -- node_modules/.bin/tsx scripts/nat2SeasonTurn.ts …", entry: import.meta.url });
import { writeFileSync } from "node:fs";
import { closeModals, loadChromium, MODAL, openScene, SEASON_TEXT, TUTORIAL_OFF } from "./perf/scenePage";
const [url, out, speedArg, intoArg] = [process.argv[2]!, process.argv[3]!, process.argv[4] ?? "1", process.argv[5] ?? "3"];
// The turn into this season (0 spring .. 3 winter): a year is 4,000 ticks, a season 1,000.
const into = Number(intoArg);
const speed = Number(speedArg);
const chromium = await loadChromium();
const browser = await chromium.launch({ channel: "chrome", headless: false, args: ["--window-size=1600,1190", "--window-position=40,40"] });
const context = await browser.newContext({ viewport: { width: 1600, height: 1100 }, deviceScaleFactor: 1 });
await context.addInitScript(TUTORIAL_OFF);
const page = await context.newPage();
await openScene(page, { url, speed, proof: true, save: "fixtures/perf-gate/ch4-1380.save.json.gz" });
// A 12x8 grid of 8x8 samples over the world (not the HUD); a cell "changed" when its mean colour moved > 18/255.
const record = `(() => new Promise(resolve => {
  const canvas = document.querySelector('canvas'); const ctx = canvas.getContext('2d', { willReadFrequently: false });
  const port = window.__FEUDAL_PHASE10_PROOF__; const frames = []; let turnTick = null; const startTick = port.snapshot().tick;
  const cells = []; for (let gy = 0; gy < 8; gy++) for (let gx = 0; gx < 12; gx++) cells.push([Math.round((gx + 0.5) * canvas.width / 12), Math.round((0.12 + gy * 0.1) * canvas.height)]);
  const sample = () => cells.map(([x, y]) => { const d = ctx.getImageData(x, y, 8, 8).data; let r = 0, g = 0, b = 0; for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; } return [r / 64, g / 64, b / 64]; });
  const step = () => {
    const tick = port.snapshot().tick; const at = ((tick % 4000) - ${into} * 1000 + 4000) % 4000; const inTurn = tick > startTick + 100 && (at >= 3985 || at <= 60);
    if (inTurn) { if (turnTick === null && at <= 60) turnTick = tick - at;
      frames.push({ t: performance.now(), tick, date: document.querySelector('${SEASON_TEXT}')?.textContent ?? '', cells: sample() }); }
    if (turnTick !== null && tick >= turnTick + 60) { resolve(frames); return; }
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}))()`;
// The season ledger opens at a season's end and holds the game: close it the way a player does, while recording.
const recording = page.evaluate(record) as Promise<{ t: number; tick: number; date: string; cells: number[][] }[]>;
let finished = false; void recording.finally(() => { finished = true; });
while (!finished) { if (await page.locator(MODAL).count() > 0) await closeModals(page); await page.waitForTimeout(150); }
const frames = await recording;
await browser.close();
const first = frames[0]!; const last = frames.at(-1)!;
const moved = (a: number[], b: number[]) => Math.abs(a[0]! - b[0]!) + Math.abs(a[1]! - b[1]!) + Math.abs(a[2]! - b[2]!) > 18 * 3;
// For each cell: the first frame whose colour is (and stays near) the final one, if it differs from the first frame.
const changing = first.cells.map((_, i) => moved(first.cells[i]!, last.cells[i]!));
const settledAt = first.cells.map((_, i) => { if (!changing[i]) return null; for (let f = 0; f < frames.length; f++) if (!moved(frames[f]!.cells[i]!, last.cells[i]!) && frames.slice(f).every(fr => !moved(fr.cells[i]!, last.cells[i]!))) return frames[f]!.t; return null; });
const dateChangedAt = frames.find(f => f.date.split(' ')[1] !== first.date.split(' ')[1])?.t ?? null;
const times = settledAt.filter((t): t is number => t !== null).sort((a, b) => a - b);
const summary = { speed, frames: frames.length, from: first.date, to: last.date, changingCells: times.length, dateChangedAtMs: dateChangedAt === null ? null : Math.round(dateChangedAt - first.t),
  pictureFirstMs: times.length ? Math.round(times[0]! - first.t) : null, pictureLastMs: times.length ? Math.round(times.at(-1)! - first.t) : null,
  spreadMs: times.length ? Math.round(times.at(-1)! - times[0]!) : null, dateFrameTick: frames.find(f => f.t === dateChangedAt)?.tick ?? null };
writeFileSync(out, JSON.stringify({ summary, frames: frames.map(f => ({ t: Math.round(f.t - first.t), tick: f.tick, date: f.date })) }, null, 1));
console.log(JSON.stringify(summary));
