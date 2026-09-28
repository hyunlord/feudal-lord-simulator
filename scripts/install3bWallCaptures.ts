// INSTALL-3b gate ①: the chapter 2 town with its walls under construction (the v24 palisade-construction save set to
// chapter 2, as scripts/install3States.ts and scripts/measureHudCoverage.ts open it), camera on the wall works:
//   w1 the trunk before (--base): a tag per segment, zoom 1;
//   w2 this build, zoom 1: one tag per works;
//   w3 this build, zoom 1.35: every segment's own tag;
//   w4 this build, zoom 1, a segment of the works selected: every segment's own tag with the card.
// Full-view JPEGs (1280 x 800) and walls.json (the tags each shot drew, read from the proof port where it has one).
//   PLAYWRIGHT_MODULE=... npx tsx scripts/install3bWallCaptures.ts <out-dir> --url <game> --base <trunk game>
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CHAPTER_TWO } from "../src/content/chapterConfig";
import { isWallConstructionSite } from "../src/economy/construction";
import type { GameState } from "../src/engine/engine.types";
import { initialPolitics } from "../src/engine/politics";
import { decodeSave } from "../src/save/saveCodec";
import { loadChromium, openScene } from "./renderCommitProbe.mjs";

type Locator = { first: () => Locator; count: () => Promise<number>; click: () => Promise<void> };
type Page = { waitForTimeout: (ms: number) => Promise<void>; evaluate: <T, A>(f: (arg: A) => T, arg?: A) => Promise<T>; locator: (selector: string) => Locator;
  screenshot: (options: object) => Promise<unknown>; mouse: { click: (x: number, y: number) => Promise<void>; move: (x: number, y: number) => Promise<void> };
  on: (event: string, handler: (error: unknown) => void) => void };
type Port = { __FEUDAL_PHASE10_PROOF__: { tileClientPoint: (tile: object) => { clientX: number; clientY: number };
  constructionTagBoxes?: () => readonly object[] } };
const [out] = process.argv.slice(2);
const flag = (name: string) => { const index = process.argv.indexOf(`--${name}`); return index > 0 ? process.argv[index + 1] : undefined; };
const url = flag("url")!; const base = flag("base")!;
mkdirSync(out!, { recursive: true });
const TUTORIAL_OFF = `try { localStorage.setItem('feudal-lord-simulator:tutorial:v1', JSON.stringify({ enabled: false, acks: [], pulsed: [], log: [] })); } catch (error) { void error; }`;
const WIDTH = 1280, HEIGHT = 800;
const saved = decodeSave(new Uint8Array(readFileSync("fixtures/saves/v24/palisade-construction.save.json"))).envelope.state as GameState;
const politics = initialPolitics(saved);
const town = { ...saved, politics: { ...politics, chapter: { ...politics.chapter, number: CHAPTER_TWO.chapter } } } as GameState;
const sites = town.constructionSites.filter(isWallConstructionSite);
const middle = [sites.reduce((sum, site) => sum + site.anchor.tx, 0) / sites.length, sites.reduce((sum, site) => sum + site.anchor.ty, 0) / sites.length];
const chromium = await loadChromium();
const browser = await chromium.launch({ channel: "chrome", headless: true });
const shots: Record<string, unknown> = {};
const errors: string[] = [];
const files: string[] = [];

async function shot(name: string, game: string, zoom: number, select: boolean) {
  const { context, page } = await openScene(browser, { state: town, tile: middle, baseUrl: game, width: WIDTH, height: HEIGHT, zoom, run: false, initScript: TUTORIAL_OFF,
    query: "&story-delay=600000&weather=none" }) as { context: { close: () => Promise<void> }; page: Page };
  page.on("pageerror", error => errors.push(`${name}: ${String(error).slice(0, 200)}`));
  for (const selector of [".story-modal-later", ".chronicle-page .chronicle-keep", ".season-ledger-resume"]) if (await page.locator(selector).count() > 0) { await page.locator(selector).first().click(); await page.waitForTimeout(300); }
  const recording = await page.evaluate(() => { const port = (window as unknown as Port).__FEUDAL_PHASE10_PROOF__; port.constructionTagBoxes?.(); return port.constructionTagBoxes !== undefined; });
  let selected: string | null = null;
  if (select) {
    // The segment nearest the works' middle, clicked on its anchor tile.
    const target = [...sites].sort((a, b) => Math.hypot(a.anchor.tx - middle[0]!, a.anchor.ty - middle[1]!) - Math.hypot(b.anchor.tx - middle[0]!, b.anchor.ty - middle[1]!))[0]!;
    const at = await page.evaluate(tile => (window as unknown as Port).__FEUDAL_PHASE10_PROOF__.tileClientPoint(tile), { tx: target.anchor.tx + 0.5, ty: target.anchor.ty + 0.5 });
    await page.mouse.click(at.clientX, at.clientY); await page.waitForTimeout(700);
    selected = target.id;
  }
  // The pointer on the HUD's date bar: off the canvas, outside the 20 px edge-pan band.
  await page.mouse.move(200, 40); await page.waitForTimeout(600);
  const file = `${name}.jpg`;
  await page.screenshot({ path: join(out!, file), type: "jpeg", quality: 62 }); files.push(file);
  const tags = recording ? await page.evaluate(() => (window as unknown as Port).__FEUDAL_PHASE10_PROOF__.constructionTagBoxes!().length) : null;
  const card = await page.locator(".diagnostic-card").count() > 0;
  shots[name] = { game, zoom, selected, card, tagBoxes: tags };
  await context.close();
}
for (const [name, game, zoom, select] of [["w1-before-zoom1", base, 1, false], ["w2-after-zoom1", url, 1, false],
  ["w3-after-zoom1.35", url, 1.35, false], ["w4-after-selected", url, 1, true]] as const) {
  try { await shot(name, game, zoom, select); console.log(name, "ok"); } catch (error) { errors.push(`${name}: ${String(error).slice(0, 300)}`); console.log(name, "FAILED"); }
}
await browser.close();
const bytes = files.reduce((total, file) => total + statSync(join(out!, file)).size, 0);
writeFileSync(join(out!, "walls.json"), JSON.stringify({ segments: sites.length, works: new Set(sites.map(site => `${site.kind}:${site.wallId}`)).size, shots, files, jpegBytes: bytes, errors }, null, 1) + "\n");
console.log(JSON.stringify({ shots, bytes, errors }));
process.exitCode = errors.length === 0 ? 0 : 1;
