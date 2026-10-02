// NAT-5 wall corners (QA-003, the user's 2026-10-03 question): the wall band at every kind of turn, paused scenes loaded
// as a player loads them, the camera set exactly at load (as scripts/nat4WorldCaptures.ts). One page per scene (a save
// at one season), a window large enough to hold the whole ring at zoom 2, the HUD hidden (the world canvas alone), then
// a crop per spot: small JPEGs <scene>-<spot>-<label>.jpg in <out dir>, and one JSON line of what the page read.
//  - town: the 1380 market town (ch4-1380, stone) as recorded (spring) and in summer / winter (the tick moved by whole
//    seasons, nothing else): the QA-003 corner gate (47, 42) at NAT-4's framing, the tower (59, 31), the 135 degree
//    pillars and the smoothed short corners.
//  - stone: chapter-four-town (stone, recorded in winter) and in summer: its four towers (two convex, one each way on
//    screen), the gates (44, 28) and (51, 38).
//  - timber: chapter-three-town (palisade) in summer and winter: the towers, the concave corner (42, 32), the gate
//    beside the tower (43, 25) and the gate (52, 38).
//   NAT5_FULL=1 also writes each scene whole (survey, not evidence). NAT5_WALL_ZOOM=<z> (default 2) sets the camera zoom,
//   with each crop covering about the same world area as at zoom 2 (never under half its size), the zoom in the file name
//   as -z<z>; NAT5_WALL_SPOTS=<name,...> keeps only those spots (the user's gate set: zoom 1.0 and 0.6).
//   PLAYWRIGHT_MODULE=... tsx scripts/nat5WallCaptures.ts <url> <out dir> <label> [scene ...]
import { refuseHeavyOnMac } from "./remote/localGuard.mjs";
refuseHeavyOnMac("브라우저 캡처(scripts/nat5WallCaptures.ts)", { remote: "scripts/remote/run.sh render-NAT5-wall-<sha7> -- bash scripts/nat5WallCaptures.sh …", entry: import.meta.url });
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { closeModals, loadChromium, readSave, TUTORIAL_OFF, type PageWindow } from "./perf/scenePage";
import { decodeSave, encodeSave, saveMetaFor } from "../src/save/saveCodec";
import type { GameState } from "../src/engine/engine.types";

const [url, out, label] = [process.argv[2]!, process.argv[3]!, process.argv[4]!];
mkdirSync(out, { recursive: true });
const saves = join(".remote", "nat5-wall-saves"); mkdirSync(saves, { recursive: true });

/** Wall points are tile-edge lattice points (integer = tile corner); the proof port takes tile coordinates. */
type Spot = { readonly name: string; readonly at: readonly [number, number]; readonly size?: readonly [number, number] };
type Scene = { readonly name: string; readonly save: string; readonly ticks: number; readonly centre: readonly [number, number];
  readonly view: { readonly width: number; readonly height: number }; readonly spots: readonly Spot[] };
const TOWN = "fixtures/perf-gate/ch4-1380.save.json.gz";
const CH4 = "fixtures/saves/v41/chapter-four-town.save.json";
const CH3 = "fixtures/saves/v41/chapter-three-town.save.json";
const townSpots: readonly Spot[] = [
  { name: "qa003", at: [46, 42], size: [520, 340] }, { name: "tower59-31", at: [59, 31] },
  { name: "pillar41-42", at: [41, 42] }, { name: "pillar43-46", at: [43, 46] }, { name: "pillar39-35", at: [39, 35] },
  { name: "pillar50-48", at: [50, 48] }, { name: "pillar59-40", at: [59, 40] }, { name: "pillar40-25", at: [40, 25] },
];
const ch4Spots: readonly Spot[] = [
  { name: "tower39-32", at: [39, 32] }, { name: "tower40-48", at: [40, 48] }, { name: "tower53-49", at: [53, 49] },
  { name: "tower49-28", at: [49, 28] }, { name: "gate44-28", at: [44, 28] }, { name: "gate51-38", at: [51, 38] },
  { name: "pillar38-37", at: [38.5, 37] }, { name: "pillar45-48", at: [45, 48.5] },
];
const ch3Spots: readonly Spot[] = [
  { name: "tower39-32", at: [39, 32] }, { name: "tower40-48", at: [40, 48] }, { name: "tower56-49", at: [56, 49] },
  { name: "concave42-32", at: [42, 32] }, { name: "gate43-25", at: [43, 25] }, { name: "gate52-38", at: [52, 38] },
  { name: "pillar49-37", at: [49, 37] }, { name: "pillar44-48", at: [44, 48.5] },
];
// Whole seasons are 1,000 ticks; the offsets land mid-season (scripts: seasonOf over the fixture's tick).
const SCENES: readonly Scene[] = [
  { name: "town-spring", save: TOWN, ticks: 0, centre: [49, 36], view: { width: 3100, height: 1500 }, spots: townSpots },
  { name: "town-summer", save: TOWN, ticks: 1500, centre: [49, 36], view: { width: 3100, height: 1500 }, spots: townSpots },
  { name: "town-winter", save: TOWN, ticks: 3500, centre: [49, 36], view: { width: 3100, height: 1500 }, spots: townSpots },
  { name: "stone-winter", save: CH4, ticks: 0, centre: [46, 38.5], view: { width: 2700, height: 1500 }, spots: ch4Spots },
  { name: "stone-summer", save: CH4, ticks: 2000, centre: [46, 38.5], view: { width: 2700, height: 1500 }, spots: ch4Spots },
  { name: "timber-summer", save: CH3, ticks: 1500, centre: [47, 37], view: { width: 2900, height: 1600 }, spots: ch3Spots },
  { name: "timber-winter", save: CH3, ticks: 3500, centre: [47, 37], view: { width: 2900, height: 1600 }, spots: ch3Spots },
];
const only = new Set(process.argv.slice(5));
const ZOOM = Number(process.env.NAT5_WALL_ZOOM ?? 2);
const SPOTS = new Set((process.env.NAT5_WALL_SPOTS ?? "").split(",").filter(name => name !== ""));
const TAG = process.env.NAT5_WALL_ZOOM === undefined ? "" : `-z${ZOOM}`;
const CROP = Math.max(0.5, ZOOM / 2);

/** The save with its tick moved by `ticks` (the season the ground, trees and snow draw), as a save file. */
function sceneSave(scene: Scene): string {
  if (scene.ticks === 0) return scene.save;
  const state = decodeSave(readSave(scene.save)).envelope.state as GameState;
  const at = "2026-10-03T00:00:00.000Z";
  const path = join(saves, `${scene.name}.save.json`);
  writeFileSync(path, encodeSave({ state: { ...state, tick: state.tick + scene.ticks }, createdAt: at, savedAt: at }).bytes);
  return path;
}

// Where the pointer rests: over the chapter goal panel (top left), off the world and out of the edge-scroll band; it
// rests there before the HUD is hidden and does not move again (no hover outline).
const PARK = { x: 80, y: 105 };
const chromium = await loadChromium();
const browser = await chromium.launch({ channel: "chrome", headless: true });

async function openPaused(save: string, centre: readonly [number, number], viewport: { width: number; height: number }) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  await context.addInitScript(TUTORIAL_OFF);
  const page = await context.newPage();
  const [x, y] = [(centre[0] - centre[1]) * 32, (centre[0] + centre[1]) * 16];
  await page.route("**/src/render/canvasRuntime.ts*", async (route: any) => {
    const response = await route.fetch(); const text = await response.text(); const anchor = "const house = startingHouse(state.buildings);";
    if (!text.includes(anchor)) throw new Error("camera anchor changed");
    const start = `return { zoom: ${ZOOM}, panX: canvas.clientWidth / 2 - ${x * ZOOM}, panY: canvas.clientHeight / 2 - ${y * ZOOM} };`;
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
const errors: string[] = [];
for (const scene of SCENES) {
  if (only.size > 0 && !only.has(scene.name) && !only.has(scene.name.split("-")[0] as string)) continue;
  const { page, context, proof } = await openPaused(sceneSave(scene), scene.centre, scene.view);
  if (process.env.NAT5_FULL === "1") await page.screenshot({ path: join(out, `${scene.name}-full-${label}.jpg`), type: "jpeg", quality: 60 });
  const rows: unknown[] = [];
  for (const spot of scene.spots) {
    if (SPOTS.size > 0 && !SPOTS.has(spot.name)) continue;
    const at = await proof(`tileClientPoint({ tx: ${spot.at[0] - 0.5}, ty: ${spot.at[1] - 0.5} })`) as { clientX: number; clientY: number };
    const [width, height] = (spot.size ?? [360, 260]).map(side => Math.round(side * CROP)) as [number, number];
    const region = { x: Math.max(0, Math.min(scene.view.width - width, Math.round(at.clientX - width / 2))),
      y: Math.max(0, Math.min(scene.view.height - height, Math.round(at.clientY - height * 0.6))), width, height };
    await page.screenshot({ path: join(out, `${scene.name}-${spot.name}${TAG}-${label}.jpg`), type: "jpeg", quality: 82, clip: region });
    rows.push({ spot: spot.name, region });
  }
  const camera = (await proof("diagnosis()") as { camera: { zoom: number } }).camera;
  report[scene.name] = { tick: await proof("state().tick"), zoom: camera.zoom, spots: rows };
  await context.close();
}
report.pageErrors = errors;
console.log(JSON.stringify(report));
await browser.close();
