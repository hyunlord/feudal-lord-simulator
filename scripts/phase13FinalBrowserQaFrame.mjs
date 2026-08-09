import { setTimeout as delay } from "node:timers/promises";

import { PHASE13_FRAME_DURATION_MS } from "./phase13FinalBrowserQaConstants.mjs";
import { Phase13FinalBrowserQaError } from "./phase13FinalBrowserQaAssertions.mjs";

export async function capturePhase13FrameProfile(input) {
  await input.client.send("Page.addScriptToEvaluateOnNewDocument", { source: phase13FrameProbeSource() });
  await input.prepare();
  await delay(5_000);
  const startedAt = await input.client.evaluate("window.__PHASE13_FRAME_TIMES__.length = 0; window.__PHASE13_FRAME_ACTIVE__ = true; performance.now()", true);
  await delay(input.durationMs);
  const endedAt = await input.client.evaluate("window.__PHASE13_FRAME_ACTIVE__ = false; performance.now()", false);
  await delay(50);
  const frameTimes = await input.client.evaluate("window.__PHASE13_FRAME_TIMES__ ?? []", false);
  return summarizePhase13FrameProfile(frameTimes, { startedAt, endedAt });
}

export function summarizePhase13FrameProfile(frameTimes, timing = null) {
  if (!Array.isArray(frameTimes) || frameTimes.length === 0) throw new Phase13FinalBrowserQaError("frameProfile requires measured frames");
  const elapsedMs = timing === null ? PHASE13_FRAME_DURATION_MS : timing.endedAt - timing.startedAt;
  const sorted = [...frameTimes].sort((left, right) => left - right);
  const total = frameTimes.reduce((sum, value) => sum + value, 0);
  const metrics = {
    minMs: sorted[0],
    p50Ms: percentile(sorted, 0.5),
    p75Ms: percentile(sorted, 0.75),
    p90Ms: percentile(sorted, 0.9),
    p95Ms: percentile(sorted, 0.95),
    p99Ms: percentile(sorted, 0.99),
    maxMs: sorted[sorted.length - 1],
    avgMs: total / frameTimes.length,
    over16_67: frameTimes.filter((value) => value > 16.67).length,
    over20: frameTimes.filter((value) => value > 20).length,
  };
  return {
    durationMs: PHASE13_FRAME_DURATION_MS,
    elapsedMs,
    startedAt: timing?.startedAt ?? null,
    endedAt: timing?.endedAt ?? null,
    measuredFrameCount: frameTimes.length,
    metrics,
    failures: metrics.over20 === 0 ? [] : [`${metrics.over20} frames exceeded 20ms`],
  };
}

export function phase13FrameProbeSource() {
  return `(() => {
    const frameTimes = [];
    const pendingFrames = new Map();
    const original = window.requestAnimationFrame.bind(window);
    window.__PHASE13_FRAME_TIMES__ = frameTimes;
    window.__PHASE13_FRAME_ACTIVE__ = false;
    window.requestAnimationFrame = (callback) => original((time) => {
      if (!window.__PHASE13_FRAME_ACTIVE__) {
        callback(time);
        return;
      }
      const startedAt = performance.now();
      try {
        callback(time);
      } finally {
        pendingFrames.set(time, (pendingFrames.get(time) ?? 0) + performance.now() - startedAt);
        setTimeout(() => {
          if (!pendingFrames.has(time)) return;
          frameTimes.push(pendingFrames.get(time));
          pendingFrames.delete(time);
        }, 0);
      }
    });
  })();`;
}

function percentile(sorted, ratio) {
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)];
}
