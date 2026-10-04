// QA-003 gate posts (the user's 2026-10-04 request): the wall's gate openings, a straight gate and a corner gate for
// each material, at zoom 1.0 and 0.6, summer and winter. Paused scenes loaded as a player loads them, the camera set at
// load on the gate (as scripts/nat5WallCaptures.ts), the HUD hidden (the world canvas alone), one crop per page:
// <scene>-<season>-z<zoom>-<label>.jpg in <out dir>, and one JSON line of what the page read.
//  - palisade-straight: chapter-three-town (palisade), its gate (52, 38) on the straight wall y = 38.
//  - palisade-corner: the 1380 market town (ch4-1380) with its walls built of timber (material only; the QA-003 gate
//    (47, 42): an axis arm and a diagonal arm, the diagonal opening of the finding). No fixture has a palisade corner
//    gate with a diagonal arm, so the scene reads the stone town's own wall.
//  - stone-straight: chapter-three-town with its palisade built of stone (material only), the same gate (52, 38).
//  - stone-corner: the 1380 market town as recorded, the QA-003 gate (47, 42).
// Summer and winter: the tick moved by whole seasons, nothing else.
// The rock (the NAT-5 rock revision, lead's brief 2026-10-04) on Astra's two cameras of its proofs
// (assets-inbox/nat5-fixes/revisions-20261004/records/capture-provenance.json, 1600 x 1100): the riverside's meadow rock
// (core:open_field map 5, world centre (-256, 1408)) and the chalk downs' rock (core:chalk_downs map 1, camera centre
// (673, 1302), the rock right of it), each a new game advanced in Node to Astra's summer tick (1003 / 1004) or to winter
// (3002), at the zooms below instead of Astra's 1.5 / 1.332; one crop about the rock: rock-<land>-<season>-z<zoom>.
// QA003_ZOOMS=<z,...> (default 1,0.6), QA003_SCENES=<scene,...> and QA003_SEASONS=<summer,winter> keep only those.
//   PLAYWRIGHT_MODULE=... tsx scripts/qa003GateCaptures.ts <url> <out dir> <label>
import { refuseHeavyOnMac } from "./remote/localGuard.mjs";
refuseHeavyOnMac("브라우저 캡처(scripts/qa003GateCaptures.ts)", { remote: "scripts/remote/run.sh render-QA003-gates-<sha7> -- bash scripts/qa003GateCaptures.sh …", entry: import.meta.url });
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { closeModals, loadChromium, readSave, TUTORIAL_OFF, type PageWindow } from "./perf/scenePage";
import { decodeSave, encodeSave, saveMetaFor } from "../src/save/saveCodec";
import { advanceTick } from "../src/engine/tick";
import { DEFAULT_SCENARIO_ID } from "../src/content/scenario/coreScenarios";
import { newGameState } from "../src/state/newGame";
import type { GameState } from "../src/engine/engine.types";

const [url, out, label] = [process.argv[2]!, process.argv[3]!, process.argv[4]!];
mkdirSync(out, { recursive: true });
const saves = join(".remote", "qa003-gate-saves"); mkdirSync(saves, { recursive: true });

type Material = "timber" | "stone";
/** `gate`: a tile-edge lattice point (integer = tile corner); `material`: every wall segment rebuilt of it, or as saved. */
type Scene = { readonly name: string; readonly save: string; readonly gate: readonly [number, number]; readonly material?: Material };
const TOWN = "fixtures/perf-gate/ch4-1380.save.json.gz";
const CH3 = "fixtures/saves/v41/chapter-three-town.save.json";
const SCENES: readonly Scene[] = [
  { name: "palisade-straight", save: CH3, gate: [52, 38] },
  { name: "palisade-corner", save: TOWN, gate: [47, 42], material: "timber" },
  { name: "stone-straight", save: CH3, gate: [52, 38], material: "stone" },
  { name: "stone-corner", save: TOWN, gate: [47, 42] },
];
// Whole seasons are 1,000 ticks; each offset lands mid-season for its save (as scripts/nat5WallCaptures.ts).
const SEASONS: Readonly<Record<string, Readonly<Record<"summer" | "winter", number>>>> = {
  [CH3]: { summer: 1500, winter: 3500 }, [TOWN]: { summer: 1500, winter: 3500 },
};
/** `centre`: Astra's camera centre (world px); `rock`: the crop's centre off it (world px). */
type RockScene = { readonly name: string; readonly land: string; readonly seed: number; readonly ticks: Readonly<Record<"summer" | "winter", number>>;
  readonly centre: readonly [number, number]; readonly rock: readonly [number, number] };
const ROCKS: readonly RockScene[] = [
  { name: "rock-river", land: "core:open_field", seed: 5, ticks: { summer: 1003, winter: 3002 }, centre: [-256, 1408], rock: [-330, 110] },
  { name: "rock-chalk", land: "core:chalk_downs", seed: 1, ticks: { summer: 1004, winter: 3002 }, centre: [673, 1302], rock: [285, 55] },
];
const ROCK_VIEW = { width: 1600, height: 1100 };
const ROCK_CROP = { width: 400, height: 260 };
const ZOOMS = (process.env.QA003_ZOOMS ?? "1,0.6").split(",").map(Number);
const ONLY = new Set((process.env.QA003_SCENES ?? "").split(",").filter(name => name !== ""));
const SEASON_LIST = (process.env.QA003_SEASONS ?? "summer,winter").split(",") as ("summer" | "winter")[];
/** Crop (CSS px) about the gate, the same at both zooms (zoom 0.6 shows more of the wall round it). */
const CROP = { width: 220, height: 150 };
const VIEW = { width: 1280, height: 800 };

/** The scene's save at one season (its tick moved by whole seasons, its walls rebuilt of `material`), as a save file. */
function sceneSave(scene: Scene, season: "summer" | "winter"): string {
  const state = decodeSave(readSave(scene.save)).envelope.state as GameState;
  const material = scene.material;
  const palisade = state.palisade === null || material === undefined ? state.palisade
    : { ...state.palisade, segments: state.palisade.segments.map(segment => ({ ...segment, material })) };
  const at = "2026-10-04T00:00:00.000Z";
  const path = join(saves, `${scene.name}-${season}.save.json`);
  writeFileSync(path, encodeSave({ state: { ...state, palisade, tick: state.tick + (SEASONS[scene.save] as Record<string, number>)[season]! }, createdAt: at, savedAt: at }).bytes);
  return path;
}

// Where the pointer rests: over the chapter goal panel (top left), off the world and out of the edge-scroll band.
const PARK = { x: 80, y: 105 };
const chromium = await loadChromium();
const browser = await chromium.launch({ channel: "chrome", headless: true });
const errors: string[] = [];

/** A new game of the land advanced in Node to `tick` (no player commands), as a save file (made once; before and after share it). */
function rockSave(scene: RockScene, season: "summer" | "winter"): string {
  const path = join(saves, `${scene.name}-${season}.save.json`);
  if (existsSync(path)) return path;
  let state = newGameState({ scenarioId: DEFAULT_SCENARIO_ID, archetypeId: scene.land, seed: scene.seed }) as GameState | null;
  if (state === null) throw new Error(`no new game on ${scene.land}`);
  while (state.tick < scene.ticks[season]) state = advanceTick(state);
  const at = "2026-10-04T00:00:00.000Z";
  writeFileSync(path, encodeSave({ state, createdAt: at, savedAt: at }).bytes);
  return path;
}

/** `centre`: the world point (px) at the canvas centre. */
async function openPaused(save: string, centre: readonly [number, number], zoom: number, view: { width: number; height: number } = VIEW) {
  const context = await browser.newContext({ viewport: view, deviceScaleFactor: 1 });
  await context.addInitScript(TUTORIAL_OFF);
  const page = await context.newPage();
  const [x, y] = centre;
  await page.route("**/src/render/canvasRuntime.ts*", async (route: any) => {
    const response = await route.fetch(); const text = await response.text(); const anchor = "const house = startingHouse(state.buildings);";
    if (!text.includes(anchor)) throw new Error("camera anchor changed");
    const start = `return { zoom: ${zoom}, panX: canvas.clientWidth / 2 - ${x * zoom}, panY: canvas.clientHeight / 2 - ${y * zoom} };`;
    await route.fulfill({ response, body: text.replace(anchor, start + anchor) });
  });
  await page.goto(`${url}?phase10-proof=1`, { waitUntil: "load" });
  const bytes = readSave(save); const meta = saveMetaFor("auto-1", bytes);
  if (meta === null) throw new Error(`${save}: not a save file`);
  await page.evaluate(async ({ base64, meta }: { base64: string; meta: unknown }) => {
    const data = Uint8Array.from(atob(base64), char => char.charCodeAt(0));
    const db: IDBDatabase = await new Promise((resolve, reject) => { const request = indexedDB.open("feudal-lord-simulator-saves", 1);
      request.onupgradeneeded = () => { for (const store of ["slots", "meta"]) if (!request.result.objectStoreNames.contains(store)) request.result.createObjectStore(store); };
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    await new Promise<void>((resolve, reject) => { const tx = db.transaction(["slots", "meta"], "readwrite");
      tx.objectStore("slots").put(data.buffer, "auto-1"); tx.objectStore("meta").put(meta, "auto-1");
      tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); });
    db.close();
  }, { base64: Buffer.from(bytes).toString("base64"), meta });
  page.on("pageerror", (error: Error) => errors.push(String(error)));
  // The dev server's first load (two servers optimising at once on a busy DGX) can outlast a minute: one reload more.
  for (let attempt = 0; ; attempt += 1) {
    await page.reload({ waitUntil: "load" });
    try { await page.getByRole("button", { name: "이어하기" }).first().click({ timeout: 120_000 }); break; }
    catch (error) { if (attempt >= 1) throw error; }
  }
  await page.waitForFunction(() => (window as unknown as PageWindow).__FEUDAL_PHASE10_PROOF__ !== undefined, null, { timeout: 90_000 });
  await page.waitForTimeout(2_000);
  if (await page.locator(".welcome-dismiss-layer").count()) await page.locator(".welcome-dismiss-layer").click();
  if (await page.locator(".pause-menu").count()) await page.keyboard.press("Escape");
  await closeModals(page);
  await page.mouse.move(PARK.x, PARK.y);
  // The world alone: every page element hidden but the canvas (visibility, so nothing moves).
  await page.addStyleTag({ content: "body * { visibility: hidden !important; } canvas { visibility: visible !important; }" });
  await page.waitForTimeout(6_000);
  const proof = (expression: string) => page.evaluate(`window.__FEUDAL_PHASE10_PROOF__.${expression}`);
  return { page, context, proof };
}

const report: Record<string, unknown> = { url, label };
for (const scene of SCENES) {
  if (ONLY.size > 0 && !ONLY.has(scene.name)) continue;
  for (const season of SEASON_LIST) {
    const save = sceneSave(scene, season);
    for (const zoom of ZOOMS) {
      const { page, context, proof } = await openPaused(save, [(scene.gate[0] - scene.gate[1]) * 32, (scene.gate[0] + scene.gate[1]) * 16], zoom);
      const at = await proof(`tileClientPoint({ tx: ${scene.gate[0] - 0.5}, ty: ${scene.gate[1] - 0.5} })`) as { clientX: number; clientY: number };
      const region = { x: Math.max(0, Math.min(VIEW.width - CROP.width, Math.round(at.clientX - CROP.width / 2))),
        y: Math.max(0, Math.min(VIEW.height - CROP.height, Math.round(at.clientY - CROP.height * 0.62))), ...CROP };
      await page.screenshot({ path: join(out, `${scene.name}-${season}-z${zoom}-${label}.jpg`), type: "jpeg", quality: 90, clip: region });
      const camera = (await proof("diagnosis()") as { camera: { zoom: number } }).camera;
      report[`${scene.name}-${season}-z${zoom}`] = { tick: await proof("state().tick"), zoom: camera.zoom, region };
      await context.close();
    }
  }
}
for (const scene of ROCKS) {
  if (ONLY.size > 0 && !ONLY.has(scene.name)) continue;
  for (const season of SEASON_LIST) {
    const save = rockSave(scene, season);
    for (const zoom of ZOOMS) {
      const { page, context, proof } = await openPaused(save, scene.centre, zoom, ROCK_VIEW);
      const region = { x: Math.round(ROCK_VIEW.width / 2 + scene.rock[0] * zoom - ROCK_CROP.width / 2),
        y: Math.round(ROCK_VIEW.height / 2 + scene.rock[1] * zoom - ROCK_CROP.height / 2), ...ROCK_CROP };
      await page.screenshot({ path: join(out, `${scene.name}-${season}-z${zoom}-${label}.jpg`), type: "jpeg", quality: 90, clip: region });
      const camera = (await proof("diagnosis()") as { camera: { zoom: number } }).camera;
      report[`${scene.name}-${season}-z${zoom}`] = { tick: await proof("state().tick"), zoom: camera.zoom, region };
      await context.close();
    }
  }
}
report.pageErrors = errors;
console.log(JSON.stringify(report));
await browser.close();
