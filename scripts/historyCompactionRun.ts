// HIST-1 gate (spec docs/design/history-ledger.md HL-10): runs the bot on a seed to the tick budget without stopping at
// stability and measures the history ledger with folding (the game's) against the same run's ledger unfolded — a
// shadow copy of every record and thumbnail as it was appended. Checks: ledger size, queries equal except the records
// a summary replaced, every folded record everyday and old, the summaries' counts, a save round trip.
//   tsx scripts/historyCompactionRun.ts <seed> <maxTicks> <out.json>
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { GameState } from "../src/engine/engine.types";
import { FOLD_AFTER_SEASONS, foldableRecord, historyQuery, ROLLUP_TEMPLATE } from "../src/engine/history";
import type { HistoryQuery, HistoryRecord, HistorySnapshot, HistoryState } from "../src/engine/history.types";
import { PRESSURE_BALANCE } from "../src/content/balanceConfig";
import { decodeSave, encodeSave } from "../src/save/saveCodec";
import { runPhase19NaturalGrowth } from "./phase19NaturalGrowth";

const [seedArg, maxArg, outArg] = process.argv.slice(2);
const seed = Number(seedArg);
const maxTicks = Number(maxArg ?? 1_200_000);
const out = outArg ?? `history-compaction-seed${seed}.json`;
const ordinalOf = (id: string) => Number(id.slice(2));

// The unfolded ledger of the same run: every record and thumbnail as it was appended.
const shadowRecords: HistoryRecord[] = [];
const shadowSnapshots = new Map<string, HistorySnapshot>();
let lastOrdinal = 0;
let last: GameState | null = null;
const started = Date.now();
runPhase19NaturalGrowth({ targetLots: 24, maxTicks, seed, additionalAcceptance: () => false, onTick: state => {
  const history = state.history;
  if (history !== undefined && history.nextOrdinal - 1 > lastOrdinal) {
    const fresh: HistoryRecord[] = [];
    for (let index = history.records.length - 1; index >= 0; index -= 1) {
      const record = history.records[index]!;
      if (ordinalOf(record.id) <= lastOrdinal) break;
      fresh.push(record);
    }
    for (let index = fresh.length - 1; index >= 0; index -= 1) shadowRecords.push(fresh[index]!);
    lastOrdinal = history.nextOrdinal - 1;
    for (const snapshot of history.snapshots) if (!shadowSnapshots.has(snapshot.id)) shadowSnapshots.set(snapshot.id, snapshot);
  }
  last = state;
} });
const final = last as GameState | null;
if (final === null || final.history === undefined) throw new Error("no ledger");
const folded: HistoryState = final.history;
// A decision's actual is written after it was appended: read it from the folded ledger (decisions are never folded).
const byId = new Map(folded.records.map(record => [record.id, record]));
const unfoldedRecords = shadowRecords.map(record => record.decision === undefined ? record : byId.get(record.id) ?? record);
const unfolded: HistoryState = { ...folded, records: unfoldedRecords, snapshots: [...shadowSnapshots.values()] };

const summaries = folded.records.filter(record => record.template === ROLLUP_TEMPLATE);
const kept = new Set(folded.records.filter(record => record.template !== ROLLUP_TEMPLATE).map(record => record.id));
const replaced = unfoldedRecords.filter(record => !kept.has(record.id));
const replacedIds = new Set(replaced.map(record => record.id));
const cutoff = final.tick - FOLD_AFTER_SEASONS * PRESSURE_BALANCE.seasonTicks;
const queries: HistoryQuery[] = [{}, { severity: 1 }, { severity: 2 }, { kinds: ["decision"] }, { kinds: ["event", "era"] }, { kinds: ["person"] },
  { kinds: ["milestone", "ledger"] }, { actors: [{ type: "household", id: final.houses[0]?.buildingId ?? "none" }] },
  { range: { from: 0, to: 100_000 } }, { range: { from: cutoff } }];
const queryChecks = queries.map(query => {
  const after = historyQuery({ history: folded }, query).filter(record => record.template !== ROLLUP_TEMPLATE);
  const before = historyQuery({ history: unfolded }, query).filter(record => !replacedIds.has(record.id));
  return { query, records: after.length, equal: JSON.stringify(after) === JSON.stringify(before) };
});
const envelope = { createdAt: "2026-09-26T00:00:00.000Z", savedAt: "2026-09-26T00:00:00.000Z" };
const encoded = encodeSave({ state: final, ...envelope });
const loaded = decodeSave(encoded.bytes);
const bytes = (value: unknown) => Buffer.byteLength(JSON.stringify(value));
const result = {
  seed, maxTicks, finalTick: final.tick, era: final.era, elapsedSeconds: Math.round((Date.now() - started) / 1000),
  ledger: { bytes: bytes(folded), records: folded.records.length, summaries: summaries.length, snapshots: folded.snapshots.length,
    snapshots256: folded.snapshots.filter(snapshot => snapshot.size === 256).length },
  unfolded: { bytes: bytes(unfolded), records: unfoldedRecords.length, snapshots: unfolded.snapshots.length },
  replaced: replaced.length,
  replacedAllFoldableAndOld: replaced.every(record => foldableRecord(record) && record.tick <= cutoff),
  summaryCountsMatch: summaries.reduce((sum, record) => sum + Number(record.params?.count ?? 0), 0) === replaced.length,
  permanentKept: { moveIns: folded.records.filter(record => record.template === "person.move_in").length,
    severity1up: folded.records.filter(record => record.severity >= 1).length,
    severity1upUnfolded: unfoldedRecords.filter(record => record.severity >= 1).length },
  queryChecks, queriesEqual: queryChecks.every(check => check.equal),
  save: { schemaVersion: loaded.envelope.schemaVersion, bytes: encoded.bytes.length, historyRoundTrip: JSON.stringify((loaded.envelope.state as GameState).history) === JSON.stringify(folded) },
};
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${JSON.stringify(result, null, 1)}\n`);
process.stdout.write(`${JSON.stringify({ ...result, queryChecks: undefined })}\n`);
