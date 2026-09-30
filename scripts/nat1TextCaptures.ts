// NAT-1 gate captures, part 3 (text-box discipline): each floating box opened the way a player opens it (not here: the
// kit's Tooltip — the gallery only —, the resource bar's coin detail — an unmounted bar — and the build menu's details —
// the HUD's build menu is controlled, which hides the details' toggle), in normal play
// and with every Korean string 1.4× longer (?pseudo-long=1, the dev server's copy transform): its width (one of the tokens
// 280 · 360 · 480 px, and the same in both modes), overflow (the box or any line inside it wider than the box), the
// frame (a UI-KIT border-image), and a JPEG of the box in each mode.
//   PLAYWRIGHT_MODULE=... npx tsx scripts/nat1TextCaptures.ts <out> --url <game> --states <UI-9 states dir> --lands <NAT-1 land states dir>
import { refuseHeavyOnMac } from "./remote/localGuard.mjs";
refuseHeavyOnMac("브라우저 캡처(scripts/nat1TextCaptures.ts)", { remote: "scripts/remote/run.sh <세션>-<작업ID> -- node_modules/.bin/tsx scripts/nat1TextCaptures.ts …", entry: import.meta.url });
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { GameState } from "../src/engine/engine.types";
import { loadChromium, openScene } from "./renderCommitProbe.mjs";

type Locator = { first: () => Locator; click: (options?: object) => Promise<void>; hover: (options?: object) => Promise<void>; count: () => Promise<number>;
  waitFor: (options?: object) => Promise<void>; screenshot: (options: object) => Promise<unknown> };
type Page = { waitForTimeout: (ms: number) => Promise<void>; evaluate: <T>(expression: string) => Promise<T>; locator: (selector: string) => Locator };
const [out] = process.argv.slice(2);
const flag = (name: string) => { const index = process.argv.indexOf(`--${name}`); return index > 0 ? process.argv[index + 1] : undefined; };
const url = flag("url")!; const statesDir = flag("states")!;
mkdirSync(out!, { recursive: true });
const TUTORIAL_OFF = `try { localStorage.setItem('feudal-lord-simulator:tutorial:v1', JSON.stringify({ enabled: false, acks: [], pulsed: [], log: [] })); } catch (error) { void error; }`;
const TOKENS = [280, 360, 480];
const landsDir = flag("lands");
/** A state by name from the UI-9 states, or `@lands/<land>` from the NAT-1 land states (scripts/nat1LandStates.ts). */
const load = (name: string) => JSON.parse(readFileSync(name.startsWith("@lands/") ? join(landsDir!, `${name.slice(7)}.json`) : join(statesDir, `${name}.json`), "utf8")) as GameState;
/** Modal cards (the petition's) keep their own size around their painting; they only have to be framed and not overflow. */
const MODAL = new Set(["petition-card"]);

/** Each box: the state, how to open it, its selector. */
const BOXES: readonly { readonly name: string; readonly state: string; readonly selector: string; readonly open: (page: Page) => Promise<void> }[] = [
  { name: "season-strip", state: "rumour-quiet", selector: ".season-strip-panel", open: async page => { await page.locator("[data-testid='hud-calendar']").first().click(); } },
  { name: "event-card", state: "reorg.alehouse_boom", selector: ".event-card", open: async page => {
    await page.locator(".event-chip").first().waitFor({ timeout: 90_000 }); await page.locator(".event-chip").first().click(); } },
  { name: "steward-line", state: "rumour-quiet", selector: ".steward-bubble", open: async page => { await page.locator(".steward-bubble").first().waitFor({ timeout: 30_000 }); } },
  { name: "autoplay-popover", state: "rumour-quiet", selector: ".command-popover", open: async page => {
    await page.locator(".settings-disclosure summary").first().click(); } },
  { name: "layer-note", state: "@lands/open_field", selector: ".layer-switch-note", open: async page => { await page.locator(".control-layer[aria-disabled='true']").first().click({ force: true }); } },
  // The petition waits behind its chip (the card opens from the chip's decide button), as the skin audit opens it.
  { name: "petition-card", state: "guild_charter", selector: ".petition-card", open: async page => {
    if (!await page.locator(".petition-card").first().waitFor({ timeout: 8_000 }).then(() => true).catch(() => false)) {
      await page.locator(".event-chip").first().click({ timeout: 60_000 }).catch(() => undefined);
      await page.locator(".event-card-decide").first().click({ timeout: 10_000 }).catch(() => undefined);
      await page.locator(".petition-card").first().waitFor({ timeout: 60_000 });
    } } },
];

// The measurement in the page (a string: tsx would wrap named functions with __name, which the page lacks).
const measure = (selector: string) => `(() => {
  const box = [...document.querySelectorAll(${JSON.stringify(selector)})].find(node => node.getBoundingClientRect().width > 0 && !node.closest('[hidden]'));
  if (box === undefined) return null;
  const rect = box.getBoundingClientRect(); const style = getComputedStyle(box);
  let clipped = 0;
  for (const node of box.querySelectorAll('*')) {
    const r = node.getBoundingClientRect();
    if (r.width === 0 || getComputedStyle(node).overflow === 'hidden' && getComputedStyle(node).textOverflow === 'ellipsis') continue;
    if (r.right > rect.right + 1 || r.left < rect.left - 1) clipped += 1;
  }
  return { width: Math.round(rect.width), height: Math.round(rect.height), scrollOverflow: Math.max(0, box.scrollWidth - box.clientWidth), childrenOutside: clipped,
    framed: (style.borderImageSource !== 'none' && style.borderImageSource !== '') || [...box.querySelectorAll('[class*="frame"]')].some(node => getComputedStyle(node).backgroundImage !== 'none' || getComputedStyle(node).borderImageSource !== 'none'), lineHeight: style.lineHeight, fontSize: style.fontSize,
    text: (box.textContent ?? '').trim().slice(0, 80) };
})()`;

const chromium = await loadChromium();
const browser = await chromium.launch({ channel: "chrome", headless: true });
const rows: Record<string, unknown>[] = [];
for (const box of BOXES) {
  const row: Record<string, unknown> = { box: box.name, selector: box.selector };
  for (const mode of ["normal", "long"] as const) {
    try {
      const state = load(box.state);
      const keep = state.buildings.find(building => building.kind === "keep") ?? state.buildings[0]!;
      const { context, page: opened } = await openScene(browser, { state, tile: [keep.tx, keep.ty], baseUrl: url, width: 1280, height: 800, zoom: 1.1, run: false,
        initScript: TUTORIAL_OFF, query: `&story-delay=${box.name === "event-card" || box.name === "petition-card" ? 0 : 600000}${mode === "long" ? "&pseudo-long=1" : ""}` });
      const page = opened as Page;
      await page.waitForTimeout(1_200);
      await box.open(page); await page.waitForTimeout(700);
      const found = await page.evaluate<Record<string, unknown> | null>(measure(box.selector));
      row[mode] = found;
      if (found !== null) await page.locator(box.selector).first().screenshot({ path: join(out!, `t-${box.name}-${mode}.jpg`), type: "jpeg", quality: 72 }).catch(() => undefined);
      await context.close();
    } catch (error) { row[mode] = { error: String(error).slice(0, 160) }; }
  }
  const normal = row.normal as { width?: number; scrollOverflow?: number; childrenOutside?: number; framed?: boolean } | null;
  const long = row.long as typeof normal;
  row.pass = normal !== null && long !== null && normal.width !== undefined && (MODAL.has(box.name) || TOKENS.includes(normal.width)) && normal.width === long.width
    && normal.scrollOverflow === 0 && long.scrollOverflow === 0 && normal.childrenOutside === 0 && long.childrenOutside === 0 && normal.framed === true;
  rows.push(row);
  console.log(JSON.stringify({ box: row.box, pass: row.pass }));
}
await browser.close();
const summary = { tokens: TOKENS, rows, measured: rows.filter(row => row.normal !== null && !(row.normal as { error?: string }).error).length,
  pass: rows.every(row => row.pass === true) };
writeFileSync(join(out!, "text-boxes.json"), JSON.stringify(summary, null, 1) + "\n");
console.log(JSON.stringify({ measured: summary.measured, pass: summary.pass }));
