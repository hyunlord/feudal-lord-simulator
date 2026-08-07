import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import path from "node:path";

import {
  closeChrome,
  createCdpClient,
  createTarget,
  frames,
  launchChrome,
  waitForChrome,
} from "../../../../../scripts/phase8Task10CdpClient.mjs";

const outputDirectory = path.dirname(new URL(import.meta.url).pathname);
const baseUrl = process.env.QA_URL ?? "http://127.0.0.1:4198";
const chromePath = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const chromePort = Number.parseInt(process.env.QA_CHROME_PORT ?? "9518", 10);
const tileWidth = 64;
const tileHeight = 32;
const targetTileSpan = 20;
const minOneByOneBuildingPx = 18;
const viewports = [
  { label: "opening-375x640", width: 375, height: 640 },
  { label: "opening-375x720", width: 375, height: 720 },
  { label: "opening-768x720", width: 768, height: 720 },
];
const diagnostics = { console: [], exceptions: [], failedResources: [] };
const screenshots = [];

const session = await launchChrome({
  chromePath,
  remoteDebuggingPort: chromePort,
  userDataPrefix: "phase8-task11-mobile-legibility-",
});

try {
  await waitForChrome(chromePort, session.stderr);
  const target = await createTarget(chromePort);
  const client = await createCdpClient(target.webSocketDebuggerUrl);
  try {
    await setupClient(client);
    const measurements = [];
    for (const viewport of viewports) {
      await setViewport(client, viewport.width, viewport.height, 1);
      await navigate(client, baseUrl);
      await waitForCanvas(client);
      await click(client, Math.floor(viewport.width / 2), Math.floor(viewport.height / 2));
      await frames(10);
      measurements.push(await measure(client, viewport));
      await screenshot(client, `${String(measurements.length).padStart(2, "0")}-${viewport.label}.png`);
    }

    const assertions = {
      noRuntimeErrors: diagnostics.console.length === 0 && diagnostics.exceptions.length === 0,
      noFailedResources: diagnostics.failedResources.length === 0,
      exactViewportSet: measurements.every((item) => item.viewport.width === item.expected.width && item.viewport.height === item.expected.height),
      canvasSized: measurements.every((item) => item.canvas?.width === item.expected.width && item.canvas?.height === item.expected.height),
      projectedFloor: measurements.every((item) => item.projectedOneByOneShortPx >= minOneByOneBuildingPx),
      consoleClearance: measurements.every((item) => item.console !== null && item.console.top >= item.expected.height - item.expected.consoleHeight),
      welcomeDismissed: measurements.every((item) => !item.bodyText.includes("영지에 오신 것을 환영합니다")),
      screenshotsNonEmpty: screenshots.every((shot) => shot.byteLength > 20_000),
    };
    const result = {
      schemaVersion: 1,
      invocation: `QA_URL=${baseUrl} QA_CHROME_PORT=${chromePort} node ${path.basename(new URL(import.meta.url).pathname)}`,
      head: process.env.PHASE8_HEAD ?? null,
      tree: process.env.PHASE8_TREE ?? null,
      startedAt: new Date().toISOString(),
      threshold: { minOneByOneBuildingPx },
      measurements,
      screenshots,
      diagnostics,
      assertions,
      verdict: Object.values(assertions).every(Boolean) ? "PASS" : "FAIL",
    };
    await writeFile(path.join(outputDirectory, "browser-legibility-results.json"), `${JSON.stringify(result, null, 2)}\n`, "utf8");
    await writeFile(
      path.join(outputDirectory, "browser-screenshots.sha256"),
      screenshots.map((shot) => `${shot.sha256}  ${path.basename(shot.path)}`).join("\n") + "\n",
      "utf8",
    );
    if (result.verdict !== "PASS") throw new Error("browser legibility QA failed");
  } finally {
    client.close();
  }
} finally {
  await closeChrome(session);
}

async function setupClient(client) {
  await client.send("Page.enable");
  await client.send("Runtime.enable");
  await client.send("Network.enable");
  void client.waitFor("Runtime.consoleAPICalled").then(function loop(event) {
    if (event.type === "error") diagnostics.console.push(event);
    void client.waitFor("Runtime.consoleAPICalled").then(loop);
  });
  void client.waitFor("Runtime.exceptionThrown").then(function loop(event) {
    diagnostics.exceptions.push(event);
    void client.waitFor("Runtime.exceptionThrown").then(loop);
  });
  void client.waitFor("Network.loadingFailed").then(function loop(event) {
    diagnostics.failedResources.push(event);
    void client.waitFor("Network.loadingFailed").then(loop);
  });
}

async function setViewport(client, width, height, dpr) {
  await client.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: dpr, mobile: false });
  await frames(12);
}

async function navigate(client, url) {
  const loaded = client.waitFor("Page.loadEventFired");
  await client.send("Page.navigate", { url });
  await loaded;
  await frames(18);
}

async function waitForCanvas(client) {
  await client.evaluate(`(async () => {
    for (let attempt = 0; attempt < 160; attempt += 1) {
      const canvas = document.querySelector("canvas.game-canvas");
      if (canvas !== null && canvas.width > 0 && canvas.height > 0) return true;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error("canvas not ready");
  })()`, true);
}

async function click(client, x, y) {
  await client.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 1 });
  await client.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", buttons: 0, clickCount: 1 });
}

async function screenshot(client, fileName) {
  const result = await client.send("Page.captureScreenshot", { format: "png", fromSurface: true });
  const buffer = Buffer.from(result.data, "base64");
  const file = path.join(outputDirectory, fileName);
  await writeFile(file, buffer);
  screenshots.push({
    path: file,
    sha256: createHash("sha256").update(buffer).digest("hex"),
    byteLength: buffer.byteLength,
    dimensions: pngDimensions(buffer),
  });
}

async function measure(client, viewport) {
  const measurement = await client.evaluate(`(() => {
    const rect = (selector) => {
      const element = document.querySelector(selector);
      if (element === null) return null;
      const bounds = element.getBoundingClientRect();
      return {
        left: bounds.left,
        top: bounds.top,
        right: bounds.right,
        bottom: bounds.bottom,
        width: bounds.width,
        height: bounds.height,
      };
    };
    return {
      viewport: { width: window.innerWidth, height: window.innerHeight, dpr: window.devicePixelRatio },
      canvas: rect("canvas.game-canvas"),
      console: rect(".court-console"),
      bodyText: document.body.innerText,
    };
  })()`, false);
  const consoleHeight = courtConsoleHeight(viewport.width);
  const projectedOneByOneShortPx = projectedShortSide({
    width: viewport.width,
    height: viewport.height,
    consoleHeight,
  });
  return {
    label: viewport.label,
    expected: { ...viewport, consoleHeight },
    projectedOneByOneShortPx,
    ...measurement,
  };
}

function projectedShortSide(viewport) {
  const usableHeight = Math.max(1, viewport.height - viewport.consoleHeight);
  const fittedZoom = Math.min(
    viewport.width / (tileWidth * targetTileSpan),
    usableHeight / (tileHeight * targetTileSpan),
  );
  const compactZoom = Math.max(fittedZoom, minOneByOneBuildingPx / tileHeight);
  return Math.min(tileWidth * compactZoom, tileHeight * compactZoom);
}

function courtConsoleHeight(width) {
  if (width <= 600) return 224;
  if (width <= 900) return 276;
  return 150;
}

function pngDimensions(buffer) {
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}
