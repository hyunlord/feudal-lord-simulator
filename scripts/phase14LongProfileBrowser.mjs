import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { frames } from "./phase8Task10CdpClient.mjs";
import { PHASE14_PROFILE_MINUTES, summarizePhase14CallbackSamples } from "./phase14LongProfileAssertions.mjs";
import { navigateFreshPage } from "./phase12PublishedProofBrowser.mjs";

export async function preparePhase14LongProfilePage(client, url) {
  await client.send("Page.addScriptToEvaluateOnNewDocument", { source: phase14FrameProbeSource() });
  const profileUrl = new URL(url);
  profileUrl.searchParams.set("phase10-proof", "1");
  await navigateFreshPage(client, profileUrl.href);
  const welcomeDismissed = await clickSelector(client, ".welcome-dismiss-layer");
  const playPressed = await clickByTextOrAria(client, "1배속");
  const fivefoldPressed = await clickByTextOrAria(client, "5배속");
  const autoplayPressed = await clickByTextOrAria(client, "자동 발전");
  const controls = await assertPhase14ControlState(client);
  const initial = await client.evaluate("window.__FEUDAL_PHASE10_PROOF__.snapshot()", true);
  const startedAt = await startPhase14ProfileClock(client);
  return {
    startedAt,
    initialSnapshot: { tick: initial.tick, snapshotCounts: snapshotCounts(initial) },
    controls: { welcomeDismissed, playPressed, fivefoldPressed, autoplayPressed, ...controls },
  };
}

export async function capturePhase14Checkpoints(input) {
  const checkpoints = [];
  for (const minute of PHASE14_PROFILE_MINUTES) {
    const targetElapsedMs = minute * 60_000;
    const windowStartMs = targetElapsedMs - 60_000;
    await waitUntilBrowserElapsed(input.client, windowStartMs);
    await resetPhase14FrameSamples(input.client);
    await waitUntilBrowserElapsed(input.client, targetElapsedMs);
    checkpoints.push(await capturePhase14Checkpoint({ ...input, minute, targetElapsedMs, windowStartMs }));
  }
  return checkpoints;
}

export function phase14FrameProbeSource() {
  return `(() => {
    const original = window.requestAnimationFrame.bind(window);
    window.__PHASE14_CALLBACK_SAMPLES__ = [];
    window.requestAnimationFrame = (callback) => original((time) => {
      const startedAt = performance.now();
      try {
        callback(time);
      } finally {
        const callbackWorkMs = performance.now() - startedAt;
        window.__PHASE14_CALLBACK_SAMPLES__.push({ frameTimestamp: time, callbackWorkMs });
      }
    });
  })();`;
}

async function capturePhase14Checkpoint(input) {
  const elapsedMs = await browserElapsed(input.client);
  const snapshot = await input.client.evaluate("window.__FEUDAL_PHASE10_PROOF__.snapshot()", true);
  const heapUsage = await input.client.send("Runtime.getHeapUsage");
  const performance = await input.client.send("Performance.getMetrics");
  const samples = await readPhase14FrameSamples(input.client);
  const failures = await input.errors.read();
  return {
    minute: input.minute,
    targetElapsedMs: input.targetElapsedMs,
    windowStartMs: input.windowStartMs,
    windowDurationMs: 60_000,
    elapsedMs,
    tick: snapshot.tick,
    snapshotCounts: snapshotCounts(snapshot),
    heapUsage,
    performanceMetrics: performance.metrics,
    frame: summarizePhase14CallbackSamples(samples),
    screenshot: await captureProfileScreenshot(input),
    failures,
  };
}

async function captureProfileScreenshot(input) {
  const screenshot = await input.client.send("Page.captureScreenshot", { format: "png" });
  const bytes = Buffer.from(screenshot.data, "base64");
  const file = path.join(input.screenshotDir, `minute-${input.minute}.png`);
  await writeFile(file, bytes);
  return { path: file, byteLength: bytes.byteLength, sha256: createHash("sha256").update(bytes).digest("hex") };
}

async function clickSelector(client, selector) {
  const point = await elementPoint(client, `document.querySelector(${JSON.stringify(selector)})`);
  await dispatchPointClick(client, point);
  return true;
}

async function clickByTextOrAria(client, label) {
  const point = await elementPoint(client, `(() => {
    return [...document.querySelectorAll("button,[role=button]")].find((element) => {
      const text = element.textContent?.trim() ?? "";
      return element.getAttribute("aria-label") === ${JSON.stringify(label)} || text === ${JSON.stringify(label)};
    }) ?? null;
  })()`);
  await dispatchPointClick(client, point);
  return true;
}

async function elementPoint(client, expression) {
  const point = await client.evaluate(`(() => {
    const element = ${expression};
    if (element === null) return null;
    element.focus({ preventScroll: true });
    const box = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    if (style.visibility !== "visible" || style.display === "none" || box.width === 0 || box.height === 0) return null;
    return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
  })()`, false);
  if (point === null) throw new Error(`missing visible element for ${expression}`);
  return point;
}

async function dispatchPointClick(client, point) {
  await client.send("Input.dispatchMouseEvent", { type: "mousePressed", button: "left", buttons: 1, clickCount: 1, x: point.x, y: point.y });
  await client.send("Input.dispatchMouseEvent", { type: "mouseReleased", button: "left", buttons: 0, clickCount: 1, x: point.x, y: point.y });
  await frames(6);
}

async function assertPhase14ControlState(client) {
  return client.evaluate(`(() => {
    const fivefold = [...document.querySelectorAll("button")].find((button) => button.getAttribute("aria-label") === "5배속" || button.textContent?.trim() === "5배속");
    const autoplay = [...document.querySelectorAll("button")].find((button) => button.getAttribute("aria-label") === "자동 발전" || button.textContent?.trim() === "자동 발전");
    if (fivefold === undefined || autoplay === undefined) throw new Error("phase14 controls missing");
    autoplay.focus({ preventScroll: true });
    const style = getComputedStyle(autoplay);
    const fivefoldAriaPressed = fivefold.getAttribute("aria-pressed");
    const autoplayAriaPressed = autoplay.getAttribute("aria-pressed");
    if (fivefoldAriaPressed !== "true") throw new Error("5x aria-pressed was not true");
    if (autoplayAriaPressed !== "true") throw new Error("autoplay aria-pressed was not true");
    if (style.visibility !== "visible" || style.display === "none") throw new Error("autoplay control was not visible");
    if (document.activeElement !== autoplay) throw new Error("autoplay control did not retain focus");
    return {
      fivefoldAriaPressed,
      autoplayAriaPressed,
      visibility: style.visibility,
      activeElement: "autoplay",
      documentVisibilityState: document.visibilityState,
      documentHasFocus: document.hasFocus(),
    };
  })()`, true);
}

async function startPhase14ProfileClock(client) {
  return client.evaluate(`(() => {
    window.__PHASE14_PROFILE_STARTED_AT__ = performance.now();
    return window.__PHASE14_PROFILE_STARTED_AT__;
  })()`, false);
}

async function browserElapsed(client) {
  return client.evaluate("performance.now() - window.__PHASE14_PROFILE_STARTED_AT__", false);
}

async function waitUntilBrowserElapsed(client, targetElapsedMs) {
  for (;;) {
    const elapsedMs = await browserElapsed(client);
    if (elapsedMs >= targetElapsedMs) return;
    await delay(Math.min(1_000, targetElapsedMs - elapsedMs));
  }
}

async function readPhase14FrameSamples(client) {
  return client.evaluate("window.__PHASE14_CALLBACK_SAMPLES__ ?? []", false);
}

async function resetPhase14FrameSamples(client) {
  await client.evaluate(`(() => {
    window.__PHASE14_CALLBACK_SAMPLES__ = [];
  })()`, false);
}

function snapshotCounts(snapshot) {
  return {
    buildings: Array.isArray(snapshot.buildings) ? snapshot.buildings.length : 0,
    houses: Array.isArray(snapshot.houses) ? snapshot.houses.length : 0,
    walkers: Array.isArray(snapshot.walkers) ? snapshot.walkers.length : 0,
    constructionSites: Array.isArray(snapshot.constructionSites) ? snapshot.constructionSites.length : 0,
  };
}
