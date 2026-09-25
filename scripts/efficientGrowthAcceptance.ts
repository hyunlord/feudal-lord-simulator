export type EfficiencyMetrics = Readonly<{
  lots: number; arableCells: number; farmsteads: number; mills: number; chronicZeroWheatMills: number;
  chronicZeroWheatKnown: boolean; chronicZeroWheatObservedTicks: number;
  granaries: number; markets: number; churches: number; population: number;
  idleWorkers: number; buildings: number; warnings: number;
  coveredTicks: number; fullWindow: boolean; known: boolean;
  rawStarvedTicks: number; eligibleMillTicks: number;
}>;

/**
 * AF-14 facility cap that replaced "mills ≤ wheat farms": arable zone cells per housing lot. Provisional 10 for the
 * first C1c-2 guardrail run; the final value is the largest observed × 1.2 (docs/verification/c1c2-arable).
 */
export const ARABLE_CELLS_PER_LOT_CAP = 10;

export function efficientAcceptance(metrics: EfficiencyMetrics) {
  const finite = Object.values(metrics).every(value => typeof value === 'boolean' || Number.isFinite(value) && value >= 0);
  const rawStarvationRatio = metrics.eligibleMillTicks > 0 ? metrics.rawStarvedTicks / metrics.eligibleMillTicks : null;
  const warningRatio = metrics.buildings > 0 ? metrics.warnings / metrics.buildings : null;
  const idleRatio = metrics.population > 0 ? metrics.idleWorkers / metrics.population : null;
  const zeroWheatMillRatio = metrics.chronicZeroWheatKnown && metrics.mills > 0
    ? metrics.chronicZeroWheatMills / metrics.mills : null;
  const checks = {
    validMetrics: finite,
    arableCells: metrics.lots > 0 && metrics.arableCells <= metrics.lots * ARABLE_CELLS_PER_LOT_CAP,
    granaries: metrics.granaries <= Math.ceil(metrics.lots / 4) + 1,
    markets: metrics.markets <= Math.ceil(metrics.lots / 24) + 1,
    churches: metrics.churches <= Math.ceil(metrics.lots / 32) + 1,
    observedWindow: metrics.known && metrics.fullWindow && metrics.coveredTicks >= 2400,
    observedMillActivity: metrics.eligibleMillTicks > 0,
    warnings: warningRatio !== null && warningRatio < 0.1,
  };
  const arableCellsPerLot = metrics.lots > 0 ? metrics.arableCells / metrics.lots : null;
  return { passed: Object.values(checks).every(Boolean), checks, metrics, rawStarvationRatio, warningRatio, idleRatio, arableCellsPerLot,
    zeroWheatMillRatio,
    highIdleDiagnostic: idleRatio !== null && idleRatio > 0.25 };
}

export type CaptureEvidence = Readonly<{
  filename: string; jpegSha256: string; stateSha256: string; captured: boolean;
  width: number; height: number; dpr: number; zoom: number;
  assetsLoaded: boolean; buildings: number; warnings: number;
}>;
export function captureAcceptance(capture: CaptureEvidence | null) {
  const checks = {
    captured: capture !== null && capture.captured && capture.filename.endsWith('.jpg') && /^[a-f0-9]{64}$/.test(capture.jpegSha256),
    stateLinked: capture !== null && /^[a-f0-9]{64}$/.test(capture.stateSha256),
    dimensions: capture?.width === 1600 && capture.height === 1100 && capture.dpr === 1 && capture.zoom === 0.9,
    assetsLoaded: capture?.assetsLoaded === true,
    visibleWarnings: capture !== null && Number.isInteger(capture.buildings) && capture.buildings > 0 &&
      Number.isInteger(capture.warnings) && capture.warnings >= 0 && capture.warnings / capture.buildings < 0.1,
  };
  return { passed: Object.values(checks).every(Boolean), checks };
}
