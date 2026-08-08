import { writeFile } from "node:fs/promises";
import path from "node:path";

import { frames } from "./phase8Task10CdpClient.mjs";

export async function openProofPage(client, baseUrl) {
  await client.send("Page.addScriptToEvaluateOnNewDocument", { source: "localStorage.setItem('feudal-lord-simulator:welcome-dismissed:v1', '1');" });
  const loaded = client.waitFor("Page.loadEventFired");
  await client.send("Page.navigate", { url: proofUrl(baseUrl) });
  await loaded;
  await waitForProofPort(client);
}

export async function clickByAria(client, label) {
  const clicked = await client.evaluate(`(() => {
    const element = document.querySelector(${JSON.stringify(`[aria-label="${label}"]`)});
    if (element === null) return false;
    element.click();
    return true;
  })()`, true);
  if (!clicked) throw new Error(`Missing aria-label ${label}`);
  await frames(2);
}

export async function clickTile(client, tile) {
  const point = await tilePoint(client, tile);
  await client.send("Input.dispatchMouseEvent", { type: "mousePressed", button: "left", buttons: 1, clickCount: 1, x: point.clientX, y: point.clientY });
  await client.send("Input.dispatchMouseEvent", { type: "mouseReleased", button: "left", buttons: 0, clickCount: 1, x: point.clientX, y: point.clientY });
  await frames(4);
}

export async function dragTile(client, start, end) {
  const from = await tilePoint(client, start);
  const to = await tilePoint(client, end);
  await client.send("Input.dispatchMouseEvent", { type: "mousePressed", button: "left", buttons: 1, x: from.clientX, y: from.clientY });
  await client.send("Input.dispatchMouseEvent", { type: "mouseMoved", button: "left", buttons: 1, x: to.clientX, y: to.clientY });
  await client.send("Input.dispatchMouseEvent", { type: "mouseReleased", button: "left", buttons: 0, x: to.clientX, y: to.clientY });
  await frames(4);
}

export async function waitAndSnapshot(client, startTick, ticks, dir, screenshots, label) {
  await waitForElapsedTicks(client, startTick, ticks);
  return snapshot(client, dir, screenshots, label);
}

export async function waitForLogsCarterAndSnapshot(client, startTick, maxTicks, dir, screenshots, label) {
  const movement = await client.evaluate(`(async () => {
    const deadlineTick = ${startTick} + ${maxTicks};
    const startHashes = new Map();
    while (window.__FEUDAL_PHASE10_PROOF__.snapshot().tick < deadlineTick) {
      const walkers = window.__FEUDAL_PHASE10_PROOF__.snapshot().walkers;
      const carters = walkers.filter((walker) => walker.kind === "carter" && walker.cargo?.resource === "logs" && walker.cargo.amount > 0);
      for (const carter of carters) {
        const hash = carter.id + ":" + carter.x.toFixed(2) + "," + carter.y.toFixed(2);
        const startHash = startHashes.get(carter.id);
        if (startHash !== undefined && hash !== startHash) {
          return { startHash, endHash: hash, logsCarter: carter };
        }
        if (startHash === undefined) startHashes.set(carter.id, hash);
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    throw new Error("no moving logs-carrying carter observed before tick " + deadlineTick);
  })()`, true);
  return { ...movement, checkpoint: await snapshot(client, dir, screenshots, label) };
}

export async function waitForElapsedTicks(client, startTick, ticks) {
  return client.evaluate(`(async () => {
    const target = ${startTick} + ${ticks};
    const deadline = performance.now() + Math.max(10000, ${ticks} * 75);
    while (window.__FEUDAL_PHASE10_PROOF__.snapshot().tick < target) {
      if (performance.now() > deadline) throw new Error("live 1x loop timed out before tick " + target);
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    return window.__FEUDAL_PHASE10_PROOF__.snapshot().tick;
  })()`, true);
}

export async function snapshot(client, dir, screenshots, label) {
  const state = await proofSnapshot(client);
  const canvas = await canvasHash(client);
  const screenshot = await client.send("Page.captureScreenshot", { format: "png" });
  await writeFile(path.join(dir, `${label}.png`), screenshot.data, "base64");
  screenshots.push(label);
  return { snapshot: state, canvas };
}

export async function proofSnapshot(client) {
  return client.evaluate("window.__FEUDAL_PHASE10_PROOF__.snapshot()", true);
}

export async function canvasHash(client) {
  return client.evaluate(`(() => {
    const canvas = document.querySelector("canvas.game-canvas");
    if (canvas === null) throw new Error("game canvas missing");
    const context = canvas.getContext("2d");
    if (context === null) throw new Error("2d context missing");
    const image = context.getImageData(0, 0, canvas.width, canvas.height);
    let hash = 2166136261, visiblePixels = 0;
    for (let index = 0; index < image.data.length; index += 4) {
      hash ^= image.data[index] + (image.data[index + 1] << 8) + (image.data[index + 2] << 16) + (image.data[index + 3] << 24);
      hash = Math.imul(hash, 16777619) >>> 0;
      if (image.data[index + 3] !== 0) visiblePixels += 1;
    }
    return { hash: hash.toString(16).padStart(8, "0"), width: canvas.width, height: canvas.height, visiblePixels };
  })()`, true);
}

export async function missingAssets(client) {
  return client.evaluate("performance.getEntriesByType('resource').filter((entry) => /assets\\/.+\\.png$/.test(entry.name) && entry.transferSize === 0).map((entry) => entry.name)", false);
}

async function tilePoint(client, tile) {
  return client.evaluate(`window.__FEUDAL_PHASE10_PROOF__.tileClientPoint(${JSON.stringify(tile)})`, true);
}

async function waitForProofPort(client) {
  await client.evaluate(`(async () => {
    for (let i = 0; i < 120; i += 1) {
      if (window.__FEUDAL_PHASE10_PROOF__ !== undefined && document.querySelector("canvas.game-canvas") !== null) return true;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error("phase10 proof port did not become ready");
  })()`, true);
  await frames(12);
}

function proofUrl(baseUrl) {
  const url = new URL(baseUrl);
  url.searchParams.set("phase10-proof", "1");
  return url.href;
}
