import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  closeChrome,
  createCdpClient,
  createTarget,
  frames,
  launchChrome,
  waitForChrome,
} from "./phase8Task10CdpClient.mjs";

const VIEWPORTS = [
  { id: "mobile-375x812", width: 375, height: 812 },
  { id: "short-640x375", width: 640, height: 375 },
  { id: "tablet-768x1024", width: 768, height: 1024 },
  { id: "desktop-1280x720", width: 1280, height: 720 },
];

if (isDirectRun()) {
  await main();
}

async function main() {
  const outputDir = process.env.LEDGER_QA_OUTPUT_DIR ?? ".omo/evidence/phase8-presentation-completion/task-11/mobile-ledger-fix";
  const chromePath = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  const baseUrl = process.env.LEDGER_QA_URL ?? "http://127.0.0.1:3200";
  const remoteDebuggingPort = Number.parseInt(process.env.LEDGER_QA_CHROME_PORT ?? "9231", 10);
  await mkdir(outputDir, { recursive: true });

  const chromeSession = await launchChrome({
    chromePath,
    remoteDebuggingPort,
    userDataPrefix: "phase8-task11-ledger-qa-chrome-",
    extraArgs: ["--no-sandbox"],
  });

  try {
    await waitForChrome(remoteDebuggingPort, chromeSession.stderr);
    const target = await createTarget(remoteDebuggingPort);
    const client = await createCdpClient(target.webSocketDebuggerUrl);
    try {
      await client.send("Page.enable");
      await client.send("Runtime.enable");
      await client.send("Page.addScriptToEvaluateOnNewDocument", {
        source: "localStorage.setItem('feudal-lord-simulator:welcome-dismissed:v1', '1');",
      });

      const scenarios = [];
      for (const viewport of VIEWPORTS) {
        scenarios.push(await captureScenario(client, baseUrl, outputDir, viewport));
      }

      const result = {
        schemaVersion: 1,
        invocation: "LEDGER_QA_URL=<url> LEDGER_QA_OUTPUT_DIR=<dir> node scripts/phase8Task11MobileLedgerQa.mjs",
        baseUrl,
        viewports: scenarios,
        verdict: scenarios.every((scenario) => scenario.pass) ? "PASS" : "FAIL",
      };
      const resultPath = path.join(outputDir, "browser-ledger-readability.json");
      await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`);
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      if (result.verdict !== "PASS") {
        throw new Error(`mobile ledger readability failed; see ${resultPath}`);
      }
    } finally {
      client.close();
    }
  } finally {
    await closeChrome(chromeSession);
  }
}

async function captureScenario(client, baseUrl, outputDir, viewport) {
  await client.send("Emulation.setDeviceMetricsOverride", {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: 1,
    mobile: viewport.width <= 420,
  });
  await navigate(client, baseUrl);
  const metrics = await client.evaluate(readabilityExpression(viewport), true);
  const screenshot = await client.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
  });
  const screenshotPath = path.join(outputDir, `${viewport.id}.png`);
  await writeFile(screenshotPath, screenshot.data, "base64");
  return {
    ...metrics,
    screenshotPath,
    pass: metrics.failures.length === 0,
  };
}

async function navigate(client, url) {
  const loaded = client.waitFor("Page.loadEventFired");
  await client.send("Page.navigate", { url });
  await loaded;
  await frames(20);
}

function readabilityExpression(viewport) {
  return `(() => {
    const viewport = ${JSON.stringify(viewport)};
    const failures = [];
    const rectOf = (element) => {
      if (element === null) return null;
      const rect = element.getBoundingClientRect();
      return {
        top: Math.round(rect.top * 100) / 100,
        right: Math.round(rect.right * 100) / 100,
        bottom: Math.round(rect.bottom * 100) / 100,
        left: Math.round(rect.left * 100) / 100,
        width: Math.round(rect.width * 100) / 100,
        height: Math.round(rect.height * 100) / 100,
      };
    };
    const visible = (element) => {
      if (element === null) return false;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    };
    const overlaps = (a, b) => (
      a !== null && b !== null &&
      a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
    );
    const visibleTextFits = (selector) => Array.from(document.querySelectorAll(selector))
      .filter(visible)
      .map((element) => ({
        text: element.textContent?.trim() ?? "",
        rect: rectOf(element),
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        fits: element.scrollWidth <= element.clientWidth + 1,
      }));

    const compact = viewport.width <= 720 || (viewport.width <= 900 && viewport.height <= 420);
    const ledger = document.querySelector(".court-ledger");
    const overlay = document.querySelector(".economy-overlays");
    const buildTray = document.querySelector(".build-seals");
    const speed = document.querySelector(".speed-seals");
    const consolePanel = document.querySelector(".court-console");
    const compactLedgerLabels = visibleTextFits(".ledger-label--compact");
    const fullLedgerLabels = visibleTextFits(".ledger-label--full");
    const compactOverlayLabels = visibleTextFits(".overlay-label--compact");
    const fullOverlayLabels = visibleTextFits(".overlay-label--full");
    const secondaryLedgerRows = Array.from(document.querySelectorAll(".ledger-row--secondary")).filter(visible);
    const overlayButtons = visibleTextFits(".overlay-seal");
    const compactTexts = [
      ...compactLedgerLabels.map((item) => item.text),
      ...compactOverlayLabels.map((item) => item.text),
    ];

    if (document.documentElement.scrollWidth > document.documentElement.clientWidth + 1) {
      failures.push("document has horizontal overflow");
    }
    if (overlaps(rectOf(ledger), rectOf(overlay))) failures.push("ledger overlaps overlay controls");
    if (overlaps(rectOf(overlay), rectOf(speed))) failures.push("overlay controls overlap speed controls");
    if (overlaps(rectOf(buildTray), rectOf(ledger))) failures.push("build tray overlaps ledger");

    if (compact) {
      if (compactLedgerLabels.length < 2) failures.push("compact ledger labels are not visible");
      if (compactOverlayLabels.length !== 4) failures.push("compact overlay labels are not visible");
      if (fullLedgerLabels.length > 0) failures.push("full ledger labels are visible in compact layout");
      if (fullOverlayLabels.length > 0) failures.push("full overlay labels are visible in compact layout");
      if (secondaryLedgerRows.length > 0) failures.push("secondary ledger rows are visible in compact layout");
      if (compactTexts.some((text) => /Timber|Population|Distribution|Road component/.test(text))) {
        failures.push("long compact labels leaked into constrained layout");
      }
    } else {
      if (!fullLedgerLabels.some((item) => item.text === "Timber")) failures.push("desktop/tablet ledger lost full Timber label");
      if (!fullOverlayLabels.some((item) => item.text === "Distribution")) failures.push("desktop/tablet overlay lost full Distribution label");
      if (compactLedgerLabels.length > 0 || compactOverlayLabels.length > 0) {
        failures.push("compact labels are visible outside compact layout");
      }
    }

    for (const item of [...compactLedgerLabels, ...compactOverlayLabels, ...overlayButtons]) {
      if (!item.fits) failures.push("visible text overflows: " + item.text);
    }

    return {
      id: viewport.id,
      viewport,
      document: {
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      },
      rects: {
        console: rectOf(consolePanel),
        ledger: rectOf(ledger),
        overlay: rectOf(overlay),
        buildTray: rectOf(buildTray),
        speed: rectOf(speed),
      },
      compact,
      compactLedgerLabels,
      fullLedgerLabels,
      compactOverlayLabels,
      fullOverlayLabels,
      overlayButtons,
      visibleSecondaryLedgerRows: secondaryLedgerRows.length,
      failures,
    };
  })()`;
}

function isDirectRun() {
  const entryPath = process.argv[1];
  return entryPath !== undefined && import.meta.url === new URL(entryPath, "file:").href;
}
