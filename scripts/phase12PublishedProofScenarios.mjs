import { mkdir } from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { canvasHash } from "./phase10BrowserProofCdp.mjs";
import { summarizeFrameBudget } from "./phase10BrowserProofAssertions.mjs";
import {
  assertFrameBudgetEvidence,
  assertHonestOneMinuteEvidence,
  assertPressPlayThirtySecondEvidence,
} from "./phase12PublishedProofAssertions.mjs";
import {
  browserElapsed,
  clickByTextOrAria,
  clickSelector,
  frameProbeSource,
  honestCapture,
  navigateFreshPage,
  navigateFreshProofPage,
  pageMissingAssets,
  proofCapture,
  resetFrameSamples,
  resourceHash,
  startScenarioClock,
  waitUntilElapsed,
  walkerHash,
  withCommon,
} from "./phase12PublishedProofBrowser.mjs";
import {
  runAutoplayTenMinutes,
  runGuidedFiveMinutes,
} from "./phase12PublishedProofLongScenarios.mjs";

export async function runScenario(client, config) {
  if (config.scenario === "press-play-30s") return runPressPlayThirtySeconds(client, config);
  if (config.scenario === "guided-5min") return runGuidedFiveMinutes(client, withDuration(config, "guidedDurationMs", 300_000));
  if (config.scenario === "autoplay-10min") return runAutoplayTenMinutes(client, withDuration(config, "autoplayDurationMs", 600_000));
  if (config.scenario === "honest-minute") return runHonestOneMinute(client, config);
  if (config.scenario === "frame-budget") return runFrameBudget(client, config);
  if (config.scenario === "final-all") return runFinalAll(client, config);
  throw new Error(`unsupported scenario ${config.scenario}`);
}

async function runPressPlayThirtySeconds(client, config) {
  const pageSetup = await navigateFreshProofPage(client, config.url);
  await mkdir(config.screenshotDir, { recursive: true });
  const screenshots = [];
  const fresh = await proofCapture({ client, dir: config.screenshotDir, screenshots, label: "fresh" });
  await clickByTextOrAria(client, "1배속");
  const startedAt = await startScenarioClock(client);
  await waitUntilElapsed(client, startedAt, 10_000);
  const ten = await proofCapture({ client, dir: config.screenshotDir, screenshots, label: "play-10s", startedAt });
  await waitUntilElapsed(client, startedAt, 30_000);
  const final = await proofCapture({ client, dir: config.screenshotDir, screenshots, label: "play-30s", startedAt });
  await clickByTextOrAria(client, "일시 정지");
  const evidence = withCommon(config, {
    elapsedMs: await browserElapsed(client, startedAt),
    setupInteractions: [pageSetup, { atMs: 0, label: "press visible 1x control", reason: "begin the thirty-second play observation" }],
    initialWalkerHash: walkerHash(fresh.snapshot),
    tenSecondWalkerHash: walkerHash(ten.snapshot),
    finalWalkerHash: walkerHash(final.snapshot),
    resourceChanged: resourceHash(fresh.snapshot) !== resourceHash(final.snapshot),
    visibleActivityBy10s: walkerHash(fresh.snapshot) !== walkerHash(ten.snapshot) || fresh.canvas.hash !== ten.canvas.hash,
    blankCanvas: final.canvas.visiblePixels === 0,
    missingAssets: await pageMissingAssets(client),
    screenshots,
  });
  assertPressPlayThirtySecondEvidence(evidence);
  return evidence;
}

async function runHonestOneMinute(client, config) {
  await navigateFreshPage(client, config.url);
  await mkdir(config.screenshotDir, { recursive: true });
  const screenshots = [];
  const setupInteractions = [];
  const fresh = await honestCapture({ client, dir: config.screenshotDir, screenshots, label: "honest-start" });
  await clickSelector(client, ".welcome-dismiss-layer");
  setupInteractions.push({ atMs: 0, label: "dismiss visible welcome guidance", reason: "start from the true fresh published page through its rendered UI" });
  await clickByTextOrAria(client, "1배속");
  setupInteractions.push({ atMs: 0, label: "press visible 1x control", reason: "begin the requested sixty-second observation" });
  const startedAt = await startScenarioClock(client);
  await waitUntilElapsed(client, startedAt, config.honestDurationMs ?? 60_000);
  const final = await honestCapture({ client, dir: config.screenshotDir, screenshots, label: "honest-60s", startedAt });
  const evidence = withCommon(config, {
    elapsedMs: await browserElapsed(client, startedAt),
    untouched: false,
    setupInteractions,
    openingText: fresh.documentSummary,
    finalText: final.documentSummary,
    blankCanvas: final.canvas.visiblePixels === 0,
    missingAssets: final.documentSummary.resourceErrors,
    screenshots,
  });
  assertHonestOneMinuteEvidence(evidence);
  return evidence;
}

async function runFrameBudget(client, config) {
  await client.send("Page.addScriptToEvaluateOnNewDocument", { source: frameProbeSource() });
  const pageSetup = await navigateFreshProofPage(client, config.url);
  await clickByTextOrAria(client, "5배속");
  await resetFrameSamples(client);
  const startedAt = await startScenarioClock(client);
  await delay(config.durationMs);
  const frameTimes = await client.evaluate("window.__PHASE12_FRAME_TIMES__ ?? []", false);
  const summary = summarizeFrameBudget(frameTimes, config.maxFrameMs);
  const canvas = await canvasHash(client);
  const evidence = withCommon(config, {
    durationMs: await browserElapsed(client, startedAt),
    speed: config.speed,
    setupInteractions: [pageSetup, { atMs: 0, label: "press visible 5x control", reason: "measure the requested fivefold frame budget" }],
    maxFrameMs: config.maxFrameMs,
    ...summary,
    canvas,
    blankCanvas: canvas.visiblePixels === 0,
    missingAssets: await pageMissingAssets(client),
  });
  assertFrameBudgetEvidence(evidence);
  return evidence;
}

async function runFinalAll(client, config) {
  const root = config.evidenceRoot;
  const pressPlay = await runPressPlayThirtySeconds(client, { ...config, scenario: "press-play-30s", screenshotDir: path.join(root, "press-play") });
  const guided = await runGuidedFiveMinutes(client, { ...config, scenario: "guided-5min", screenshotDir: path.join(root, "guided") });
  const autoplay = await runAutoplayTenMinutes(client, { ...config, scenario: "autoplay-10min", screenshotDir: path.join(root, "autoplay") });
  const honest = await runHonestOneMinute(client, { ...config, scenario: "honest-minute", screenshotDir: path.join(root, "honest") });
  const frameBudget = await runFrameBudget(client, { ...config, scenario: "frame-budget", durationMs: config.frameBudgetDurationMs, speed: 5 });
  return withCommon(config, { pressPlay, guided, autoplay, honest, frameBudget });
}

function withDuration(config, key, fallback) {
  return { ...config, [key]: config[key] ?? fallback };
}
