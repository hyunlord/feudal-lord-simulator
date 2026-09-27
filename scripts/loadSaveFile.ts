// RES-REG: how a script reads a saved town (a .save.json, or a bare final-state.json / autoplay .json.gz) — through the
// save codec: checksum, the migration chain from the file's own schema (a bare file is v0: the whole chain), validation.
// Never JSON.parse a save into the game (scripts/sceneState.ts rejects an old bare state at the page).
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import type { GameState } from "../src/engine/engine.types";
import { decodeSave } from "../src/save/saveCodec";

export function loadSaveFile(path: string): GameState {
  const bytes = readFileSync(path);
  return decodeSave(path.endsWith(".gz") ? gunzipSync(bytes) : bytes).envelope.state;
}
