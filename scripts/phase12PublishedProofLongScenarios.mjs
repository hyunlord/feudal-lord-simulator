import { mkdir } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";

import { proofSnapshot } from "./phase10BrowserProofCdp.mjs";
import {
  assertAutoplayTenMinuteEvidence,
  assertGuidedFiveMinuteEvidence,
} from "./phase12PublishedProofAssertions.mjs";
import {
  AUTOPLAY_TOGGLE_LABEL,
  browserElapsed,
  clickByTextOrAria,
  navigateFreshProofPage,
  pageMissingAssets,
  proofCapture,
  startScenarioClock,
  waitUntilElapsed,
  withCommon,
} from "./phase12PublishedProofBrowser.mjs";
import { followDedicatedGuidance } from "./phase12PublishedProofGuided.mjs";
import {
  createAutoplayObservation,
  finishAutoplayObservation,
  sampleAutoplayObservation,
} from "./phase12PublishedProofAutoplay.mjs";

export async function runGuidedFiveMinutes(client, config) {
  const pageSetup = await navigateFreshProofPage(client, config.url);
  await mkdir(config.screenshotDir, { recursive: true });
  const screenshots = [];
  const actions = [];
  const guesses = [];
  await clickByTextOrAria(client, "1배속");
  const startedAt = await startScenarioClock(client);
  await delay(1_500);
  await proofCapture({ client, dir: config.screenshotDir, screenshots, label: "guided-start", startedAt });
  let attempt = 0;
  while (await browserElapsed(client, startedAt) < config.guidedDurationMs) {
    const atMs = await browserElapsed(client, startedAt);
    const step = await followDedicatedGuidance(client, { atMs, attempt });
    if (step.action !== null) actions.push(step.action);
    guesses.push(step.guess);
    attempt += 1;
    await waitUntilElapsed(client, startedAt, Math.min(config.guidedDurationMs, atMs + 20_000));
  }
  await clickByTextOrAria(client, "일시 정지");
  const final = await proofCapture({ client, dir: config.screenshotDir, screenshots, label: "guided-final", startedAt });
  const evidence = withCommon(config, {
    elapsedMs: await browserElapsed(client, startedAt),
    speed: 1,
    setupInteractions: [pageSetup, { atMs: 0, label: "press visible 1x control", reason: "follow guidance at the requested normal speed" }],
    finalPopulation: final.snapshot.population,
    actions,
    guesses,
    blankCanvas: final.canvas.visiblePixels === 0,
    missingAssets: await pageMissingAssets(client),
    screenshots,
  });
  assertGuidedFiveMinuteEvidence(evidence);
  return evidence;
}

export async function runAutoplayTenMinutes(client, config) {
  const pageSetup = await navigateFreshProofPage(client, config.url);
  await mkdir(config.screenshotDir, { recursive: true });
  const screenshots = [];
  const observation = await createAutoplayObservation(client);
  const startedAt = await startScenarioClock(client);
  const first = await proofCapture({ client, dir: config.screenshotDir, screenshots, label: "autoplay-start", startedAt });
  const populationCurve = [{ atMs: 0, population: first.snapshot.population }];
  let nextPopulationSampleMs = 60_000;
  await clickByTextOrAria(client, AUTOPLAY_TOGGLE_LABEL);
  await clickByTextOrAria(client, "1배속");
  while (await browserElapsed(client, startedAt) < config.autoplayDurationMs) {
    const elapsed = await browserElapsed(client, startedAt);
    await delay(Math.min(125, Math.max(0, config.autoplayDurationMs - elapsed)));
    const sampledAt = await browserElapsed(client, startedAt);
    await sampleAutoplayObservation(client, observation, sampledAt);
    if (sampledAt >= nextPopulationSampleMs) {
      const snapshot = await proofSnapshot(client);
      populationCurve.push({ atMs: Math.round(sampledAt), population: snapshot.population });
      nextPopulationSampleMs += 60_000;
    }
  }
  const graceDeadline = config.autoplayDurationMs + 500;
  while (observation.pending.length > 0 && await browserElapsed(client, startedAt) < graceDeadline) {
    await delay(125);
    await sampleAutoplayObservation(client, observation, await browserElapsed(client, startedAt));
  }
  await clickByTextOrAria(client, AUTOPLAY_TOGGLE_LABEL);
  await clickByTextOrAria(client, "일시 정지");
  const elapsedMs = await browserElapsed(client, startedAt);
  const sensibility = finishAutoplayObservation(observation, elapsedMs);
  const final = await proofCapture({ client, dir: config.screenshotDir, screenshots, label: "autoplay-final", startedAt });
  const evidence = withCommon(config, {
    elapsedMs,
    populationCurve,
    setupInteractions: [
      pageSetup,
      { atMs: 0, label: "enable visible autoplay control", reason: "begin the requested advisor observation" },
      { atMs: 0, label: "press visible 1x control", reason: "observe autoplay at normal speed" },
    ],
    actionOrder: observation.actionOrder,
    sensibility,
    blankCanvas: final.canvas.visiblePixels === 0,
    missingAssets: await pageMissingAssets(client),
    screenshots,
  });
  assertAutoplayTenMinuteEvidence(evidence);
  return evidence;
}
