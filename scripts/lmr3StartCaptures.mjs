// LM-R3 evidence (the welcome and the house choice): JPEGs at 1280×800 and on the tablet (1180×820), the boxes the
// layout rules need (the parchment inside the viewport, no scroll, targets ≥ 44 px, text ≥ 12 px, one primary), the
// "목표와 함께" switch turning the sandbox button into the campaign's, "다른 문장 보기", and a start with another house
// read back from the game (the proof port: the lordship's first house, the scenario, lord mode).
//   PLAYWRIGHT_MODULE=/abs/playwright-core/index.mjs node scripts/lmr3StartCaptures.mjs <outDir> --url <dev server>
import { refuseHeavyOnMac } from "./remote/localGuard.mjs";
refuseHeavyOnMac("브라우저 캡처(scripts/lmr3StartCaptures.mjs)", { remote: "scripts/remote/run.sh render-LMR3-start-captures-<sha7> --light -- bash scripts/lmr3StartCaptures.sh", entry: import.meta.url });
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { startFromWelcome } from "./welcomeStart.mjs";

const [outDir] = process.argv.slice(2);
const at = process.argv.indexOf("--url");
const url = at > 0 ? process.argv[at + 1] : "http://127.0.0.1:4213/";
for (let attempt = 0; ; attempt += 1) {
  try { if ((await fetch(url)).ok) break; } catch { /* not up yet */ }
  if (attempt > 120) throw new Error(`no server at ${url}`);
  await new Promise(resolve => setTimeout(resolve, 500));
}
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
await mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const report = { url, views: [], flows: {}, errors: [] };

/** The parchment's box, whether it fits and scrolls, the smallest text and target, the primaries and the centre's hit. */
const layout = page => page.evaluate(() => {
  const box = element => { const rect = element.getBoundingClientRect(); return [Math.round(rect.x), Math.round(rect.y), Math.round(rect.width), Math.round(rect.height)]; };
  const parchment = document.querySelector(".welcome-parchment");
  const rect = parchment.getBoundingClientRect();
  const visible = element => { const r = element.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const texts = [...parchment.querySelectorAll("*")].filter(element => visible(element) && [...element.childNodes].some(node => node.nodeType === 3 && node.textContent.trim() !== ""));
  const smallest = texts.map(element => ({ size: Number.parseFloat(getComputedStyle(element).fontSize), text: element.textContent.trim().slice(0, 24) })).sort((a, b) => a.size - b.size)[0] ?? null;
  const buttons = [...parchment.querySelectorAll("button")].filter(visible);
  const target = buttons.map(button => ({ w: Math.round(button.getBoundingClientRect().width), h: Math.round(button.getBoundingClientRect().height), text: (button.textContent || button.getAttribute("aria-label") || "").trim().slice(0, 24) }))
    .sort((a, b) => Math.min(a.w, a.h) - Math.min(b.w, b.h))[0] ?? null;
  const centre = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
  const logo = parchment.querySelector(".welcome-logo");
  return {
    parchment: box(parchment), inside: rect.top >= 0 && rect.bottom <= window.innerHeight && rect.left >= 0 && rect.right <= window.innerWidth,
    scrolls: parchment.scrollHeight > parchment.clientHeight + 1, smallestText: smallest, smallestTarget: target,
    primaries: buttons.filter(button => button.classList.contains("ui-btn--primary")).map(button => button.textContent.trim()),
    logo: logo === null ? null : box(logo), emblem: document.querySelector(".title-emblem") === null ? null : box(document.querySelector(".title-emblem")),
    modes: [...parchment.querySelectorAll("[data-scenario]")].map(button => ({ id: button.getAttribute("data-scenario"), box: box(button), text: button.textContent.trim() })),
    house: parchment.querySelector(".welcome-house") === null ? null : {
      name: parchment.querySelector(".welcome-house").getAttribute("data-house"), arms: parchment.querySelector(".welcome-house").getAttribute("data-arms"),
      names: parchment.querySelectorAll("[data-house-name]").length, candidates: [...parchment.querySelectorAll("[data-arms-candidate]")].map(button => button.getAttribute("data-arms-candidate")),
      composed: parchment.querySelectorAll("img.emblem-image").length,
    },
    centre: centre === null ? null : `${centre.tagName.toLowerCase()}.${[...centre.classList].join(".")}`,
  };
});
const composed = page => page.waitForFunction(() => document.querySelectorAll(".welcome-house img.emblem-image").length >= 5, null, { timeout: 20_000 }).catch(() => undefined);

for (const [width, height, name, touch] of [[1280, 800, "1280x800", false], [1180, 820, "tablet-1180x820", true], [1280, 720, "1280x720", false]]) {
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: touch });
  const page = await context.newPage();
  page.on("pageerror", error => report.errors.push(`${name}: ${String(error).slice(0, 200)}`));
  await page.routeWebSocket("**", socket => socket.close());
  await page.goto(url);
  await page.locator(".welcome-parchment").waitFor({ timeout: 60_000 });
  await page.waitForTimeout(1_500);
  const shoot = height !== 720;
  report.views.push({ viewport: name, step: "welcome", shot: shoot ? `welcome-${name}.jpg` : null, ...await layout(page) });
  if (shoot) await page.screenshot({ path: join(outDir, `welcome-${name}.jpg`), type: "jpeg", quality: 72 });
  await page.locator(".welcome-parchment [data-scenario='core:lord_slice']").click();
  await page.locator(".welcome-house").waitFor({ timeout: 10_000 });
  await composed(page); await page.waitForTimeout(300);
  report.views.push({ viewport: name, step: "house", shot: shoot ? `house-${name}.jpg` : null, ...await layout(page) });
  if (shoot) await page.screenshot({ path: join(outDir, `house-${name}.jpg`), type: "jpeg", quality: 72 });
  await context.close();
}

// Flows at 1280×800: the goal switch, another name and more arms, back, then a start with the chosen house (proof port).
{
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  page.on("pageerror", error => report.errors.push(`flows: ${String(error).slice(0, 200)}`));
  await page.routeWebSocket("**", socket => socket.close());
  await page.goto(`${url}?phase10-proof=1`);
  await page.locator(".welcome-parchment").waitFor({ timeout: 60_000 });
  await page.waitForTimeout(1_000);
  const sandbox = () => page.locator(".welcome-modes [data-mode='sandbox'] [data-scenario]").getAttribute("data-scenario");
  const before = await sandbox();
  await page.locator("[data-sandbox-goal]").click();
  report.flows.goalSwitch = { before, on: await sandbox(), checked: await page.locator("[data-sandbox-goal]").getAttribute("aria-checked"),
    welcome: await page.locator(".welcome-parchment").count() === 1 };
  await page.locator("[data-sandbox-goal]").click();
  report.flows.goalSwitch.off = await sandbox();
  await page.locator(".welcome-parchment [data-scenario='core:lord_slice']").click();
  await page.locator(".welcome-house").waitFor({ timeout: 10_000 });
  const house = () => page.evaluate(() => ({ name: document.querySelector(".welcome-house").getAttribute("data-house"), arms: document.querySelector(".welcome-house").getAttribute("data-arms"),
    candidates: [...document.querySelectorAll("[data-arms-candidate]")].map(button => button.getAttribute("data-arms-candidate")) }));
  report.flows.defaultHouse = await house();
  await page.locator("[data-house-name='de Ravenholt']").click();
  report.flows.pickedName = await house();
  await page.locator(".welcome-house-more").click();
  report.flows.moreArms = await house();
  await page.locator("[data-arms-candidate='ravenholt-7']").click();
  report.flows.pickedArms = await house();
  await composed(page); await page.waitForTimeout(300);
  await page.screenshot({ path: join(outDir, "house-1280x800-picked.jpg"), type: "jpeg", quality: 72 });
  await page.locator("[data-house-back]").click();
  report.flows.backKeepsWelcome = { modes: await page.locator(".welcome-modes").count() === 1, house: await page.locator(".welcome-house").count() };
  await page.locator(".welcome-parchment [data-scenario='core:lord_slice']").click();
  report.flows.houseKeptAfterBack = await house();
  await page.locator("[data-house-start]").click();
  await page.waitForFunction(() => document.querySelector(".welcome-parchment") === null && window.__FEUDAL_PHASE10_PROOF__ !== undefined, null, { timeout: 30_000 });
  await page.waitForTimeout(2_000);
  report.flows.started = await page.evaluate(() => {
    const state = window.__FEUDAL_PHASE10_PROOF__.state();
    return { scenarioId: state.scenarioId, lord: state.agency !== undefined, house: state.lordship?.house ?? null };
  });
  await page.screenshot({ path: join(outDir, "started-1280x800.jpg"), type: "jpeg", quality: 62 });
  await context.close();
}
// The campaign through the helper the other scripts use (startFromWelcome), with the default house.
{
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  await page.routeWebSocket("**", socket => socket.close());
  await page.goto(`${url}?phase10-proof=1`);
  await page.locator(".welcome-parchment").waitFor({ timeout: 60_000 });
  await startFromWelcome(page, "core:campaign_market_town");
  await page.waitForFunction(() => document.querySelector(".welcome-parchment") === null && window.__FEUDAL_PHASE10_PROOF__ !== undefined, null, { timeout: 30_000 });
  report.flows.campaignHelper = await page.evaluate(() => {
    const state = window.__FEUDAL_PHASE10_PROOF__.state();
    return { scenarioId: state.scenarioId, lord: state.agency !== undefined, house: state.lordship?.house?.name ?? "(default)" };
  });
  await context.close();
}
await browser.close();
await writeFile(join(outDir, "captures.json"), `${JSON.stringify(report, null, 1)}\n`);
for (const view of report.views) console.log(`${view.viewport} ${view.step}: parchment ${view.parchment} inside=${view.inside} scrolls=${view.scrolls} text≥${view.smallestText?.size} target≥${view.smallestTarget?.w}x${view.smallestTarget?.h} primaries=${view.primaries.length}`);
console.log(JSON.stringify(report.flows));
console.log(`errors: ${report.errors.length}`);
