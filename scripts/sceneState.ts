// RES-REG: admitSceneState for tsx scripts and tests — the same function the page runs (scripts/sceneInjection.mjs), given
// the real codec. See that file for the rule.
import { advanceTick } from "../src/engine/tick";
import type { GameState } from "../src/engine/engine.types";
import { migrateSaveToLatest } from "../src/save/migrations";
import { assertGameStateSnapshot, decodeSave } from "../src/save/saveCodec";
import { admitSceneState as admit, staleStateKeys as stale } from "./sceneInjection.mjs";

const CODEC = { decodeSave, assertGameStateSnapshot, migrateSaveToLatest, advanceTick, staleStateKeys: stale };

export function staleStateKeys(state: object, newGame: GameState): readonly string[] {
  return stale(state, newGame, CODEC);
}

export function admitSceneState(input: unknown, newGame: GameState): GameState {
  return admit(input, newGame, CODEC) as GameState;
}
