import { mkdtemp, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { spawn } from "node:child_process";

const chromePath = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const baseUrl = process.env.BENCHMARK_URL ?? "http://127.0.0.1:3200";
const revision = process.env.BENCHMARK_REVISION ?? "unknown";
const hostLabel = process.env.BENCHMARK_HOST_LABEL ?? "local";
const thresholdMs = Number.parseFloat(process.env.BENCHMARK_THRESHOLD_MS ?? "12");
const sampleCount = Number.parseInt(process.env.BENCHMARK_SAMPLES ?? "5", 10);
const remoteDebuggingPort = Number.parseInt(process.env.BENCHMARK_CHROME_PORT ?? "9230", 10);
const require = createRequire(import.meta.url);

const userDataDir = await mkdtemp(path.join(tmpdir(), "phase8-task10-benchmark-chrome-"));
const chrome = spawn(chromePath, [
  "--headless=new",
  "--disable-gpu",
  "--disable-dev-shm-usage",
  "--no-sandbox",
  "--no-first-run",
  "--no-default-browser-check",
  `--remote-debugging-port=${remoteDebuggingPort}`,
  `--user-data-dir=${userDataDir}`,
  "about:blank",
], { stdio: ["ignore", "ignore", "pipe"] });

let stderr = "";
chrome.stderr.on("data", (chunk) => {
  stderr += chunk.toString();
});

async function createCdpClient(webSocketUrl) {
  const WebSocketConstructor = globalThis.WebSocket ?? require(process.env.WS_MODULE_PATH ?? "ws");
  const socket = new WebSocketConstructor(webSocketUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  let nextId = 1;
  const pending = new Map();
  const waiters = new Map();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id !== undefined) {
      const request = pending.get(message.id);
      if (request === undefined) return;
      pending.delete(message.id);
      if (message.error !== undefined) {
        request.reject(new Error(message.error.message));
      } else {
        request.resolve(message.result);
      }
      return;
    }
    const eventWaiters = waiters.get(message.method);
    if (eventWaiters === undefined || eventWaiters.length === 0) return;
    waiters.set(message.method, []);
    for (const resolve of eventWaiters) resolve(message.params);
  });
  const send = (method, params = {}) => {
    const id = nextId;
    nextId += 1;
    socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
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
        throw new Error(response.exceptionDetails.text ?? "Runtime.evaluate failed");
      }
      return response.result.value;
    },
    waitFor: (method) => new Promise((resolve) => {
      const eventWaiters = waiters.get(method) ?? [];
      eventWaiters.push(resolve);
      waiters.set(method, eventWaiters);
    }),
    close: () => socket.close(),
  };
}

try {
  await waitForChrome(remoteDebuggingPort);
  const target = await createTarget(remoteDebuggingPort);
  const client = await createCdpClient(target.webSocketDebuggerUrl);
  try {
    await client.send("Page.enable");
    await client.send("Runtime.enable");
    await client.send("Emulation.setDeviceMetricsOverride", {
      width: 1280,
      height: 720,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await client.send("Page.navigate", { url: baseUrl });
    await client.waitFor("Page.loadEventFired");
    await delay(500);
    const samples = [];
    for (let index = 0; index < sampleCount; index += 1) {
      const sample = await client.evaluate(`(async () => {
        const benchmark = await import("/scripts/phase4eBenchmarkFixture.ts");
        const result = await benchmark.runPhase4eRenderBenchmark("5x");
        return {
          index: ${index + 1},
          competition: result.competition,
          averageMs: result.averageMs,
          p95Ms: result.p95Ms,
          worstMs: result.worstMs,
          renderAverageMs: result.render.averageMs,
          simulationAverageMs: result.simulation.averageMs,
          overBudgetFrames: result.overBudgetFrames,
          measuredFrames: result.measuredFrames,
          entities: result.entities,
        };
      })()`, true);
      samples.push(sample);
    }
    const failing = samples.filter((sample) => sample.averageMs >= thresholdMs);
    if (failing.length > 0) {
      throw new Error(`benchmark average exceeded ${thresholdMs}ms: ${JSON.stringify(failing)}`);
    }
    process.stdout.write(`${JSON.stringify({
      schemaVersion: 1,
      hostLabel,
      revision,
      baseUrl,
      thresholdMs,
      userAgent: await client.evaluate("navigator.userAgent", false),
      samples,
    }, null, 2)}\n`);
  } finally {
    client.close();
  }
} finally {
  chrome.kill("SIGTERM");
  await onceExit(chrome);
  await rm(userDataDir, { recursive: true, force: true });
}

async function waitForChrome(port) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (response.ok) return;
    } catch {
      // Chrome is still starting.
    }
    await delay(100);
  }
  throw new Error(`Chrome did not expose CDP on ${port}: ${stderr}`);
}

async function createTarget(port) {
  const response = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent("about:blank")}`, {
    method: "PUT",
  });
  if (!response.ok) throw new Error(`Unable to create Chrome target: HTTP ${response.status}`);
  return response.json();
}

async function onceExit(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    delay(2_000).then(() => {
      child.kill("SIGKILL");
    }),
  ]);
}
