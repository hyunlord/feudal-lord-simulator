// NAT-1: capture script for text-box discipline (section 3).
// Loads each state, measures every inventoried floating box in normal and pseudo-long mode,
// verifies width is one of the three tokens and overflow is 0, then writes JSON + JPEGs.
//   PLAYWRIGHT_MODULE=... npx tsx scripts/nat1TextCaptures.ts [--url <url>] [--out <dir>]
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { loadChromium, openScene } from "./renderCommitProbe.mjs";

type Page = {
  waitForTimeout: (ms: number) => Promise<void>;
  screenshot: (options: object) => Promise<unknown>;
  evaluate: (expr: string) => Promise<unknown>;
};

type BoxRow = { selector: string; width: number; scrollWidth: number; overflow: number; expected: number | undefined; inTokenSet: boolean; pass: boolean };
type RunResult = { state: string; mode: string; boxes: BoxRow[] };
type ErrResult = { state: string; error: string };

const flag = (name: string) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : undefined; };
const url = flag("url") ?? "http://127.0.0.1:4485/";
const out = flag("out") ?? "/private/tmp/nat1-text";
mkdirSync(out, { recursive: true });

// Width tokens as CSS px values (base; tablet not tested here).
const TOKEN_SMALL = 280;
const TOKEN_MEDIUM = 360;
const TOKEN_WIDE = 480;
const TOKENS = new Set([TOKEN_SMALL, TOKEN_MEDIUM, TOKEN_WIDE]);

// Floating boxes to measure: [CSS selector, expected token width].
const BOXES: Array<[string, number]> = [
  [".season-strip-panel", TOKEN_MEDIUM],
  [".event-card", TOKEN_MEDIUM],
  [".steward-bubble--line", TOKEN_SMALL],
  [".layer-switch-note", TOKEN_SMALL],
  [".resource-bar__coin-detail", TOKEN_MEDIUM],
  [".settlement-crisis-slot .settlement-crisis", TOKEN_MEDIUM],
  [".command-popover", TOKEN_MEDIUM],
  [".build-menu-details", TOKEN_WIDE],
  [".slot-panel", TOKEN_MEDIUM],
  [".ui-tooltip", TOKEN_SMALL],
];

const TUTORIAL_OFF = `try { localStorage.setItem('feudal-lord-simulator:tutorial:v1', JSON.stringify({ enabled: false, acks: [], pulsed: [], log: [] })); } catch (_) {}`;

// State files from the standard locations.
const STATE_FILES = [
  "/Users/rexxa/fls-ui9-states/rumour-quiet.json",
  "/Users/rexxa/fls-ui9-states/guild_charter.json",
];

// NAT-1: browser-side measurement — serialised string so tsx __name does not run in browser context.
function buildMeasureExpr(boxes: Array<[string, number]>): string {
  return `(function() {
  var boxes = ${JSON.stringify(boxes)};
  var rows = [];
  for (var i = 0; i < boxes.length; i++) {
    var sel = boxes[i][0];
    var el = document.querySelector(sel);
    if (!el) continue;
    var rect = el.getBoundingClientRect();
    if (rect.width === 0) continue;
    var w = Math.round(rect.width);
    rows.push({ selector: sel, width: w, scrollWidth: el.scrollWidth, overflow: Math.max(0, el.scrollWidth - w) });
  }
  return rows;
})()`;
}

async function capture(statePath: string, mode: "normal" | "pseudo-long"): Promise<RunResult> {
  const state = JSON.parse(readFileSync(statePath, "utf8")) as Record<string, unknown>;
  const chromium = await loadChromium();
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const query = mode === "pseudo-long" ? "pseudo-long=1" : "";
  const buildings = state.buildings as Array<{ kind: string; tx: number; ty: number }> | undefined;
  const house = buildings?.find(b => b.kind === "house") ?? buildings?.[0];
  const tile: [number, number] = house ? [house.tx, house.ty] : [10, 10];
  const opened = await openScene(browser, { state, tile, baseUrl: url, width: 1280, height: 800, zoom: 1.4, run: false,
    initScript: TUTORIAL_OFF, query, hasTouch: false, isMobile: false });
  const page = (opened as { page: Page }).page;

  await page.waitForTimeout(1200);
  const rawRows = await page.evaluate(buildMeasureExpr(BOXES)) as Array<{ selector: string; width: number; scrollWidth: number; overflow: number }>;
  const boxes: BoxRow[] = rawRows.map(row => {
    const expected = BOXES.find(([s]) => s === row.selector)?.[1];
    return { ...row, expected, inTokenSet: TOKENS.has(row.width), pass: TOKENS.has(row.width) && row.overflow === 0 };
  });

  const stateName = statePath.replace(/.*\//, "").replace(/\.json$/, "");
  await page.screenshot({ path: join(out, `${stateName}-${mode}.jpg`), type: "jpeg", quality: 80 });
  await browser.close();
  return { state: stateName, mode, boxes };
}

const results: Array<RunResult | ErrResult> = [];
for (const statePath of STATE_FILES) {
  try {
    results.push(await capture(statePath, "normal"));
    results.push(await capture(statePath, "pseudo-long"));
  } catch (err) {
    console.error(`Failed for ${statePath}:`, err);
    results.push({ state: statePath, error: String(err) });
  }
}

function isRun(r: RunResult | ErrResult): r is RunResult { return "boxes" in r; }

const summary = {
  tokens: { small: TOKEN_SMALL, medium: TOKEN_MEDIUM, wide: TOKEN_WIDE },
  results,
  pass: results.every(r => isRun(r) && r.boxes.every(b => b.pass)),
};
const jsonPath = join(out, "nat1-text-results.json");
writeFileSync(jsonPath, JSON.stringify(summary, null, 2) + "\n");
console.log(`Written: ${jsonPath}`);
console.log(`Pass: ${summary.pass}`);
for (const r of results) {
  if (isRun(r)) {
    const failures = r.boxes.filter(b => !b.pass);
    if (failures.length > 0) {
      console.warn(`  FAIL ${r.state} ${r.mode}:`, failures.map(b => `${b.selector} w=${b.width} ov=${b.overflow}`).join(", "));
    } else {
      console.log(`  OK ${r.state} ${r.mode}: ${r.boxes.length} boxes measured`);
    }
  } else {
    console.error(`  ERROR ${r.state}: ${r.error}`);
  }
}
