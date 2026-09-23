import type { GameState } from "../../engine/engine.types";
import { createSaveSummary } from "../saveSummary";
import { DEFAULT_SCENARIO_ID, type SaveEnvelope } from "../saveTypes";

// v0 files carry no timestamps or build identity; these markers say so instead of guessing.
const UNKNOWN_TIME = "1970-01-01T00:00:00.000Z";
const UNKNOWN_V0_VERSION = "unknown (v0 bare state)";

export function migrateV0ToV1(input: unknown): SaveEnvelope {
  const state = input as GameState;
  return {
    schemaVersion: 1,
    gameVersion: UNKNOWN_V0_VERSION,
    createdAt: UNKNOWN_TIME,
    savedAt: UNKNOWN_TIME,
    scenarioId: DEFAULT_SCENARIO_ID,
    seed: String(state.seed),
    tick: state.tick,
    rngState: { kind: "derived", algorithm: "mulberry32/fnv1a-roaming-junction-v1", seed: state.seed },
    summary: createSaveSummary(state),
    state,
  };
}
