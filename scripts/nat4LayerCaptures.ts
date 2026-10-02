// NAT-4 BLD-06 evidence: the state layers on their paintings, before (the base build, --base) and after (this build,
// --url). The 1340 town (UI-6's seed 2 chapter 2 run, the state nearest 1340 in ~/fls-ui6-states, as INSTALL-26/30's)
// with every enabled neighbour merge applied (scripts/install30PairCaptures.ts: the bot never merges houses), then up
// close (zoom 2) on one pair house and one single house whose painting has a registered layer
// (docs/provenance/state-layer-registration.csv) and on one granary, each in three scenes:
//   fresh  — summer, the house just rebuilt (a person.rebuilt record one tick ago: its fresh layer);
//   winter — the next winter's middle (its snow layer over whatever state it is in);
//   worn   — summer, the house short of food since a tick ago (its weathered layer); the granary one hand short.
// Paused. Small JPEGs of the subject and captures.json (the subjects, their paintings, each view).
//   PLAYWRIGHT_MODULE=... npx tsx scripts/nat4LayerCaptures.ts <out-dir> --url <this> --base <base> --states <ui6States dir>
import { refuseHeavyOnMac } from "./remote/localGuard.mjs";
refuseHeavyOnMac("브라우저 캡처(scripts/nat4LayerCaptures.ts)", { remote: "scripts/remote/run.sh <세션>-<작업ID> -- node_modules/.bin/tsx scripts/nat4LayerCaptures.ts …", entry: import.meta.url });
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { BALANCE } from "../src/content/balanceConfig";
import { isWinterTick } from "../src/content/houseFoodConfig";
import type { Building } from "../src/content/buildingConfig";
import { houseMergeOptions } from "../src/engine/houseMerge";
import type { GameState } from "../src/engine/engine.types";
import { granaryVariantAssignments } from "../src/render/granaryVariantChoice";
import { houseBodyAssignments } from "../src/render/houseVariantChoice";
import { gameReducer } from "../src/state/gameStore";
import { loadChromium, openScene } from "./renderCommitProbe.mjs";

type Page = { waitForTimeout: (ms: number) => Promise<void>; screenshot: (options: object) => Promise<unknown>; mouse: { move: (x: number, y: number) => Promise<void> };
  locator: (selector: string) => { count: () => Promise<number>; first: () => { click: () => Promise<void> } }; on: (event: string, handler: (error: unknown) => void) => void };
const [out] = process.argv.slice(2);
const flag = (name: string) => { const index = process.argv.indexOf(`--${name}`); return index > 0 ? process.argv[index + 1] : undefined; };
const url = flag("url")!; const base = flag("base")!; const statesDir = flag("states")!;
mkdirSync(out!, { recursive: true });
const TUTORIAL_OFF = `try { localStorage.setItem('feudal-lord-simulator:tutorial:v1', JSON.stringify({ enabled: false, acks: [], pulsed: [], log: [] })); } catch (error) { void error; }`;
const YEAR = BALANCE.TICKS_PER_YEAR;
const TARGET = (1340 - 1300) * YEAR;
const candidates = readdirSync(statesDir).filter(file => file.endsWith(".json") && !file.startsWith("moments"))
  .map(file => ({ file, state: JSON.parse(readFileSync(join(statesDir, file), "utf8")) as GameState }))
  .filter(entry => typeof entry.state.tick === "number" && Array.isArray(entry.state.buildings));
const town = candidates.sort((a, b) => Math.abs(a.state.tick - TARGET) - Math.abs(b.state.tick - TARGET))[0]!;
let state = town.state;
for (let merged = true; merged;) {
  merged = false;
  for (const building of state.buildings) {
    if (building.kind !== "house" || building.houseLot !== undefined) continue;
    const option = houseMergeOptions(state, building.id).find(entry => entry.enabled);
    if (option === undefined) continue;
    state = gameReducer(state, { type: "merge_houses", sourceBuildingId: building.id, targetBuildingId: option.targetBuildingId });
    merged = true; break;
  }
}
// The registered layers by painting: a subject prefers a painting whose fresh and weathered layers both moved.
const [header, ...rows] = readFileSync("docs/provenance/state-layer-registration.csv", "utf8").trim().split("\n").map(line => line.split(","));
const registered = new Map<string, string[]>();
for (const row of rows) if (row[header!.indexOf("decision")] === "registered") {
  const key = row[0]!.replace(/^.*\//, "").replace(/\.png$/, ""); const painting = key.replace(/_(fresh|weathered|boarded)$/, "");
  registered.set(painting, [...registered.get(painting) ?? [], key.slice(painting.length + 1)]);
}
const assignments = houseBodyAssignments(state);
const pick = (pairs: boolean) => state.buildings.filter(building => building.kind === "house" && (building.houseLot !== undefined) === pairs)
  .map(building => ({ building, painting: assignments.get(building.id)?.key ?? null }))
  .filter(entry => entry.painting !== null && registered.has(entry.painting))
  .sort((a, b) => registered.get(b.painting!)!.length - registered.get(a.painting!)!.length)[0] ?? null;
const pair = pick(true); const single = pick(false);
const granary = state.buildings.find(building => building.kind === "granary") ?? null;
const subjects = [
  ...(pair === null ? [] : [{ name: "pair", building: pair.building, painting: pair.painting, layers: registered.get(pair.painting!) }]),
  ...(single === null ? [] : [{ name: "single", building: single.building, painting: single.painting, layers: registered.get(single.painting!) }]),
  ...(granary === null ? [] : [{ name: "granary", building: granary, painting: granaryVariantAssignments(state).get(granary.id)?.key ?? null, layers: [] }]),
];
let winter = state.tick; while (!isWinterTick(winter)) winter += 50; winter += 500;
const rebuilt = (building: Building) => ({ id: `h-nat4-${building.id}`, tick: state.tick - 1, kind: "person", template: "person.rebuilt",
  subject: { type: "household", id: building.id }, severity: 0, place: { tx: building.tx, ty: building.ty, buildingId: building.id } });
function scene(kind: "fresh" | "winter" | "worn", building: Building): GameState {
  if (kind === "winter") return { ...state, tick: winter };
  if (building.kind === "granary") return kind === "worn" ? { ...state, buildings: state.buildings.map(entry => entry.id === building.id ? { ...entry, workers: 0 } : entry) } : state;
  if (kind === "fresh") return { ...state, history: { ...state.history, records: [...state.history?.records ?? [], rebuilt(building)] } } as GameState;
  return { ...state, houses: state.houses.map(house => house.buildingId === building.id ? { ...house, foodShortSinceTick: state.tick - 1 } : house) };
}
const chromium = await loadChromium();
const browser = await chromium.launch({ channel: "chrome", headless: true });
const errors: string[] = []; const files: string[] = []; const views: Record<string, unknown> = {};
// The subject at zoom 2 in the middle of a 1280 x 800 view: its sprite stands above its ground tile.
const CLIP = { x: 440, y: 160, width: 400, height: 320 };
async function view(name: string, game: string, sceneState: GameState, building: Building) {
  const size = building.houseLot === "horizontal" ? [2, 1] : building.houseLot === "vertical" ? [1, 2] : building.kind === "granary" ? [2, 2] : [1, 1];
  const tile = [building.tx + (size[0]! - 1) / 2, building.ty + (size[1]! - 1) / 2]; // the footprint's middle
  const { context, page } = await openScene(browser, { state: sceneState, tile, baseUrl: game, width: 1280, height: 800, zoom: 2, run: false, initScript: TUTORIAL_OFF,
    query: "&story-delay=600000" }) as { context: { close: () => Promise<void> }; page: Page };
  page.on("pageerror", error => errors.push(`${name}: ${String(error).slice(0, 200)}`));
  for (const selector of [".season-ledger-resume", ".story-modal-later", ".chronicle-page .chronicle-keep"]) if (await page.locator(selector).count() > 0) { await page.locator(selector).first().click(); await page.waitForTimeout(300); }
  await page.mouse.move(200, 40); await page.waitForTimeout(2_500);
  const file = `${name}.jpg`;
  await page.screenshot({ path: join(out!, file), type: "jpeg", quality: 70, clip: CLIP }); files.push(file);
  views[name] = { game: game === url ? "this" : "base", tile, zoom: 2, tick: sceneState.tick };
  await context.close();
}
for (const subject of subjects) for (const kind of ["fresh", "winter", "worn"] as const) for (const [side, game] of [["before", base], ["after", url]] as const) {
  const name = `${subject.name}-${kind}-${side}`;
  try { await view(name, game, scene(kind, subject.building), subject.building); console.log(name, "ok"); }
  catch (error) { errors.push(`${name}: ${String(error).slice(0, 300)}`); console.log(name, "FAILED"); }
}
await browser.close();
const bytes = files.reduce((total, file) => total + statSync(join(out!, file)).size, 0);
writeFileSync(join(out!, "captures.json"), JSON.stringify({ state: town.file, tick: state.tick, winter, clip: CLIP,
  subjects: subjects.map(subject => ({ name: subject.name, id: subject.building.id, tx: subject.building.tx, ty: subject.building.ty, lot: subject.building.houseLot, painting: subject.painting, registered: subject.layers })),
  views, files, jpegBytes: bytes, errors }, null, 1) + "\n");
console.log(JSON.stringify({ state: town.file, subjects: subjects.map(subject => `${subject.name}:${subject.painting}`), files: files.length, bytes, errors }));
process.exitCode = errors.length === 0 ? 0 : 1;
