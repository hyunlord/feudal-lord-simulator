// ASSET-2 before / after captures (JPEG): the story walkers now drawn at an ordinary walker's height (the two petitioners
// before the chapel, UI-5's petition-open state, zoom 2), and the resource bar (raw stone's second line without the
// retired icon), on the trunk before (--base) and this build (--url).
//   PLAYWRIGHT_MODULE=... npx tsx scripts/asset2Captures.ts <out-dir> --url <game> --base <trunk game> --states5 <ui5States dir>
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { GameState } from "../src/engine/engine.types";
import { loadChromium, openScene } from "./renderCommitProbe.mjs";

const [out] = process.argv.slice(2);
const flag = (name: string) => { const index = process.argv.indexOf(`--${name}`); return index > 0 ? process.argv[index + 1] : undefined; };
const url = flag("url")!; const base = flag("base")!; const states5 = flag("states5")!;
mkdirSync(out!, { recursive: true });
const TUTORIAL_OFF = `try { localStorage.setItem('feudal-lord-simulator:tutorial:v1', JSON.stringify({ enabled: false, acks: [], pulsed: [], log: [] })); } catch (error) { void error; }`;
const chromium = await loadChromium();
const browser = await chromium.launch({ channel: "chrome", headless: true });
const state = JSON.parse(readFileSync(join(states5, "petition-open.json"), "utf8")) as GameState;
const chapel = state.buildings.find(building => building.kind === "chapel" || building.kind === "church") ?? state.buildings.find(building => building.kind === "house")!;
const errors: string[] = [];
for (const [label, target] of [["before", base], ["after", url]] as const) {
  try {
    // The card waits (story delay 10 min) so the world shows the petitioners at the door.
    const { context, page } = await openScene(browser, { state, tile: [chapel.tx, chapel.ty + 1], baseUrl: target, width: 1280, height: 800, zoom: 2, run: false,
      initScript: TUTORIAL_OFF, query: "&story-delay=600000" });
    await (page as { waitForTimeout: (ms: number) => Promise<void> }).waitForTimeout(1_500);
    const shot = page as unknown as { screenshot: (options: object) => Promise<unknown> };
    await shot.screenshot({ path: join(out!, `a1-story-walkers-${label}.jpg`), type: "jpeg", quality: 70, clip: { x: 340, y: 200, width: 600, height: 400 } });
    await shot.screenshot({ path: join(out!, `a2-resource-bar-${label}.jpg`), type: "jpeg", quality: 80, clip: { x: 0, y: 0, width: 640, height: 60 } });
    await context.close();
  } catch (error) { errors.push(`${label}: ${String(error).slice(0, 300)}`); }
}
await browser.close();
writeFileSync(join(out!, "captures.json"), JSON.stringify({ chapel: { tx: chapel.tx, ty: chapel.ty }, errors }, null, 1) + "\n");
console.log(JSON.stringify({ errors }));
process.exitCode = errors.length === 0 ? 0 : 1;
