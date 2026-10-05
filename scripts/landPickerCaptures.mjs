// LAND-UI (LU-D7) evidence: the title's land picker at three desktop viewports and the 1024 minimum — where the
// emblem, the parchment, the land buttons, the map number field and the mode buttons sit, what element the viewport's
// centre point hits (the scripts and gates click the dismiss layer's centre: it must stay the keyart / layer, never a
// control), and a JPEG of the title at 1280×800 (then the fen on a typed number, then a riverside number with no game)
// and 1180×820; then the starts (see below). NAT-4: the number is a kit NumberField (1–999,999) with "무작위"; without a
// query the welcome opens on a random number, under the proof query on map 1.
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
for (const [width, height, long] of [[1280, 800], [1920, 1080], [1180, 820], [1024, 768], [1280, 800, true], [1920, 1080, true], [1180, 820, true], [1024, 768, true]]) {
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
      field: rect(".welcome-seed-field"), random: rect(".welcome-seed-random"), value: document.querySelector(".welcome-seed-field")?.value ?? null,
      fieldSkin: getComputedStyle(document.querySelector(".welcome-seed-field") ?? document.body).borderImageSource.includes("/assets/ui-p0/"),
      fieldFontPx: Number.parseFloat(getComputedStyle(document.querySelector(".welcome-seed-field") ?? document.body).fontSize),
      modes: all(".welcome-parchment [data-scenario]"),
      centre: centre === null ? null : { tag: centre.tagName, className: String(centre.className), inButton: centre.closest("button") !== null },
      landPreviews: [...document.querySelectorAll(".welcome-land canvas")].filter(canvas => canvas.width > 0).length,
    };
  });
  const seen = await measure();
  rows.push({ viewport: [width, height], pseudoLong: long === true, emblem: box(seen.emblem), parchment: box(seen.parchment), lands: seen.lands.map(box), seed: box(seen.seed),
    field: box(seen.field), random: box(seen.random), value: seen.value, fieldSkin: seen.fieldSkin, fieldFontPx: seen.fieldFontPx,
    modes: seen.modes.map(box), centre: seen.centre, landPreviews: seen.landPreviews,
    centreAboveLandsPx: seen.lands.length === 0 ? null : Math.round(Math.min(...seen.lands.map(rect => rect.top)) - height / 2),
    parchmentInside: seen.parchment !== null && seen.parchment.top >= 0 && seen.parchment.bottom <= height && seen.parchment.left >= 0 && seen.parchment.right <= width });
  if (shots && !long && (width === 1280 || width === 1180)) {
    await writeFile(join(outDir, `title-${width}x${height}.jpg`), await page.screenshot({ type: "jpeg", quality: 62 }));
  }
  if (shots && !long && width === 1280 && seen.lands.length > 1) {
    const after = () => page.evaluate(() => ({
      pressed: [...document.querySelectorAll(".welcome-land")].map(button => button.getAttribute("aria-pressed")),
      value: document.querySelector(".welcome-seed-field")?.value ?? null,
      invalid: document.querySelector(".welcome-seed-field")?.getAttribute("aria-invalid") ?? null,
      problem: document.querySelector(".welcome-seed-problem")?.textContent ?? null,
      modesDisabled: [...document.querySelectorAll(".welcome-parchment [data-scenario]")].map(button => button.getAttribute("aria-disabled")),
      previews: [...document.querySelectorAll(".welcome-land canvas")].filter(canvas => canvas.width > 0).length,
      welcome: document.querySelector(".welcome-parchment") !== null,
    }));
    await page.locator(".welcome-land").nth(4).click();
    await page.locator(".welcome-seed-field").fill("482913");
    await page.waitForTimeout(900); // the previews follow the number 300 ms after typing stops
    await writeFile(join(outDir, `title-${width}x${height}-fen-482913.jpg`), await page.screenshot({ type: "jpeg", quality: 62 }));
    rows.at(-1).afterPick = await after();
    await page.locator(".welcome-land").nth(0).click();
    await page.locator(".welcome-seed-field").fill("118");
    await page.waitForTimeout(900);
    await writeFile(join(outDir, `title-${width}x${height}-riverside-118.jpg`), await page.screenshot({ type: "jpeg", quality: 62 }));
    rows.at(-1).unbuildable = await after();
  }
  await context.close();
}
// The starts (1280×800, the proof port reads the state; the proof query opens on map 1): a mode button on the default
// is today's game; 무작위 then a click on the layer's centre starts the riverside on the drawn number; typing into the
// field (letters dropped, the keys stay in it) never dismisses; a pick and a typed number then the centre start that
// land and number; a riverside number with no game, or an empty field, refuses both the mode buttons and the centre;
// over a save, 새 게임 shows the picker too (measured and captured) and its mode button starts the picked land and number.
const flows = {};
{
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  await page.routeWebSocket("**", socket => socket.close());
  const ready = () => page.waitForFunction(() => window.__FEUDAL_PHASE10_PROOF__ !== undefined, null, { timeout: 60_000 });
  const land = () => page.evaluate(() => { const state = window.__FEUDAL_PHASE10_PROOF__.state(); return { archetypeId: state.archetypeId ?? null, seed: state.seed, scenarioId: state.scenarioId, tick: state.tick }; });
  const fresh = async (query = "") => { await context.clearCookies(); await page.evaluate(() => localStorage.clear()).catch(() => undefined);
    await page.goto(`${url}?phase10-proof=1${query}`); await ready(); };
  const value = () => page.locator(".welcome-seed-field").inputValue();
  const centre = () => page.mouse.click(640, 400);
  await fresh();
  // LU-D8 still holds with only the switch taking the pointer (NAT-4): a press on it toggles and keeps the welcome.
  const switchBefore = await page.locator(".welcome-parchment .tutorial-switch").getAttribute("aria-checked");
  await page.locator(".welcome-parchment .tutorial-switch").click();
  flows.tutorialSwitch = { before: switchBefore, after: await page.locator(".welcome-parchment .tutorial-switch").getAttribute("aria-checked"),
    welcome: await page.locator(".welcome-parchment").count() === 1 };
  await page.locator(".welcome-parchment .tutorial-switch").click();
  flows.proofDefaultValue = await value();
  await page.locator(".welcome-parchment [data-scenario='core:campaign_market_town']").click(); await page.waitForTimeout(800);
  flows.defaultModeButton = await land();
  await fresh();
  await page.locator(".welcome-seed-random").click();
  flows.drawn = await value();
  flows.drawnKeepsWelcome = await page.locator(".welcome-parchment").count() === 1;
  await centre(); await page.waitForTimeout(800);
  flows.drawnThenCentre = await land();
  await fresh();
  await page.locator(".welcome-seed-field").click(); await page.keyboard.press("Control+A"); await page.keyboard.type("12a3wd");
  flows.typedValue = await value();
  flows.typingKeepsWelcome = await page.locator(".welcome-parchment").count() === 1;
  await page.locator(".welcome-land").nth(4).click(); await page.locator(".welcome-seed-field").fill("482913");
  await centre(); await page.waitForTimeout(800);
  flows.pickThenDismiss = await land();
  await fresh();
  await page.locator(".welcome-seed-field").fill("118");
  // aria-disabled: Playwright waits for an enabled element, so the refused press is forced (it still reaches the button).
  await page.locator(".welcome-parchment [data-scenario='core:campaign_market_town']").click({ force: true }); await centre(); await page.waitForTimeout(500);
  flows.unbuildableRefused = { welcome: await page.locator(".welcome-parchment").count() === 1, problem: await page.locator(".welcome-seed-problem").textContent() };
  await page.locator(".welcome-seed-field").fill("");
  await centre(); await page.waitForTimeout(300);
  flows.emptyRefused = { welcome: await page.locator(".welcome-parchment").count() === 1, problem: await page.locator(".welcome-seed-problem").textContent() };
  await page.locator(".welcome-seed-field").fill("1");
  await centre(); await page.waitForTimeout(800);
  flows.mapOneCentre = await land();
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
  await page.locator(".welcome-seed-field").fill("3");
  await page.getByRole("button", { name: "목표형으로 시작", exact: true }).click(); await page.waitForTimeout(1_500);
  flows.overSavePick = await land();
  await context.close();
}
// NAT-4: the kit gallery's number fields (/dev/ui-kit): their art, size and text, and a JPEG of the row.
const gallery = {};
{
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  await page.goto(`${url}dev/ui-kit`);
  const row = page.locator('[data-states="number"]');
  await row.waitFor({ timeout: 60_000 }); await row.scrollIntoViewIfNeeded(); await page.waitForTimeout(500);
  gallery.fields = await row.evaluate(element => [...element.querySelectorAll("input")].map(input => {
    const style = getComputedStyle(input); const box = input.getBoundingClientRect();
    return { value: input.value, skin: style.borderImageSource.includes("/assets/ui-p0/"), width: Math.round(box.width), height: Math.round(box.height),
      fontPx: Number.parseFloat(style.fontSize), invalid: input.getAttribute("aria-invalid"), disabled: input.disabled };
  }));
  await page.locator('[data-states="number"] input').first().fill("12a34");
  gallery.typed = await page.locator('[data-states="number"] input').first().inputValue();
  if (shots) await writeFile(join(outDir, "gallery-number.jpg"), await row.screenshot({ type: "jpeg", quality: 70 }));
  await context.close();
}
await browser.close();
await writeFile(join(outDir, "layout.json"), `${JSON.stringify({ rows, flows, gallery }, null, 1)}\n`);
console.log(JSON.stringify({ rows, flows, gallery }));
