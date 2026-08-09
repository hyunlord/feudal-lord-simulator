import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import path from "node:path";

import { frames } from "./phase8Task10CdpClient.mjs";
import { canvasHash } from "./phase10BrowserProofCdp.mjs";
import { phase13ProofUrl } from "./phase13FinalBrowserQaConstants.mjs";

export async function setViewport(client, viewport) {
  await client.send("Emulation.setDeviceMetricsOverride", {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: 1,
    mobile: viewport.mobile,
  });
}

export async function openPublicProofPage(client, publicUrl) {
  const url = phase13ProofUrl(publicUrl);
  if (!url.includes("phase10-proof=1")) throw new Error("public QA requires phase10-proof=1");
  await client.send("Storage.clearDataForOrigin", { origin: new URL(publicUrl).origin, storageTypes: "all" });
  const loaded = client.waitFor("Page.loadEventFired");
  await client.send("Page.navigate", { url });
  await loaded;
  await client.evaluate(`(async () => {
    for (let attempt = 0; attempt < 120; attempt += 1) {
      if (window.__FEUDAL_PHASE10_PROOF__ !== undefined && document.querySelector("canvas.game-canvas") !== null) return true;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error("public proof page did not expose canvas and proof port");
  })()`, true);
  const interaction = await dismissWelcome(client);
  await frames(12);
  return interaction;
}

export async function captureQaScreenshot(input) {
  const canvas = await canvasHash(input.client);
  if (canvas.visiblePixels === 0) throw new Error(`${input.id} canvas was blank`);
  const screenshot = await input.client.send("Page.captureScreenshot", { format: "png" });
  const bytes = Buffer.from(screenshot.data, "base64");
  const file = path.join(input.dir, `${input.id}.png`);
  const entry = { id: input.id, path: file, byteLength: bytes.byteLength, sha256: sha256(bytes) };
  await writeFile(file, bytes);
  input.screenshots.push(entry);
  return { ...entry, canvas };
}

export async function loadedScriptAndStyleHashes(client) {
  return client.evaluate(`(async () => {
    const toHex = (buffer) => [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    const candidates = performance.getEntriesByType("resource")
      .map((entry) => entry.name)
      .filter((name) => /\\.(?:js|css)(?:[?#].*)?$/.test(name));
    const urls = [...new Set(candidates)].sort();
    const results = [];
    for (const url of urls) {
      const response = await fetch(url, { cache: "force-cache" });
      if (!response.ok) throw new Error("resource hash fetch failed " + response.status + " " + url);
      const body = await response.arrayBuffer();
      const digest = await crypto.subtle.digest("SHA-256", body);
      const contentType = response.headers.get("content-type") ?? "";
      results.push({
        url,
        fetchedUrl: response.url,
        kind: /\\.css(?:[?#].*)?$/.test(url) ? "stylesheet" : "script",
        status: response.status,
        contentType,
        byteLength: body.byteLength,
        sha256: toHex(digest),
      });
    }
    return results;
  })()`, true);
}

export async function responsiveMetrics(client) {
  return client.evaluate(`(() => {
    const selectors = ["canvas.game-canvas", "button", ".settlement-status", ".resource-ledger", ".build-menu", ".era-console"];
    const elements = selectors.flatMap((selector) => [...document.querySelectorAll(selector)]);
    const boxMetrics = (selector) => {
      const element = document.querySelector(selector);
      return element === null ? null : {
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
        scrollHeight: element.scrollHeight,
        clientHeight: element.clientHeight,
      };
    };
    const clipped = elements.flatMap((element) => {
      const style = getComputedStyle(element);
      const box = element.getBoundingClientRect();
      if (style.visibility === "hidden" || style.display === "none" || box.width === 0 || box.height === 0) return [];
      const clipped = box.left < -1 || box.top < -1 || box.right > window.innerWidth + 1 || box.bottom > window.innerHeight + 1;
      return clipped ? [{ tag: element.tagName.toLowerCase(), className: element.className, text: element.textContent?.trim().slice(0, 40) ?? "" }] : [];
    });
    return {
      clipped,
      document: {
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        scrollHeight: document.documentElement.scrollHeight,
        clientHeight: document.documentElement.clientHeight,
      },
      body: {
        scrollWidth: document.body.scrollWidth,
        clientWidth: document.body.clientWidth,
        scrollHeight: document.body.scrollHeight,
        clientHeight: document.body.clientHeight,
      },
      buildSeals: boxMetrics(".build-seals"),
      console: boxMetrics(".court-console"),
    };
  })()`, false);
}

export async function clickByAria(client, label) {
  const point = await client.evaluate(`(() => {
    const element = [...document.querySelectorAll("button,[role=button]")].find((candidate) => {
      const text = candidate.textContent?.trim() ?? "";
      return candidate.getAttribute("aria-label") === ${JSON.stringify(label)} || text === ${JSON.stringify(label)};
    });
    if (element === null) return null;
    if (element === undefined) return null;
    const box = element.getBoundingClientRect();
    return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
  })()`, false);
  if (point === null) throw new Error(`Missing button text or aria-label ${label}`);
  await dispatchPointClick(client, point);
}

export async function clickTile(client, tile) {
  const point = await client.evaluate(`window.__FEUDAL_PHASE10_PROOF__.tileClientPoint(${JSON.stringify(tile)})`, true);
  await dispatchPointClick(client, { x: point.clientX, y: point.clientY });
}

export async function pressEscape(client) {
  await client.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await client.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await frames(4);
}

export async function zoomCanvasIn(client) {
  const point = await canvasCenter(client);
  for (let count = 0; count < 8; count += 1) {
    await client.send("Input.dispatchMouseEvent", { type: "mouseWheel", x: point.x, y: point.y, deltaX: 0, deltaY: -260 });
  }
  await frames(12);
}

export async function dragCanvas(client, from, to) {
  const start = await canvasFractionPoint(client, from);
  const end = await canvasFractionPoint(client, to);
  await client.send("Input.dispatchMouseEvent", { type: "mousePressed", button: "left", buttons: 1, x: start.x, y: start.y });
  await client.send("Input.dispatchMouseEvent", { type: "mouseMoved", button: "left", buttons: 1, x: end.x, y: end.y });
  await client.send("Input.dispatchMouseEvent", { type: "mouseReleased", button: "left", buttons: 0, x: end.x, y: end.y });
  await frames(8);
}

export async function centerProofTile(client, tile) {
  const before = await client.evaluate(`window.__FEUDAL_PHASE10_PROOF__.tileClientPoint(${JSON.stringify(tile)})`, true);
  const center = await canvasCenter(client);
  await client.send("Input.dispatchMouseEvent", { type: "mousePressed", button: "left", buttons: 1, x: before.clientX, y: before.clientY });
  await client.send("Input.dispatchMouseEvent", { type: "mouseMoved", button: "left", buttons: 1, x: center.x, y: center.y });
  await client.send("Input.dispatchMouseEvent", { type: "mouseReleased", button: "left", buttons: 0, x: center.x, y: center.y });
  await frames(12);
  const after = await client.evaluate(`window.__FEUDAL_PHASE10_PROOF__.tileClientPoint(${JSON.stringify(tile)})`, true);
  return {
    tile,
    before: { x: before.clientX, y: before.clientY },
    after: { x: after.clientX, y: after.clientY },
    canvasCenter: center,
    distanceFromCenterPx: Math.hypot(after.clientX - center.x, after.clientY - center.y),
  };
}

export async function proofSnapshot(client) {
  return client.evaluate("window.__FEUDAL_PHASE10_PROOF__.snapshot()", true);
}

export async function selectedConstructionProgress(client) {
  return client.evaluate(`(() => {
    const card = document.querySelector(".diagnostic-card--site");
    if (card === null) return null;
    const rows = [...card.querySelectorAll("dl div")].map((row) => ({
      label: row.querySelector("dt")?.textContent?.trim() ?? "",
      value: row.querySelector("dd")?.textContent?.trim() ?? "",
    }));
    const progress = rows.find((row) => row.label === "건축 작업")?.value ?? "";
    const match = progress.match(/(\\d+)\\/(\\d+)틱/);
    return {
      name: card.querySelector("h2")?.textContent?.trim() ?? "",
      progressText: progress,
      progress: match === null ? null : Number(match[1]) / Number(match[2]),
    };
  })()`, false);
}

async function dismissWelcome(client) {
  const point = await client.evaluate(`(() => {
    const element = document.querySelector(".welcome-dismiss-layer");
    if (element === null) return null;
    const box = element.getBoundingClientRect();
    return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
  })()`, false);
  if (point === null) throw new Error("fresh public page did not show welcome guidance to dismiss");
  await dispatchPointClick(client, point);
  return { atMs: 0, label: "dismiss visible welcome guidance", method: "Input.dispatchMouseEvent" };
}

async function dispatchPointClick(client, point) {
  await client.send("Input.dispatchMouseEvent", { type: "mousePressed", button: "left", buttons: 1, clickCount: 1, x: point.x, y: point.y });
  await client.send("Input.dispatchMouseEvent", { type: "mouseReleased", button: "left", buttons: 0, clickCount: 1, x: point.x, y: point.y });
  await frames(4);
}

async function canvasCenter(client) {
  return canvasFractionPoint(client, { x: 0.5, y: 0.5 });
}

async function canvasFractionPoint(client, fraction) {
  return client.evaluate(`(() => {
    const canvas = document.querySelector("canvas.game-canvas");
    if (canvas === null) throw new Error("game canvas missing");
    const box = canvas.getBoundingClientRect();
    return { x: box.left + box.width * ${fraction.x}, y: box.top + box.height * ${fraction.y} };
  })()`, true);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}
