// NAT-1 gate captures, part 1 (occlusion) and part 2 (door props, the town centre before → after), this build (--url) beside the trunk before it (--base): in seed 2's 1381 town
// (UI-9's rumour-quiet state, paused, the walkers where the save left them) the spots where the old order put the most
// walkers on roofs (scripts/nat1Occlusion.ts), close up at zoom 1.8 — before → after — and the whole-town count for the
// states given (the "0 walkers on roofs" check).
//   PLAYWRIGHT_MODULE=... npx tsx scripts/nat1Captures.ts <out> --url <this> --base <trunk> --states <UI-9 states dir> [--extra <state.json> ...]
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { occlusionFaults } from "../src/render/walkerOcclusion";
import { spinDoorPropShares } from "../src/render/doorProps";
import { drawOrders, loadState } from "./nat1Occlusion";
import { loadChromium, openScene } from "./renderCommitProbe.mjs";

type Page = { waitForTimeout: (ms: number) => Promise<void>; screenshot: (options: object) => Promise<unknown> };
const [out] = process.argv.slice(2);
const flag = (name: string) => { const index = process.argv.indexOf(`--${name}`); return index > 0 ? process.argv[index + 1] : undefined; };
const url = flag("url")!; const base = flag("base")!; const statesDir = flag("states")!;
const extra = process.argv.flatMap((arg, index) => arg === "--extra" ? [process.argv[index + 1]!] : []);
mkdirSync(out!, { recursive: true });
const TUTORIAL_OFF = `try { localStorage.setItem('feudal-lord-simulator:tutorial:v1', JSON.stringify({ enabled: false, acks: [], pulsed: [], log: [] })); } catch (error) { void error; }`;
const result: Record<string, unknown> = {};
const errors: string[] = [];

// The count, whole town, for every state.
for (const path of [join(statesDir, "rumour-quiet.json"), join(statesDir, "reorg.textile_street.json"), ...extra]) {
  const state = loadState(path);
  const { deferred, placed, keepOrder, walkers } = drawOrders(state);
  const before = occlusionFaults(deferred, state, keepOrder); const after = occlusionFaults(placed, state, keepOrder);
  result[`count:${path.split("/").pop()}`] = { tick: state.tick, walkers, before: { onRoof: before.onRoof.length, hidden: before.hidden.length },
    after: { onRoof: after.onRoof.length, hidden: after.hidden.length, hiddenPairs: after.hidden } };
}

// Part 2's shares: each spinning house's door prop (or none) in the counted states.
for (const path of [join(statesDir, "rumour-quiet.json"), join(statesDir, "reorg.textile_street.json"), ...extra]) {
  result[`doorProps:${path.split("/").pop()}`] = Object.fromEntries(spinDoorPropShares(loadState(path)));
}

// The hotspots: walkers the old order drew on the most roofs, a few tiles apart.
const state = loadState(join(statesDir, "rumour-quiet.json"));
const { deferred, keepOrder } = drawOrders(state);
const byWalker = new Map<string, number>();
for (const pair of occlusionFaults(deferred, state, keepOrder).onRoof) { const id = pair.split(">")[0]!; byWalker.set(id, (byWalker.get(id) ?? 0) + 1); }
const spots: { tx: number; ty: number; walker: string; roofs: number }[] = [];
for (const [id, roofs] of [...byWalker].sort((a, b) => b[1] - a[1])) {
  const walker = state.walkers.find(entry => entry.id === id);
  if (walker === undefined) continue;
  const { tx, ty } = walker.position;
  if (spots.some(spot => Math.hypot(spot.tx - tx, spot.ty - ty) < 8)) continue;
  spots.push({ tx: Math.round(tx), ty: Math.round(ty), walker: id, roofs });
  if (spots.length === 3) break;
}
result.spots = spots;

const chromium = await loadChromium();
const browser = await chromium.launch({ channel: "chrome", headless: true });
for (const [index, spot] of spots.entries()) {
  for (const [when, build] of [["before", base], ["after", url]] as const) {
    try {
      const { context, page: opened } = await openScene(browser, { state, tile: [spot.tx, spot.ty], baseUrl: build, width: 1280, height: 800, zoom: 1.8, run: false,
        initScript: TUTORIAL_OFF, query: "&story-delay=600000" });
      const page = opened as Page;
      await page.waitForTimeout(1_500);
      await page.screenshot({ path: join(out!, `o${index + 1}-occlusion-${when}.jpg`), type: "jpeg", quality: 70 });
      await context.close();
    } catch (error) { errors.push(`o${index + 1}-${when}: ${String(error).slice(0, 200)}`); }
  }
}
// Part 2 (door props): the town centre's spinning houses, before → after (zoom 1.3), and the shares from doorProps.ts.
const centre = state.buildings.find(building => building.kind === "market") ?? state.buildings[0]!;
for (const [when, build] of [["before", base], ["after", url]] as const) {
  try {
    const { context, page: opened } = await openScene(browser, { state, tile: [centre.tx, centre.ty], baseUrl: build, width: 1280, height: 800, zoom: 1.3, run: false,
      initScript: TUTORIAL_OFF, query: "&story-delay=600000" });
    const page = opened as Page;
    await page.waitForTimeout(1_500);
    await page.screenshot({ path: join(out!, `d1-door-props-${when}.jpg`), type: "jpeg", quality: 70 });
    await context.close();
  } catch (error) { errors.push(`d1-${when}: ${String(error).slice(0, 200)}`); }
}
await browser.close();
result.errors = errors;
writeFileSync(join(out!, "occlusion.json"), JSON.stringify(result, null, 1) + "\n");
console.log(JSON.stringify({ spots: spots.length, errors }));
process.exitCode = errors.length === 0 ? 0 : 1;
