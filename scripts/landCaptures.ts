// LAND-UI gate captures: the five lands' grown towns (scripts/landStates.ts) in summer and winter, at 1280 × 800 — the
// town centre at zoom 1.0 and 0.6 and the land's character (the riverside's river, the coast's shore, the downs' walled
// fields, the forest's edge, the fen's meres) at 1.0 — then the fen's drainage works (stage 1, stage 3 and a drained
// patch) and the downs' ford roads (each width) at 1.3, summer and winter; paused, the tutorial off, JPEG quality 70.
// With --base, every shot again on that build (before → after). A contact sheet (contact.jpg: one row per land, then
// the works and fords; with --base the before row under each) and shots.json (file, state, tile, zoom, page errors).
//   PLAYWRIGHT_MODULE=... npx tsx scripts/landCaptures.ts <out> --url <this> --states <landStates dir> [--base <trunk>]
//     [--only open_field,fen_drainage,works,ford] [--quality 70]
import { refuseHeavyOnMac } from "./remote/localGuard.mjs";
refuseHeavyOnMac("브라우저 캡처(scripts/landCaptures.ts)", { remote: "scripts/remote/run.sh render-LANDUI-<작업> -- node_modules/.bin/tsx scripts/landCaptures.ts …", entry: import.meta.url });
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadChromium, openScene } from "./renderCommitProbe.mjs";

type Page = { waitForTimeout: (ms: number) => Promise<void>; screenshot: (options: object) => Promise<Buffer>; on: (event: string, handler: (error: Error) => void) => void;
  setContent: (html: string, options?: object) => Promise<void>; evaluate: <T>(fn: () => T) => Promise<T>; setViewportSize: (size: { width: number; height: number }) => Promise<void> };
type Tile = { tx: number; ty: number };
type Entry = { land: string; tick: number; season: number; centre: Tile; character: Tile | null; characterWhat: string | null; focus?: Tile;
  works?: { stage: string; origin: Tile }[]; fords?: { width: number; cells: Tile[] }[] };

const [out] = process.argv.slice(2);
const flag = (name: string) => { const index = process.argv.indexOf(`--${name}`); return index > 0 ? process.argv[index + 1] : undefined; };
const url = flag("url"); const base = flag("base"); const statesDir = flag("states");
if (out === undefined || out.startsWith("--") || url === undefined || statesDir === undefined) throw new Error("usage: landCaptures.ts <out> --url <url> --states <dir> [--base <url>]");
const only = flag("only")?.split(",").filter(Boolean) ?? null;
const quality = Number(flag("quality") ?? 70);
const LANDS = ["open_field", "coastal_port", "chalk_downs", "forest_edge", "fen_drainage"] as const;
const TUTORIAL_OFF = `try { localStorage.setItem('feudal-lord-simulator:tutorial:v1', JSON.stringify({ enabled: false, acks: [], pulsed: [], log: [] })); } catch (error) { void error; }`;
const manifest = JSON.parse(readFileSync(join(statesDir, "manifest.json"), "utf8")) as { states: Record<string, Entry> };
mkdirSync(join(out, "shots"), { recursive: true });

// The shots: [row, label, state name, tile, zoom].
type Shot = { row: string; label: string; state: string; tile: Tile; zoom: number };
const shots: Shot[] = [];
for (const land of LANDS) {
  if (only !== null && !only.includes(land)) continue;
  for (const season of ["summer", "winter"]) {
    const name = `${land}-${season}`; const entry = manifest.states[name];
    if (entry === undefined) throw new Error(`${name} is not in ${statesDir}/manifest.json`);
    shots.push({ row: land, label: `${season} 1.0`, state: name, tile: entry.centre, zoom: 1 });
    shots.push({ row: land, label: `${season} 0.6`, state: name, tile: entry.centre, zoom: 0.6 });
    if (entry.character !== null) shots.push({ row: land, label: `${season} ${entry.characterWhat}`, state: name, tile: entry.character, zoom: 1 });
  }
}
for (const season of ["summer", "winter"]) {
  const works = manifest.states[`fen_drainage-works-${season}`];
  if (works?.focus !== undefined && (only === null || only.includes("works"))) shots.push({ row: "works", label: `fen works ${season} 1.3`, state: `fen_drainage-works-${season}`, tile: works.focus, zoom: 1.3 });
  const ford = manifest.states[`chalk_downs-ford-${season}`];
  if (ford?.fords !== undefined && (only === null || only.includes("ford"))) {
    for (const record of ford.fords) shots.push({ row: "works", label: `ford w${record.width} ${season} 1.3`, state: `chalk_downs-ford-${season}`, tile: record.cells[0]!, zoom: 1.3 });
  }
}

const stateCache = new Map<string, unknown>();
const stateOf = (name: string) => { if (!stateCache.has(name)) stateCache.set(name, JSON.parse(readFileSync(join(statesDir, `${name}.json`), "utf8"))); return stateCache.get(name); };
const slug = (shot: Shot) => `${shot.state}-${shot.label.split(" ").slice(1).join("-").replace(/[^A-Za-z0-9.-]+/g, "_")}-${shot.tile.tx}x${shot.tile.ty}`;

const chromium = await loadChromium();
const browser = await chromium.launch({ channel: "chrome", headless: true }) as Awaited<ReturnType<typeof chromium.launch>> & { newPage: (options: object) => Promise<unknown> };
const records: Record<string, unknown>[] = [];
const builds = base === undefined ? [["after", url]] as const : [["after", url], ["before", base]] as const;
for (const shot of shots) {
  for (const [when, build] of builds) {
    const file = `shots/${slug(shot)}${base === undefined ? "" : `-${when}`}.jpg`;
    const errors: string[] = [];
    try {
      const { context, page: opened } = await openScene(browser, { state: stateOf(shot.state), tile: [shot.tile.tx, shot.tile.ty], baseUrl: build, width: 1280, height: 800,
        zoom: shot.zoom, run: false, initScript: TUTORIAL_OFF, query: "&story-delay=600000", loadTimeout: 120_000 });
      const page = opened as Page;
      page.on("pageerror", error => errors.push(String(error).slice(0, 200)));
      // The ground chunks and their art after the first frames.
      await page.waitForTimeout(2_500);
      await page.screenshot({ path: join(out, file), type: "jpeg", quality });
      await context.close();
      records.push({ ...shot, when, file, errors });
    } catch (error) { records.push({ ...shot, when, file: null, errors: [...errors, String(error).slice(0, 300)] }); }
    console.log(JSON.stringify(records.at(-1)));
  }
}
writeFileSync(join(out, "shots.json"), `${JSON.stringify(records, null, 1)}\n`);

// The contact sheet: thumbnails 288 × 180 in rows (a land, then the works and fords; --base: the before row beneath).
const thumb = (record: Record<string, unknown>) => record.file === null ? `<div class="cell missing">${String(record.label)}<br>실패</div>`
  : `<div class="cell"><img src="data:image/jpeg;base64,${readFileSync(join(out, String(record.file))).toString("base64")}"><span>${String(record.state)} · ${String(record.label)}${base === undefined ? "" : ` · ${String(record.when)}`}</span></div>`;
const rows = [...new Set(shots.map(shot => shot.row))].flatMap(row => builds.map(([when]) =>
  `<div class="row"><b>${row}${base === undefined ? "" : ` ${when}`}</b>${records.filter(record => record.row === row && record.when === when).map(thumb).join("")}</div>`));
const sheet = await browser.newPage({ viewport: { width: 1900, height: 400 } }) as Page;
await sheet.setContent(`<html><body style="margin:6px;background:#222;color:#ddd;font:11px sans-serif">
  <style>.row{display:flex;gap:4px;margin-bottom:6px;align-items:flex-start}.row b{width:84px;flex:none}.cell{width:288px;display:flex;flex-direction:column}
  .cell img{width:288px;height:180px}.missing{height:180px;background:#633}</style>${rows.join("")}<div style="height:12px"></div></body></html>`, { waitUntil: "load" });
// The sheet's whole height as the viewport (a full-page shot cut the last row's labels).
await sheet.setViewportSize({ width: 1900, height: await sheet.evaluate(() => document.documentElement.scrollHeight) });
await sheet.screenshot({ path: join(out, "contact.jpg"), type: "jpeg", quality: 62 });
await browser.close();
const failed = records.filter(record => record.file === null || (record.errors as string[]).length > 0);
console.log(JSON.stringify({ shots: records.length, failed: failed.length, contact: join(out, "contact.jpg") }));
process.exitCode = failed.length > 0 ? 1 : 0;
