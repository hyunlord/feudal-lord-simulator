// LAND-UI (LU-D7) evidence: the title's land picker at three desktop viewports and the 1024 minimum — where the
// emblem, the parchment, the land buttons and the mode buttons sit, what element the viewport's centre point hits (the
// scripts and gates click the dismiss layer's centre: it must stay the keyart / layer, never a land button), and a
// JPEG of the title at 1280×800 (with a second land picked) and 1180×820; then the starts (see below).
//   PLAYWRIGHT_MODULE=/abs/playwright-core/index.mjs node scripts/landPickerCaptures.mjs <outDir> [--url http://127.0.0.1:4213/] [--shots 0]
import { refuseHeavyOnMac } from "./remote/localGuard.mjs";
refuseHeavyOnMac("브라우저 캡처(scripts/landPickerCaptures.mjs)", { remote: "scripts/remote/run.sh render-LANDUI-lands-<sha7> -- node scripts/landPickerCaptures.mjs …", entry: import.meta.url });
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const [outDir] = process.argv.slice(2);
const flags = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, all) => value.startsWith("--") ? [...pairs, [value.slice(2), all[index + 1]]] : pairs, []));
const url = flags.url ?? "http://127.0.0.1:4213/";
const shots = flags.shots !== "0";
for (let attempt = 0; ; attempt += 1) {
  try { if ((await fetch(url)).ok) break; } catch { /* not up yet */ }
  if (attempt > 120) throw new Error(`no server at ${url}`);
  await new Promise(resolve => setTimeout(resolve, 500));
}
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
await mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const box = rect => rect === null ? null : [Math.round(rect.x), Math.round(rect.y), Math.round(rect.width), Math.round(rect.height)];
const rows = [];
for (const [width, height, long] of [[1280, 800], [1920, 1080], [1180, 820], [1024, 768], [1280, 800, true], [1024, 768, true]]) {
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  await page.routeWebSocket("**", socket => socket.close());
  await page.goto(long ? `${url}?pseudo-long=1` : url);
  await page.locator(".welcome-parchment").waitFor({ timeout: 60_000 });
  await page.waitForTimeout(1_200);
  const measure = () => page.evaluate(() => {
    const rect = selector => { const element = document.querySelector(selector); return element === null ? null : element.getBoundingClientRect().toJSON(); };
    const all = selector => [...document.querySelectorAll(selector)].map(element => element.getBoundingClientRect().toJSON());
    const centre = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
    return {
      emblem: rect(".title-emblem"), parchment: rect(".welcome-parchment"), lands: all(".welcome-land"), seed: rect(".welcome-seed"),
      modes: all(".welcome-parchment [data-scenario]"),
      centre: centre === null ? null : { tag: centre.tagName, className: String(centre.className), inButton: centre.closest("button") !== null },
      landPreviews: [...document.querySelectorAll(".welcome-land canvas")].filter(canvas => canvas.width > 0).length,
    };
  });
  const seen = await measure();
  rows.push({ viewport: [width, height], pseudoLong: long === true, emblem: box(seen.emblem), parchment: box(seen.parchment), lands: seen.lands.map(box), seed: box(seen.seed),
    modes: seen.modes.map(box), centre: seen.centre, landPreviews: seen.landPreviews,
    centreAboveLandsPx: seen.lands.length === 0 ? null : Math.round(Math.min(...seen.lands.map(rect => rect.top)) - height / 2),
    parchmentInside: seen.parchment !== null && seen.parchment.top >= 0 && seen.parchment.bottom <= height && seen.parchment.left >= 0 && seen.parchment.right <= width });
  if (shots && !long && (width === 1280 || width === 1180)) {
    await writeFile(join(outDir, `title-${width}x${height}.jpg`), await page.screenshot({ type: "jpeg", quality: 62 }));
  }
  if (shots && !long && width === 1280 && seen.lands.length > 1) {
    await page.locator(".welcome-land").nth(4).click();
    await page.locator(".welcome-seed button").last().click();
    await page.waitForTimeout(300);
    await writeFile(join(outDir, `title-${width}x${height}-fen-seed2.jpg`), await page.screenshot({ type: "jpeg", quality: 62 }));
    rows.at(-1).afterPick = await page.evaluate(() => ({
      pressed: [...document.querySelectorAll(".welcome-land")].map(button => button.getAttribute("aria-pressed")),
      seed: document.querySelector(".welcome-seed-value")?.textContent ?? null,
      welcome: document.querySelector(".welcome-parchment") !== null,
    }));
  }
  await context.close();
}
// The starts (1280×800, the proof port reads the state): a mode button on the default land is today's game; a pick then
// a click on the layer's centre starts the picked land; the disabled seed buttons never dismiss; over a save, 새 게임
// shows the picker too (measured and captured) and its mode button starts the picked land and seed.
const flows = {};
{
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  await page.routeWebSocket("**", socket => socket.close());
  const ready = () => page.waitForFunction(() => window.__FEUDAL_PHASE10_PROOF__ !== undefined, null, { timeout: 60_000 });
  const land = () => page.evaluate(() => { const state = window.__FEUDAL_PHASE10_PROOF__.state(); return { archetypeId: state.archetypeId ?? null, seed: state.seed, scenarioId: state.scenarioId, tick: state.tick }; });
  await page.goto(`${url}?phase10-proof=1`); await ready();
  await page.locator(".welcome-seed button").first().click({ force: true }); await page.locator(".welcome-seed button").last().click({ force: true });
  flows.disabledSeedKeepsWelcome = await page.locator(".welcome-parchment").count() === 1;
  await page.locator(".welcome-parchment [data-scenario]").first().click(); await page.waitForTimeout(800);
  flows.defaultModeButton = await land();
  await context.clearCookies(); await page.evaluate(() => localStorage.clear());
  await page.goto(`${url}?phase10-proof=1`); await ready();
  await page.locator(".welcome-land").nth(4).click(); await page.locator(".welcome-seed button").last().click();
  await page.locator(".welcome-dismiss-layer").click(); await page.waitForTimeout(800);
  flows.pickThenDismiss = await land();
  await page.locator(".settings-disclosure > summary").click();
  await page.getByRole("button", { name: "지금 저장", exact: true }).click(); await page.waitForTimeout(800);
  await page.reload(); await ready();
  await page.getByRole("button", { name: "새 게임", exact: true }).click(); await page.waitForTimeout(400);
  const seen = await page.evaluate(() => {
    const rect = element => { const box = element.getBoundingClientRect(); return [Math.round(box.x), Math.round(box.y), Math.round(box.width), Math.round(box.height)]; };
    const parchment = document.querySelector(".welcome-parchment").getBoundingClientRect();
    return { parchment: rect(document.querySelector(".welcome-parchment")), lands: [...document.querySelectorAll(".welcome-land")].map(rect),
      inside: parchment.top >= 0 && parchment.bottom <= window.innerHeight, emblem: rect(document.querySelector(".title-emblem")) };
  });
  flows.overSaveLayout = seen;
  if (shots) await writeFile(join(outDir, "title-1280x800-over-save.jpg"), await page.screenshot({ type: "jpeg", quality: 62 }));
  await page.locator(".welcome-land").nth(1).click();
  for (let press = 0; press < 2; press += 1) await page.locator(".welcome-seed button").last().click();
  await page.getByRole("button", { name: "목표형으로 시작", exact: true }).click(); await page.waitForTimeout(1_500);
  flows.overSavePick = await land();
  await context.close();
}
await browser.close();
await writeFile(join(outDir, "layout.json"), `${JSON.stringify({ rows, flows }, null, 1)}\n`);
console.log(JSON.stringify({ rows, flows }));
