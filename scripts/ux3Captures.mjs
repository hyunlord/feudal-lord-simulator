// UX-3 evidence: placement validity in the normal and the colourblind palette, each also in grey scale (gate 4: fine
// and blocked tiles still differ without colour), and the tutorial target before / after a tool is picked (gate 3).
//   PLAYWRIGHT_MODULE=... node scripts/ux3Captures.mjs <out-dir> --url <url>
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadChromium, openScene } from "./renderCommitProbe.mjs";

const [out] = process.argv.slice(2);
const urlIndex = process.argv.indexOf("--url");
const url = urlIndex > 0 ? process.argv[urlIndex + 1] : "http://127.0.0.1:4281/";
mkdirSync(out, { recursive: true });
const chromium = await loadChromium();
const browser = await chromium.launch({ channel: "chrome", headless: true });
const point = (page, tx, ty) => page.evaluate(t => window.__FEUDAL_PHASE10_PROOF__.tileClientPoint(t), { tx, ty });
const clipAt = (p, w = 420, h = 280) => ({ x: Math.max(0, p.clientX - w / 2), y: Math.max(0, p.clientY - h / 2), width: w, height: h });
const rows = [];

// Placement: a storehouse laid over the starting house's corner (one tile on the house, the rest open) — the fine
// tiles, the blocked tile with its hatch and icon, the ring, and the chip.
for (const [palette, query] of [["normal", ""], ["colorblind", "&colorblind=1"]]) {
  const { context, page } = await openScene(browser, { state: null, tile: [44, 42], baseUrl: url, query, width: 1280, height: 800, dpr: 1, zoom: 1.6, run: false });
  await page.keyboard.press("Escape"); await page.waitForTimeout(200);
  await page.locator(".pause-menu .tutorial-switch").click(); await page.keyboard.press("Escape"); await page.waitForTimeout(200);
  await page.locator("[data-dock='build']").click(); await page.waitForTimeout(200);
  await page.locator("[data-category='storage']").click(); await page.waitForTimeout(200);
  await page.locator(".build-tool:visible:not([aria-disabled='true'])").first().click(); await page.waitForTimeout(200);
  const at = await point(page, 43, 41);
  await page.mouse.move(at.clientX, at.clientY); await page.waitForTimeout(500);
  const chip = await page.evaluate(() => document.querySelector(".placement-chip")?.textContent ?? null);
  for (const tone of ["colour", "grey"]) {
    const style = tone === "grey" ? await page.addStyleTag({ content: "html{filter:grayscale(1)!important}" }) : null;
    await page.waitForTimeout(150);
    const file = `placement-${palette}-${tone}.jpg`;
    writeFileSync(join(out, file), await page.screenshot({ type: "jpeg", quality: 82, clip: { ...clipAt(at, 520, 300), x: Math.max(0, at.clientX - 220) } }));
    if (style !== null) await style.evaluate(element => element.remove());
    rows.push({ file, palette, tone, chip });
  }
  await context.close();
}

// Tutorial target: before a tool (label only, no diamond) and with the well picked (the target's tiles).
{
  const { context, page } = await openScene(browser, { state: null, tile: [45, 41], baseUrl: url, width: 1280, height: 800, dpr: 1, zoom: 1, run: false });
  await page.locator("[data-tutorial-cta]").first().click().catch(() => undefined); await page.waitForTimeout(600);
  writeFileSync(join(out, "target-before-tool.jpg"), await page.screenshot({ type: "jpeg", quality: 80 }));
  await page.locator("[data-dock='build']").click(); await page.waitForTimeout(200);
  await page.locator(".build-tool:visible:not([aria-disabled='true'])").nth(1).click(); await page.waitForTimeout(500);
  writeFileSync(join(out, "target-with-tool.jpg"), await page.screenshot({ type: "jpeg", quality: 80 }));
  rows.push({ file: "target-before-tool.jpg" }, { file: "target-with-tool.jpg" });
  await context.close();
}
await browser.close();
writeFileSync(join(out, "captures.json"), JSON.stringify({ url, rows }, null, 1) + "\n");
console.log(JSON.stringify(rows, null, 1));
