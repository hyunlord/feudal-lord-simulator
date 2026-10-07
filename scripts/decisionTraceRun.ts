// DEC-TRACE gate (docs/design/dec-trace.md): the lord's slice played by the lord-mode bot from a new game for N years
// (`core:lord_slice`). Counted by the year: the decisions that came to the lord with a weight (P-D5, the heavy ones; P-T1
// counts these — `cameHeavyToLord`, not his own initiatives), all the lord's heavy ones, the lord's, the steward's answers
// by policy, the faction acts. For every decision: the consequences tied to it
// within three years (the thread), and the decisions with none, with what they touched. Reads only the game's APIs.
//   tsx scripts/decisionTraceRun.ts <seed> [years] > run.json
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { FactionAct, TracedDecision } from "../src/engine/decisionTrace.types";
import type { HistoryRecord } from "../src/engine/history.types";
import { TRACE_LIVE_TICKS } from "../src/engine/decisionTrace";
import { cameHeavyToLord } from "../src/engine/decisionLayer";
import { lordBotCommands } from "../src/engine/lordBot";
import { stateCalendar } from "../src/engine/scenarioState";
import { advanceTick } from "../src/engine/tick";
import { LORD_SLICE_SCENARIO_ID } from "../src/content/lordSliceConfig";
import { gameReducer } from "../src/state/gameStore";
import { newGameState } from "../src/state/newGame";

export function decisionTraceRun(seed: number, years = 20) {
  let state = newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed });
  if (state === null) throw new Error(`seed ${seed}: no game`);
  const startYear = stateCalendar(state).year;
  const decisions = new Map<string, TracedDecision>();
  const consequences = new Map<string, HistoryRecord>();
  const acts: FactionAct[] = [];
  let seenActs = 0;
  const collect = () => {
    for (const decision of state!.trace?.decisions ?? []) decisions.set(decision.id, decision);
    // The consequences are the history's records with the decisions behind them (never folded).
    for (const record of state!.history?.records ?? []) if (record.because !== undefined) consequences.set(record.id, record);
    const all = state!.trace?.acts ?? [];
    // The thread keeps ten years; acts are appended in order (ticks only grow), so the new ones are those past the last seen.
    const fresh = all.filter(entry => acts.length === 0 || entry.tick > acts.at(-1)!.tick || (entry.tick === acts.at(-1)!.tick && !acts.includes(entry)));
    if (fresh.length > 0) { acts.push(...fresh); seenActs += fresh.length; }
  };
  const started = Date.now();
  while (stateCalendar(state).year < startYear + years) {
    for (const { command } of lordBotCommands(state)) {
      const next = gameReducer(state, command);
      if (next !== state) state = next;
    }
    state = advanceTick(state);
    if (state.tick % 1000 === 0) collect();
  }
  collect();
  const endTick = state.tick;
  const yearOf = (tick: number) => stateCalendar({ ...state!, tick }).year;
  const after = new Map<string, HistoryRecord[]>();
  for (const consequence of consequences.values()) for (const id of consequence.because!.map(entry => entry.decisionId)) {
    const decision = decisions.get(id);
    if (decision === undefined || consequence.tick - decision.tick > TRACE_LIVE_TICKS || consequence.tick < decision.tick) continue;
    after.set(id, [...(after.get(id) ?? []), consequence]);
  }
  const rows = [...decisions.values()].map(decision => ({
    id: decision.id, year: yearOf(decision.tick), tick: decision.tick, by: decision.by, kind: decision.kind, source: decision.source, weights: decision.weights,
    heavy: decision.weights.length > 0, came: cameHeavyToLord(decision), targets: decision.targets,
    // A decision of the last three years has not had its three years (reported apart).
    fullWindow: endTick - decision.tick >= TRACE_LIVE_TICKS,
    consequences: (after.get(decision.id) ?? []).length,
    consequenceKinds: [...new Set((after.get(decision.id) ?? []).map(consequence => String(consequence.params?.key ?? consequence.template)))],
  }));
  const table: Record<number, { heavyToLord: number; heavyAll: number; lord: number; steward: number; acts: number; consequences: number }> = {};
  for (let year = startYear; year < startYear + years; year += 1) table[year] = { heavyToLord: 0, heavyAll: 0, lord: 0, steward: 0, acts: 0, consequences: 0 };
  for (const row of rows) {
    const cell = table[row.year]; if (cell === undefined) continue;
    if (row.by === "lord") cell.lord += 1; else cell.steward += 1;
    if (row.came) cell.heavyToLord += 1;
    if (row.heavy && row.by === "lord") cell.heavyAll += 1;
  }
  for (const act of acts) { const cell = table[yearOf(act.tick)]; if (cell !== undefined) cell.acts += 1; }
  for (const consequence of consequences.values()) { const cell = table[yearOf(consequence.tick)]; if (cell !== undefined) cell.consequences += 1; }
  const heavy = rows.filter(row => row.heavy && row.fullWindow);
  const withNone = heavy.filter(row => row.consequences === 0);
  return {
    seed, startYear, years, tick: endTick, seconds: Math.round((Date.now() - started) / 1000),
    table, acts,
    heavy: { counted: heavy.length, withConsequence: heavy.length - withNone.length, sharePermille: heavy.length === 0 ? null : Math.round((heavy.length - withNone.length) * 1000 / heavy.length),
      consequencesPerDecision: heavy.length === 0 ? null : Math.round(heavy.reduce((sum, row) => sum + row.consequences, 0) * 100 / heavy.length) / 100 },
    noConsequence: withNone.map(({ id, year, kind, source, weights, targets }) => ({ id, year, kind, source, weights, targets })),
    decisions: rows,
    consequences: [...consequences.values()].map(record => ({ id: record.id, tick: record.tick, template: record.template, params: record.params, because: record.because })),
    relations: state.factions?.factions.map(faction => ({ id: faction.id, relation: faction.relation })) ?? [],
  };
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [seed = "1", years = "20"] = process.argv.slice(2);
  process.stdout.write(`${JSON.stringify(decisionTraceRun(Number(seed), Number(years)), null, 1)}\n`);
}
