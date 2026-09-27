// RES-REG: admitSceneState for tsx scripts and tests — the same function the page runs (scripts/sceneInjection.mjs), given
// the real codec. See that file for the rule.
import { advanceTick } from "../src/engine/tick";
import type { GameState } from "../src/engine/engine.types";
import { migrateSaveToLatest } from "../src/save/migrations";
import { assertGameStateSnapshot, decodeSave } from "../src/save/saveCodec";
// @ts-expect-error why: a plain .mjs module (the browser scripts import it too) without type declarations.
import { admitSceneState as admit, staleStateKeys as stale } from "./sceneInjection.mjs";

type Codec = { readonly staleStateKeys: (state: object, newGame: GameState, codec: Codec) => readonly string[] };
const CODEC = { decodeSave, assertGameStateSnapshot, migrateSaveToLatest, advanceTick, staleStateKeys: stale as Codec["staleStateKeys"] };

export function staleStateKeys(state: object, newGame: GameState): readonly string[] {
  return (stale as Codec["staleStateKeys"])(state, newGame, CODEC);
}

export function admitSceneState(input: unknown, newGame: GameState): GameState {
  return (admit as (input: unknown, newGame: GameState, codec: typeof CODEC) => GameState)(input, newGame, CODEC);
}
