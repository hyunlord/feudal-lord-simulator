// MARKET-TOWN lord-mode states after the market charter's proclamation (the geometry audit's `market` set, DGX
// ~/fls-market-states; tests/marketTownStates.test.ts reads them when they are there): the lord's slice as the lord bot
// plays it — nothing injected — seed by seed until a town leaves the hamlet (`state.era` past "hamlet", the engine's
// `charterWallPlan(state).stage === "past"`), then on (the slice's own end does not stop the bot):
//  - `market-proclaimed`: one season after the proclamation;
//  - `market-years`: four years after it.
// Beside them states.json (each: seed, tick, year, season, era, population, what holds — the lord's matters due, the
// slice's outcome, the estates held, the marriage) and each year's milliseconds.
//   tsx scripts/marketTownStates.ts <out-dir> [seeds=1,2] [years=40]
import { refuseHeavyOnMac } from "./remote/localGuard.mjs";
refuseHeavyOnMac("영주 조각 봇 판(scripts/marketTownStates.ts)", { remote: "scripts/remote/run.sh render-MARKET-states-<sha7> --heavy --keep -- node_modules/.bin/tsx scripts/marketTownStates.ts $HOME/fls-market-states", entry: import.meta.url });
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { BALANCE } from "../src/content/balanceConfig";
import { LORD_SLICE_SCENARIO_ID } from "../src/content/lordSliceConfig";
import { charterWallPlan } from "../src/engine/charterPlan";
import type { GameState } from "../src/engine/engine.types";
import { lordBotCommands } from "../src/engine/lordBot";
import { lordMattersDue } from "../src/engine/lordDue";
import { lordSliceOutcome } from "../src/engine/lordSlice";
import { stateCalendar } from "../src/engine/scenarioState";
import { advanceTick } from "../src/engine/tick";
import { gameReducer } from "../src/state/gameStore";
import { newGameState } from "../src/state/newGame";

const YEAR = BALANCE.TICKS_PER_YEAR;
const SEASON = YEAR / 4;
/** Each state, ticks after the proclamation. */
const AFTER = { "market-proclaimed": SEASON, "market-years": 4 * YEAR } as const;
type Name = keyof typeof AFTER;

const out = process.argv[2];
if (out === undefined) throw new Error("usage: tsx scripts/marketTownStates.ts <out-dir> [seeds] [years]");
const seeds = (process.argv[3] ?? "1,2").split(",").map(Number);
const years = Number(process.argv[4] ?? 40);
mkdirSync(out, { recursive: true });

const found: Partial<Record<Name, Record<string, unknown>>> = {};
const timings: { seed: number; year: number; ms: number; population: number }[] = [];
const step = (state: GameState) => { let next = state; for (const { command } of lordBotCommands(next)) next = gameReducer(next, command); return advanceTick(next); };
const save = (name: Name, seed: number, state: GameState, proclaimed: { tick: number; year: number; season: number }) => {
  const date = stateCalendar(state);
  const outcome = lordSliceOutcome(state);
  found[name] = { seed, tick: state.tick, year: date.year, season: date.season, era: state.era, population: state.population,
    plan: charterWallPlan(state)?.stage ?? null, proclaimed, treasury: outcome?.summary.treasury ?? null, houses: state.houses.length,
    estatesHeld: outcome?.summary.estatesHeld ?? null, marriage: outcome?.summary.marriage ?? null,
    lordMattersDue: lordMattersDue(state).map(matter => `${matter.kind}:${matter.id}`),
    openPetitions: (state.stewardship?.petitions ?? []).filter(petition => petition.status === "open").length,
    sliceEnded: outcome?.ended ?? null, sliceEndReason: outcome?.reason ?? null, sliceEndTick: outcome?.endTick ?? null };
  writeFileSync(join(out, `${name}.json`), JSON.stringify(state));
  process.stderr.write(`${name}: seed ${seed} tick ${state.tick} (${date.year} season ${date.season}) ${state.era}, population ${state.population}\n`);
};

const started = Date.now();
for (const seed of seeds) {
  let state = newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed })!;
  const end = stateCalendar(state).year + years;
  let proclaimed: { tick: number; year: number; season: number } | null = null;
  let year = stateCalendar(state).year;
  let yearStarted = Date.now();
  while (stateCalendar(state).year < end && (Object.keys(AFTER) as Name[]).some(name => found[name] === undefined)) {
    state = step(state);
    const now = stateCalendar(state).year;
    if (now !== year) {
      timings.push({ seed, year, ms: Date.now() - yearStarted, population: state.population });
      process.stderr.write(`seed ${seed} ${year}: ${Date.now() - yearStarted} ms, population ${state.population}, ${state.era}\n`);
      year = now; yearStarted = Date.now();
    }
    if (proclaimed === null && state.era !== "hamlet") {
      const date = stateCalendar(state);
      proclaimed = { tick: state.tick, year: date.year, season: date.season };
      process.stderr.write(`seed ${seed}: proclaimed at tick ${state.tick} (${date.year}), era ${state.era}, plan ${charterWallPlan(state)?.stage}\n`);
    }
    if (proclaimed === null) continue;
    for (const name of Object.keys(AFTER) as Name[]) if (found[name] === undefined && state.tick >= proclaimed.tick + AFTER[name]) save(name, seed, state, proclaimed);
  }
  process.stderr.write(`seed ${seed} ran to ${stateCalendar(state).year} (tick ${state.tick}, ${state.era}) — ${Math.round((Date.now() - started) / 1000)} s\n`);
  if ((Object.keys(AFTER) as Name[]).every(name => found[name] !== undefined)) break;
}
writeFileSync(join(out, "states.json"), JSON.stringify({ found, years: timings }, null, 1));
const missing = (Object.keys(AFTER) as Name[]).filter(name => found[name] === undefined);
process.stderr.write(missing.length === 0 ? "both states found\n" : `not reached: ${missing.join(", ")}\n`);
if (missing.length > 0) process.exitCode = 1;
