// INSTALL-3 world captures (JPEG crops, quality 60) from the gate's replay states (scripts/install3States.ts: the C4
// human path, m0 … m11). Each scene takes its moment's state; when the subject is not on the map at that tick (a cart or
// an errand between trips, a dry year's ripe barley) the same replay is run on from that moment, no command and no edit,
// to the first tick it is (the tick used is in captures.json). Opened paused, centred on the subject, shot at zoom 1.0
// and 0.6 (IN7-D1: at 0.6 the buildings are blocks and the piles, cart loads and walkers' art are not drawn, the strips
// are), and 2.0 for the fields, the alehouses and the brewing door (a few pixels at 1.0). Gate ② (strips at 0.6): each
// crop's field on its own at 0.6 (field-*), since the town's two-strip fields beside each other hide behind the block houses.
//   PLAYWRIGHT_MODULE=... npx tsx scripts/install3WorldCaptures.ts <out-dir> --url <game> --states <install3States dir>
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { alehouses, brewingSlot, isAlehouse } from "../src/engine/ale";
import type { GameState } from "../src/engine/engine.types";
import { advanceTick } from "../src/engine/tick";
import { buildingFootprint } from "../src/geometry/buildingFootprint";
import { residentWalkers } from "../src/render/presentation/residentTrips";
import { millOvenBurning } from "../src/render/roofSmoke";
import { brewingDoor } from "../src/render/villageLife";
import { wetSummer } from "../src/render/wetSummer";
import { arableStripStates } from "../src/zones/arableStrips";
import { zonesOf } from "../src/zones/zoneEdits";
import { loadChromium, openScene } from "./renderCommitProbe.mjs";

type Page = { waitForTimeout: (ms: number) => Promise<void>; screenshot: (options: object) => Promise<unknown>;
  evaluate: <T, A>(f: (arg: A) => T, arg: A) => Promise<T> };
type Tile = readonly [number, number];
const [out] = process.argv.slice(2);
const flag = (name: string) => { const index = process.argv.indexOf(`--${name}`); return index > 0 ? process.argv[index + 1] : undefined; };
const url = flag("url"); const statesDir = flag("states");
if (out === undefined || url === undefined || statesDir === undefined) throw new Error("usage: install3WorldCaptures.ts <out-dir> --url <game> --states <dir>");
mkdirSync(out, { recursive: true });
const WIDTH = 1280, HEIGHT = 800;
// tsx names the functions it compiles with an `__name` helper; the page gets it too. The tutorial is off (no guidance ring).
const TUTORIAL_OFF = `window.__name = (target) => target; try { localStorage.setItem('feudal-lord-simulator:tutorial:v1', JSON.stringify({ enabled: false, acks: [], pulsed: [], log: [] })); } catch (error) { void error; }`;
const load = (moment: string) => JSON.parse(readFileSync(join(statesDir, `${moment}.json`), "utf8")) as GameState;

const centreOf = (state: GameState, id: string): Tile | null => {
  const building = state.buildings.find(candidate => candidate.id === id);
  if (building === undefined) return null;
  const size = buildingFootprint(building);
  return [building.tx + (size.width - 1) / 2, building.ty + (size.height - 1) / 2];
};
const middle = (cells: readonly { readonly tx: number; readonly ty: number }[]): Tile =>
  [cells.reduce((sum, cell) => sum + cell.tx, 0) / cells.length, cells.reduce((sum, cell) => sum + cell.ty, 0) / cells.length];
/** Between the closest barley and wheat strips of a stage (within 10 tiles), so the crop holds both; a wet summer blights both (UI-4). */
function stripPair(state: GameState, stage: "growing" | "ripe"): { tile: Tile; note: string } | null {
  if (wetSummer(state)) return null;
  const strips = zonesOf(state).filter(zone => zone.kind === "arable").flatMap(zone => arableStripStates(zone, state).strips).filter(strip => strip.stage === stage);
  const pairs = strips.filter(strip => strip.crop === "barley").flatMap(barley => strips.filter(strip => strip.crop === "wheat")
    .map(wheat => ({ barley: middle(barley.cells), wheat: middle(wheat.cells) })))
    .map(pair => ({ ...pair, gap: Math.hypot(pair.barley[0] - pair.wheat[0], pair.barley[1] - pair.wheat[1]) })).sort((a, b) => a.gap - b.gap);
  const pair = pairs[0];
  if (pair === undefined || pair.gap > 10) return null;
  return { tile: [(pair.barley[0] + pair.wheat[0]) / 2, (pair.barley[1] + pair.wheat[1]) / 2], note: `barley strip at ${pair.barley.join(",")} beside wheat at ${pair.wheat.join(",")}` };
}
/**
 * Gate ② at 0.6: one field of a crop on its own, where neither the block houses nor a site label covers it in this
 * town (looked at on the replay's 0.6 view): the barley barn's own field (zone-000007) and the lakeside wheat
 * (zone-000006); another town falls back to the crop's largest field.
 */
const OPEN_FIELD = { barley: "zone-000007", wheat: "zone-000006" } as const;
function field(state: GameState, crop: "barley" | "wheat", stage: "growing" | "ripe"): { tile: Tile; note: string } | null {
  if (wetSummer(state)) return null;
  const strips = zonesOf(state).filter(zone => zone.kind === "arable").flatMap(zone => arableStripStates(zone, state).strips)
    .filter(strip => strip.crop === crop && strip.stage === stage)
    .sort((a, b) => Number(b.id.startsWith(`${OPEN_FIELD[crop]}:`)) - Number(a.id.startsWith(`${OPEN_FIELD[crop]}:`)) || b.cells.length - a.cells.length);
  const strip = strips[0];
  return strip === undefined ? null : { tile: middle(strip.cells), note: `${crop} strip ${strip.id} ${stage}` };
}
const carter = (state: GameState, resource: string) => {
  const walker = state.walkers.find(candidate => candidate.kind === "carter" && candidate.cargo?.resource === resource
    && state.buildings.find(building => building.id === candidate.homeBuildingId)?.kind === "malt_kiln");
  return walker === undefined ? null : { tile: [walker.position.tx, walker.position.ty] as Tile, note: `${walker.id} with ${walker.cargo!.amount} ${resource}` };
};
const errand = (state: GameState, purpose: "malt" | "kiln") => {
  const walker = residentWalkers(state).find(candidate => candidate.resident.purpose === purpose);
  return walker === undefined ? null : { tile: [walker.position.tx, walker.position.ty] as Tile, note: walker.id };
};
const house = (state: GameState, pick: (candidate: GameState["houses"][number]) => boolean, why: string) => {
  const found = state.houses.find(candidate => pick(candidate) && state.buildings.find(building => building.id === candidate.buildingId)?.houseLot === undefined);
  const tile = found === undefined ? null : centreOf(state, found.buildingId);
  return found === undefined || tile === null ? null : { tile, note: `${found.buildingId} level ${found.level}, ale ${brewingSlot(found)?.stock.ale ?? 0} (${why})` };
};

type Scene = { readonly moment: string; readonly find: (state: GameState) => { tile: Tile; note: string } | null; readonly close?: boolean; readonly raised?: boolean; readonly wide?: boolean;
  /** Only these zooms, in a small crop (the 0.6 field pairs). */
  readonly only?: readonly number[] };
const SCENES: Readonly<Record<string, Scene>> = {
  "barley-growing": { moment: "m4-barley-growing", find: state => stripPair(state, "growing"), close: true, wide: true },
  // m5's summer is wet (both crops blighted): the first dry year's ripe strips, the replay run on from m11.
  "barley-ripe": { moment: "m11-ale-sold", find: state => stripPair(state, "ripe"), close: true, wide: true },
  "field-barley-growing": { moment: "m4-barley-growing", find: state => field(state, "barley", "growing"), only: [0.6] },
  "field-wheat-growing": { moment: "m4-barley-growing", find: state => field(state, "wheat", "growing"), only: [0.6] },
  "field-barley-ripe": { moment: "m11-ale-sold", find: state => field(state, "barley", "ripe"), only: [0.6] },
  "field-wheat-ripe": { moment: "m11-ale-sold", find: state => field(state, "wheat", "ripe"), only: [0.6] },
  "kiln-working": { moment: "m8-malt", find: state => { const kiln = state.buildings.find(building => building.kind === "malt_kiln");
    const tile = kiln === undefined ? null : centreOf(state, kiln.id);
    return kiln === undefined || tile === null || !millOvenBurning(kiln) ? null : { tile, note: `kiln barley ${kiln.inventory.barley ?? 0}, malt ${kiln.inventory.malt ?? 0}` }; }, raised: true },
  "barn-barley": { moment: "m7-barley-in-barn", find: state => { const barn = state.buildings.find(building => building.kind === "farmstead" && (building.inventory.barley ?? 0) > 0);
    const tile = barn === undefined ? null : centreOf(state, barn.id);
    return barn === undefined || tile === null ? null : { tile, note: `${barn.id} barley ${barn.inventory.barley}` }; }, raised: true },
  "alehouse": { moment: "m10-alehouse", find: state => house(state, candidate => isAlehouse(candidate) && candidate.level === 2 && (brewingSlot(candidate)?.stock.ale ?? 0) > 0, "stake"), close: true, raised: true },
  "alehouse-dry": { moment: "m11-ale-sold", find: state => house(state, candidate => alehouses(state).includes(candidate.buildingId) && candidate.level === 2
    && (brewingSlot(candidate)?.stock.ale ?? 0) === 0, "sold out: no stake"), close: true, raised: true },
  "brewing": { moment: "m11-ale-sold", find: state => house(state, candidate => !isAlehouse(candidate) && (brewingSlot(candidate)?.stock.ale ?? 0) > 0
    && brewingDoor(state, candidate.buildingId) !== null, "a level 1 brewer's door"), close: true, raised: true },
  "cart-barley": { moment: "m7-barley-in-barn", find: state => carter(state, "barley") },
  "cart-malt": { moment: "m8-malt", find: state => carter(state, "malt") },
  "alewife": { moment: "m8-malt", find: state => errand(state, "malt") },
  "maltster": { moment: "m6-kiln-built", find: state => errand(state, "kiln") },
};
const RUN_ON = 6_000;
const CROP = { width: 400, height: 260 } as const;

const chromium = await loadChromium();
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--disable-gpu"] });
const shots: Record<string, unknown> = {};
const errors: string[] = [];
for (const [name, scene] of Object.entries(SCENES)) {
  let state = load(scene.moment);
  let found = scene.find(state);
  for (let step = 0; found === null && step < RUN_ON; step += 1) { state = advanceTick(state); found = scene.find(state); }
  if (found === null) { errors.push(`${name}: not on the map within ${RUN_ON} ticks of ${scene.moment}`); continue; }
  for (const zoom of scene.only ?? (scene.close === true ? [1, 0.6, 2] : [1, 0.6])) {
    try {
      const opened = await openScene(browser, { state, tile: found.tile, baseUrl: url, width: WIDTH, height: HEIGHT, zoom, run: false,
        initScript: TUTORIAL_OFF, query: "&story-delay=600000&weather=none" });
      const page = opened.page as Page;
      // The art loads lazily on first draw (Wave 3 through manifestArt; the ground chunks re-raster once it is in).
      await page.waitForTimeout(3_500);
      const size = scene.only !== undefined ? { width: 400, height: 260 } : scene.wide === true && zoom < 2 ? { width: CROP.width * 1.4, height: CROP.height * 1.2 } : CROP;
      // Around the subject's point on the screen (the camera stops at the map's edge, so it is not always the view's middle).
      const at = await page.evaluate(tile => {
        const proof = (window as unknown as { __FEUDAL_PHASE10_PROOF__?: { tileClientPoint: (point: { tx: number; ty: number }) => { clientX: number; clientY: number } } }).__FEUDAL_PHASE10_PROOF__;
        return proof?.tileClientPoint({ tx: tile[0], ty: tile[1] }) ?? null;
      }, found.tile);
      const middleX = at?.clientX ?? WIDTH / 2; const middleY = at?.clientY ?? HEIGHT / 2;
      const clip = { x: Math.round(Math.min(WIDTH - size.width, Math.max(0, middleX - size.width / 2))),
        y: Math.round(Math.min(HEIGHT - size.height, Math.max(0, middleY - size.height / 2 - (scene.raised === true ? 40 * zoom : 0)))),
        width: Math.round(size.width), height: Math.round(size.height) };
      const file = `${name}-z${zoom.toFixed(1)}.jpg`;
      await page.screenshot({ path: join(out, file), type: "jpeg", quality: 60, clip });
      shots[file] = { moment: scene.moment, tick: state.tick, ranOn: state.tick - load(scene.moment).tick, tile: found.tile, zoom, clip, note: found.note };
      await opened.context.close();
    } catch (error) { errors.push(`${name} ${zoom}: ${String(error).slice(0, 300)}`); }
  }
}
await browser.close();
const bytes = Object.keys(shots).map(file => statSync(join(out, file)).size).reduce((a, b) => a + b, 0);
writeFileSync(join(out, "captures.json"), JSON.stringify({ source: "scripts/install3States.ts moments (the C4 human path replayed; ranOn: ticks the same replay ran on, no edit)",
  paused: true, lod: "IN7-D1: zoom <= 0.7 simplified (blocks, no piles or building overlays), cart loads below 0.8 not drawn, walker art only above 0.7", shots, jpegBytes: bytes, errors }, null, 1) + "\n");
console.log(JSON.stringify({ files: Object.keys(shots).length, bytes, errors }));
process.exitCode = errors.length === 0 ? 0 : 1;
