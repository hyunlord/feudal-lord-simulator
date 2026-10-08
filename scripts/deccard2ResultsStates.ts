// DEC-CARD-2 (the result thread) lord-mode states for the captures (scripts/deccard2ResultsCaptures.mjs) and the geometry
// rows of the set `deccard2` (src/ui/results/surfaces.ts): the lord's slice as the lord bot plays it (its first tick files
// a suit and sets the market dues; the steward answers the home petitions by the customary policy), each state taken at
// the first tick it holds:
//  - `trace-season`: a season's chip "○○년 당신의 결정 때문에" is up for a decision of the lord's (traceNews);
//  - `trace-later`: the same, for a decision of an earlier season whose later consequence landed this season (a suit's
//    turn) — its chronicle page lists what followed;
//  - `year-eve`: 40 ticks before the first year turn after a year with a decision of the lord's and its consequences
//    (the year's card opens at the next year's first tick the game is watched; the capture runs the town over the turn);
//  - `year-loaded`: the first tick of that next year with the screen's one mark (a house card read) — what a played
//    game's save holds; INJECTED: that mark (the screen writes it, the bot never does), so the unseen year card opens
//    after the load;
//  - `succession`: the first tick after the engine's own `house.succession` (the lord's death and his heir). If none
//    comes by `lastYear`, the lord's birth year is set back (INJECTED, reported) so the engine's own death takes him.
// Beside them deccard2-results-states.json (each: the seed, the tick, the year and what it holds).
//   tsx scripts/deccard2ResultsStates.ts <out-dir> [lastYear=1308]
import { refuseHeavyOnMac } from "./remote/localGuard.mjs";
refuseHeavyOnMac("영주 모드 1300→(scripts/deccard2ResultsStates.ts)", { remote: "scripts/remote/run.sh render-DC2-results-captures-<sha7> --light -- bash scripts/deccard2ResultsCaptures.sh", entry: import.meta.url });
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { LORD_SLICE_SCENARIO_ID } from "../src/content/lordSliceConfig";
import type { GameState } from "../src/engine/engine.types";
import { lordBotCommands } from "../src/engine/lordBot";
import { lordshipOf } from "../src/engine/lordshipState";
import { manorLord } from "../src/engine/persons";
import { stateCalendar } from "../src/engine/scenarioState";
import { markStorySeen } from "../src/engine/storySeen";
import { advanceTick } from "../src/engine/tick";
import { gameReducer } from "../src/state/gameStore";
import { newGameState } from "../src/state/newGame";
import { traceNews } from "../src/ui/results/decisionThread";
import { lordYearReview } from "../src/ui/results/lordYearReview";

const YEAR = 4_000;
const out = process.argv[2];
if (out === undefined) throw new Error("usage: tsx scripts/deccard2ResultsStates.ts <out-dir> [lastYear]");
const lastYear = Number(process.argv[3] ?? 1308);
mkdirSync(out, { recursive: true });
const found: Record<string, Record<string, unknown>> = {};
const save = (name: string, state: GameState, seed: number, about: Record<string, unknown>) => {
  const date = stateCalendar(state);
  found[name] = { seed, tick: state.tick, year: date.year, season: date.season, ...about };
  writeFileSync(join(out, `${name}.json`), JSON.stringify(state));
  process.stderr.write(`${name} at tick ${state.tick} (${date.year}) ${JSON.stringify(about)}\n`);
};
const step = (state: GameState) => { let next = state; for (const { command } of lordBotCommands(next)) next = gameReducer(next, command); return advanceTick(next); };

// Seed 3: the thread's chips, the year's card.
{
  const seed = 3;
  let state = newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed })!;
  let eve: number | null = null;
  while (stateCalendar(state).year <= lastYear && (found["year-loaded"] === undefined || found["trace-later"] === undefined)) {
    state = step(state);
    const season = state.tick - (state.tick % (YEAR / 4));
    // A chip is up once the story's delay is out; take the state a little into the season (the world first).
    if (found["trace-season"] === undefined && state.tick - season >= 200) {
      const news = traceNews(state).find(entry => entry.decisionTick >= season);
      if (news !== undefined) save("trace-season", state, seed, { decision: news.decisionId, title: news.title, line: news.line, facts: news.facts });
    }
    if (found["trace-later"] === undefined && state.tick - season >= 200) {
      const news = traceNews(state).find(entry => entry.decisionTick < season && entry.facts.some(fact => !fact.includes("(관계 ")));
      if (news !== undefined) save("trace-later", state, seed, { decision: news.decisionId, title: news.title, line: news.line, facts: news.facts });
    }
    if (eve === null && state.tick % YEAR === YEAR - 40) {
      const review = lordYearReview(state, stateCalendar(state).year);
      if (review.decisions.length > 0 && review.threads.length > 0) {
        save("year-eve", state, seed, { reviewYear: stateCalendar(state).year, decisions: review.decisions.length, steward: review.steward.length, threads: review.threads.length });
        eve = state.tick;
      }
    }
    if (eve !== null && found["year-loaded"] === undefined && state.tick === eve + 41) {
      save("year-loaded", markStorySeen(state, "house:capture-mark", "opened"), seed, { reviewYear: stateCalendar(state).year - 1, injected: "one screen mark (a house card read)" });
    }
  }
}

// Seed 1: the engine's own succession.
{
  const seed = 1;
  let state = newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed })!;
  let injected: string | null = null;
  const hasSuccession = (current: GameState) => current.history?.records.some(record => record.template === "house.succession") === true;
  while (!hasSuccession(state) && stateCalendar(state).year <= lastYear + 6) {
    state = step(state);
    if (injected === null && stateCalendar(state).year > lastYear && state.persons !== undefined) {
      const lord = manorLord(state.persons.people, lordshipOf(state).house.order, stateCalendar(state).year);
      if (lord !== undefined) {
        state = { ...state, persons: { ...state.persons, people: state.persons.people.map(person => person.id === lord.id ? { ...person, birthYear: person.birthYear - 40 } : person) } };
        injected = `the lord's birth year set back 40 years in ${stateCalendar(state).year}`;
      }
    }
  }
  const record = state.history?.records.find(entry => entry.template === "house.succession");
  if (record !== undefined) {
    state = step(state);
    save("succession", state, seed, { record: record.id, recordTick: record.tick, params: record.params, injected });
  }
}

writeFileSync(join(out, "deccard2-results-states.json"), JSON.stringify(found, null, 1));
const missing = ["trace-season", "trace-later", "year-eve", "year-loaded", "succession"].filter(name => found[name] === undefined);
if (missing.length > 0) { process.stderr.write(`missing: ${missing.join(", ")}\n`); process.exit(1); }
