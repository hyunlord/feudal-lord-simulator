// NAT-1 naturalness audit tour: for each state, a 3 × 2 grid of views over the town (the buildings' bounding box),
// paused, zoom 1.25, JPEG — the material for the audit list (docs/verification/nat1/REPORT.md §4).
//   PLAYWRIGHT_MODULE=... npx tsx scripts/nat1AuditTour.ts <out> --url <game> <name=state.json> ...
import { refuseHeavyOnMac } from "./remote/localGuard.mjs";
refuseHeavyOnMac("브라우저 캡처(scripts/nat1AuditTour.ts)", { remote: "scripts/remote/run.sh <세션>-<작업ID> -- node_modules/.bin/tsx scripts/nat1AuditTour.ts …", entry: import.meta.url });
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { GameState } from "../src/engine/engine.types";
import { loadChromium, openScene } from "./renderCommitProbe.mjs";

type Page = { waitForTimeout: (ms: number) => Promise<void>; screenshot: (options: object) => Promise<unknown> };
const [out] = process.argv.slice(2);
const flag = (name: string) => { const index = process.argv.indexOf(`--${name}`); return index > 0 ? process.argv[index + 1] : undefined; };
const url = flag("url")!;
const pairs = process.argv.slice(2).filter(arg => arg.includes("=") && !arg.startsWith("--"));
mkdirSync(out!, { recursive: true });
const TUTORIAL_OFF = `try { localStorage.setItem('feudal-lord-simulator:tutorial:v1', JSON.stringify({ enabled: false, acks: [], pulsed: [], log: [] })); } catch (error) { void error; }`;
const chromium = await loadChromium();
const browser = await chromium.launch({ channel: "chrome", headless: true });
for (const pair of pairs) {
  const [name, path] = pair.split("=") as [string, string];
  const state = JSON.parse(readFileSync(path, "utf8")) as GameState;
  const xs = state.buildings.map(building => building.tx); const ys = state.buildings.map(building => building.ty);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  for (let row = 0; row < 2; row += 1) for (let col = 0; col < 3; col += 1) {
    const tile = [Math.round(x0 + (x1 - x0) * (col + 0.5) / 3), Math.round(y0 + (y1 - y0) * (row + 0.5) / 2)];
    const { context, page: opened } = await openScene(browser, { state, tile, baseUrl: url, width: 1280, height: 800, zoom: 1.25, run: false, initScript: TUTORIAL_OFF, query: "&story-delay=600000" });
    const page = opened as Page;
    await page.waitForTimeout(1_500);
    await page.screenshot({ path: join(out!, `${name}-${row}${col}.jpg`), type: "jpeg", quality: 62 });
    await context.close();
  }
  console.log(name, "done");
}
await browser.close();
