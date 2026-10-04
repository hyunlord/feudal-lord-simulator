// FIX-17 gate: each save given decodes (migrated to the latest version) and survives an encode → decode round trip with
// the same state; prints one line per save with its version, tick and the first problem if any.
//   tsx scripts/saveLoadCheck.ts <save.json> [...]
import { readFileSync } from "node:fs";
import { decodeSave, encodeSave } from "../src/save/saveCodec";

for (const path of process.argv.slice(2)) {
  try {
    const decoded = decodeSave(new Uint8Array(readFileSync(path)));
    const state = decoded.envelope.state;
    const again = decodeSave(encodeSave({ state, createdAt: decoded.envelope.createdAt, savedAt: decoded.envelope.savedAt, gameVersion: decoded.envelope.gameVersion }).bytes);
    const same = JSON.stringify(again.envelope.state) === JSON.stringify(state);
    process.stdout.write(`${JSON.stringify({ path, ok: same, from: decoded.migratedFrom ?? null, tick: state.tick })}\n`);
  } catch (error) {
    process.stdout.write(`${JSON.stringify({ path, ok: false, error: (error as Error).message })}\n`);
  }
}
