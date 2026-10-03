// LM-R1 buttons: the Wave 38 capture gate (docs/ops/install-plan-20261003/SPECS/wave38.md "캡처 관문") on the kit gallery
// (/dev/ui-kit, inside .app-shell: the game's skin, type and touch floor) and the game's first screens.
//  - primary / secondary / danger / icon / close: normal → hover → pressed → disabled, and the keyboard focus ring;
//  - checkbox, radio, toggle, select closed and open, slider at its min and max, number field normal / focused, chips,
//    tabs (unselected · hover · selected), the scrollbar on a long list; the long Korean labels;
//  - at 1280 × 800 and 1024 × 768, DPR 1 and 2, and the tablet (1180 × 820 touch, DPR 2);
//  - per button: its box (the hit target), its border-image picture per state, its text colour and the label's inset
//    from the button's edges (text_safe); the tabs' centre brightness is read from the clips by scripts/lmr1ButtonSheets.py;
//  - the P0 fallback: one Wave 38 picture refused (route abort) → `data-ui-art="p0"`, P0 pictures, how often it was asked for;
//  - the game: the welcome screen (primary mode buttons) and the build drawer (the primary cards), and where seal_slot.png
//    is drawn (computed backgrounds of .build-seal / .speed-seal).
// Raw PNG clips go to <raw-dir> (composed into small JPEG sheets on the Mac); the numbers to <json>.
//   node scripts/lmr1ButtonCaptures.mjs <url> <raw-dir> <json> [--label after|before] [--only gallery]
import { refuseHeavyOnMac } from "./remote/localGuard.mjs";
refuseHeavyOnMac("브라우저 캡처(scripts/lmr1ButtonCaptures.mjs)", { remote: "scripts/remote/run.sh render-LMR1-buttons-<sha7> -- bash scripts/lmr1ButtonCaptures.sh …", entry: import.meta.url });
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadChromium } from "./renderCommitProbe.mjs";

const [url, rawDir, jsonOut] = process.argv.slice(2);
const flag = name => { const index = process.argv.indexOf(`--${name}`); return index > 0 ? process.argv[index + 1] : undefined; };
const label = flag("label") ?? "after";
const only = flag("only");
const VIEWS = [
  { name: "1280-dpr1", width: 1280, height: 800, dpr: 1 },
  { name: "1280-dpr2", width: 1280, height: 800, dpr: 2 },
  { name: "1024-dpr1", width: 1024, height: 768, dpr: 1 },
  { name: "1024-dpr2", width: 1024, height: 768, dpr: 2 },
  { name: "tablet", width: 1180, height: 820, dpr: 2, touch: true },
];
const TUTORIAL_OFF = `try { localStorage.setItem('feudal-lord-simulator:tutorial:v1', JSON.stringify({ enabled: false, acks: [], pulsed: [], log: [] })); } catch (error) { void error; }`;
const chromium = await loadChromium();
const browser = await chromium.launch({ channel: "chrome", headless: true });
const result = { label, url, errors: [], views: {}, fallback: null, game: null };
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

/** In the page: a button's box, picture, colour and its label's inset from each edge (null without a text node). */
function measureButton(element) {
  const style = getComputedStyle(element); const before = getComputedStyle(element, "::before");
  const box = element.getBoundingClientRect();
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, { acceptNode: node => node.textContent.trim() === "" ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
  const range = document.createRange(); let text = null;
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    if (getComputedStyle(node.parentElement).visibility === "hidden") continue;
    range.selectNodeContents(node); const r = range.getBoundingClientRect();
    text = text === null ? { l: r.left, t: r.top, r: r.right, b: r.bottom } : { l: Math.min(text.l, r.left), t: Math.min(text.t, r.top), r: Math.max(text.r, r.right), b: Math.max(text.b, r.bottom) };
  }
  const picture = value => (value.match(/\/assets\/([^")]+)/) ?? [null, value])[1];
  return { w: Math.round(box.width * 10) / 10, h: Math.round(box.height * 10) / 10, art: picture(style.borderImageSource), face: picture(before.borderImageSource),
    background: picture(style.backgroundImage), color: style.color, outline: style.outlineStyle === "none" ? null : `${style.outlineWidth} ${style.outlineStyle} ${style.outlineColor}`,
    inset: text === null ? null : { left: Math.round(text.l - box.left), top: Math.round(text.t - box.top), right: Math.round(box.right - text.r), bottom: Math.round(box.bottom - text.b) } };
}

async function gallery(view) {
  const context = await browser.newContext({ viewport: { width: view.width, height: view.height }, deviceScaleFactor: view.dpr, hasTouch: view.touch === true });
  const page = await context.newPage();
  page.on("pageerror", error => result.errors.push(`${view.name}: ${String(error)}`));
  await page.goto(`${url}dev/ui-kit`);
  await page.locator('[data-testid="ui-kit-gallery"]').waitFor();
  await page.evaluate(() => document.fonts.ready);
  await pause(1200);
  await page.evaluate(`window.__lmr1Measure = ${measureButton.toString()}`);
  const record = { fallback: await page.evaluate(() => document.documentElement.getAttribute("data-ui-art")), buttons: {}, controls: {} };
  const dir = join(rawDir, label, view.name); mkdirSync(dir, { recursive: true });
  const shot = async (locator, name, pad = 12) => {
    await locator.scrollIntoViewIfNeeded();
    const box = await locator.boundingBox(); if (box === null) return;
    await page.screenshot({ path: join(dir, `${name}.png`), clip: { x: Math.max(0, box.x - pad), y: Math.max(0, box.y - pad), width: box.width + pad * 2, height: box.height + pad * 2 } });
  };
  const away = async () => { await page.mouse.move(2, 2); await pause(80); };
  // One part failing (the trunk's gallery has no radio, close or long-label rows) leaves the others.
  const step = async (name, fn) => { try { await fn(); } catch (error) { result.errors.push(`${view.name} ${name}: ${String(error).split("\n")[0].slice(0, 200)}`); } };
  const controls = page.locator('[data-section="controls"]');
  const families = { primary: '[data-states="primary"]', secondary: '[data-states="secondary"]', danger: '[data-states="danger"]', close: '[data-states="close"]',
    icon: '[data-section="buttons"] .ui-kit-gallery-row:has(> .ui-btn--icon)' };
  for (const [family, selector] of Object.entries(families)) await step(family, async () => {
    const row = page.locator(selector).first();
    const buttons = row.locator(".ui-btn");
    const target = buttons.first(); const disabled = row.locator(".ui-btn:disabled").first();
    const states = {};
    await away(); await target.scrollIntoViewIfNeeded();
    states.normal = await target.evaluate(measureButton); await shot(row, `${family}-1-normal`);
    if (view.touch !== true) {
      const box = await target.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await pause(120);
      states.hover = await target.evaluate(measureButton); await shot(row, `${family}-2-hover`);
      await page.mouse.down(); await pause(120);
      states.pressed = await target.evaluate(measureButton); await shot(row, `${family}-3-pressed`);
      await page.mouse.up(); await away();
    }
    if (await disabled.count()) states.disabled = await disabled.evaluate(measureButton);
    await page.keyboard.press("Shift"); await target.evaluate(element => element.focus()); await pause(120);
    states.focus = await target.evaluate(measureButton); await shot(row, `${family}-4-focus`);
    await target.evaluate(element => element.blur());
    record.buttons[family] = states;
  });
  await step("long", async () => {
  const long = page.locator('[data-states="long"]');
  record.buttons.long = await long.locator(".ui-btn").evaluateAll(elements => elements.map(element => ({ text: element.textContent, ...window.__lmr1Measure(element) })));
  await shot(long, "long-labels");
  });
  await step("tabs", async () => {
  // Tabs: unselected, hover over an unselected one, selected (aria-selected) — the sheet reads their centre brightness.
  const tabs = page.locator('[role="tablist"].ui-tabs').first();
  const unselected = tabs.locator('[aria-selected="false"]').first();
  await away(); await shot(tabs, "tabs-1-normal");
  record.controls.tabs = { selected: await tabs.locator('[aria-selected="true"]').evaluate(measureButton), unselected: await unselected.evaluate(measureButton) };
  if (view.touch !== true) {
    const box = await unselected.boundingBox(); await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await pause(120);
    record.controls.tabs.hover = await unselected.evaluate(measureButton); await shot(tabs, "tabs-2-hover"); await away();
  }
  });
  await step("choices", async () => {
  // Toggles, checkboxes, radio, chips, number field.
  const toggleRow = controls.locator(".ui-kit-gallery-row:has(.ui-toggle)").first();
  await shot(toggleRow, "choices");
  record.controls.toggle = await toggleRow.locator(".ui-toggle-track").evaluateAll(elements => elements.map(element => ({ w: element.getBoundingClientRect().width, h: element.getBoundingClientRect().height, background: getComputedStyle(element).backgroundImage.replace(/.*\/assets\//, "").replace(/"\)$/, "") })));
  record.controls.checkbox = await toggleRow.locator(".ui-checkbox-box").evaluateAll(elements => elements.map(element => ({ w: element.getBoundingClientRect().width, background: getComputedStyle(element).backgroundImage.replace(/.*\/assets\//, "").replace(/"\)$/, "") })));
  const radio = controls.locator('[data-states="radio"]');
  await shot(radio, "radio");
  record.controls.radio = await radio.locator(".ui-radio").evaluateAll(elements => elements.map(element => ({ checked: element.getAttribute("aria-checked"), h: element.getBoundingClientRect().height,
    background: getComputedStyle(element.querySelector(".ui-radio-box")).backgroundImage.replace(/.*\/assets\//, "").replace(/"\)$/, "") })));
  const chips = controls.locator(".ui-kit-gallery-row:has(.ui-chip)").first();
  await shot(chips, "chips");
  const number = controls.locator('[data-states="number"]');
  await shot(number, "number-1-normal");
  await number.locator(".ui-number").first().click(); await pause(120); await shot(number, "number-2-focus");
  record.controls.number = await number.locator(".ui-number").first().evaluate(element => ({ h: element.getBoundingClientRect().height, art: getComputedStyle(element).borderImageSource.replace(/.*\/assets\//, "").replace(/"\)$/, "") }));
  await page.keyboard.press("Escape"); await page.locator(".ui-kit-gallery-head").click();
  });
  await step("select", async () => {
  // Select: closed, then open (the list over the next rows).
  const selectRow = controls.locator(".ui-kit-gallery-row--select");
  await away(); await shot(selectRow, "select-1-closed");
  const trigger = selectRow.locator(".ui-select-trigger").first();
  record.controls.select = { closed: await trigger.evaluate(element => ({ ...window.__lmr1Measure(element), faceH: parseFloat(getComputedStyle(element, "::before").height) })) };
  await trigger.click(); await pause(200);
  await page.keyboard.press("ArrowDown"); await pause(120);
  const list = selectRow.locator(".ui-select-list");
  const listBox = await list.boundingBox(); const rowBox = await selectRow.boundingBox();
  if (listBox !== null && rowBox !== null) {
    await page.screenshot({ path: join(dir, "select-2-open.png"), clip: { x: rowBox.x - 12, y: rowBox.y - 12, width: Math.max(rowBox.width, listBox.x + listBox.width - rowBox.x) + 24, height: listBox.y + listBox.height - rowBox.y + 24 } });
  }
  record.controls.select.list = await list.evaluate(element => ({ art: getComputedStyle(element).borderImageSource.replace(/.*\/assets\//, "").replace(/"\)$/, ""),
    active: getComputedStyle(element.querySelector(".ui-select-option--active")).borderImageSource.replace(/.*\/assets\//, "").replace(/"\)$/, ""),
    rowH: element.querySelector(".ui-select-option").getBoundingClientRect().height })).catch(() => null);
  await page.keyboard.press("Escape"); await pause(120);
  });
  await step("slider", async () => {
  // Slider at its minimum and maximum (keys on the focused range).
  const sliderRow = controls.locator(".ui-kit-gallery-row:has(.ui-slider)").first();
  const slider = sliderRow.locator(".ui-slider").first();
  await slider.focus(); await page.keyboard.press("Home"); await pause(120); await shot(sliderRow, "slider-1-min");
  await page.keyboard.press("End"); await pause(120); await shot(sliderRow, "slider-2-max");
  await slider.evaluate(element => element.blur());
  });
  await step("scroll", async () => {
  // The scrollbar on the long list, scrolled to its middle.
  const scroll = page.locator('[data-states="scroll"]');
  await scroll.scrollIntoViewIfNeeded(); await scroll.evaluate(element => { element.scrollTop = (element.scrollHeight - element.clientHeight) / 2; }); await pause(150);
  await shot(scroll, "scrollbar");
  record.controls.scroll = await scroll.evaluate(element => ({ clientWidth: element.clientWidth, offsetWidth: element.offsetWidth, scrollHeight: element.scrollHeight, clientHeight: element.clientHeight }));
  });
  await page.locator(".ui-kit-gallery-head").scrollIntoViewIfNeeded();
  await page.screenshot({ path: join(dir, "page-top.png") });
  result.views[view.name] = record;
  await context.close();
}

async function fallback() {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  let asked = 0;
  await page.route("**/assets/wave38/tab_hover.png", route => { asked += 1; return route.abort(); });
  await page.goto(`${url}dev/ui-kit`);
  await page.locator('[data-testid="ui-kit-gallery"]').waitFor(); await pause(2500);
  const attribute = await page.evaluate(() => document.documentElement.getAttribute("data-ui-art"));
  const primary = await page.locator('[data-states="primary"] .ui-btn').first().evaluate(element => getComputedStyle(element).borderImageSource.replace(/.*\/assets\//, "").replace(/"\)$/, ""));
  const section = page.locator('[data-section="buttons"]');
  const dir = join(rawDir, label, "fallback"); mkdirSync(dir, { recursive: true });
  await section.screenshot({ path: join(dir, "buttons-p0.png") });
  await page.locator('[data-section="controls"]').screenshot({ path: join(dir, "controls-p0.png") });
  await pause(1500);
  result.fallback = { attribute, primary, askedTabHover: asked };
  await context.close();
}

async function game() {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await context.addInitScript(TUTORIAL_OFF);
  const page = await context.newPage();
  page.on("pageerror", error => result.errors.push(`game: ${String(error)}`));
  await page.goto(url); await page.waitForTimeout(4000);
  const dir = join(rawDir, label, "game"); mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: join(dir, "welcome.png") });
  const welcome = await page.locator(".welcome-modes .ui-btn").evaluateAll(elements => elements.map(element => ({ text: element.textContent, color: getComputedStyle(element).color,
    art: getComputedStyle(element).borderImageSource.replace(/.*\/assets\//, "").replace(/"\)$/, ""), h: element.getBoundingClientRect().height }))).catch(() => []);
  if (await page.locator(".welcome-dismiss-layer").count()) await page.locator(".welcome-dismiss-layer").click();
  await page.keyboard.press("Escape"); await page.waitForTimeout(800);
  if (await page.locator(".pause-menu").count()) await page.keyboard.press("Escape");
  const category = page.locator(".build-menu-category:not([aria-disabled=\"true\"])").first();
  if (await category.count()) { await category.click(); await page.waitForTimeout(800); }
  await page.mouse.move(640, 300); await page.waitForTimeout(300);
  await page.screenshot({ path: join(dir, "build-drawer.png"), clip: { x: 0, y: 520, width: 1280, height: 280 } });
  const cards = await page.locator(".build-menu .build-tool").evaluateAll(elements => elements.slice(0, 6).map(element => ({ text: element.textContent, color: getComputedStyle(element).color,
    label: element.querySelector(".build-seal-label") === null ? null : getComputedStyle(element.querySelector(".build-seal-label")).color,
    art: getComputedStyle(element).borderImageSource.replace(/.*\/assets\//, "").replace(/"\)$/, ""), background: getComputedStyle(element).backgroundImage, w: element.getBoundingClientRect().width, h: element.getBoundingClientRect().height })));
  const sealSlot = await page.evaluate(() => [...document.querySelectorAll(".build-seal, .speed-seal")].map(element => getComputedStyle(element).backgroundImage).filter(value => value.includes("seal_slot")).length);
  const speed = await page.locator(".speed-seal").evaluateAll(elements => elements.map(element => ({ w: element.getBoundingClientRect().width, h: element.getBoundingClientRect().height,
    art: getComputedStyle(element).borderImageSource.replace(/.*\/assets\//, "").replace(/"\)$/, ""), background: getComputedStyle(element).backgroundImage })));
  await page.screenshot({ path: join(dir, "hud-top.png"), clip: { x: 0, y: 0, width: 1280, height: 140 } });
  result.game = { welcome, cards, speed, sealSlotDrawn: sealSlot };
  await context.close();
}

try {
  for (const view of VIEWS) await gallery(view).catch(error => result.errors.push(`${view.name}: ${String(error).slice(0, 400)}`));
  if (only !== "gallery") {
    await fallback().catch(error => result.errors.push(`fallback: ${String(error).slice(0, 400)}`));
    await game().catch(error => result.errors.push(`game: ${String(error).slice(0, 400)}`));
  }
} finally {
  await browser.close();
}
mkdirSync(join(jsonOut, ".."), { recursive: true });
writeFileSync(jsonOut, `${JSON.stringify(result, null, 1)}\n`);
console.log(`${label}: ${Object.keys(result.views).length} views, ${result.errors.length} errors`);
for (const error of result.errors) console.log("  ", error);
