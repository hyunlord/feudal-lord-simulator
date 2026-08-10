export const PHASE14_PROFILE_MINUTES = [1, 3, 5, 7, 10];
export const PHASE14_ELAPSED_TOLERANCE_MS = 1_500;
export const PHASE14_MIN_FRAME_DENSITY_PER_SECOND = 10;
export const PHASE14_FRAME_REGRESSION_LIMIT = 1.2;

export function assertPhase14LongProfileEvidence(evidence) {
  const failures = [];
  if (!isRecord(evidence)) throw new Error("phase14 evidence must be an object");
  if (evidence.schemaVersion !== 1) failures.push("schemaVersion must be 1");
  assertRevision(evidence, failures);
  assertControls(evidence.controls, failures);
  const checkpoints = Array.isArray(evidence.checkpoints) ? evidence.checkpoints : [];
  if (checkpoints.length !== PHASE14_PROFILE_MINUTES.length) failures.push("checkpoints must include minute 1,3,5,7,10");
  for (const minute of PHASE14_PROFILE_MINUTES) {
    const checkpoint = checkpoints.find((entry) => isRecord(entry) && entry.minute === minute);
    if (checkpoint === undefined) {
      failures.push(`missing minute ${minute} checkpoint`);
      continue;
    }
    assertCheckpoint(checkpoint, minute, failures);
  }
  assertProfileProgress(evidence.initialSnapshot, checkpoints, failures);
  assertCleanFailures(evidence.errors, "errors", failures);
  const minuteOne = checkpoints.find((entry) => isRecord(entry) && entry.minute === 1);
  const minuteTen = checkpoints.find((entry) => isRecord(entry) && entry.minute === 10);
  if (isRecord(minuteOne) && isRecord(minuteTen)) assertFrameRegression(minuteOne.frame, minuteTen.frame, failures);
  if (failures.length > 0) throw new Error(`phase14 long profile invalid: ${failures.join("; ")}`);
  return { ok: true };
}

function assertRevision(evidence, failures) {
  if (evidence.revisionDirty !== false || typeof evidence.revision !== "string" || !/^[0-9a-f]{40}$/i.test(evidence.revision)) {
    failures.push("release evidence requires a clean 40-hex revision");
  }
  if (evidence.revisionSource !== "git" && evidence.revisionSource !== "argument") {
    failures.push("revisionSource must be git or argument");
  }
}

export function summarizePhase14CallbackSamples(samples) {
  if (!Array.isArray(samples)) throw new Error("frame callback samples must be an array");
  const frames = new Map();
  for (const sample of samples) {
    if (!isRecord(sample)) throw new Error("frame callback sample must be an object");
    const time = finiteNumber(sample.frameTimestamp, "frameTimestamp");
    const duration = finiteNumber(sample.callbackWorkMs, "callbackWorkMs");
    frames.set(time, (frames.get(time) ?? 0) + duration);
  }
  return summarizeFrameDurations([...frames.values()]);
}

export function summarizeFrameDurations(durations) {
  if (!Array.isArray(durations) || durations.length === 0) {
    return { sampleCount: 0, avgMs: 0, p95Ms: 0, maxMs: 0, over20: 0 };
  }
  const sorted = durations.map((value) => finiteNumber(value, "frame duration")).sort((left, right) => left - right);
  const total = sorted.reduce((sum, value) => sum + value, 0);
  return {
    sampleCount: sorted.length,
    avgMs: total / sorted.length,
    p95Ms: percentile(sorted, 0.95),
    maxMs: sorted[sorted.length - 1],
    over20: sorted.filter((value) => value > 20).length,
  };
}

function assertControls(controls, failures) {
  if (!isRecord(controls)) {
    failures.push("controls must be an object");
    return;
  }
  for (const key of ["welcomeDismissed", "playPressed", "fivefoldPressed", "autoplayPressed"]) {
    if (controls[key] !== true) failures.push(`${key} must be true`);
  }
  if (controls.fivefoldAriaPressed !== "true") failures.push("5x aria-pressed must be true");
  if (controls.autoplayAriaPressed !== "true") failures.push("autoplay aria-pressed must be true");
  if (controls.visibility !== "visible") failures.push("autoplay visibility must be visible");
  if (controls.activeElement !== "autoplay") failures.push("autoplay control must retain focus");
  if (controls.documentVisibilityState !== "visible") failures.push("document visibility must be visible");
  if (controls.documentHasFocus !== true) failures.push("document focus must be true");
}

function assertCheckpoint(checkpoint, minute, failures) {
  const targetElapsedMs = minute * 60_000;
  if (checkpoint.targetElapsedMs !== targetElapsedMs) failures.push(`minute ${minute} targetElapsedMs mismatch`);
  if (checkpoint.windowStartMs !== targetElapsedMs - 60_000) failures.push(`minute ${minute} windowStartMs mismatch`);
  if (checkpoint.windowDurationMs !== 60_000) failures.push(`minute ${minute} windowDurationMs must be 60000`);
  const elapsedMs = numberOrFailure(checkpoint.elapsedMs, `minute ${minute} elapsed`, failures);
  if (elapsedMs !== null && Math.abs(elapsedMs - targetElapsedMs) > PHASE14_ELAPSED_TOLERANCE_MS) {
    failures.push(`minute ${minute} elapsed outside ${PHASE14_ELAPSED_TOLERANCE_MS}ms tolerance`);
  }
  assertDensity(checkpoint, minute, failures);
  assertCounts(checkpoint.snapshotCounts, minute, failures);
  assertHeap(checkpoint.heapUsage, minute, failures);
  if (!Array.isArray(checkpoint.performanceMetrics) || checkpoint.performanceMetrics.length === 0) {
    failures.push(`minute ${minute} Performance.getMetrics result is required`);
  }
  assertFrame(checkpoint.frame, minute, failures);
  assertScreenshot(checkpoint.screenshot, minute, failures);
  assertCleanFailures(checkpoint.failures, `minute ${minute} failures`, failures);
}

function assertDensity(checkpoint, minute, failures) {
  const sampleCount = isRecord(checkpoint.frame) ? numberOrFailure(checkpoint.frame.sampleCount, `minute ${minute} frame sampleCount`, failures) : null;
  if (sampleCount !== null && sampleCount / 60 < PHASE14_MIN_FRAME_DENSITY_PER_SECOND) {
    failures.push(`minute ${minute} frame density below ${PHASE14_MIN_FRAME_DENSITY_PER_SECOND}/s`);
  }
}

function assertProfileProgress(initialSnapshot, checkpoints, failures) {
  if (!isRecord(initialSnapshot) || !isRecord(initialSnapshot.snapshotCounts)) {
    failures.push("initialSnapshot with snapshotCounts is required");
    return;
  }
  let previousTick = numberOrFailure(initialSnapshot.tick, "initial tick", failures);
  for (const checkpoint of checkpoints) {
    if (!isRecord(checkpoint)) continue;
    const tick = numberOrFailure(checkpoint.tick, `minute ${checkpoint.minute} tick`, failures);
    if (tick !== null && previousTick !== null && tick <= previousTick) {
      failures.push(`minute ${checkpoint.minute} tick must advance`);
    }
    if (tick !== null) previousTick = tick;
  }
  const finalCounts = checkpoints.at(-1)?.snapshotCounts;
  const initialCounts = initialSnapshot.snapshotCounts;
  if (!isRecord(finalCounts)) return;
  const buildingGrowth = finiteCount(finalCounts.buildings) > finiteCount(initialCounts.buildings);
  const houseGrowth = finiteCount(finalCounts.houses) > finiteCount(initialCounts.houses);
  if (!buildingGrowth && !houseGrowth) failures.push("settlement must grow during autoplay profile");
}

function finiteCount(value) {
  return Number.isInteger(value) && value >= 0 ? value : Number.NaN;
}

function assertCounts(counts, minute, failures) {
  if (!isRecord(counts)) {
    failures.push(`minute ${minute} snapshotCounts must be an object`);
    return;
  }
  for (const key of ["buildings", "houses", "walkers", "constructionSites"]) {
    const value = counts[key];
    if (!Number.isInteger(value) || value < 0) failures.push(`minute ${minute} snapshotCounts.${key} must be a nonnegative integer`);
  }
}

function assertHeap(heapUsage, minute, failures) {
  if (!isRecord(heapUsage)) {
    failures.push(`minute ${minute} Runtime.getHeapUsage result is required`);
    return;
  }
  numberOrFailure(heapUsage.usedSize, `minute ${minute} heap usedSize`, failures);
  numberOrFailure(heapUsage.totalSize, `minute ${minute} heap totalSize`, failures);
}

function assertFrame(frame, minute, failures) {
  if (!isRecord(frame)) {
    failures.push(`minute ${minute} frame summary must be an object`);
    return;
  }
  for (const key of ["sampleCount", "avgMs", "p95Ms", "maxMs", "over20"]) {
    numberOrFailure(frame[key], `minute ${minute} frame ${key}`, failures);
  }
}

function assertScreenshot(screenshot, minute, failures) {
  if (!isRecord(screenshot)) {
    failures.push(`minute ${minute} screenshot object is required`);
    return;
  }
  if (typeof screenshot.path !== "string" || screenshot.path.length === 0) failures.push(`minute ${minute} screenshot path is required`);
  if (!Number.isInteger(screenshot.byteLength) || screenshot.byteLength <= 0) failures.push(`minute ${minute} screenshot byteLength is required`);
  if (typeof screenshot.sha256 !== "string" || !/^[0-9a-f]{64}$/i.test(screenshot.sha256)) {
    failures.push(`minute ${minute} screenshot sha256 is required`);
  }
}

function assertCleanFailures(value, label, failures) {
  if (!isRecord(value)) {
    failures.push(`${label} must be an object`);
    return;
  }
  for (const key of ["console", "page", "network", "resource", "log", "runtime"]) {
    if (!Array.isArray(value[key])) failures.push(`${label}.${key} must be an array`);
    else if (value[key].length > 0) failures.push(`${label}.${key} contains failures`);
  }
}

function assertFrameRegression(minuteOneFrame, minuteTenFrame, failures) {
  if (!isRecord(minuteOneFrame) || !isRecord(minuteTenFrame)) return;
  for (const key of ["avgMs", "p95Ms"]) {
    const baseline = numberOrFailure(minuteOneFrame[key], `minute1 ${key}`, failures);
    const current = numberOrFailure(minuteTenFrame[key], `minute10 ${key}`, failures);
    if (baseline === null || current === null) continue;
    if (baseline === 0 && current > 0) failures.push(`minute10 ${key} has nonzero value against zero baseline`);
    if (baseline > 0 && current > baseline * PHASE14_FRAME_REGRESSION_LIMIT) {
      failures.push(`minute10 ${key} exceeds 1.2x minute1`);
    }
  }
}

function numberOrFailure(value, label, failures) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  failures.push(`${label} must be finite`);
  return null;
}

function finiteNumber(value, label) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  throw new Error(`${label} must be finite`);
}

function percentile(sorted, ratio) {
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)];
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
