// GROW-BLOCK (the screen's part) lord-mode states for the era console's palisade plan (the geometry audit's `growplan`
// set, DGX ~/fls-growplan-states; tests/lordWallPlan.test.ts reads them when they are there): the lord's slice as the lord
// bot plays it, each seed until the town is past the hamlet or the years run out, and for each stage of the engine's
// `charterWallPlan` the first tick that holds it — nothing injected:
//  - `plan-waiting`: a condition of the market charter unmet;
//  - `plan-sites`: every condition met, the search waiting on open building sites (one with a site the town gave up,
//    `agency.abandonedSites`, when a seed has one; the first otherwise);
//  - `plan-searching`, `plan-asked`: the town's turn; its request waiting on the lord (taken after the tick, before the
//    bot answers it);
//  - `plan-failed`: the last search found no wall (one whose failure names homes, when a seed has one).
// Beside them states.json (each: seed, tick, year, season, what the plan holds).
//   tsx scripts/growPlanStates.ts <out-dir> [seeds=1,2,3] [years=60]
import { refuseHeavyOnMac } from "./remote/localGuard.mjs";
refuseHeavyOnMac("영주 조각 봇 판(scripts/growPlanStates.ts)", { remote: "scripts/remote/run.sh render-GROWPLAN-states-<sha7> -- node_modules/.bin/tsx scripts/growPlanStates.ts $HOME/fls-growplan-states", entry: import.meta.url });
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { LORD_SLICE_SCENARIO_ID } from "../src/content/lordSliceConfig";
import { charterWallPlan, type CharterWallPlan } from "../src/engine/charterPlan";
import type { GameState } from "../src/engine/engine.types";
import { lordBotCommands } from "../src/engine/lordBot";
import { stateCalendar } from "../src/engine/scenarioState";
import { advanceTick } from "../src/engine/tick";
import { gameReducer } from "../src/state/gameStore";
import { newGameState } from "../src/state/newGame";

const out = process.argv[2];
if (out === undefined) throw new Error("usage: tsx scripts/growPlanStates.ts <out-dir> [seeds] [years]");
const seeds = (process.argv[3] ?? "1,2,3").split(",").map(Number);
const years = Number(process.argv[4] ?? 60);
mkdirSync(out, { recursive: true });

type Stage = Exclude<CharterWallPlan["stage"], "past">;
const STAGES: readonly Stage[] = ["waiting", "sites", "searching", "asked", "failed"];
const found: Partial<Record<Stage, Record<string, unknown> & { best: boolean }>> = {};
/** The richer state of a stage: a sites state beside a site given up, a failure that names homes. */
const best = (stage: Stage, state: GameState, plan: CharterWallPlan): boolean =>
  stage === "sites" ? (state.agency?.abandonedSites?.length ?? 0) > 0 : stage === "failed" ? (plan.failure?.homes.length ?? 0) > 0 : true;
const save = (seed: number, stage: Stage, state: GameState, plan: CharterWallPlan) => {
  const date = stateCalendar(state);
  const richer = best(stage, state, plan);
  found[stage] = { seed, tick: state.tick, year: date.year, season: date.season, best: richer,
    unmet: plan.requirements.filter(requirement => !requirement.met).map(requirement => requirement.key), sites: plan.sites, failure: plan.failure,
    abandoned: state.agency?.abandonedSites?.length ?? 0 };
  writeFileSync(join(out, `plan-${stage}.json`), JSON.stringify(state));
  process.stderr.write(`plan-${stage}: seed ${seed} tick ${state.tick} (${date.year}) ${richer ? "" : "(first, not the richer)"}\n`);
};
const step = (state: GameState) => { let next = state; for (const { command } of lordBotCommands(next)) next = gameReducer(next, command); return advanceTick(next); };

const started = Date.now();
for (const seed of seeds) {
  let state = newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed })!;
  const end = stateCalendar(state).year + years;
  while (stateCalendar(state).year < end && STAGES.some(stage => found[stage]?.best !== true)) {
    state = step(state);
    const plan = charterWallPlan(state);
    if (plan === null || plan.stage === "past") break;
    const stage = plan.stage;
    if (found[stage] === undefined || (found[stage].best !== true && best(stage, state, plan))) save(seed, stage, state, plan);
  }
  process.stderr.write(`seed ${seed} ran to ${stateCalendar(state).year} (tick ${state.tick}, ${state.era}) — ${Math.round((Date.now() - started) / 1000)} s\n`);
}
writeFileSync(join(out, "states.json"), JSON.stringify(found, null, 1));
const missing = STAGES.filter(stage => found[stage] === undefined);
process.stderr.write(missing.length === 0 ? "every stage found\n" : `not reached: ${missing.join(", ")}\n`);
