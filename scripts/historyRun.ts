// F0-C2 gates ② ③ ④ (spec docs/design/history-ledger.md HL-1…HL-9): runs the bot from a seed's growth opening to the
// end of chapter 1 and measures the history ledger at the chapter's end (or at the last tick, if it never ends) — records by kind and severity, decision kinds seen, big decisions
// with their actuals, thumbnails, the save's size with and without the ledger, a save/load round trip, and the share
// of tick time the ledger step takes (it is timed again on a copy, so the run is not changed).
//   tsx scripts/historyRun.ts <seed> <maxTicks> > seed.json
import { performance } from "node:perf_hooks";
import type { GameState } from "../src/engine/engine.types";
import { advanceHistory, DECISION_KINDS } from "../src/engine/history";
import { chapterEnd } from "../src/engine/politics";
import { decodeSave, encodeSave } from "../src/save/saveCodec";
import { runPhase19NaturalGrowth } from "./phase19NaturalGrowth";

const [seedArg, maxArg] = process.argv.slice(2);
const seed = Number(seedArg);
const maxTicks = Number(maxArg ?? 100_000);
let previous: GameState | null = null;
let last: GameState | null = null;
let historyMs = 0;
let tickMs = 0;
let lastTickClock = performance.now();
let endTick: number | null = null;
let atEnd: GameState | null = null;
runPhase19NaturalGrowth({ targetLots: 24, maxTicks, seed, onTick: state => {
  const now = performance.now();
  tickMs += now - lastTickClock;
  if (previous !== null && state.tick % 10 === 0) {
    // The ledger step again, on a copy whose ledger is the one before the tick: its cost, without changing the run.
    const started = performance.now();
    const copy: GameState = { ...state, ...(previous.history === undefined ? {} : { history: previous.history }) };
    advanceHistory(previous, copy);
    historyMs += (performance.now() - started) * 10;
  }
  if (endTick === null && chapterEnd(state) !== null) { endTick = state.tick; atEnd = state; }
  previous = state;
  last = state;
  lastTickClock = performance.now();
} });
const final = (atEnd ?? last) as GameState | null;
if (final === null) throw new Error("no state");
const records = final.history?.records ?? [];
const count = (key: (record: (typeof records)[number]) => string) => records.reduce<Record<string, number>>((m, record) => { const k = key(record); m[k] = (m[k] ?? 0) + 1; return m; }, {});
const decisionKinds = new Set(records.filter(record => record.kind === "decision").map(record => String(record.params?.decisionKind)));
const big = records.filter(record => record.decision !== undefined).map(record => ({ id: record.id, tick: record.tick, kind: record.params?.decisionKind,
  chosen: record.decision!.chosen, alternatives: record.decision!.alternatives, predicted: record.decision!.predicted, actual: record.decision!.actual ?? null }));
const envelope = { createdAt: "2026-09-26T00:00:00.000Z", savedAt: "2026-09-26T00:00:00.000Z" };
const withLedger = encodeSave({ state: final, ...envelope }).bytes;
const { history: _history, ...withoutHistory } = final;
const withoutLedger = encodeSave({ state: withoutHistory, ...envelope }).bytes;
const loaded = decodeSave(withLedger).envelope.state as GameState;
const roundTrip = JSON.stringify(loaded.history) === JSON.stringify(final.history);
const snapshotBytes = (final.history?.snapshots ?? []).reduce((sum, snapshot) => sum + snapshot.data.length, 0);
process.stdout.write(`${JSON.stringify({ seed, maxTicks, measuredTick: final.tick, lastTick: (last as GameState | null)?.tick ?? null, chapterEndTick: endTick,
  records: records.length, byKind: count(record => record.kind), bySeverity: count(record => String(record.severity)), byTemplate: count(record => record.template),
  decisionKindsSeen: DECISION_KINDS.filter(kind => decisionKinds.has(kind)), decisionKindsMissing: DECISION_KINDS.filter(kind => !decisionKinds.has(kind)),
  bigDecisions: big, snapshots: final.history?.snapshots.length ?? 0, snapshotBytes,
  saveBytes: { withLedger: withLedger.length, withoutLedger: withoutLedger.length, ledger: withLedger.length - withoutLedger.length },
  roundTrip, ledgerShareOfTick: tickMs <= 0 ? null : historyMs / tickMs }, null, 1)}\n`);
