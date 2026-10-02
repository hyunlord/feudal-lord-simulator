// LM-E8 gates (spec docs/design/lord-slice.md LS-3, LS-4): the lord's slice played by the lord-mode bot from a new game
// (`core:lord_slice`, the seed's riverside town) to the slice's end — twenty years, or five after a second estate. The
// town agency builds; the bot only plays the lord, with every feature (`lordBotCommands`). Counted by the year: the
// decisions the lord took, by kind and whether they came to him (answers) or he took them of himself, and the
// auto-pause's stops by reason (`pauseReasons`, read across each command and tick). Reads only the game's APIs.
//   tsx scripts/lordSliceRun.ts <seed> > run.json
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
  readonly pausesByReason: Readonly<Record<string, number>>;
}

export function lordSliceRun(seed: number, maxYears = 20) {
  let state = newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed });
  if (state === null) throw new Error(`seed ${seed}: no game`);
  const start = lordSliceStart(state);
  const startYear = stateCalendar(state).year;
  const years = new Map<number, { byKind: Record<string, number>; pauses: Record<string, number>; asked: number; own: number }>();
  const yearOf = (year: number) => {
    if (!years.has(year)) years.set(year, { byKind: {}, pauses: {}, asked: 0, own: 0 });
    return years.get(year)!;
  };
  const pauseLog: (PauseEvent & { readonly year: number; readonly line: string })[] = [];
  const features = new Set<LordDecisionKind>();
  const started = Date.now();
  for (;;) {
    const outcome = lordSliceOutcome(state)!;
    if (outcome.ended || stateCalendar(state).year >= startYear + maxYears) break;
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
      const record = event.recordId === undefined ? undefined : state.history?.records.find(entry => entry.id === event.recordId);
      pauseLog.push({ ...event, year, line: record === undefined ? `petition ${event.petitionId}` : historySummary(record, state) });
    }
  }
  const table: LordSliceYear[] = [...years.entries()].sort(([a], [b]) => a - b).map(([year, row]) => ({
    year, decisions: row.asked + row.own, asked: row.asked, own: row.own, byKind: row.byKind,
    pauses: Object.values(row.pauses).reduce((sum, count) => sum + count, 0), pausesByReason: row.pauses,
  }));
  const outcome = lordSliceOutcome(state)!;
  return {
    seed, start, outcome, table, pauses: pauseLog, features: [...features].sort(),
    finalYear: stateCalendar(state).year, tick: state.tick, seconds: Math.round((Date.now() - started) / 1000),
    stateSha256: createHash("sha256").update(JSON.stringify(state)).digest("hex"),
  };
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [seed, maxYears] = process.argv.slice(2);
  process.stdout.write(`${JSON.stringify(lordSliceRun(Number(seed ?? 1), maxYears === undefined ? 20 : Number(maxYears)), null, 1)}\n`);
}
