import { execFileSync } from "node:child_process";

import { readDeploymentProof } from "./phase12PublishedProofDeployment.mjs";

export const PHASE12_PUBLISHED_URL = "https://hyunlord.github.io/feudal-lord-simulator/";

const DEFAULT_CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const SCENARIOS = [
  "press-play-30s",
  "guided-5min",
  "autoplay-10min",
  "honest-minute",
  "frame-budget",
  "final-all",
];

export function parsePhase12PublishedProofArgs(args) {
  const values = parsePairs(args);
  const scenario = requiredChoice(values, "scenario", SCENARIOS);
  const evidenceRoot = valueOrNull(values, "evidence-root");
  const out = valueOrNull(values, "out") ?? (evidenceRoot === null ? null : `${evidenceRoot}/${scenario}.json`);
  const screenshotDir = valueOrNull(values, "screenshot-dir") ?? (evidenceRoot === null ? null : `${evidenceRoot}/screens`);
  const config = {
    scenario,
    url: valueOrNull(values, "url") ?? valueOrNull(values, "public-url") ?? PHASE12_PUBLISHED_URL,
    speed: valueOrNull(values, "speed") === null ? defaultSpeed(scenario) : readInteger(required(values, "speed"), "speed"),
    durationMs: scenario === "frame-budget" ? readInteger(valueOrNull(values, "duration-ms") ?? "30000", "duration-ms") : null,
    maxFrameMs: Number.parseFloat(valueOrNull(values, "max-frame-ms") ?? "12"),
    out,
    screenshotDir,
    ...revisionProvenance(valueOrNull(values, "revision")),
    chromePath: valueOrNull(values, "chrome-path") ?? process.env.CHROME_PATH ?? DEFAULT_CHROME,
    chromePort: valueOrNull(values, "chrome-port") === null ? 9242 : readInteger(required(values, "chrome-port"), "chrome-port"),
  };
  if (config.out === null) throw new Error("--out or --evidence-root is required");
  if (config.screenshotDir === null) throw new Error("--screenshot-dir or --evidence-root is required");
  if (!Number.isFinite(config.maxFrameMs) || config.maxFrameMs <= 0) throw new Error("max-frame-ms must be positive");
  if (scenario === "frame-budget" && (config.speed !== 5 || config.durationMs !== 30_000)) {
    throw new Error("frame-budget requires --speed 5 --duration-ms 30000");
  }
  if (scenario !== "final-all") return config;
  if (config.url !== PHASE12_PUBLISHED_URL) throw new Error(`final-all requires published URL ${PHASE12_PUBLISHED_URL}`);
  const deploymentProofSource = valueOrNull(values, "deployment-proof");
  if (deploymentProofSource === null) throw new Error("final-all requires --deployment-proof");
  return {
    ...config,
    out: valueOrNull(values, "out") ?? `${requiredFinalRoot(evidenceRoot)}/final-all.json`,
    screenshotDir: valueOrNull(values, "screenshot-dir") ?? `${requiredFinalRoot(evidenceRoot)}/screens`,
    evidenceRoot: requiredFinalRoot(evidenceRoot),
    pressPlayDurationMs: readInteger(valueOrNull(values, "press-play-duration-ms") ?? "30000", "press-play-duration-ms"),
    guidedDurationMs: readInteger(valueOrNull(values, "guided-duration-ms") ?? "300000", "guided-duration-ms"),
    autoplayDurationMs: readInteger(valueOrNull(values, "autoplay-duration-ms") ?? "600000", "autoplay-duration-ms"),
    honestDurationMs: readInteger(valueOrNull(values, "honest-duration-ms") ?? "60000", "honest-duration-ms"),
    frameBudgetDurationMs: readInteger(valueOrNull(values, "frame-budget-duration-ms") ?? "30000", "frame-budget-duration-ms"),
    deploymentProof: readDeploymentProof(deploymentProofSource, config),
  };
}

export function readCleanRevision(value) {
  const normalized = value.trim();
  if (!/^[0-9a-f]{40}$/i.test(normalized)) throw new Error("Set --revision to a clean 40-hex revision.");
  return normalized;
}

export function assertPressPlayThirtySecondEvidence(input) {
  requireDuration(input.elapsedMs, 30_000, "press-play");
  requireScreenshots(input.screenshots, ["fresh", "play-10s", "play-30s"]);
  requireTimedScreenshot(input.screenshots, "play-10s", 10_000);
  requireTimedScreenshot(input.screenshots, "play-30s", 30_000);
  requireHealthyPage(input);
  if (input.initialWalkerHash === input.tenSecondWalkerHash || input.visibleActivityBy10s !== true) {
    throw new Error("Part 1 failed: pressing play produced no visible activity within 10 seconds");
  }
  if (input.initialWalkerHash === input.finalWalkerHash) throw new Error("walkers did not move during thirty-second published watch");
  if (input.resourceChanged !== true) throw new Error("no building inventory or treasury resource number changed");
  return { ok: true };
}

export function assertGuidedFiveMinuteEvidence(input) {
  requireDuration(input.elapsedMs, 300_000, "guided five-minute");
  requireScreenshots(input.screenshots, ["guided-start", "guided-final"]);
  requireHealthyPage(input);
  if (!Number.isInteger(input.finalPopulation) || input.finalPopulation < 0) throw new Error("guided proof requires finalPopulation");
  if (!Array.isArray(input.actions) || input.actions.length === 0) throw new Error("guided proof requires at least one followed guidance action");
  if (!Array.isArray(input.guesses)) throw new Error("guided proof requires explicit guess moments array");
  for (const action of input.actions) requireGuidedAction(action);
  for (const guess of input.guesses) requireKeys(guess, ["atMs", "prompt", "decision", "reason"], "guided guess");
  return { ok: true };
}

export function assertAutoplayTenMinuteEvidence(input) {
  requireDuration(input.elapsedMs, 600_000, "autoplay ten-minute");
  requireScreenshots(input.screenshots, ["autoplay-start", "autoplay-final"]);
  requireHealthyPage(input);
  if (!Array.isArray(input.populationCurve) || input.populationCurve.length < 2) throw new Error("autoplay proof requires population curve");
  const actionOrder = Array.isArray(input.actionOrder) ? input.actionOrder : input.buildOrder;
  if (!Array.isArray(actionOrder)) throw new Error("autoplay proof requires action order");
  if (actionOrder.length === 0) throw new Error("autoplay proof requires at least one advisor commit");
  if (input.sensibility?.sensible !== true && !Array.isArray(input.sensibility?.wrongChoices)) {
    throw new Error("autoplay proof requires sensibility judgment");
  }
  if (Array.isArray(input.actionOrder)) {
    if (input.sensibility?.derivedFrom !== "advisorCommits") throw new Error("autoplay sensibility must be derivedFrom advisorCommits");
    for (const action of input.actionOrder) requireAutoplayCommit(action);
  }
  rejectMillBeforeWheat(actionOrder);
  rejectRoadToNowhere(input.sensibility?.wrongChoices ?? []);
  return { ok: true };
}

export function assertHonestOneMinuteEvidence(input) {
  requireDuration(input.elapsedMs, 60_000, "honest one-minute");
  requireScreenshots(input.screenshots, ["honest-start", "honest-60s"]);
  requireHealthyPage(input);
  if (typeof input.untouched === "boolean") {
    if (!Array.isArray(input.setupInteractions)) throw new Error("honest one-minute proof requires setupInteractions");
    if (input.untouched && input.setupInteractions.length > 0) throw new Error("honest one-minute proof cannot call setup interactions untouched");
    if (!input.untouched && input.setupInteractions.length === 0) throw new Error("honest one-minute proof must record setup interactions");
    for (const interaction of input.setupInteractions) requireKeys(interaction, ["atMs", "label", "reason"], "honest setup interaction");
  } else if (input.interactions !== 0) {
    throw new Error("honest one-minute proof must be untouched");
  }
  return { ok: true };
}

export function assertFrameBudgetEvidence(input) {
  requireDuration(input.durationMs, 30_000, "frame budget");
  if (input.speed !== 5) throw new Error("frame budget requires 5x speed");
  if (input.p95Ms >= input.maxFrameMs) throw new Error(`frame p95 ${input.p95Ms}ms exceeded ${input.maxFrameMs}ms`);
  if (input.measuredFrames <= 0) throw new Error("frame budget requires measured frames");
  requireHealthyPage(input);
  return { ok: true };
}

function defaultSpeed(scenario) {
  return scenario === "frame-budget" ? 5 : 1;
}

function revisionProvenance(explicitRevision) {
  if (explicitRevision !== null) return { revision: readCleanRevision(explicitRevision), revisionSource: "explicit", revisionDirty: null };
  const head = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const dirty = execFileSync("git", ["status", "--porcelain", "--untracked-files=normal"], { encoding: "utf8" }).trim() !== "";
  if (dirty) throw new Error("Set --revision to a clean 40-hex published revision when the worktree is dirty.");
  return { revision: readCleanRevision(head), revisionSource: "git-head", revisionDirty: false };
}

function requireDuration(actual, expected, label) {
  if (!Number.isFinite(actual) || actual < expected) throw new Error(`${label} elapsed ${actual}ms < ${expected}ms`);
}

function requireScreenshots(actual, requiredLabels) {
  const labels = actual?.map((entry) => typeof entry === "string" ? entry : entry?.label) ?? [];
  const missing = requiredLabels.filter((label) => !labels.includes(label));
  if (missing.length > 0) throw new Error(`missing screenshots: ${missing.join(",")}`);
}

function requireTimedScreenshot(screenshots, label, expectedMs) {
  if (!Array.isArray(screenshots) || screenshots.every((entry) => typeof entry === "string")) return;
  const shot = screenshots.find((entry) => entry?.label === label);
  const atMs = shot?.atMs;
  if (!Number.isFinite(atMs) || atMs < expectedMs || atMs > expectedMs + 1_500) {
    throw new Error(`${label} timestamp must be ${expectedMs}-${expectedMs + 1_500}ms after Play`);
  }
}

function requireHealthyPage(input) {
  if (input.blankCanvas) throw new Error("published canvas was blank");
  if ((input.missingAssets ?? []).length > 0) throw new Error(`published assets failed: ${input.missingAssets.join(",")}`);
}

function requireKeys(value, keys, label) {
  for (const key of keys) {
    if (value?.[key] === undefined || value[key] === "") throw new Error(`${label} missing ${key}`);
  }
}

function requireGuidedAction(action) {
  requireKeys(action, ["atMs", "label", "outcome"], "guided action");
  const roundTwo = action?.source !== undefined || action?.gesture !== undefined || action?.before !== undefined;
  if (!roundTwo) {
    requireKeys(action, ["reason"], "guided action");
    return;
  }
  requireKeys(action, ["source", "gesture", "before", "after"], "guided action");
  if (!['onboarding-task-current', 'settlement-status'].includes(action.source)) throw new Error("guided action source is not dedicated guidance DOM");
  if (action.gesture === "road-drag") {
    if (!(action.after.roadRevision > action.before.roadRevision)) throw new Error("guided road action has no roadRevision state delta");
    return;
  }
  if (action.gesture !== "building-click") throw new Error(`guided action has unsupported gesture ${action.gesture}`);
  const siteDelta = action.after.constructionSites > action.before.constructionSites;
  const buildingDelta = action.after.buildings > action.before.buildings;
  if (!siteDelta && !buildingDelta) throw new Error("guided building action has no observable state delta");
}

function requireAutoplayCommit(action) {
  requireKeys(action, ["atMs", "kind", "label", "before", "after"], "autoplay action");
  if (action.kind === "place_road") {
    if (action.pulse?.message === undefined) throw new Error("autoplay road commit missing pulse");
    if (!(action.after.roadRevision > action.before.roadRevision)) throw new Error("autoplay road-to-nowhere: roadRevision did not change");
    return;
  }
  if (action.kind === "place_building") {
    requireKeys(action, ["building"], "autoplay building action");
    if (action.pulse?.message === undefined) throw new Error("autoplay building commit missing pulse");
    if (!(action.after.constructionSites > action.before.constructionSites || action.after.buildings > action.before.buildings)) {
      throw new Error("autoplay building commit has no state delta");
    }
    return;
  }
  if (action.kind === "proclaim_era") {
    if (action.before.era === action.after.era) throw new Error("autoplay proclamation has no era state delta");
    return;
  }
  throw new Error(`unsupported autoplay action kind ${action.kind}`);
}

function rejectMillBeforeWheat(buildOrder) {
  const wheatIndex = buildOrder.findIndex((entry) => (entry.building ?? entry.kind) === "wheat_farm");
  const millIndex = buildOrder.findIndex((entry) => (entry.building ?? entry.kind) === "mill");
  if (millIndex >= 0 && (wheatIndex < 0 || millIndex < wheatIndex)) throw new Error("autoplay built mill before wheat farm");
}

function rejectRoadToNowhere(wrongChoices) {
  if (wrongChoices.some((choice) => /road(?:ing)?[-_ ]to[-_ ]nowhere/i.test(choice))) throw new Error("autoplay road-to-nowhere");
}

function requiredFinalRoot(value) {
  if (value === null) throw new Error("final-all requires --evidence-root");
  return value;
}

function parsePairs(args) {
  const values = new Map();
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    const value = args[index + 1];
    if (!key?.startsWith("--") || value === undefined) throw new Error(`Invalid argument near ${key ?? "<end>"}`);
    values.set(key.slice(2), value);
  }
  return values;
}

function required(values, key) {
  const value = values.get(key);
  if (value === undefined || value.trim() === "") throw new Error(`Missing --${key}`);
  return value;
}

function valueOrNull(values, key) {
  return values.get(key) ?? null;
}

function requiredChoice(values, key, choices) {
  const value = required(values, key);
  if (!choices.includes(value)) throw new Error(`--${key} must be one of ${choices.join(", ")}`);
  return value;
}

function readInteger(value, label) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed.toString() !== value) throw new Error(`--${label} must be an integer`);
  return parsed;
}
