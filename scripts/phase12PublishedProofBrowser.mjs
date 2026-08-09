import { writeFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { canvasHash, proofSnapshot } from "./phase10BrowserProofCdp.mjs";

export const AUTOPLAY_TOGGLE_LABEL = "자동 발전";

export async function proofCapture(input) {
  const snapshot = await proofSnapshot(input.client);
  const canvas = await canvasHash(input.client);
  await captureScreenshot(input);
  return { snapshot, canvas };
}

export async function honestCapture(input) {
  const canvas = await canvasHash(input.client);
  const documentSummary = await input.client.evaluate(`(() => {
    const publishedProofAssetIsMissing = ${publishedProofAssetIsMissing.toString()};
    return {
      title: document.title,
      welcomeTitle: document.querySelector(".welcome-parchment h2")?.textContent?.trim() ?? null,
      statusText: document.querySelector(".settlement-status")?.textContent?.trim() ?? null,
      taskText: document.querySelector(".onboarding-task--current")?.textContent?.trim() ?? null,
      resourceErrors: performance.getEntriesByType("resource")
        .filter(publishedProofAssetIsMissing)
        .map((entry) => entry.name),
    };
  })()`, false);
  await captureScreenshot(input);
  return { canvas, documentSummary };
}

export async function captureScreenshot(input) {
  const atMs = input.startedAt === undefined ? null : Math.round(await browserElapsed(input.client, input.startedAt));
  const screenshot = await input.client.send("Page.captureScreenshot", { format: "png" });
  await writeFile(path.join(input.dir, `${input.label}.png`), screenshot.data, "base64");
  input.screenshots.push(input.startedAt === undefined ? input.label : { label: input.label, atMs });
}

export async function pageMissingAssets(client) {
  return client.evaluate(`(() => {
    const publishedProofAssetIsMissing = ${publishedProofAssetIsMissing.toString()};
    return performance.getEntriesByType("resource").filter(publishedProofAssetIsMissing).map((entry) => entry.name);
  })()`, false);
}

export function publishedProofAssetIsMissing(entry) {
  const pngAssetPattern = /\/assets\/[^?#]+\.png(?:[?#].*)?$/;
  if (!pngAssetPattern.test(entry.name)) return false;
  if (entry.responseStatus >= 400) return true;
  return entry.responseStatus === 0
    && entry.encodedBodySize === 0
    && entry.decodedBodySize === 0
    && entry.deliveryType !== "cache";
}

export async function clickByTextOrAria(client, label) {
  const point = await client.evaluate(`(() => {
    const buttons = [...document.querySelectorAll("button")];
    const target = buttons.find((button) => button.getAttribute("aria-label") === ${JSON.stringify(label)} || button.textContent?.trim() === ${JSON.stringify(label)});
    if (target === undefined) return null;
    const box = target.getBoundingClientRect();
    return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
  })()`, false);
  if (point === null) throw new Error(`Missing button ${label}`);
  await dispatchPointClick(client, point);
}

export async function clickSelector(client, selector) {
  const point = await client.evaluate(`(() => {
    const target = document.querySelector(${JSON.stringify(selector)});
    if (target === null) return null;
    const box = target.getBoundingClientRect();
    return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
  })()`, false);
  if (point === null) throw new Error(`Missing selector ${selector}`);
  await dispatchPointClick(client, point);
}

export async function clickCanvasFraction(client, xFraction, yFraction) {
  const point = await canvasFractionPoint(client, xFraction, yFraction);
  await dispatchPointClick(client, point);
}

export async function dragCanvasFractions(client, from, to) {
  const start = await canvasFractionPoint(client, from.x, from.y);
  const end = await canvasFractionPoint(client, to.x, to.y);
  await client.send("Input.dispatchMouseEvent", { type: "mousePressed", button: "left", buttons: 1, x: start.x, y: start.y });
  await client.send("Input.dispatchMouseEvent", { type: "mouseMoved", button: "left", buttons: 1, x: end.x, y: end.y });
  await client.send("Input.dispatchMouseEvent", { type: "mouseReleased", button: "left", buttons: 0, x: end.x, y: end.y });
  await delay(120);
}

export async function navigateFreshPage(client, url) {
  const origin = new URL(url).origin;
  await client.send("Storage.clearDataForOrigin", { origin, storageTypes: "local_storage" });
  const loaded = client.waitFor("Page.loadEventFired");
  await client.send("Page.navigate", { url });
  await loaded;
  await client.evaluate(`(async () => {
    for (let attempt = 0; attempt < 120; attempt += 1) {
      if (document.querySelector("canvas.game-canvas") !== null && document.querySelector(".welcome-parchment") !== null) return true;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error("fresh published page did not expose canvas and welcome guidance");
  })()`, true);
}

export async function navigateFreshProofPage(client, url) {
  const proofUrl = new URL(url);
  proofUrl.searchParams.set("phase10-proof", "1");
  await navigateFreshPage(client, proofUrl.href);
  await clickSelector(client, ".welcome-dismiss-layer");
  await client.evaluate(`(async () => {
    for (let attempt = 0; attempt < 120; attempt += 1) {
      if (window.__FEUDAL_PHASE10_PROOF__ !== undefined && document.querySelector(".welcome-parchment") === null) return true;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error("fresh proof page did not become interactive");
  })()`, true);
  return {
    atMs: 0,
    label: "dismiss visible welcome guidance",
    reason: "enter the fresh published proof page through its rendered UI",
  };
}

export async function dedicatedGuidance(client) {
  return client.evaluate(`(() => {
    const current = document.querySelector(".onboarding-task--current");
    const status = document.querySelector(".settlement-status");
    const source = current ?? status;
    if (source === null) throw new Error("dedicated guidance DOM missing");
    const tools = [...document.querySelectorAll(".build-seal[data-highlighted]")]
      .filter((button) => button.getAttribute("data-affordable") === "true")
      .map((button) => ({
        tool: button.getAttribute("data-highlighted"),
        label: button.getAttribute("aria-label"),
      }));
    return {
      source: current === null ? "settlement-status" : "onboarding-task-current",
      prompt: source.textContent?.trim() ?? "",
      tools,
    };
  })()`, true);
}

export async function observableState(client) {
  const snapshot = await proofSnapshot(client);
  const era = await client.evaluate(`document.querySelector(".era-console__header strong")?.textContent?.trim() ?? null`, false);
  return {
    roadRevision: snapshot.roadRevision,
    buildings: snapshot.buildings.length,
    constructionSites: snapshot.constructionSites.length,
    treasuryTimber: snapshot.treasuryTimber,
    population: snapshot.population,
    era,
  };
}

export function withCommon(config, body) {
  return {
    schemaVersion: 2,
    scenario: config.scenario,
    url: config.url,
    revision: config.revision,
    revisionSource: config.revisionSource,
    revisionDirty: config.revisionDirty,
    deploymentProof: config.deploymentProof ?? null,
    ...body,
  };
}

export function walkerHash(snapshot) {
  return snapshot.walkers.map((walker) => `${walker.id}:${walker.x.toFixed(2)},${walker.y.toFixed(2)}`).sort().join("|");
}

export function resourceHash(snapshot) {
  return JSON.stringify({
    treasuryTimber: snapshot.treasuryTimber,
    buildings: snapshot.buildings.map((building) => [building.id, building.inventory]).sort(),
  });
}

export async function startScenarioClock(client) {
  return client.evaluate(`(() => {
    const startedAt = performance.now();
    window.__PHASE12_STARTED_AT__ = startedAt;
    return startedAt;
  })()`, false);
}

export async function browserElapsed(client, fallbackStartedAt) {
  return client.evaluate(`(() => {
    const startedAt = window.__PHASE12_STARTED_AT__ ?? ${fallbackStartedAt};
    return performance.now() - startedAt;
  })()`, false);
}

export async function waitUntilElapsed(client, startedAt, targetMs) {
  const elapsed = await browserElapsed(client, startedAt);
  if (elapsed < targetMs) await delay(targetMs - elapsed);
}

export async function installAutoplayPulseProbe(client) {
  await client.evaluate(`(() => {
    window.__PHASE12_AUTOPLAY_PULSES__ = [];
    window.addEventListener("feudal-lord-simulator:autoplay-pulse", (event) => {
      const detail = event.detail;
      window.__PHASE12_AUTOPLAY_PULSES__.push({
        atMs: performance.now() - (window.__PHASE12_STARTED_AT__ ?? performance.now()),
        message: detail.message,
        anchorKind: detail.anchor.kind,
        anchor: detail.anchor.kind === "tile"
          ? { kind: "tile", tile: detail.anchor.tile }
          : { kind: "path", path: detail.anchor.path },
      });
    });
  })()`, true);
}

export async function readAutoplayPulses(client) {
  return client.evaluate("window.__PHASE12_AUTOPLAY_PULSES__ ?? []", false);
}

export function frameProbeSource() {
  return `(() => {
    const frameTimes = [];
    const pendingFrames = new Map();
    const original = window.requestAnimationFrame.bind(window);
    window.__PHASE12_FRAME_TIMES__ = frameTimes;
    window.requestAnimationFrame = (callback) => original((time) => {
      const startedAt = performance.now();
      callback(time);
      const duration = performance.now() - startedAt;
      pendingFrames.set(time, (pendingFrames.get(time) ?? 0) + duration);
      setTimeout(() => {
        const frameDuration = pendingFrames.get(time);
        if (frameDuration === undefined) return;
        frameTimes.push(frameDuration);
        pendingFrames.delete(time);
      }, 0);
    });
  })();`;
}

export async function resetFrameSamples(client) {
  await client.evaluate(`(() => {
    const frameTimes = window.__PHASE12_FRAME_TIMES__;
    if (!Array.isArray(frameTimes)) throw new Error("Phase12 frame probe is not installed");
    frameTimes.length = 0;
  })()`, true);
}

async function dispatchPointClick(client, point) {
  await client.send("Input.dispatchMouseEvent", { type: "mousePressed", button: "left", buttons: 1, clickCount: 1, x: point.x, y: point.y });
  await client.send("Input.dispatchMouseEvent", { type: "mouseReleased", button: "left", buttons: 0, clickCount: 1, x: point.x, y: point.y });
  await delay(20);
}

async function canvasFractionPoint(client, xFraction, yFraction) {
  return client.evaluate(`(() => {
    const canvas = document.querySelector("canvas.game-canvas");
    if (canvas === null) throw new Error("game canvas missing");
    const box = canvas.getBoundingClientRect();
    return { x: box.left + box.width * ${xFraction}, y: box.top + box.height * ${yFraction} };
  })()`, true);
}
