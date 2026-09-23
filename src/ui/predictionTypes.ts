import type { TileCoordinate } from '../world/grid';
import type { PlacementResult } from '../world/placement';

/** Domain-independent presentation contract, shared by future policy and district predictions. */
export interface PredictionLine {
  readonly id: string;
  readonly tone: 'neutral' | 'positive' | 'warning' | 'negative';
  readonly text: string;
}
export interface PlacementPrediction {
  readonly lines: readonly PredictionLine[];
  readonly houseIds: readonly string[];
  readonly range: { readonly center: TileCoordinate; readonly radius: number } | null;
  readonly roadSegments: readonly { readonly tile: TileCoordinate; readonly kind: 'land' | 'bridge' }[];
  readonly placement: PlacementResult;
}
