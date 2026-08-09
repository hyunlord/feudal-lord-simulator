import { spawn, type ChildProcess } from "node:child_process";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { SEMANTIC_PALETTE } from "../src/content/palette";
import { DEFAULT_GAME_STATE } from "../src/state/gameStore";
import { PALETTE_CSS_VARIABLES } from "../src/styles/paletteVariables";
import { BuildSeals } from "../src/ui/BuildMenu";

type BrowserProof = {
  readonly verdict: "PASS" | "FAIL";
  readonly failures: readonly string[];
  readonly measurements: unknown;
};

const VIEWPORTS = [
  { width: 1280, height: 720 },
  { width: 920, height: 720 },
] as const;

type ChromeSession = {
  readonly chrome: ChildProcess;
  readonly userDataDir: string;
  readonly stderr: () => string;
};

type CdpClient = {
  readonly send: (method: string, params?: Record<string, unknown>) => Promise<Record<string, unknown>>;
  readonly evaluate: (expression: string, awaitPromise: boolean) => Promise<unknown>;
  readonly close: () => void;
};

type CdpPendingRequest = {
  readonly resolve: (value: Record<string, unknown>) => void;
  readonly reject: (reason: Error) => void;
};

const stoneTownState = {
  ...DEFAULT_GAME_STATE,
  era: "stone_town" as const,
  treasuryTimber: 500,
  buildings: [
    ...DEFAULT_GAME_STATE.buildings,
    {
      id: "stone-store",
      kind: "storehouse" as const,
      tx: 0,
      ty: 0,
      workers: 0,
      inventory: { stone: 500, stone_raw: 500 },
      reserved: {},
      stockReserved: {},
      productionProgress: 0,
    },
  ],
};

async function main(): Promise<void> {
  const chromePath = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  const remoteDebuggingPort = Number.parseInt(process.env.PART7_PROOF_CHROME_PORT ?? "9337", 10);
  const chromeSession = await launchChrome({
    chromePath,
    remoteDebuggingPort,
    userDataPrefix: "phase13-part7-build-menu-proof-",
    extraArgs: ["--no-sandbox"],
  });

  try {
    await waitForChrome(remoteDebuggingPort, chromeSession.stderr);
    const target = await createTarget(remoteDebuggingPort, htmlDataUrl(await pageHtml()));
    const client = await createCdpClient(target.webSocketDebuggerUrl);
    try {
      await client.send("Page.enable");
      await client.send("Runtime.enable");
      const proof = await measureViewports(client);
      process.stdout.write(`${JSON.stringify(proof, null, 2)}\n`);
      if (proof.verdict !== "PASS") {
        throw new Error(`Part7 browser build-menu proof failed: ${proof.failures.join("; ")}`);
      }
    } finally {
      client.close();
    }
  } finally {
    await closeChrome(chromeSession);
  }
}

async function pageHtml(): Promise<string> {
  const css = await readFile(new URL("../src/styles/global.css", import.meta.url), "utf8");
  const buildMenuMarkup = renderToStaticMarkup(
    createElement(BuildSeals, {
      selectedTool: null,
      state: stoneTownState,
      onSelect: () => undefined,
    }),
  );
  const cssVariables = Object.entries(PALETTE_CSS_VARIABLES)
    .map(([name, value]) => `${name}: ${value};`)
    .join("\n");
  const paletteVariables = Object.entries(SEMANTIC_PALETTE)
    .map(([name, value]) => `--palette-${name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}: ${value};`)
    .join("\n");

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
:root {
${cssVariables}
${paletteVariables}
}
${css}
</style>
</head>
<body>
<main class="app-shell" style="${inlineStyle(PALETTE_CSS_VARIABLES)}">
  <section class="court-console" aria-label="영주 명령대">
    <div class="court-recess map-recess"><button class="map-overview" type="button" aria-label="영지 지형 지도 이동"></button></div>
    <div class="court-recess seal-recess">${buildMenuMarkup}</div>
    <div class="court-recess ledger-recess"></div>
  </section>
</main>
</body>
</html>`;
}

function inlineStyle(values: Record<string, string>): string {
  return Object.entries(values)
    .map(([name, value]) => `${name}: ${value}`)
    .join("; ");
}

function htmlDataUrl(html: string): string {
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}

async function measureViewports(client: CdpClient): Promise<BrowserProof> {
  const viewportProofs: BrowserProof[] = [];
  for (const viewport of VIEWPORTS) {
    await client.send("Emulation.setDeviceMetricsOverride", {
      width: viewport.width,
      height: viewport.height,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await frames(10);
    const evaluatedProof = await client.evaluate(browserMeasurementExpression(viewport), true);
    viewportProofs.push(parseBrowserProof(evaluatedProof));
  }

  const failures = viewportProofs.flatMap((proof) => proof.failures);
  return {
    verdict: failures.length === 0 ? "PASS" : "FAIL",
    failures,
    measurements: viewportProofs.map((proof) => proof.measurements),
  };
}

function browserMeasurementExpression(viewport: (typeof VIEWPORTS)[number]): string {
  return `(() => {
    const failures = [];
    const round = (value) => Math.round(value * 100) / 100;
    const rectOf = (element) => {
      const rect = element.getBoundingClientRect();
      return {
        top: round(rect.top),
        right: round(rect.right),
        bottom: round(rect.bottom),
        left: round(rect.left),
        width: round(rect.width),
        height: round(rect.height),
      };
    };
    const requireElement = (selector) => {
      const element = document.querySelector(selector);
      if (!(element instanceof HTMLElement)) throw new Error(selector + " missing");
      return element;
    };
    const textMetrics = (selector) => Array.from(document.querySelectorAll(selector)).map((element) => {
      if (!(element instanceof HTMLElement)) throw new Error(selector + " yielded non-HTMLElement");
      const style = getComputedStyle(element);
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      if (context === null) throw new Error("2d canvas unavailable");
      context.font = style.font;
      const measuredTextWidth = context.measureText(element.textContent?.trim() ?? "").width;
      return {
        text: element.textContent?.trim() ?? "",
        font: style.font,
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        measuredTextWidth: round(measuredTextWidth),
        rect: rectOf(element),
        canvasFits: measuredTextWidth <= element.clientWidth + 1,
        domFits: element.scrollWidth <= element.clientWidth + 1,
      };
    });

    const consolePanel = requireElement(".court-console");
    const sealRecess = requireElement(".seal-recess");
    const buildSeals = requireElement(".build-seals");
    const minimap = requireElement(".map-overview");
    const labelMetrics = textMetrics(".build-seal-label");
    const groupMetrics = textMetrics(".build-group-label");
    const buildRect = rectOf(buildSeals);
    const recessRect = rectOf(sealRecess);
    const mapRect = rectOf(minimap);

    const prefix = "${viewport.width}px: ";
    if (mapRect.width > 140 || mapRect.height > 140) failures.push(prefix + "minimap exceeds 140px square");
    if (buildSeals.scrollHeight > buildSeals.clientHeight + 1) failures.push(prefix + "build menu has vertical scroll");
    if (buildSeals.scrollWidth > buildSeals.clientWidth + 1) failures.push(prefix + "build menu has horizontal scroll");
    if (buildRect.top < recessRect.top - 1 || buildRect.bottom > recessRect.bottom + 1) failures.push(prefix + "build menu clips outside seal recess");
    for (const metric of [...labelMetrics, ...groupMetrics]) {
      if (!metric.domFits) failures.push(prefix + "DOM text overflows: " + metric.text);
      if (!metric.canvasFits) failures.push(prefix + "canvas text overflows: " + metric.text);
    }

    return {
      verdict: failures.length === 0 ? "PASS" : "FAIL",
      failures,
      measurements: {
        viewport: ${JSON.stringify(viewport)},
        console: rectOf(consolePanel),
        sealRecess: recessRect,
        buildSeals: {
          ...buildRect,
          clientWidth: buildSeals.clientWidth,
          clientHeight: buildSeals.clientHeight,
          scrollWidth: buildSeals.scrollWidth,
          scrollHeight: buildSeals.scrollHeight,
          overflowY: getComputedStyle(buildSeals).overflowY,
        },
        minimap: mapRect,
        labels: labelMetrics,
        groupLabels: groupMetrics,
      },
    };
  })()`;
}

await main();

async function launchChrome(input: {
  readonly chromePath: string;
  readonly remoteDebuggingPort: number;
  readonly userDataPrefix: string;
  readonly extraArgs?: readonly string[];
}): Promise<ChromeSession> {
  const userDataDir = await mkdtemp(path.join(tmpdir(), input.userDataPrefix));
  const chrome = spawn(input.chromePath, [
    "--headless=new",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    ...(input.extraArgs ?? []),
    "--no-first-run",
    "--no-default-browser-check",
    `--remote-debugging-port=${input.remoteDebuggingPort}`,
    `--user-data-dir=${userDataDir}`,
    "about:blank",
  ], { stdio: ["ignore", "ignore", "pipe"] });
  let stderr = "";
  chrome.stderr?.on("data", (chunk: Buffer) => {
    stderr += chunk.toString();
  });
  return { chrome, userDataDir, stderr: () => stderr };
}

async function closeChrome(session: ChromeSession): Promise<void> {
  session.chrome.kill("SIGTERM");
  if (session.chrome.exitCode === null && session.chrome.signalCode === null) {
    await Promise.race([
      new Promise((resolve) => session.chrome.once("exit", resolve)),
      delay(2_000).then(() => {
        session.chrome.kill("SIGKILL");
      }),
    ]);
  }
  await rm(session.userDataDir, { recursive: true, force: true });
}

async function waitForChrome(port: number, stderr: () => string): Promise<void> {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (response.ok) return;
    } catch {
      // Chrome is still starting.
    }
    await delay(100);
  }
  throw new Error(`Chrome did not expose CDP on ${port}: ${stderr()}`);
}

async function createTarget(port: number, url: string): Promise<{ readonly webSocketDebuggerUrl: string }> {
  const response = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, {
    method: "PUT",
  });
  if (!response.ok) throw new Error(`Unable to create Chrome target: HTTP ${response.status}`);
  const body: unknown = await response.json();
  if (!isRecord(body) || typeof body.webSocketDebuggerUrl !== "string") {
    throw new Error("Chrome target response did not include webSocketDebuggerUrl");
  }
  return { webSocketDebuggerUrl: body.webSocketDebuggerUrl };
}

async function createCdpClient(webSocketUrl: string): Promise<CdpClient> {
  if (globalThis.WebSocket === undefined) {
    throw new Error("global WebSocket is unavailable in this Node runtime");
  }
  const socket = new WebSocket(webSocketUrl);
  await new Promise<void>((resolve, reject) => {
    socket.addEventListener("open", () => resolve(), { once: true });
    socket.addEventListener("error", () => reject(new Error("CDP WebSocket failed to open")), { once: true });
  });

  let nextId = 1;
  const pending = new Map<number, CdpPendingRequest>();
  socket.addEventListener("message", (event) => {
    const message = cdpMessageFromEventData(event.data);
    const id = typeof message.id === "number" ? message.id : null;
    if (id === null) return;
    const request = pending.get(id);
    if (request === undefined) return;
    pending.delete(id);
    if (isRecord(message.error) && typeof message.error.message === "string") {
      request.reject(new Error(message.error.message));
      return;
    }
    request.resolve(message);
  });

  const send = (method: string, params: Record<string, unknown> = {}) => {
    const id = nextId;
    nextId += 1;
    socket.send(JSON.stringify({ id, method, params }));
    return new Promise<Record<string, unknown>>((resolve, reject) => {
      pending.set(id, { resolve, reject });
    });
  };

  return {
    send,
    evaluate: async (expression, awaitPromise) => {
      const response = await send("Runtime.evaluate", {
        expression,
        awaitPromise,
        returnByValue: true,
      });
      if (response.exceptionDetails !== undefined) {
        throw new Error("Runtime.evaluate failed");
      }
      const result = response.result;
      if (!isRecord(result) || !isRecord(result.result)) return undefined;
      return result.result.value;
    },
    close: () => socket.close(),
  };
}

async function frames(count: number): Promise<void> {
  await delay(Math.max(50, count * 16));
}

function cdpMessageFromEventData(data: MessageEvent["data"]): Record<string, unknown> {
  if (typeof data !== "string") throw new Error("CDP message was not a string");
  const parsed: unknown = JSON.parse(data);
  if (!isRecord(parsed)) throw new Error("CDP message was not an object");
  return parsed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseBrowserProof(value: unknown): BrowserProof {
  if (!isRecord(value)) throw new Error("browser proof did not return an object");
  if (value.verdict !== "PASS" && value.verdict !== "FAIL") {
    throw new Error("browser proof returned an invalid verdict");
  }
  if (!Array.isArray(value.failures) || !value.failures.every((failure) => typeof failure === "string")) {
    throw new Error("browser proof returned invalid failures");
  }
  return {
    verdict: value.verdict,
    failures: value.failures,
    measurements: value.measurements,
  };
}
