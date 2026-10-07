// INSTALL-18 (Wave 18 HUD) evidence, JPEG, and one JSON of what each capture showed (states: scripts/in18HudStates.ts).
//   PLAYWRIGHT_MODULE=... node scripts/in18HudCaptures.mjs <out-dir> --url <url> --states <dir>
//  hud: the status pill, the layer switch and the action dock — sandbox and lord mode (명령) — with the pictures and with
//    every Wave 18 request refused (the current look must stay), each HUD box measured both ways (same box = no growth);
//  placement: each blocked reason's scene (colour and grey), the overlap scene at zoom 0.6 / 1.0 / 1.4, the service
//    edge of a well's range at 0.6 / 1.0 / 1.4; zone: the toolbar with the brush at sizes 1 / 2 / 3, the eraser, grey;
//  crisis: the two three-crisis states (colour, grey, refused); tablet: the confirm bar (1180 × 820, touch);
//  pause: the menu's "H: HUD 숨기기" line; pulse: the ring's three frames (animation held at 0 / 240 / 480 ms) and the
//    reduced-motion still frame.
import { refuseHeavyOnMac } from "./remote/localGuard.mjs";
refuseHeavyOnMac("브라우저 캡처(scripts/in18HudCaptures.mjs)", { remote: "scripts/remote/run.sh render-IN18-hud-<what>-<sha7> -- bash scripts/in18HudCaptures.sh …", entry: import.meta.url });
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadChromium, openScene } from "./renderCommitProbe.mjs";

const [out] = process.argv.slice(2);
const flag = name => { const index = process.argv.indexOf(`--${name}`); return index > 0 ? process.argv[index + 1] : undefined; };
const url = flag("url") ?? "http://127.0.0.1:4281/";
const statesDir = flag("states");
if (out === undefined || statesDir === undefined) throw new Error("usage: node scripts/in18HudCaptures.mjs <out> --url <url> --states <dir>");
mkdirSync(out, { recursive: true });
const TUTORIAL_OFF = `try { localStorage.setItem('feudal-lord-simulator:tutorial:v1', JSON.stringify({ enabled: false, acks: [], pulsed: [], log: [] })); } catch (error) { void error; }`;
const GREY = "html{filter:grayscale(1)!important}";
const state = name => readFileSync(join(statesDir, name), "utf8");
const { scenes } = JSON.parse(state("scenes.json"));
const chromium = await loadChromium();
const browser = await chromium.launch({ channel: "chrome", headless: true });
const result = { url, errors: [], shots: [] };

async function open(options) {
  const { context, page } = await openScene(browser, { baseUrl: url, width: 1280, height: 800, run: false, initScript: TUTORIAL_OFF, ...options,
    state: options.state ?? null, tile: options.tile ?? [45, 41] });
  page.on("pageerror", error => result.errors.push(String(error)));
  if (options.refuse === true) await page.route("**/assets/wave18/**", route => route.abort());
  return { context, page };
}
/** Waits until every Wave 18 picture the page asked for has settled (loaded or refused). */
const settle = page => page.waitForFunction(() => {
  const asked = performance.getEntriesByType("resource").filter(entry => entry.name.includes("/assets/wave18/"));
  return asked.every(entry => entry.responseEnd > 0);
}, null, { timeout: 15_000 }).catch(() => undefined).then(() => page.waitForTimeout(400));
async function shot(page, file, clip, { grey = false } = {}) {
  const style = grey ? await page.addStyleTag({ content: GREY }) : null;
  if (style !== null) await page.waitForTimeout(150);
  const options = { type: "jpeg", quality: 78, ...(clip ? { clip: { x: Math.max(0, Math.round(clip.x)), y: Math.max(0, Math.round(clip.y)), width: Math.round(clip.width), height: Math.round(clip.height) } } : {}) };
  writeFileSync(join(out, file), await page.screenshot(options));
  if (style !== null) await style.evaluate(element => element.remove());
  result.shots.push(file);
}
const at = (page, tx, ty) => page.evaluate(t => { const p = window.__FEUDAL_PHASE10_PROOF__.tileClientPoint(t); return { x: p.clientX, y: p.clientY }; }, { tx, ty });
const box = async (page, selector) => page.locator(selector).first().boundingBox();
/** The HUD boxes the area budget counts, and which pictures are showing. */
const hudBoxes = page => page.evaluate(() => {
  const rect = element => { const r = element.getBoundingClientRect(); return [Math.round(r.x * 10) / 10, Math.round(r.y * 10) / 10, Math.round(r.width * 10) / 10, Math.round(r.height * 10) / 10]; };
  const all = selector => [...document.querySelectorAll(selector)].map(rect);
  return { pill: all(".status-pill"), pillCells: all(".status-pill-cell"), dock: all(".action-dock"), dockButtons: all(".action-dock-button"),
    layerSwitch: all(".layer-switch"), layers: all(".control-layer"), crisis: all(".crisis-icons"), crisisButtons: all(".crisis-icon"),
    zoneToolbar: all(".zone-toolbar"), zoneButtons: all(".zone-toolbar-button"), confirm: all(".placement-confirm-bar"),
    art: [...document.querySelectorAll("[data-art]")].map(element => element.getAttribute("data-art")) };
});
const same = (a, b) => JSON.stringify({ ...a, art: [] }) === JSON.stringify({ ...b, art: [] });
const pickTool = async (page, category, name) => {
  await page.locator("[data-dock='build']").click(); await page.waitForTimeout(250);
  await page.locator(`button.build-menu-category[data-category='${category}']`).first().click(); await page.waitForTimeout(250);
  await page.locator(`button[aria-label="${name}"]:visible`).first().click(); await page.waitForTimeout(250);
};

// HUD: sandbox (new game) and lord mode, with the pictures and refused.
for (const [label, stateFile] of [["sandbox", null], ["lord", "lord.json"]]) {
  const boxes = {};
  for (const refuse of [false, true]) {
    const { context, page } = await open({ state: stateFile === null ? null : state(stateFile), refuse });
    await settle(page);
    boxes[refuse ? "refused" : "art"] = await hudBoxes(page);
    const suffix = refuse ? "-refused" : "";
    await shot(page, `hud-${label}-1280${suffix}.jpg`);
    if (!refuse) {
      await shot(page, `hud-${label}-pill.jpg`, await box(page, ".status-pill"));
      const dock = await box(page, ".action-dock");
      await shot(page, `hud-${label}-dock.jpg`, { x: dock.x - 8, y: dock.y - 8, width: dock.width + 16, height: dock.height + 16 });
      await shot(page, `hud-${label}-dock-grey.jpg`, { x: dock.x - 8, y: dock.y - 8, width: dock.width + 16, height: dock.height + 16 }, { grey: true });
    }
    await context.close();
  }
  result[`hud-${label}`] = { ...boxes, sameBoxes: same(boxes.art, boxes.refused) };
}

// Placement: each blocked reason's scene (one capture per fixture / kind / tile).
const done = new Map();
for (const scene of scenes) {
  const key = `${scene.fixture}|${scene.kind}|${scene.tile.tx},${scene.tile.ty}`;
  if (done.has(key)) { done.get(key).reasons.push(scene.reason); continue; }
  const row = { ...scene, reasons: [scene.reason], shots: [] }; done.set(key, row);
  const zooms = scene.reason === "building" ? [0.6, 1, 1.4] : [1];
  for (const zoom of zooms) {
    const { context, page } = await open({ state: state(`${scene.fixture}.save.json`), tile: [scene.tile.tx, scene.tile.ty], zoom });
    await pickTool(page, scene.category, scene.name);
    const p = await at(page, scene.tile.tx, scene.tile.ty);
    await page.mouse.move(p.x, p.y); await page.waitForTimeout(600); await settle(page);
    const clip = { x: p.x - 230, y: p.y - 160, width: 520, height: 300 };
    const base = `placement-${scene.reason}-z${String(zoom).replace(".", "")}`;
    await shot(page, `${base}.jpg`, clip); await shot(page, `${base}-grey.jpg`, clip, { grey: true });
    row.shots.push(`${base}.jpg`, `${base}-grey.jpg`);
    if (zoom === 1) row.chip = await page.evaluate(() => ({ text: document.querySelector(".placement-chip-reason")?.textContent ?? null,
      art: document.querySelector(".placement-chip-reason [data-art]")?.getAttribute("data-art") ?? null }));
    await context.close();
  }
}
result.placement = [...done.values()];

// The service edge: a well's range in the new game, at three zooms.
result.edge = [];
for (const zoom of [0.6, 1, 1.4]) {
  const { context, page } = await open({ tile: [40, 44], zoom });
  await pickTool(page, "living", "우물");
  const p = await at(page, 40, 44);
  await page.mouse.move(p.x, p.y); await page.waitForTimeout(600); await settle(page);
  const file = `edge-well-z${String(zoom).replace(".", "")}.jpg`;
  await shot(page, file, { x: p.x - 320, y: p.y - 220, width: 640, height: 440 });
  await shot(page, file.replace(".jpg", "-grey.jpg"), { x: p.x - 320, y: p.y - 220, width: 640, height: 440 }, { grey: true });
  result.edge.push(file);
  await context.close();
}

// Zone toolbar: brush (sizes 1 / 2 / 3), the eraser; colour and grey; the boxes with and without pictures.
{
  const boxes = {};
  for (const refuse of [false, true]) {
    const { context, page } = await open({ refuse });
    await page.locator(".layer-switch [data-layer='zone']").first().click(); await page.waitForTimeout(300);
    await page.locator(".zone-toolbar [data-zone-tool='burgage']").first().click(); await page.waitForTimeout(300); await settle(page);
    boxes[refuse ? "refused" : "art"] = await hudBoxes(page);
    const bar = await box(page, ".zone-toolbar");
    const clip = { x: bar.x, y: bar.y, width: bar.width + 4, height: bar.height };
    if (refuse) { await shot(page, "zone-size1-refused.jpg", clip); await context.close(); continue; }
    for (const size of [1, 2, 3]) {
      await shot(page, `zone-size${size}.jpg`, clip);
      if (size === 1) await shot(page, "zone-size1-grey.jpg", clip, { grey: true });
      await page.locator(".zone-toolbar [data-zone-mode='size']").click(); await page.waitForTimeout(250);
    }
    await page.locator(".zone-toolbar [data-zone-mode='erase']").click(); await page.waitForTimeout(250);
    await shot(page, "zone-erase.jpg", clip);
    await context.close();
  }
  result.zone = { ...boxes, sameBoxes: same(boxes.art, boxes.refused) };
}

// Crisis icons: two states of three crises each (colour, grey, refused).
for (const name of ["crisis-a", "crisis-b"]) {
  const boxes = {};
  for (const refuse of [false, true]) {
    const { context, page } = await open({ state: state(`${name}.json`), refuse });
    await settle(page);
    boxes[refuse ? "refused" : "art"] = await hudBoxes(page);
    const icons = await box(page, ".crisis-icons");
    const clip = { x: icons.x - 8, y: icons.y - 8, width: icons.width + 16, height: icons.height + 16 };
    await shot(page, `${name}${refuse ? "-refused" : ""}.jpg`, clip);
    if (!refuse) { await shot(page, `${name}-grey.jpg`, clip, { grey: true }); await shot(page, `${name}-1280.jpg`); }
    await context.close();
  }
  result[name] = { ...boxes, sameBoxes: same(boxes.art, boxes.refused) };
}

// Tablet confirm bar (touch).
{
  const { context, page } = await open({ width: 1180, height: 820, hasTouch: true });
  const cdp = await context.newCDPSession(page);
  const tap = async p => { await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: p.x, y: p.y, id: 0 }] }); await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); await page.waitForTimeout(400); };
  const press = async locator => { const b = await locator.boundingBox(); await tap({ x: b.x + b.width / 2, y: b.y + b.height / 2 }); };
  await press(page.locator("[data-dock='build']"));
  await press(page.locator("button.build-menu-category[data-category='living']"));
  await press(page.locator('button[aria-label="우물"]:visible').first());
  const target = await at(page, 40, 44);
  await tap({ x: target.x, y: target.y + 80 }); await settle(page);
  const bar = await box(page, ".placement-confirm-bar");
  result.tablet = { bar: bar !== null, boxes: await hudBoxes(page) };
  if (bar !== null) {
    await shot(page, "tablet-confirm-bar.jpg", { x: bar.x - 12, y: bar.y - 12, width: bar.width + 24, height: bar.height + 24 });
    await shot(page, "tablet-confirm-bar-grey.jpg", { x: bar.x - 12, y: bar.y - 12, width: bar.width + 24, height: bar.height + 24 }, { grey: true });
  }
  await shot(page, "tablet-1180.jpg");
  await context.close();
}

// Pause menu: the H line.
{
  const { context, page } = await open({});
  await page.keyboard.press("Escape"); await page.waitForTimeout(300);
  const menu = await box(page, ".pause-menu");
  result.pause = { line: await page.evaluate(() => document.querySelector(".pause-menu-shortcut")?.textContent ?? null) };
  if (menu !== null) await shot(page, "pause-menu-h-line.jpg", menu);
  await context.close();
}

// Pulse ring: three frames held, and the reduced-motion still.
for (const motion of ["no-preference", "reduce"]) {
  const { context, page } = await open({});
  await page.emulateMedia({ reducedMotion: motion }); await settle(page);
  const ready = await page.evaluate(() => document.documentElement.dataset.hudPulseRing ?? null);
  await page.evaluate(() => { document.querySelector(".layer-switch [data-layer='zone']")?.setAttribute("data-pulse", "capture#1"); });
  const target = await box(page, ".layer-switch [data-layer='zone']");
  const clip = { x: target.x + target.width / 2 - 70, y: target.y + target.height / 2 - 70, width: 140, height: 140 };
  const times = motion === "reduce" ? [300] : [0, 240, 480];
  for (const time of times) {
    await page.evaluate(ms => { for (const animation of document.getAnimations()) { animation.pause(); animation.currentTime = ms; } }, time);
    await page.waitForTimeout(120);
    await shot(page, `pulse-${motion === "reduce" ? "reduced" : "frame"}-${time}.jpg`, clip);
  }
  result[`pulse-${motion}`] = { ready, animations: await page.evaluate(() => document.getAnimations().map(animation => animation.animationName ?? null)) };
  await context.close();
}

await browser.close();
writeFileSync(join(out, "captures.json"), JSON.stringify(result, null, 1) + "\n");
console.log(JSON.stringify({ shots: result.shots.length, errors: result.errors.length, placement: result.placement.map(row => [row.reasons, row.chip]),
  same: { sandbox: result["hud-sandbox"].sameBoxes, lord: result["hud-lord"].sameBoxes, zone: result.zone.sameBoxes, a: result["crisis-a"].sameBoxes, b: result["crisis-b"].sameBoxes } }, null, 1));
