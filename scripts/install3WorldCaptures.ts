// INSTALL-3 world captures (JPEG crops, quality 60): each moment of scripts/install3States.ts (the C4 human path
// replayed) opened paused in the game, centred on its tile, shot at zoom 1.0 and 0.6 (and 2.0 for the fields, the alehouses and the brewing door): barley against wheat growing and
// ripe, the kiln working (flue smoke, malt sacks), the barn's barley sacks, a brewing house's barrels at its door, the
// alehouse with its stake and a dry one without, the kiln's carts with barley and malt, an alewife and a maltster.
// Writes <out>/<moment>-z1.0.jpg, <moment>-z0.6.jpg and <out>/captures.json (the moments, the crops, the bytes).
//   PLAYWRIGHT_MODULE=... npx tsx scripts/install3WorldCaptures.ts <out-dir> --url <game> --states <install3States dir>
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { GameState } from "../src/engine/engine.types";
import { loadChromium, openScene } from "./renderCommitProbe.mjs";

type Page = { waitForTimeout: (ms: number) => Promise<void>; screenshot: (options: object) => Promise<unknown>;
  waitForFunction: (f: () => boolean, arg: null, options: object) => Promise<unknown> };
const [out] = process.argv.slice(2);
const flag = (name: string) => { const index = process.argv.indexOf(`--${name}`); return index > 0 ? process.argv[index + 1] : undefined; };
const url = flag("url"); const statesDir = flag("states");
if (out === undefined || url === undefined || statesDir === undefined) throw new Error("usage: install3WorldCaptures.ts <out-dir> --url <game> --states <dir>");
mkdirSync(out, { recursive: true });
const WIDTH = 1280, HEIGHT = 800;
// tsx names the functions it compiles with an `__name` helper; the page gets it too. The tutorial is off (no guidance ring).
const TUTORIAL_OFF = `window.__name = (target) => target; try { localStorage.setItem('feudal-lord-simulator:tutorial:v1', JSON.stringify({ enabled: false, acks: [], pulsed: [], log: [] })); } catch (error) { void error; }`;
type Moment = { readonly tick: number; readonly tile: readonly [number, number]; readonly note: string };
const { moments } = JSON.parse(readFileSync(join(statesDir, "moments.json"), "utf8")) as { moments: Record<string, Moment> };
/** Crop size (view px) per moment: the fields and the carts' roads take a wider one; the centre is raised for buildings. */
const CROP = { width: 400, height: 260 } as const;
const WIDE = new Set(["barley-growing", "barley-ripe"]);
const RAISED = new Set(["kiln-working", "barn-barley", "brewing", "alehouse", "alehouse-dry"]);
/** A close look (zoom 2) too where the zoom 1 crop is a few pixels: the two-strip fields among the houses, the stake, the door barrels. */
const CLOSE = new Set(["barley-growing", "barley-ripe", "alehouse", "alehouse-dry", "brewing"]);

const chromium = await loadChromium();
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--disable-gpu"] });
const shots: Record<string, unknown> = {};
const errors: string[] = [];
for (const [name, moment] of Object.entries(moments)) {
  const state = JSON.parse(readFileSync(join(statesDir, `${name}.json`), "utf8")) as GameState;
  for (const zoom of CLOSE.has(name) ? [1, 0.6, 2] : [1, 0.6]) {
    try {
      const opened = await openScene(browser, { state, tile: moment.tile, baseUrl: url, width: WIDTH, height: HEIGHT, zoom, run: false,
        initScript: TUTORIAL_OFF, query: "&story-delay=600000&weather=none" });
      const page = opened.page as Page;
      // The art loads lazily on first draw (Wave 3 through manifestArt, the ground chunks re-raster once it is in).
      await page.waitForTimeout(3_500);
      const size = WIDE.has(name) && zoom < 2 ? { width: CROP.width * 1.4, height: CROP.height * 1.2 } : CROP;
      const clip = { x: Math.round(WIDTH / 2 - size.width / 2), y: Math.round(HEIGHT / 2 - size.height / 2 - (RAISED.has(name) ? 40 * zoom : 0)),
        width: Math.round(size.width), height: Math.round(size.height) };
      const file = `${name}-z${zoom.toFixed(1)}.jpg`;
      await page.screenshot({ path: join(out, file), type: "jpeg", quality: 60, clip });
      shots[file] = { tick: moment.tick, tile: moment.tile, zoom, clip, note: moment.note };
      await opened.context.close();
    } catch (error) { errors.push(`${name} ${zoom}: ${String(error).slice(0, 300)}`); }
  }
}
await browser.close();
const bytes = Object.keys(shots).map(file => statSync(join(out, file)).size).reduce((a, b) => a + b, 0);
writeFileSync(join(out, "captures.json"), JSON.stringify({ source: "scripts/install3States.ts (the C4 human path replayed; states not edited)", paused: true, shots, jpegBytes: bytes, errors }, null, 1) + "\n");
console.log(JSON.stringify({ files: Object.keys(shots).length, bytes, errors }));
process.exitCode = errors.length === 0 ? 0 : 1;
