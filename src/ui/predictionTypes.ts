import type { PredictionLine as ContractPredictionLine } from '../contracts';
import type { TileCoordinate } from '../world/grid';
import type { PlacementResult } from '../world/placement';

/** A displayed forecast line: the shared `PredictionLine` contract plus a stable list key. */
export interface PredictionLine extends ContractPredictionLine {
  readonly id: string;
}

/**
 * Pre-contract line shape. Only `src/render/placementPredictionRuntime.ts` still builds one (the
 * construction-connection line); that file belongs to the concurrent render work, so the adapter accepts
 * it and `toPredictionLine` converts it for display. Remove once that call site emits `severity`.
 */
export interface LegacyPredictionLine {
  readonly id: string;
  readonly tone: 'neutral' | 'positive' | 'warning' | 'negative';
  readonly text: string;
}

export type PresentablePredictionLine = PredictionLine | LegacyPredictionLine;

/** Presentation key per severity; the CSS modifier and symbol table were defined on these names. */
export const PREDICTION_SEVERITY_TONE = {
  info: 'neutral', ok: 'positive', warn: 'warning', block: 'negative',
} as const satisfies Record<ContractPredictionLine['severity'], LegacyPredictionLine['tone']>;

const TONE_SEVERITY = {
  neutral: 'info', positive: 'ok', warning: 'warn', negative: 'block',
} as const satisfies Record<LegacyPredictionLine['tone'], ContractPredictionLine['severity']>;

export function toPredictionLine(line: PresentablePredictionLine): PredictionLine {
  return 'severity' in line ? line : { id: line.id, severity: TONE_SEVERITY[line.tone], text: line.text, sources: [] };
}

/** Domain-independent presentation contract, shared by future policy and district predictions. */
export interface PlacementPrediction {
  readonly lines: readonly PresentablePredictionLine[];
  readonly houseIds: readonly string[];
  readonly range: { readonly center: TileCoordinate; readonly radius: number } | null;
  readonly roadSegments: readonly { readonly tile: TileCoordinate; readonly kind: 'land' | 'bridge' }[];
  readonly placement: PlacementResult;
}
