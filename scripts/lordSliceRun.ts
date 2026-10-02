// LM-E8 gates (spec docs/design/lord-slice.md LS-3, LS-4): the lord's slice played by the lord-mode bot from a new game
// (`core:lord_slice`, the seed's riverside town) to the slice's end — twenty years, or five after a second estate. The
// town agency builds; the bot only plays the lord, with every feature (`lordBotCommands`). Counted by the year: the
// decisions the lord took, by kind and whether they came to him (answers) or he took them of himself, and the
// auto-pause's stops by reason (`pauseReasons`, read across each command and tick). Reads only the game's APIs.
// The screen stops once a tick, so a year's stops are its ticks with a reason (the reasons are counted apart). With
// `through`, the run goes on past the slice's end to its twenty years (the bot plays on; the end is recorded).
//   tsx scripts/lordSliceRun.ts <seed> [maxYears] [through] > run.json
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { pauseReasons, type PauseEvent } from "../src/engine/autoPause";
import type { GameState } from "../src/engine/engine.types";
import { historySummary } from "../src/engine/history";
import { ASKED_KINDS, lordBotCommands, type LordDecisionKind } from "../src/engine/lordBot";
import { lordSliceOutcome, lordSliceStart } from "../src/engine/lordSlice";
import { stateCalendar } from "../src/engine/scenarioState";
import { advanceTick } from "../src/engine/tick";
import { LORD_SLICE_SCENARIO_ID } from "../src/content/lordSliceConfig";
import { gameReducer } from "../src/state/gameStore";
import { newGameState } from "../src/state/newGame";

export interface LordSliceYear {
  readonly year: number;
  readonly decisions: number;
  readonly asked: number;
  readonly own: number;
  readonly byKind: Readonly<Partial<Record<LordDecisionKind, number>>>;
  readonly pauses: number;
  readonly stops: number;
  readonly pausesByReason: Readonly<Record<string, number>>;
}

export function lordSliceRun(seed: number, maxYears = 20, through = false) {
  let state = newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed });
  if (state === null) throw new Error(`seed ${seed}: no game`);
  const start = lordSliceStart(state);
  const startYear = stateCalendar(state).year;
  const years = new Map<number, { byKind: Record<string, number>; pauses: Record<string, number>; stops: Set<number>; asked: number; own: number }>();
  for (let year = startYear; year < startYear + maxYears; year += 1) years.set(year, { byKind: {}, pauses: {}, stops: new Set(), asked: 0, own: 0 });
  let endedAt: { readonly tick: number; readonly year: number; readonly reason: string | null } | null = null;
  const yearOf = (year: number) => {
    if (!years.has(year)) years.set(year, { byKind: {}, pauses: {}, stops: new Set(), asked: 0, own: 0 });
    return years.get(year)!;
  };
  const pauseLog: (PauseEvent & { readonly year: number; readonly line: string })[] = [];
  const features = new Set<LordDecisionKind>();
  const started = Date.now();
  for (;;) {
    const outcome = lordSliceOutcome(state)!;
    if (outcome.ended && endedAt === null) endedAt = { tick: state.tick, year: stateCalendar(state).year, reason: outcome.reason };
    if ((outcome.ended && !through) || stateCalendar(state).year >= startYear + maxYears) break;
    const before: GameState = state;
    for (const { kind, command } of lordBotCommands(state)) {
      const next = gameReducer(state, command);
      if (next === state) continue;
      state = next;
      const row = yearOf(stateCalendar(state).year);
      row.byKind[kind] = (row.byKind[kind] ?? 0) + 1;
      if (ASKED_KINDS.has(kind)) row.asked += 1; else row.own += 1;
      features.add(kind);
    }
    state = advanceTick(state);
    for (const event of pauseReasons(before, state)) {
      const year = stateCalendar({ ...state, tick: event.tick }).year;
      const row = yearOf(year);
      row.pauses[event.reason] = (row.pauses[event.reason] ?? 0) + 1;
      row.stops.add(event.tick);
      const record = event.recordId === undefined ? undefined : state.history?.records.find(entry => entry.id === event.recordId);
      pauseLog.push({ ...event, year, line: record === undefined ? `petition ${event.petitionId}` : historySummary(record, state) });
    }
  }
  // The years played (the last one may be partial: the slice ends at its tick).
  const lastYear = stateCalendar({ ...state, tick: Math.max(0, state.tick - 1) }).year;
  const table: LordSliceYear[] = [...years.entries()].filter(([year]) => year <= lastYear).sort(([a], [b]) => a - b).map(([year, row]) => ({
    year, decisions: row.asked + row.own, asked: row.asked, own: row.own, byKind: row.byKind,
    pauses: Object.values(row.pauses).reduce((sum, count) => sum + count, 0), stops: row.stops.size, pausesByReason: row.pauses,
  }));
  const outcome = lordSliceOutcome(state)!;
  return {
    seed, start, outcome, endedAt, table, pauses: pauseLog, features: [...features].sort(),
    finalYear: stateCalendar(state).year, tick: state.tick, seconds: Math.round((Date.now() - started) / 1000),
    stateSha256: createHash("sha256").update(JSON.stringify(state)).digest("hex"),
  };
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [seed, maxYears, through] = process.argv.slice(2);
  process.stdout.write(`${JSON.stringify(lordSliceRun(Number(seed ?? 1), maxYears === undefined ? 20 : Number(maxYears), through === "through"), null, 1)}\n`);
}
