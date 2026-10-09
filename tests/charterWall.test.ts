/**
 * GROW-BLOCK GB-1·GB-3 (the user's ruling 2026-10-09): a failed charter wall search is kept with its reason and tried
 * again — a season on, the gap doubled at each failure in a row (at most eight seasons) — and the town's palisade plan
 * is read (where it stands, each condition's project, why the wall was not found). Lord mode only.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { CHARTER_RING, ERA_REQUIREMENT_PROJECT } from "../src/content/charterRingConfig";
import { LORD_SLICE_SCENARIO_ID } from "../src/content/lordSliceConfig";
import { charterWallPlan } from "../src/engine/charterPlan";
import type { GameState } from "../src/engine/engine.types";
import { charterRetryTick } from "../src/engine/townAgency";
import { advanceTick } from "../src/engine/tick";
import { newGameState } from "../src/state/newGame";

const lordGame = (): GameState => { let state = newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed: 1 })!; for (let tick = 0; tick < 10; tick += 1) state = advanceTick(state); return state; };

test("GB-1: a failed search is tried again a season on, the gap doubled at each failure in a row, at most eight seasons", () => {
  const season = CHARTER_RING.retryTicks;
  assert.deepEqual([1, 2, 3, 4, 5, 9].map(attempts => charterRetryTick({ tick: 10_000, attempts }) - 10_000), [season, 2 * season, 4 * season, 8 * season, 8 * season, 8 * season]);
});

test("GB-3: the palisade plan says where the charter stands — each condition with its project; failed, why, the homes cut off and when it tries again", () => {
  const state = lordGame();
  const plan = charterWallPlan(state)!;
  assert.equal(plan.stage, "waiting");
  for (const requirement of plan.requirements) assert.equal(requirement.project, ERA_REQUIREMENT_PROJECT[requirement.key]);
  assert.ok(plan.requirements.some(requirement => requirement.key === "population" && requirement.project === "house"));
  // Every condition met, nothing open, the last search failed on the homes' service space.
  const met = { ...state, constructionSites: [], agency: { ...state.agency!, charterWallFailure: { tick: 4_000, reason: "service_space" as const, homes: ["house-1"], attempts: 2 } } };
  const failed = charterWallPlan({ ...met, population: 600 } as GameState)!;
  assert.deepEqual(failed.failure, { tick: 4_000, reason: "service_space", homes: ["house-1"], attempts: 2, retryTick: 4_000 + 2 * CHARTER_RING.retryTicks });
  // Outside lord mode, nothing.
  const { agency: _agency, ...sandbox } = state;
  assert.equal(charterWallPlan(sandbox as GameState), null);
});

test("GB-4: a building site no road has reached for a year, nothing delivered and no work done, is given up with its cause; a younger one stays", async () => {
  const { AGENCY_WEEK_TICKS } = await import("../src/content/townAgencyConfig");
  const { isBuildingConstructionSite } = await import("../src/economy/construction");
  const { HISTORY_TEMPLATES } = await import("../src/content/historyCopy.ko");
  const { advanceTownAgency } = await import("../src/engine/townAgency");
  const { advanceHistory } = await import("../src/engine/history");
  let state = lordGame();
  for (let tick = 0; tick < 400 && !state.constructionSites.some(isBuildingConstructionSite); tick += 1) state = advanceTick(state);
  const site = state.constructionSites.find(isBuildingConstructionSite)!;
  assert.ok(site !== undefined, "the opening lays a site out");
  // The town's week itself (the construction's own step would find this site's road again and lift its stall).
  const week = (Math.floor(state.tick / AGENCY_WEEK_TICKS) + 1) * AGENCY_WEEK_TICKS;
  const stuck = (age: number): GameState => ({ ...state, tick: week, constructionSites: state.constructionSites.map(entry => entry.id !== site.id ? entry
    : { ...entry, stall: "no_route" as const, builderTicks: 0, delivered: {}, startedTick: week - age }) });
  const before = stuck(CHARTER_RING.abandonTicks + 10);
  const old = advanceTownAgency(before);
  assert.equal(old.constructionSites.some(entry => entry.id === site.id), false, "given up");
  assert.deepEqual(old.agency!.abandonedSites!.map(entry => [entry.id, entry.reason, entry.tx, entry.ty]), [[site.id, "road", site.tx, site.ty]]);
  const record = advanceHistory(before, old).history!.records.find(entry => entry.template === "agency.site_abandoned")!;
  assert.match(HISTORY_TEMPLATES["agency.site_abandoned"]!(record.params!), /공사를 접었다 — 1년 동안 길이 닿지 않았다$/);
  const young = advanceTownAgency(stuck(CHARTER_RING.abandonTicks - 1_000));
  assert.ok(young.constructionSites.some(entry => entry.id === site.id), "not yet a year");
});

test("GB-6: only a core site getting on holds the charter's search — a stuck one, one untouched a season, or one outside the core does not", async () => {
  const { holdsCharterSearch } = await import("../src/engine/palisadeFootprints");
  const { isBuildingConstructionSite } = await import("../src/economy/construction");
  let state = lordGame();
  for (let tick = 0; tick < 400 && !state.constructionSites.some(isBuildingConstructionSite); tick += 1) state = advanceTick(state);
  const site = state.constructionSites.find(isBuildingConstructionSite)!;
  const as = (fields: Record<string, unknown>) => ({ ...site, ...fields }) as typeof site;
  const fresh = as({ kind: "well", stall: "awaiting_materials", startedTick: state.tick, builderTicks: 0, delivered: {} });
  assert.equal(holdsCharterSearch(state, fresh), true, "a core site just laid out");
  assert.equal(holdsCharterSearch(state, as({ kind: "well", stall: "no_route" })), false, "no road");
  assert.equal(holdsCharterSearch(state, as({ kind: "well", stall: "no_material_source" })), false, "no source");
  assert.equal(holdsCharterSearch({ tick: state.tick + 1_000 }, fresh), false, "untouched a season");
  assert.equal(holdsCharterSearch(state, as({ kind: "logging_camp", stall: "awaiting_materials", startedTick: state.tick })), false, "the wall has no business with it");
});

test("GB-5: a site is laid out only where its materials can come; a spot given up for want of material or hands is not taken again within a year", async () => {
  const { constructionSiteReachable } = await import("../src/engine/siteReach");
  const state = lordGame();
  // A tile beside a road of the town's network.
  const road = state.tiles.find(tile => tile.hasRoad)!;
  const besides = [{ tx: road.tx, ty: road.ty + 1 }, { tx: road.tx + 1, ty: road.ty }, { tx: road.tx, ty: road.ty - 1 }, { tx: road.tx - 1, ty: road.ty }];
  const spot = besides.find(tile => constructionSiteReachable(state, "well", tile));
  assert.ok(spot !== undefined, "a well beside the network's road is reachable");
  const given: GameState = { ...state, agency: { ...state.agency!, abandonedSites: [{ id: "site-x", kind: "well", tx: spot!.tx, ty: spot!.ty, tick: state.tick, since: 0, reason: "material" }] } };
  assert.equal(constructionSiteReachable(given, "well", spot!), false, "not again within a year");
  assert.equal(constructionSiteReachable({ ...given, tick: state.tick + 4_000 }, "well", spot!), true, "a year on, if it reaches");
  // A corner of the map no road reaches is not.
  assert.equal(constructionSiteReachable(state, "well", { tx: 1, ty: 1 }), false);
});
