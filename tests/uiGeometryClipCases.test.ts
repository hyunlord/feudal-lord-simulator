import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { test } from "node:test";
import { collectSurface, evaluateSurface, surfaceFontsLoaded, type MeasureSpec } from "../scripts/uiGeometryMeasure";

// The geometry audit's "text clipped without an ellipsis" on deliberately clipped pages, measured in a real Chromium with
// the audit's own collectSurface/evaluateSurface (REMOTE review of LR2-D5, 2026-10-07). A cut that scrolling reaches is
// no failure; a cut that nothing reaches is. Needs Playwright (the DGX runner sets FLS_PLAYWRIGHT_CORE): skipped elsewhere.
const playwright = process.env.PLAYWRIGHT_MODULE ?? process.env.FLS_PLAYWRIGHT_CORE;
const SHIM = "globalThis.__name = globalThis.__name || (target => target);";   // tsx keepNames, as the audit
const BASE = `<style>*{box-sizing:border-box} body{margin:0;font:16px/20px monospace} .case{position:absolute;left:20px;top:20px} span{white-space:nowrap;display:inline-block}</style>`;
const spec: MeasureSpec = { root: ".case", frame: "flat", gap: 0 };
type Case = { name: string; cut: boolean; html: string; scroll?: [string, number, number] };
const CASES: Case[] = [
  { name: "a label in an overflow-hidden map scrolled out of the screen's scroller (the LM-R2 case): reachable", cut: false,
    html: `<div class="case" style="width:300px;height:200px;overflow:hidden"><div id="s" style="height:200px;overflow-y:auto"><div style="height:600px;overflow:hidden;position:relative"><span style="position:absolute;top:10px;left:10px">label near the map top</span></div></div></div>`,
    scroll: ["#s", 0, 300] },
  { name: "an overflow-hidden box inside a scroller cuts its own text", cut: true,
    html: `<div class="case" style="width:300px;height:200px;overflow-y:auto"><div style="width:100px;overflow:hidden"><span>a long line that the narrow box cuts for good</span></div></div>` },
  { name: "an overflow-y:auto scroller with overflow-x:hidden cuts a wide line sideways (no scroll reaches it)", cut: true,
    html: `<div class="case" style="width:200px;height:200px;overflow-y:auto;overflow-x:hidden"><div style="width:700px;height:80px;overflow:hidden"><span>a line wider than the scroller, cut at its right edge</span></div></div>` },
  { name: "a scroller with no height limit, cut by the overflow-hidden panel around it (it never scrolls)", cut: true,
    html: `<div class="case" style="width:300px;height:150px;overflow:hidden"><div style="overflow-y:auto"><div style="height:400px;overflow:hidden;position:relative"><span style="position:absolute;top:300px;left:10px">text below the panel</span></div></div></div>` },
  { name: "an overflow-hidden box inside a sideways scroller cuts its own text", cut: true,
    html: `<div class="case" style="width:300px;height:100px;overflow-x:auto;overflow-y:hidden"><div style="width:600px"><div style="width:120px;overflow:hidden"><span>a long line that the 120 px box cuts</span></div></div></div>` },
  { name: "text in an overflow-hidden strip scrolled out sideways: reachable", cut: false,
    html: `<div class="case" id="h" style="width:300px;height:100px;overflow-x:auto;overflow-y:hidden"><div style="width:900px;height:60px;overflow:hidden;position:relative"><span style="position:absolute;left:20px;top:10px">left text</span></div></div>`,
    scroll: ["#h", 500, 0] },
];
const clipped = (failures: readonly { check: string; what: string }[]) => failures.some(f => f.check === "overflow" && /text clipped/.test(f.what));

test("geometry audit: a clip that scrolling reaches passes, a clip nothing reaches fails (scrollers, mixed axes, a cut scroller)", { skip: !playwright && "needs Playwright (the DGX runner)" }, async () => {
  const { chromium } = await import(pathToFileURL(playwright!).href);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 800, height: 600 } }); await page.addInitScript(SHIM);
    const wrong: string[] = [];
    for (const c of CASES) {
      await page.setContent(`${BASE}${c.html}`); await page.evaluate(SHIM);
      if (c.scroll) await page.evaluate(([s, l, t]: [string, number, number]) => { const e = document.querySelector(s)!; e.scrollLeft = l; e.scrollTop = t; }, c.scroll);
      const failed = clipped(evaluateSurface(await page.evaluate(collectSurface, spec), spec).failures);
      if (failed !== c.cut) wrong.push(`${c.cut ? "missed" : "false failure"}: ${c.name}`);
    }
    assert.deepEqual(wrong, []);
  } finally { await browser.close(); }
});

test("geometry audit: a web font that arrives late and widens a line past its box is measured after it loads", { skip: !playwright && "needs Playwright (the DGX runner)" }, async (t) => {
  const font = ["/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"].find(existsSync);
  if (font === undefined) { t.skip("no DejaVu font file on this machine"); return; }
  const { chromium } = await import(pathToFileURL(playwright!).href);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 800, height: 600 } }); await page.addInitScript(SHIM);
    await page.route("http://fonts.test/**", async (route: any) => {
      if (route.request().url().endsWith(".ttf")) { await new Promise(r => setTimeout(r, 1500)); await route.fulfill({ body: readFileSync(font), contentType: "font/ttf" }); }
      else await route.fulfill({ contentType: "text/html", body: `${BASE}<style>@font-face{font-family:Late;src:url(late.ttf)} .w{font-family:Late,monospace;font-size:18px}</style><div class="case" style="width:400px;height:100px"><div style="width:250px;overflow:hidden"><span class="w">WWWWWWWWWWWWWWWWWWWWWW</span></div></div>` });
    });
    await page.goto("http://fonts.test/page", { waitUntil: "domcontentloaded" });
    assert.equal(clipped(evaluateSurface(await page.evaluate(collectSurface, spec), spec).failures), false, "measured before the font: the cut is not there yet");
    await page.evaluate(surfaceFontsLoaded);     // what the audit now waits for (bounded) before it measures
    assert.equal(clipped(evaluateSurface(await page.evaluate(collectSurface, spec), spec).failures), true);
  } finally { await browser.close(); }
});
