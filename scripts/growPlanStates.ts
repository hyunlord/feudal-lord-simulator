// GROW-BLOCK (the screen's part) lord-mode states for the era console's palisade plan (the geometry audit's `growplan`
// set, DGX ~/fls-growplan-states; tests/lordWallPlan.test.ts reads them when they are there): the lord's slice as the lord
// bot plays it, each seed until the town is past the hamlet or the years run out, and for each stage of the engine's
// `charterWallPlan` the first tick that holds it — nothing injected (but the prepared ones below):
//  - `plan-waiting`: a condition of the market charter unmet;
//  - `plan-sites`: every condition met, the search waiting on open building sites (one with a site the town gave up,
//    `agency.abandonedSites`, when a seed has one; the first otherwise);
//  - `plan-searching`, `plan-asked`: the town's turn; its request waiting on the lord (taken after the tick, before the
//    bot answers it);
//  - `plan-failed`: the last search found no wall (one whose failure names homes, when a seed has one).
// A stage no seed reaches is prepared from the first natural `plan-searching` state (`prepared` in states.json; the
// bot's towns of seeds 2–6 went from waiting straight to searching — the charter holds new buildings — and found their
// wall at the first search):
//  - sites: two building sites laid out as the engine lays one (createConstructionSite on tiles canPlaceBuilding takes,
//    the kinds the town builds), one standing a year and a season, the other no road reached for a year; then the
//    town's own week (advanceTownAgency, advanceHistory) gives the second up (GB-4) with its record — as the engine's
//    tests make it;
//  - failed: the town's failure as the engine keeps it (`agency.charterWallFailure`: the homes' service space, two of
//    the town's outermost houses, the second failure in a row) — the reason and homes chosen, not the engine's search.
// Beside them states.json (each: seed, tick, year, season, what the plan holds).
//   tsx scripts/growPlanStates.ts <out-dir> [seeds=1,2,3] [years=60]
import { refuseHeavyOnMac } from "./remote/localGuard.mjs";
refuseHeavyOnMac("영주 조각 봇 판(scripts/growPlanStates.ts)", { remote: "scripts/remote/run.sh render-GROWPLAN-states-<sha7> -- node_modules/.bin/tsx scripts/growPlanStates.ts $HOME/fls-growplan-states", entry: import.meta.url });
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CHARTER_RING } from "../src/content/charterRingConfig";
import type { BuildingKind } from "../src/content/buildingConfig";
import { LORD_SLICE_SCENARIO_ID } from "../src/content/lordSliceConfig";
import { AGENCY_WEEK_TICKS } from "../src/content/townAgencyConfig";
import { createConstructionSite } from "../src/economy/constructionSites";
import { advanceHistory } from "../src/engine/history";
import { advanceTownAgency } from "../src/engine/townAgency";
import { canPlaceBuilding, canPlaceBuildingBeforeRoad } from "../src/world/placement";
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
let searching: { seed: number; state: GameState } | null = null;
/** The richer state of a stage: a sites state beside a site given up, a failure that names homes. */
const best = (stage: Stage, state: GameState, plan: CharterWallPlan): boolean =>
  stage === "sites" ? (state.agency?.abandonedSites?.length ?? 0) > 0 : stage === "failed" ? (plan.failure?.homes.length ?? 0) > 0 : true;
const save = (seed: number, stage: Stage, state: GameState, plan: CharterWallPlan, prepared: string | null = null) => {
  const date = stateCalendar(state);
  const richer = best(stage, state, plan);
  found[stage] = { seed, tick: state.tick, year: date.year, season: date.season, best: richer, prepared,
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
    if (stage === "searching" && searching === null) searching = { seed, state };
    if (found[stage] === undefined || (found[stage].best !== true && best(stage, state, plan))) save(seed, stage, state, plan);
  }
  process.stderr.write(`seed ${seed} ran to ${stateCalendar(state).year} (tick ${state.tick}, ${state.era}) — ${Math.round((Date.now() - started) / 1000)} s\n`);
}
/** Free tiles for a kind near the town's houses, nearest first (with or without a road beside). */
function spots(state: GameState, kind: BuildingKind, road: boolean): { tx: number; ty: number }[] {
  const houses = state.buildings.filter(building => building.kind === "house");
  const cx = houses.reduce((sum, house) => sum + house.tx, 0) / Math.max(1, houses.length), cy = houses.reduce((sum, house) => sum + house.ty, 0) / Math.max(1, houses.length);
  const free: { tx: number; ty: number; d: number }[] = [];
  for (let ty = 0; ty < state.height; ty += 1) for (let tx = 0; tx < state.width; tx += 1) {
    const d = Math.hypot(tx - cx, ty - cy);
    if (d > 30 || state.constructionSites.some(site => "tx" in site && Math.abs(site.tx - tx) < 3 && Math.abs(site.ty - ty) < 3)) continue;
    if ((road ? canPlaceBuilding(state, kind, tx, ty) : canPlaceBuildingBeforeRoad(state, kind, tx, ty)).ok) free.push({ tx, ty, d });
  }
  return free.sort((left, right) => left.d - right.d);
}

function preparedSites(seed: number, start: GameState): void {
  const week = (Math.floor(start.tick / AGENCY_WEEK_TICKS) + 1) * AGENCY_WEEK_TICKS;
  const open = spots(start, "granary", true)[0];
  const stuck = spots(start, "well", false).reverse()[0];
  if (open === undefined || stuck === undefined) { process.stderr.write("prepared sites: no free tile\n"); return; }
  let ordinal = start.nextConstructionOrdinal;
  // Getting on (half its work and materials in), so it holds the search (GB-6) as a town's own site would.
  const laid = createConstructionSite({ ordinal: ordinal++, kind: "granary", tx: open.tx, ty: open.ty, startedTick: week - 5_000 });
  const half = Object.fromEntries(Object.entries(laid.required).map(([resource, amount]) => [resource, Math.floor(Number(amount) / 2)]));
  const standing = { ...laid, delivered: half, builderTicks: Math.floor(laid.requiredBuilderTicks / 2), stall: "none" as const };
  const given = { ...createConstructionSite({ ordinal: ordinal++, kind: "well", tx: stuck.tx, ty: stuck.ty, startedTick: week - CHARTER_RING.abandonTicks - 10 }),
    stall: "no_route" as const };
  const before: GameState = { ...start, tick: week, nextConstructionOrdinal: ordinal, constructionSites: [...start.constructionSites, standing, given] };
  const after = advanceHistory(before, advanceTownAgency(before));
  const plan = charterWallPlan(after)!;
  if (plan.stage !== "sites") { process.stderr.write(`prepared sites: the engine reads ${plan.stage}\n`); return; }
  save(seed, "sites", after, plan, "two sites laid out on the natural searching state; the town's week gave the roadless one up");
}

function preparedFailure(seed: number, start: GameState): void {
  const houses = start.buildings.filter(building => building.kind === "house");
  const cx = houses.reduce((sum, house) => sum + house.tx, 0) / houses.length, cy = houses.reduce((sum, house) => sum + house.ty, 0) / houses.length;
  const outer = [...houses].sort((left, right) => Math.hypot(right.tx - cx, right.ty - cy) - Math.hypot(left.tx - cx, left.ty - cy)).slice(0, 2);
  const state: GameState = { ...start, agency: { ...start.agency!, charterWallFailure: { tick: start.tick - 600, reason: "service_space", homes: outer.map(house => house.id), attempts: 2 } } };
  const plan = charterWallPlan(state)!;
  if (plan.stage !== "failed") { process.stderr.write(`prepared failure: the engine reads ${plan.stage}\n`); return; }
  save(seed, "failed", state, plan, "the engine's failure shape on the natural searching state: service space, two outermost houses, second failure");
}

if (searching !== null) {
  const from: { seed: number; state: GameState } = searching;
  if (found.sites === undefined) preparedSites(from.seed, from.state);
  if (found.failed === undefined) preparedFailure(from.seed, from.state);
}
writeFileSync(join(out, "states.json"), JSON.stringify(found, null, 1));
const missing = STAGES.filter(stage => found[stage] === undefined);
process.stderr.write(missing.length === 0 ? "every stage found\n" : `not reached: ${missing.join(", ")}\n`);
