import { setTimeout as delay } from "node:timers/promises";

import {
  closeChrome,
  createCdpClient,
  createTarget,
  launchChrome,
  waitForChrome,
} from "./phase8Task10CdpClient.mjs";

const chromePath = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const baseUrl = process.env.BENCHMARK_URL ?? "http://127.0.0.1:3200";
const revision = readBenchmarkRevision();
const hostLabel = process.env.BENCHMARK_HOST_LABEL ?? "local";
const thresholdMs = Number.parseFloat(process.env.BENCHMARK_THRESHOLD_MS ?? "12");
const sampleCount = 5;
const remoteDebuggingPort = Number.parseInt(process.env.BENCHMARK_CHROME_PORT ?? "9230", 10);

const chromeSession = await launchChrome({
  chromePath,
  remoteDebuggingPort,
  userDataPrefix: "phase8-task10-benchmark-chrome-",
  extraArgs: ["--no-sandbox"],
});

try {
  await waitForChrome(remoteDebuggingPort, chromeSession.stderr);
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
  await closeChrome(chromeSession);
}

function readBenchmarkRevision() {
  const value = process.env.BENCHMARK_REVISION;
  if (value === undefined || value.trim() === "") {
    throw new Error("BENCHMARK_REVISION must be set to the exact committed revision.");
  }
  const exactRevision = value.trim();
  if (/dirty|unknown/i.test(exactRevision)) {
    throw new Error(`BENCHMARK_REVISION must be committed and exact; received ${exactRevision}`);
  }
  return exactRevision;
}
