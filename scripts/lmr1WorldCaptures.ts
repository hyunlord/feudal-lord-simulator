// LM-R1 world evidence (the Wave 37 house-front signs, the manor house), paused scenes loaded as a player loads them, the
// camera set exactly at load (canvasRuntime's start camera, as scripts/nat4WorldCaptures.ts). PNG crops go to <out dir>
// (composed into small JPEG boards afterwards), and one JSON line reports what was read.
//  - town: build (once) a lord-mode town — LM-E1 lordModeRun, forest edge seed 3 to the end of 1315 (LM-E6a's run: 24
//    trade households by then) — saved to output/lmr1-world/; LMR1_TOWN=fixture takes population-176 with lord mode on
//    instead (a quick pipeline check). The town is advanced in Node (the deterministic simulation) to mid-summer and on to
//    mid-winter.
//  - signs: each season at zoom 0.6, 1.0 and 1.4 the whole town (one camera, the signs' middle), and at 1.4 a crop per
//    sign kind present, one road-side away from the camera (NE / NW), one house the hash shows but no free spot takes;
//    the summer town loaded twice (the same signs and pictures after a reload).
//  - manor: population-176 (picture A) and chapter-four-town (picture B), each occupied and then with the ruling family
//    gone (moved to the persons' past: the engine's "no lord in the manor" state, constructed for the capture), summer and
//    winter, zoom 0.6 / 1.0 / 1.4, the same camera on the manor.
//   PLAYWRIGHT_MODULE=... tsx scripts/lmr1WorldCaptures.ts <url> <out dir> [section ...]
import { refuseHeavyOnMac } from "./remote/localGuard.mjs";
refuseHeavyOnMac("브라우저 캡처(scripts/lmr1WorldCaptures.ts)", { remote: "scripts/remote/run.sh render-LMR1-world-<sha7> -- bash scripts/lmr1WorldCaptures.sh <out dir>", entry: import.meta.url });
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { closeModals, loadChromium, readSave, TUTORIAL_OFF, type PageWindow } from "./perf/scenePage";
import { decodeSave, encodeSave, saveMetaFor } from "../src/save/saveCodec";
import { advanceTick } from "../src/engine/tick";
import type { GameState } from "../src/engine/engine.types";
import { initialAgency } from "../src/engine/townAgency";
import { stateCalendar } from "../src/engine/scenarioState";
import { doorSignFront, doorSignKind, doorSigns } from "../src/render/doorSigns";
import { yardHash } from "../src/render/backyardDecals";
import { lordInResidence, manorHousePictures } from "../src/render/manorHouseArt";
import { tradesOf } from "../src/engine/trades";
import { lordModeRun } from "./lordModeRun";

const [url, out] = [process.argv[2]!, process.argv[3]!];
const sections = new Set(process.argv.slice(4).length > 0 ? process.argv.slice(4) : ["signs", "manor"]);
mkdirSync(out, { recursive: true });
const saves = join(".remote", "lmr1-saves"); mkdirSync(saves, { recursive: true });
const TOWN = "output/lmr1-world/lord-forest_edge-3-1315.save.json";
const at = "2026-10-03T00:00:00.000Z";
const report: Record<string, unknown> = { url };

const loadState = (path: string) => decodeSave(readSave(path)).envelope.state as GameState;
const writeState = (state: GameState, name: string) => {
  const path = join(saves, `${name}.save.json`);
  writeFileSync(path, encodeSave({ state, createdAt: at, savedAt: at }).bytes);
  return path;
};
/** Advanced by the simulation to the middle of `season` (0 spring … 3 winter), at least one tick on. */
const toSeason = (state: GameState, season: number): GameState => {
  let next = advanceTick(state);
  while (!(stateCalendar(next).season === season && next.tick % 1000 >= 500)) next = advanceTick(next);
  return next;
};

function lordTown(): GameState {
  if (process.env.LMR1_TOWN === "fixture") return { ...loadState("fixtures/saves/v47/population-176.save.json"), agency: initialAgency() };
  if (!existsSync(TOWN)) {
    let end: GameState | null = null;
    const run = lordModeRun({ archetypeId: "core:forest_edge", seed: 3, lastYear: 1315, policy: "growth", onEnd: state => { end = state; } });
    mkdirSync("output/lmr1-world", { recursive: true });
    writeFileSync(TOWN, encodeSave({ state: end!, createdAt: at, savedAt: at }).bytes);
    report.townRun = { elapsedSeconds: run.elapsedSeconds, final: run.final.population };
  }
  return loadState(TOWN);
}

// The lord-mode town first (section "town" alone builds it and stops: a long run, detached).
const builtTown = sections.has("town") || sections.has("signs") ? lordTown() : null;
if (sections.size === 1 && sections.has("town")) { console.log(JSON.stringify({ ...report, tick: builtTown?.tick })); process.exit(0); }

type Camera = { readonly zoom: number; readonly x: number; readonly y: number };
const cameraOn = (tx: number, ty: number, zoom: number): Camera => ({ zoom, x: (tx - ty) * 32, y: (tx + ty) * 16 });
const PARK = { x: 80, y: 105 };
const chromium = await loadChromium();
const browser = await chromium.launch({ channel: "chrome", headless: true });

/** A page with the save loaded through 이어하기 and left paused, the camera set at load (scripts/nat4WorldCaptures.ts). */
async function openPaused(save: string, camera: Camera, viewport: { width: number; height: number }) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  await context.addInitScript(TUTORIAL_OFF);
  const page = await context.newPage();
  await page.route("**/src/render/canvasRuntime.ts*", async (route: any) => {
    const response = await route.fetch(); const text = await response.text(); const anchor = "const house = startingHouse(state.buildings);";
    if (!text.includes(anchor)) throw new Error("camera anchor changed");
    const start = `return { zoom: ${camera.zoom}, panX: canvas.clientWidth / 2 - ${camera.x * camera.zoom}, panY: canvas.clientHeight / 2 - ${camera.y * camera.zoom} };`;
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
  await page.reload({ waitUntil: "load" });
  await page.getByRole("button", { name: "이어하기" }).first().click({ timeout: 60_000 });
  await page.waitForFunction(() => (window as unknown as PageWindow).__FEUDAL_PHASE10_PROOF__ !== undefined, null, { timeout: 90_000 });
  await page.waitForTimeout(2_000);
  if (await page.locator(".welcome-dismiss-layer").count()) await page.locator(".welcome-dismiss-layer").click();
  if (await page.locator(".pause-menu").count()) await page.keyboard.press("Escape");
  await closeModals(page);
  await page.mouse.move(PARK.x, PARK.y);
  await page.waitForTimeout(3_500);
  const proof = (expression: string) => page.evaluate(`window.__FEUDAL_PHASE10_PROOF__.${expression}`);
  return { page, context, proof };
}
type Point = { clientX: number; clientY: number };
const clip = (point: Point, size: { width: number; height: number }, view: { width: number; height: number }, lift = 0.6) => ({
  x: Math.max(0, Math.min(view.width - size.width, Math.round(point.clientX - size.width / 2))),
  y: Math.max(0, Math.min(view.height - size.height, Math.round(point.clientY - size.height * lift))), ...size });
const shot = (page: any, name: string, region?: object) => page.screenshot({ path: join(out, `${name}.png`), type: "png", ...(region === undefined ? {} : { clip: region }) });

if (sections.has("signs")) {
  const town = builtTown!;
  const summer = toSeason(town, 1), winter = toSeason(summer, 3);
  const rows: Record<string, unknown>[] = [];
  for (const [season, state] of [["summer", summer], ["winter", winter]] as const) {
    const save = writeState(state, `town-${season}`);
    const signs = doorSigns(state);
    const houses = state.buildings.filter(building => building.kind === "house");
    const middle = signs.length === 0 ? { tx: houses[0]!.tx, ty: houses[0]!.ty }
      : { tx: signs.reduce((sum, sign) => sum + sign.x, 0) / signs.length, ty: signs.reduce((sum, sign) => sum + sign.y, 0) / signs.length };
    for (const zoom of [0.6, 1.0, 1.4]) {
      const view = zoom === 1.4 ? { width: 2400, height: 1500 } : { width: 1440, height: 900 };
      const { page, context, proof } = await openPaused(save, cameraOn(middle.tx, middle.ty, zoom), view);
      await shot(page, `signs-${season}-z${zoom.toFixed(1)}`);
      if (zoom === 1.4 && season === "summer") {
        // A crop per sign kind present, the first in house order; a road side away from the camera; a skipped house —
        // each beside the same crop of the town without lord mode (no signs: what the sandbox and the campaign show).
        const firsts = new Map<string, typeof signs[number]>();
        for (const sign of signs) if (!firsts.has(sign.key.replace(/_[ab]$/, ""))) firsts.set(sign.key.replace(/_[ab]$/, ""), sign);
        const regions: { name: string; at: { tx: number; ty: number }; size: { width: number; height: number } }[] =
          [...firsts].map(([kind, sign]) => ({ name: `sign-${kind}`, at: { tx: sign.x, ty: sign.y }, size: { width: 260, height: 200 } }));
        const byId = new Map(houses.map(building => [building.id, building]));
        const away = signs.find(sign => { const front = doorSignFront(state, byId.get(sign.buildingId)!); return front !== null && front.tx + front.ty < 0; });
        if (away !== undefined) regions.push({ name: "sign-away-front", at: { tx: away.x, ty: away.y }, size: { width: 300, height: 240 } });
        const placed = new Set(signs.map(sign => sign.buildingId));
        const skipped = houses.find(building => {
          const house = state.houses.find(entry => entry.buildingId === building.id);
          return house !== undefined && !placed.has(building.id) && yardHash(building.id, 37) % 2 === 0
            && doorSignKind({ house, members: [], trade: null, tick: state.tick, movedInTick: null }) !== null;
        });
        if (skipped !== undefined) regions.push({ name: "sign-skipped", at: { tx: skipped.tx, ty: skipped.ty }, size: { width: 300, height: 240 } });
        const clips = [];
        for (const region of regions) clips.push({ ...region, clip: clip(await proof(`tileClientPoint(${JSON.stringify(region.at)})`) as Point, region.size, view) });
        for (const entry of clips) await shot(page, entry.name, entry.clip);
        const { agency: _agency, ...sandboxState } = state;
        const sandbox = await openPaused(writeState(sandboxState, `town-${season}-sandbox`), cameraOn(middle.tx, middle.ty, zoom), view);
        for (const entry of clips) await shot(sandbox.page, `${entry.name}-sandbox`, entry.clip);
        await sandbox.context.close();
        rows.push({ away: away?.id ?? null, skipped: skipped?.id ?? null, kinds: [...firsts.keys()], clips: clips.map(entry => [entry.name, entry.clip]) });
        // The same save again: the same signs, the same A / B.
        const again = await openPaused(save, cameraOn(middle.tx, middle.ty, zoom), view);
        if (clips[0] !== undefined) { await shot(page, "reload-before", clips[0].clip); await shot(again.page, "reload-after", clips[0].clip); }
        await again.context.close();
      }
      rows.push({ season, zoom, tick: await proof("state().tick"), signs: signs.length, houses: houses.length,
        trades: tradesOf(state).households.length, keys: signs.map(sign => `${sign.buildingId}:${sign.key}`) });
      await context.close();
    }
  }
  report.signs = rows;
}

if (sections.has("manor")) {
  const isFamily = (tags: readonly string[], order: number) => tags.includes(`lord-house:${order}`);
  const gone = (state: GameState): GameState => {
    const order = state.lordship?.house.order ?? 1;
    return { ...state, persons: { ...state.persons!, people: state.persons!.people.filter(person => !isFamily(person.tags, order)),
      past: [...state.persons!.past, ...state.persons!.people.filter(person => isFamily(person.tags, order)).map(person => ({ ...person, alive: false }))] } };
  };
  const rows: Record<string, unknown>[] = [];
  for (const name of ["population-176", "chapter-four-town"]) {
    const base = loadState(`fixtures/saves/v47/${name}.save.json`);
    // Past the first season, so the engine has made the ruling family (a new game's manor has only its steward).
    const summer = toSeason(base, 1), winter = toSeason(summer, 3);
    for (const [season, occupied] of [["summer", summer], ["winter", winter]] as const) {
      for (const [label, state] of [["occupied", occupied], ["empty", gone(occupied)]] as const) {
        const manor = state.buildings.find(building => building.kind === "manor_house")!;
        const save = writeState(state, `manor-${name}-${season}-${label}`);
        for (const zoom of [0.6, 1.0, 1.4]) {
          const view = { width: 900, height: 700 };
          const { page, context, proof } = await openPaused(save, cameraOn(manor.tx + 0.5, manor.ty + 0.5, zoom), view);
          const point = await proof(`tileClientPoint(${JSON.stringify({ tx: manor.tx + 0.5, ty: manor.ty + 0.5 })})`) as Point;
          await shot(page, `manor-${name}-${season}-${label}-z${zoom.toFixed(1)}`, clip(point, { width: Math.round(260 * zoom), height: Math.round(220 * zoom) }, view, 0.62));
          rows.push({ name, season, label, zoom, tick: state.tick, residence: lordInResidence(state), pictures: manorHousePictures(state, manor) });
          await context.close();
        }
      }
    }
  }
  report.manor = rows;
}

console.log(JSON.stringify(report));
await browser.close();
