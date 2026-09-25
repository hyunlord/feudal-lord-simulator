/**
 * v12 adds F0-A pressure (spec `docs/design/flow-pressure.md`, FP-1…FP-5): `GameState.seasons` (the season being
 * counted and the last eight season ledgers), `GameState.historicalEras` (eras entered, FP-5) and, on houses, the
 * failure ladder's `foodShortSinceTick` / `leavingSinceTick` / `abandonedTick` and the winter ration's carry. Every
 * house starts settled with no carry; the season opens at the loaded tick's season start and the eras due at the
 * loaded date enter now (readiness checked against the loaded town, forced if the grace has passed).
 */
import type { GameState } from "../../engine/engine.types";
import { initialSeasonState } from "../../engine/seasonPressure";
import { advanceHistoricalEras } from "../../engine/scenarioState";

export function migrateStateV11ToV12(state: GameState): GameState {
  const withEras = advanceHistoricalEras(state);
  return { ...withEras, seasons: initialSeasonState(withEras) };
}

export function migrateV11ToV12(input: unknown): unknown {
  if (typeof input !== 'object' || input === null) throw new TypeError('Schema v11 save must be an envelope object');
  const envelope = input as { readonly state?: unknown };
  if (typeof envelope.state !== 'object' || envelope.state === null) throw new TypeError('Schema v11 save has no state');
  return { ...envelope, schemaVersion: 12, state: migrateStateV11ToV12(envelope.state as GameState) };
}
