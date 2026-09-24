import type { Era } from "../content/eraConfig";
import type { SaveProblemKey } from "../content/saveCopy.ko";
import type { GameState } from "../engine/engine.types";

export const SAVE_SCHEMA_VERSION = 4;
export const DEFAULT_SCENARIO_ID = "default";

/**
 * The whole simulation state as plain JSON. GameState already holds only JSON-safe
 * values (strings, finite numbers, booleans, null, arrays, plain objects); the
 * snapshot is therefore the state itself, and `assertJsonSafe` guards that claim.
 */
export type GameStateSnapshot = GameState;

/**
 * The simulation has no stored RNG stream: every draw is a fresh mulberry32 seeded
 * from (state.seed, walkerId, tick, tile, walker.junctionVisits), all of which live
 * in GameState. The save records that derivation instead of a mutable cursor.
 */
export interface DerivedRngState {
  readonly kind: "derived";
  readonly algorithm: "mulberry32/fnv1a-roaming-junction-v1";
  readonly seed: number;
}

export interface SaveSummary {
  readonly elapsedTicks: number;
  readonly elapsedMinutes: number;
  readonly population: number;
  readonly era: Era;
  readonly problem: SaveProblemKey | null;
  readonly line: string;
}

export interface SaveEnvelope {
  readonly schemaVersion: number;
  readonly gameVersion: string;
  readonly createdAt: string;
  readonly savedAt: string;
  readonly scenarioId: string;
  readonly seed: string;
  readonly tick: number;
  readonly rngState: DerivedRngState;
  readonly summary: SaveSummary;
  readonly checksum?: string;
  readonly state: GameStateSnapshot;
}

export type SaveHeader = Omit<SaveEnvelope, "state">;

export interface SaveMeta {
  readonly slotId: string;
  readonly schemaVersion: number;
  readonly savedAt: string;
  readonly createdAt: string;
  readonly tick: number;
  readonly summary: SaveSummary | null;
  readonly byteLength: number;
}
