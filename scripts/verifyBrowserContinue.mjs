// B8 gate ②: in a real Chrome, play a new game for 2 minutes, reload the page, press 이어하기,
// and check tick, population, resources and buildings match. Then again after closing the tab.
// Needs `npm run play` (or vite preview) serving http://127.0.0.1:4173/.
// Usage: node scripts/verifyBrowserContinue.mjs [outputDirectory=docs/verification/b8-save] [playSeconds=120]
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
export const URL_UNDER_TEST = process.env.B8_URL ?? "http://127.0.0.1:4173/";
const PORT = 9337;
let OUT = resolve(process.argv[2] ?? "docs/verification/b8-save");
export function setOutputDirectory(directory) { OUT = resolve(directory); }
const PLAY_SECONDS = Number(process.argv[3] ?? "120");
export const sleep = ms => new Promise(done => setTimeout(done, ms));

export async function waitForJson(url, attempts = 100) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try { const response = await fetch(url); if (response.ok) return response.json(); } catch { /* not up yet */ }
    await sleep(100);
  }
  throw new Error(`No response from ${url}`);
}

export function connect(wsUrl) {
  const socket = new WebSocket(wsUrl);
  let nextId = 1;
  const pending = new Map();
  socket.onmessage = event => {
    const message = JSON.parse(String(event.data));
    const waiter = message.id === undefined ? undefined : pending.get(message.id);
    if (waiter === undefined) return;
    pending.delete(message.id);
    if (message.error) waiter.reject(new Error(`${waiter.method}: ${message.error.message}`));
    else waiter.resolve(message.result);
  };
  const opened = new Promise((done, fail) => { socket.onopen = done; socket.onerror = fail; });
  return {
    opened,
    send(method, params = {}, sessionId) {
      const id = nextId++;
      socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
      return new Promise((resolvePromise, reject) => pending.set(id, { resolve: resolvePromise, reject, method }));
    },
    close: () => socket.close(),
  };
}

export async function openTab(browser) {
  const { targetId } = await browser.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await browser.send("Target.attachToTarget", { targetId, flatten: true });
  const send = (method, params) => browser.send(method, params, sessionId);
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 1600, height: 1100, deviceScaleFactor: 1, mobile: false });
  const page = {
    targetId,
    async evaluate(expression) {
      const result = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
      if (result.exceptionDetails) throw new Error(`evaluate failed: ${result.exceptionDetails.exception?.description ?? result.exceptionDetails.text}`);
      return result.result.value;
    },
    async navigate(url) {
      await send("Page.navigate", { url });
      await page.waitFor(`document.readyState === "complete" && document.querySelector(".resource-bar") !== null`);
    },
    async reload() {
      await send("Page.reload", { ignoreCache: false });
      await sleep(500);
      await page.waitFor(`document.readyState === "complete" && document.querySelector(".resource-bar") !== null`);
    },
    async waitFor(expression, timeoutMs = 20_000) {
      const started = Date.now();
      while (Date.now() - started < timeoutMs) {
        try { if (await page.evaluate(expression)) return; } catch { /* page navigating */ }
        await sleep(100);
      }
      throw new Error(`Timed out waiting for ${expression}`);
    },
    /** Real mouse press/release at the centre of the first element matching `finder` (a JS expression). */
    async click(finder) {
      const box = await page.evaluate(`(() => { const el = ${finder}; if (!el) return null; const r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
      if (box === null) throw new Error(`Nothing to click for ${finder}`);
      for (const type of ["mouseMoved", "mousePressed", "mouseReleased"]) {
        await send("Input.dispatchMouseEvent", { type, x: box.x, y: box.y, button: "left", buttons: type === "mousePressed" ? 1 : 0, clickCount: 1 });
      }
      await sleep(150);
    },
    async screenshot(name) {
      const { data } = await send("Page.captureScreenshot", { format: "jpeg", quality: 60 });
      writeFileSync(join(OUT, name), Buffer.from(data, "base64"));
      return name;
    },
  };
  return page;
}

export const byText = (selector, text) => `[...document.querySelectorAll(${JSON.stringify(selector)})].find(el => el.textContent.includes(${JSON.stringify(text)}))`;
export const byLabel = label => `document.querySelector('[aria-label=${JSON.stringify(label)}]')`;

/** Reads a slot straight from IndexedDB: header fields plus counts and a SHA-256 of the state JSON. */
export const readSlot = slotId => `(async () => {
  const db = await new Promise((ok, fail) => { const r = indexedDB.open("feudal-lord-simulator-saves", 1); r.onsuccess = () => ok(r.result); r.onerror = () => fail(r.error); });
  const get = (store, key) => new Promise((ok, fail) => { const r = db.transaction(store).objectStore(store).get(key); r.onsuccess = () => ok(r.result); r.onerror = () => fail(r.error); });
  const all = store => new Promise((ok, fail) => { const r = db.transaction(store).objectStore(store).getAll(); r.onsuccess = () => ok(r.result); r.onerror = () => fail(r.error); });
  const metas = (await all("meta")).filter(m => /^(auto-\\d|manual)$/.test(m.slotId)).sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  const slot = ${JSON.stringify(slotId)} ?? metas[0]?.slotId;
  if (slot === undefined) { db.close(); return null; }
  const buffer = await get("slots", slot);
  db.close();
  if (!buffer) return null;
  const text = new TextDecoder().decode(buffer);
  const at = text.indexOf(',"state":');
  const stateJson = text.slice(at + 9, -1);
  const state = JSON.parse(stateJson);
  const digest = [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(stateJson)))].map(b => b.toString(16).padStart(2, "0")).join("");
  const stock = {};
  for (const building of state.buildings) for (const [resource, amount] of Object.entries(building.inventory ?? {})) stock[resource] = (stock[resource] ?? 0) + amount;
  return { slot, slots: metas.map(m => m.slotId + "@" + m.tick), summary: JSON.parse(text.slice(0, at) + "}").summary.line,
    tick: state.tick, population: state.population, treasuryTimber: state.treasuryTimber, treasuryCoin: state.treasuryCoin,
    buildings: state.buildings.length, houses: state.houses.length, constructionSites: state.constructionSites.length,
    walkers: state.walkers.length, stock, stateSha256: digest, bytes: buffer.byteLength };
})()`;

/** Frame-to-frame gaps over `ms` with no save in flight, as the baseline for the save metrics. */
export const frameGaps = ms => `new Promise(done => { const stamps = []; const started = performance.now();
  const frame = t => { stamps.push(t); if (performance.now() - started < ${ms}) requestAnimationFrame(frame); else {
    const gaps = stamps.slice(1).map((t, i) => t - stamps[i]).sort((a, b) => a - b);
    done({ frames: gaps.length, medianMs: gaps[Math.floor(gaps.length / 2)] ?? null, p95Ms: gaps[Math.floor(gaps.length * 0.95)] ?? null, maxMs: gaps.at(-1) ?? null }); } };
  requestAnimationFrame(frame); })`;

export const resourceBarText = `document.querySelector(".resource-bar")?.innerText.replace(/\\s+/g, " ").trim()`;

async function continueAndCompare(page, label, reference) {
  await page.waitFor(`${byText("button", "이어하기")} !== undefined`);
  const welcomeShot = await page.screenshot(`${label}-1-welcome-continue.jpg`);
  const welcomeLine = await page.evaluate(`document.querySelector(".welcome-save p")?.textContent ?? null`);
  await page.click(byText("button", "이어하기"));
  await page.waitFor(`document.querySelector(".welcome-parchment") === null`);
  await sleep(1_000);
  const barAfter = await page.evaluate(resourceBarText);
  const afterShot = await page.screenshot(`${label}-2-after-continue.jpg`);
  // Persist the in-memory state through the product's own manual save, then read it back.
  await page.click(byText("summary", "설정"));
  await page.click(byText("button", "지금 저장"));
  await page.waitFor(`${byText(".save-controls span", "저장했습니다")} !== undefined`);
  const restored = await page.evaluate(readSlot("manual"));
  await page.click(byText("summary", "설정")); // close the popover so it does not cover the speed seals
  const keys = ["tick", "population", "treasuryTimber", "treasuryCoin", "buildings", "houses", "constructionSites", "walkers", "stateSha256"];
  const mismatches = keys.filter(key => restored[key] !== reference.saved[key]);
  if (JSON.stringify(restored.stock) !== JSON.stringify(reference.saved.stock)) mismatches.push("stock");
  if (barAfter !== reference.bar) mismatches.push("resourceBar");
  return { label, welcomeLine, welcomeShot, afterShot, barAfter, restored, mismatches, matches: mismatches.length === 0 };
}

export async function playAndPause(page, seconds, label) {
  const tickBefore = (await page.evaluate(readSlot(null)))?.tick ?? 0;
  await page.click(byLabel("1배속"));
  const started = Date.now();
  await sleep(Math.max(0, seconds * 1_000 - 25_000));
  // Sampled mid-run between autosaves (the 60 s interval save lands earlier).
  const baselineFrameGaps = await page.evaluate(frameGaps(3_000));
  await sleep(Math.max(0, started + seconds * 1_000 - Date.now()));
  await page.click(byLabel("일시 정지"));
  const playedSeconds = (Date.now() - started) / 1000;
  await sleep(1_500); // pause-entry autosave is serialised when idle
  const saved = await page.evaluate(readSlot(null));
  if (saved === null || saved.tick <= tickBefore) throw new Error(`${label}: the game did not advance past tick ${tickBefore}`);
  const bar = await page.evaluate(resourceBarText);
  const shot = await page.screenshot(`${label}-0-before.jpg`);
  const metrics = await page.evaluate(`window.__FLS_SAVE_METRICS__ ?? []`);
  return { playedSeconds, saved, bar, shot, metrics, baselineFrameGaps };
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const profile = mkdtempSync(join(tmpdir(), "b8-chrome-"));
  const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
    "--window-size=1600,1100", "--no-first-run", "--no-default-browser-check", "about:blank"], { stdio: "ignore" });
  try {
    const version = await waitForJson(`http://127.0.0.1:${PORT}/json/version`);
    const browser = connect(version.webSocketDebuggerUrl);
    await browser.opened;
    const report = { url: URL_UNDER_TEST, autoplayDuringRun1: true, chrome: version.Browser, playSeconds: PLAY_SECONDS, startedAt: new Date().toISOString(), runs: [] };

    // Run 1: new game → 2 minutes → reload → 이어하기.
    let page = await openTab(browser);
    await page.navigate(URL_UNDER_TEST);
    const noSaveWelcome = await page.evaluate(`${byText("button", "이어하기")} === undefined`);
    await page.screenshot("reload-0-new-game.jpg");
    await page.click(`document.querySelector(".welcome-dismiss-layer")`);
    // The in-game 자동 발전 (settings popover) places buildings so the saved city is not idle.
    await page.click(byText("summary", "설정"));
    await page.click(`document.querySelector(".autoplay-toggle[aria-pressed]")`);
    await page.click(byText("summary", "설정"));
    const first = await playAndPause(page, PLAY_SECONDS, "reload");
    await page.reload();
    report.runs.push({ kind: "page-reload", noContinueOnFirstVisit: noSaveWelcome, before: first, after: await continueAndCompare(page, "reload", first) });

    // Run 2: keep playing, close the tab, open a new one on the same profile → 이어하기.
    const second = await playAndPause(page, Math.min(30, PLAY_SECONDS), "tab");
    await browser.send("Target.closeTarget", { targetId: page.targetId });
    await sleep(1_000);
    page = await openTab(browser);
    await page.navigate(URL_UNDER_TEST);
    report.runs.push({ kind: "tab-close-reopen", before: second, after: await continueAndCompare(page, "tab", second) });

    report.passed = report.runs.every(run => run.after.matches) && noSaveWelcome;
    writeFileSync(join(OUT, "browser-continue.json"), `${JSON.stringify(report, null, 2)}\n`);
    for (const run of report.runs) {
      process.stdout.write(`${run.kind}: before tick=${run.before.saved.tick} pop=${run.before.saved.population} buildings=${run.before.saved.buildings} ` +
        `after tick=${run.after.restored.tick} pop=${run.after.restored.population} buildings=${run.after.restored.buildings} ` +
        `stateSha=${run.after.restored.stateSha256 === run.before.saved.stateSha256} mismatches=${run.after.mismatches.join(",") || "none"}\n`);
    }
    process.stdout.write(`passed=${report.passed}\n`);
    browser.close();
    if (!report.passed) process.exitCode = 1;
  } finally {
    chrome.kill();
    await sleep(500);
    rmSync(profile, { recursive: true, force: true });
  }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
