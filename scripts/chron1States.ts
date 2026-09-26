// CHRON-1 gate states: the seed 2 chapter 1 run (the bot answers the Great Famine with relief), saving the game state at
// the end of chapter 1 — its whole history ledger (records, decisions with their actuals, a thumbnail at every season's
// close: the "그때 지도" of each season) and its persons — through the save format (the .save.json a player's save
// would be, and the state it loads back to), with a summary beside it.
//   tsx scripts/chron1States.ts <seed> <maxTicks> <out-dir>
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { GameState } from "../src/engine/engine.types";
import { chapterEnd } from "../src/engine/politics";
import { decodeSave, encodeSave } from "../src/save/saveCodec";
import { runPhase19NaturalGrowth } from "./phase19NaturalGrowth";

const [seedArg, maxArg, out] = process.argv.slice(2);
mkdirSync(out!, { recursive: true });
let ended: number | null = null;
const started = performance.now();
runPhase19NaturalGrowth({ targetLots: 24, maxTicks: Number(maxArg ?? 200_000), seed: Number(seedArg), famineResponse: "relief", onTick: state => {
  if (ended !== null || chapterEnd(state) === null) return;
  ended = state.tick;
  // Through the save format (v17): the screens open the state a player's save of this moment would load.
  const saved = encodeSave({ state, createdAt: "1320-01-01T00:00:00.000Z", savedAt: "1323-06-01T00:00:00.000Z" });
  writeFileSync(join(out!, "chapter-end.save.json"), saved.bytes);
  const loaded = decodeSave(saved.bytes).envelope.state as GameState;
  if (JSON.stringify(loaded.history) !== JSON.stringify(state.history) || JSON.stringify(loaded.persons) !== JSON.stringify(state.persons)) throw new Error("save round trip lost the ledger");
  writeFileSync(join(out!, "chapter-end.json"), JSON.stringify(loaded));
  const history = state.history;
  const summary = { tick: state.tick, records: history?.records.length ?? 0, snapshots: history?.snapshots.length ?? 0,
    decisions: history?.records.filter(record => record.decision !== undefined).map(record => ({ id: record.id, template: record.template, actual: record.decision?.actual !== undefined })) ?? [],
    persons: state.persons?.people.length ?? 0, past: state.persons?.past.length ?? 0, saveBytes: saved.bytes.length, saveSchema: saved.header.schemaVersion,
    ms: Math.round(performance.now() - started) };
  writeFileSync(join(out!, "chapter-end.summary.json"), JSON.stringify(summary, null, 1) + "\n");
  process.stderr.write(`chapter-end at tick ${state.tick}: ${summary.records} records, ${summary.snapshots} thumbnails\n`);
}, additionalAcceptance: (state: GameState) => chapterEnd(state) !== null });
if (ended === null) { process.stderr.write("no chapter end within the run\n"); process.exit(1); }
