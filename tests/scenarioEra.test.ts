import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { CORE_SCENARIOS, DEFAULT_SCENARIO_ID, SANDBOX_SCENARIO_ID } from "../src/content/scenario/coreScenarios";
import { SCENARIOS, ScenarioRegistry, ScenarioValidationError } from "../src/content/scenario/registry";
import type { ScenarioDef } from "../src/content/scenario/types";
import { BUILDING_CONFIG } from "../src/content/buildingConfig";
import { canProclaimPalisadeEra, canProclaimStoneTownEra, evaluateEraRequirements } from "../src/engine/era";
import type { GameState } from "../src/engine/engine.types";
import { calendar, historicalEra, historicalEraEffectRegistry, stateCalendar, victoryConditionsMet } from "../src/engine/scenarioState";
import { settlementMetrics } from "../src/engine/settlementMetrics";
import { updateSettlementProgress } from "../src/engine/settlementProgress";
import { getSettlementView } from "../src/engine/settlementView";
import { advanceTick } from "../src/engine/tick";
import { decodeSave, encodeSave } from "../src/save/saveCodec";
import { DEFAULT_GAME_STATE } from "../src/state/gameStore";
import { isBuildingUnlocked } from "../src/world/placement";

const v5 = (name: string): GameState => decodeSave(readFileSync(`fixtures/saves/v5/${name}.save.json`)).envelope.state as GameState;
const v4 = (name: string) => decodeSave(readFileSync(`fixtures/saves/v4/${name}.save.json`));

/** The 24-lot L4 seed-1 city with its stone wall turned back into a completed timber palisade (market town). */
function walledMarketTown(scenarioId = DEFAULT_SCENARIO_ID): GameState {
  const city = JSON.parse(readFileSync("fixtures/determinism/seed1/final-state.json", "utf8")) as GameState;
  const palisade = city.palisade;
  assert.ok(palisade !== null);
  return {
    ...city, scenarioId, era: "palisade",
    palisade: { ...palisade, segments: palisade.segments.map(segment => ({ ...segment, material: "timber" as const, replacementConstructionSiteId: null })) },
    constructionSites: city.constructionSites.filter(site => site.kind !== "stone_wall_segment"),
    ...(city.settlement === undefined ? {} : {
      settlement: { ...city.settlement, prosperityTicks: 0, milestones: { ...city.settlement.milestones, prosperity: null }, outcome: "ongoing" as const },
    }),
  };
}

test("SC-1 scenarios register as namespace:id in declaration order and reject invalid data", () => {
  assert.deepEqual(SCENARIOS.list().map(scenario => scenario.id), [DEFAULT_SCENARIO_ID, SANDBOX_SCENARIO_ID]);
  const base = CORE_SCENARIOS[0]!;
  const registry = () => { const r = new ScenarioRegistry(); r.registerArchetype({ id: "core:open_field", resourcePackage: {} }); return r; };
  const reject = (scenario: ScenarioDef, pattern: RegExp) => assert.throws(() => registry().register(scenario), (error: unknown) => error instanceof ScenarioValidationError && pattern.test(String((error as Error).message)));
  reject({ ...base, id: "campaign" }, /namespace:id/);
  reject({ ...base, walls: { ...base.walls, palisade: "optional" } }, /K4-2/);
  reject({ ...base, walls: { palisade: "required", stoneWall: "optional" } }, /stoneWallPrereq/);
  reject({ ...base, mode: "sandbox" }, /sandbox has no victory/);
  reject({ ...base, eras: [...base.eras].reverse() }, /ascending/);
  reject({ ...base, victory: { all: [{ kind: "no_such_rule" } as never] } }, /unknown condition/);
  reject({ ...base, stages: [base.stages[0]!, { ...base.stages[1]!, unlocks: [] }, base.stages[2]!] }, /never unlocked/);
  const r = registry();
  r.register(base);
  assert.throws(() => r.register(base), /Duplicate scenario/);
});

test("SC-4 SC-6 proclamation requirement rows keep the pre-B2 labels and targets", () => {
  const rows = (state: GameState) => evaluateEraRequirements(state).map(row => [row.key, row.label, row.target]);
  assert.deepEqual(rows(DEFAULT_GAME_STATE), [["population", "인구", 60], ["granary", "곡창", 1], ["chapel", "예배당", 1], ["timber", "목재", 250]]);
  assert.deepEqual(rows({ ...DEFAULT_GAME_STATE, era: "palisade" }), [["population", "인구", 140], ["market", "시장", 1], ["masonry", "석공소", 1], ["stone", "석재", 400], ["coin", "돈", 200]]);
  assert.equal(canProclaimPalisadeEra(DEFAULT_GAME_STATE), false);
});

test("SC-5 unlocks come from stages: the church moves to market town, everything else is unchanged", () => {
  const before = { quarry: "palisade", masonry: "palisade", market: "palisade", church: "stone_town", keep: "stone_town" } as const;
  for (const { kind } of BUILDING_CONFIG) {
    const firstEra = (["hamlet", "palisade", "stone_town"] as const).find(era => isBuildingUnlocked(kind, era));
    // AF-12: the retired wheat farm is never unlocked; the farmstead opens with the village.
    const expected = kind === "wheat_farm" ? undefined : kind === "church" ? "palisade" : (before as Record<string, string>)[kind] ?? "hamlet";
    assert.equal(firstEra, expected, kind);
  }
});

test("T3 SC-6 the stone-wall project opens only when the scenario allows it and its prerequisites hold", () => {
  const city = walledMarketTown();
  const ready: GameState = { ...city, treasuryCoin: 999, buildings: city.buildings.map(building => building.kind === "storehouse"
    ? { ...building, inventory: { ...building.inventory, stone: 999 } } : building) };
  assert.equal(canProclaimStoneTownEra(ready), true, "optional + prerequisites met");
  assert.equal(canProclaimStoneTownEra({ ...ready, treasuryCoin: 0 }), false, "optional + coin prerequisite unmet");
  if (SCENARIOS.get("test:no_stone_wall") === undefined) {
    SCENARIOS.register({ ...CORE_SCENARIOS[0]!, id: "test:no_stone_wall", walls: { palisade: "required", stoneWall: "off" } });
  }
  const off = { ...ready, scenarioId: "test:no_stone_wall" };
  assert.equal(canProclaimStoneTownEra(off), false, "off never opens");
  assert.deepEqual(evaluateEraRequirements(off), [], "no stone-wall rows are shown when the project does not exist");
});

test("T1 SC-7 prosperity victory is reached with a timber palisade and no stone wall", () => {
  let state = walledMarketTown();
  assert.equal(settlementMetrics(state).completedStoneWall, false);
  assert.equal(state.buildings.some(building => building.kind === "church"), true);
  assert.equal(victoryConditionsMet(state), true, "victory conditions hold without a stone town or stone wall");
  for (let step = 0; step < 1300 && state.settlement?.outcome !== "victory"; step += 1) state = advanceTick(state);
  assert.equal(state.settlement?.outcome, "victory");
  assert.equal(state.era, "palisade");
  assert.equal(settlementMetrics(state).completedStoneWall, false);
});

test("SC-8 SC-9 objective order and abandonment are unchanged for the campaign", () => {
  const view = getSettlementView(DEFAULT_GAME_STATE);
  assert.equal(view.currentGoal?.id, "selfSufficient");
  assert.deepEqual(view.currentGoal?.criteria.map(row => [row.id, row.target]), [["population", 20], ["supplied", 90]]);
  const empty: GameState = { ...DEFAULT_GAME_STATE, tick: 7000, population: 0, houses: DEFAULT_GAME_STATE.houses.map(house => ({ ...house, residents: 0 })),
    settlement: { lastUpdatedTick: 6999, selfSufficientTicks: 0, prosperityTicks: 0, foodShortageTicks: 0, emptyTicks: 599, hadResidents: true,
      milestones: { selfSufficient: null, palisade: null, prosperity: null }, outcome: "ongoing" } };
  assert.equal(updateSettlementProgress({ ...empty, tick: 7000 }).settlement?.outcome, "abandoned");
  assert.equal(updateSettlementProgress({ ...empty, tick: 7000, scenarioId: SANDBOX_SCENARIO_ID }).settlement?.outcome, "ongoing");
});

test("T2 SC-10 a victory-ready city in the sandbox runs 24,000 ticks without victory or failure", () => {
  let state = walledMarketTown(SANDBOX_SCENARIO_ID);
  assert.equal(victoryConditionsMet(state), false, "sandbox has no victory conditions");
  for (let step = 0; step < 24_000; step += 1) {
    state = advanceTick(state);
    assert.equal(state.settlement?.outcome ?? "ongoing", "ongoing", `tick ${state.tick}`);
  }
  assert.equal(getSettlementView(state).currentGoal, null);
  assert.equal(getSettlementView(state).mode, "sandbox");
});

test("T4 SC-11 calendar boundaries: seasons every 1,000 ticks, years every 4,000 (C1c, provisional)", () => {
  assert.deepEqual(calendar(0, 1300), { year: 1300, season: 0, dayOfYear: 1 });
  assert.deepEqual(calendar(999, 1300), { year: 1300, season: 0, dayOfYear: 90 });
  assert.deepEqual(calendar(1000, 1300), { year: 1300, season: 1, dayOfYear: 91 });
  assert.deepEqual(calendar(3999, 1300), { year: 1300, season: 3, dayOfYear: 360 });
  assert.deepEqual(calendar(4000, 1300), { year: 1301, season: 0, dayOfYear: 1 });
  assert.deepEqual(stateCalendar({ tick: 2 * 4000 + 1000, scenarioId: DEFAULT_SCENARIO_ID }), { year: 1302, season: 1, dayOfYear: 91 });
});

test("T4 SC-12 historical eras change on their years and publish zero effects", () => {
  const eraAt = (year: number) => historicalEra({ tick: (year - 1300) * 4000, scenarioId: DEFAULT_SCENARIO_ID }).id;
  assert.deepEqual([1300, 1314, 1315, 1336, 1337, 1347, 1348, 1379, 1380, 1450].map(eraAt),
    ["saturation", "saturation", "famine", "famine", "war", "war", "collapse", "collapse", "specialisation", "specialisation"]);
  assert.equal(historicalEra({ tick: 15 * 4000 - 1, scenarioId: DEFAULT_SCENARIO_ID }).id, "saturation");
  assert.equal(historicalEraEffectRegistry({ tick: 50 * 4000, scenarioId: DEFAULT_SCENARIO_ID }).size, 0);
});

test("T4 SC-13 calendar and era are identical after save and load", () => {
  let state = v5("population-176");
  const before = { calendar: stateCalendar(state), era: historicalEra(state).id };
  const encoded = encodeSave({ state, createdAt: "2026-09-24T00:00:00.000Z", savedAt: "2026-09-24T00:00:00.000Z" });
  const loaded = decodeSave(encoded.bytes).envelope.state as GameState;
  assert.deepEqual({ calendar: stateCalendar(loaded), era: historicalEra(loaded).id }, before);
  for (let step = 0; step < 1200; step += 1) { state = advanceTick(state); }
  let reloaded = loaded;
  for (let step = 0; step < 1200; step += 1) { reloaded = advanceTick(reloaded); }
  assert.deepEqual(stateCalendar(reloaded), stateCalendar(state));
  assert.equal(JSON.stringify(reloaded), JSON.stringify(state));
});

test("T5 SC-14 v4 saves load as the default campaign with their stage and era intact", () => {
  for (const name of ["new-game", "population-176", "palisade-construction", "timber-shortage"]) {
    const decoded = v4(name);
    const state = decoded.envelope.state as GameState;
    assert.equal(decoded.migratedFrom, 4);
    assert.equal(state.scenarioId, DEFAULT_SCENARIO_ID);
    assert.equal(decoded.envelope.scenarioId, DEFAULT_SCENARIO_ID);
    const original = JSON.parse(readFileSync(`fixtures/saves/v4/${name}.save.json`, "utf8")) as { state: GameState };
    assert.equal(state.era, original.state.era);
    assert.deepEqual(stateCalendar(state), calendar(original.state.tick, 1300));
  }
  const unknown = JSON.parse(readFileSync("fixtures/saves/v5/new-game.save.json", "utf8")) as { state: GameState; checksum?: string };
  delete unknown.checksum;
  assert.throws(() => decodeSave(new TextEncoder().encode(JSON.stringify({ ...unknown, state: { ...unknown.state, scenarioId: "core:missing" } }))), /scenario is unknown/);
});
