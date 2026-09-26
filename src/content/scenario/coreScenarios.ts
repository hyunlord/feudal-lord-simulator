import { MONEY_BALANCE } from "../balanceConfig";
import { DEARTH_REHEARSAL_EVENT_ID, FIRE_EVENT_ID, FIRST_FIRE_EVENT_ID, WEATHER_EVENT_ID } from "../eventConfig";
import { SCENARIO_COPY } from "./scenarioCopy.ko";
import type { ArchetypeDef, EraDef, ObjectiveDef, ScenarioDef, StageDef } from "./types";

/** Settlement stages shared by both core scenarios. Values reproduce the pre-B2 proclamation rules. */
const STAGES: readonly StageDef[] = [
  {
    id: "village",
    enterWhen: { all: [] },
    unlocks: ["house", "well", "storehouse", "granary", "chapel", "wheat_farm", "farmstead", "mill", "logging_camp", "sawmill"],
  },
  {
    id: "market_town",
    enterWhen: { all: [
      { kind: "population_at_least", value: 60 },
      { kind: "building_count_at_least", building: "granary", value: 1 },
      { kind: "building_count_at_least", building: "chapel", value: 1 },
      { kind: "spendable_resource_at_least", resource: "timber", value: 250 },
    ] },
    // K4-1: the church moves here from the stone-town proclamation so L4 houses need no stone wall.
    unlocks: ["quarry", "masonry", "market", "church"],
  },
  {
    id: "fortified_town",
    enterWhen: { all: [{ kind: "stage_at_least", stage: "market_town" }] },
    unlocks: ["keep"],
  },
];

/**
 * Five historical eras (content design §1, K9). F0-A (F2, spec FP-5): the Great Famine waits for a town that can meet
 * it (a granary, 12 lots, a market), at most five years; effects come with F0-B.
 */
const ERAS: readonly EraDef[] = [
  { id: "saturation", name: SCENARIO_COPY.eras.saturation, enterWhen: { yearAtLeast: 1300 }, effects: [] },
  { id: "famine", name: SCENARIO_COPY.eras.famine, enterWhen: { yearAtLeast: 1315, maxDelayYears: 5, state: { all: [
    { kind: "building_count_at_least", building: "granary", value: 1 },
    { kind: "housing_lots_at_least", value: 12 },
    { kind: "building_count_at_least", building: "market", value: 1 },
  ] } }, effects: [] },
  { id: "war", name: SCENARIO_COPY.eras.war, enterWhen: { yearAtLeast: 1337 }, effects: [] },
  { id: "collapse", name: SCENARIO_COPY.eras.collapse, enterWhen: { yearAtLeast: 1348 }, effects: [] },
  { id: "specialisation", name: SCENARIO_COPY.eras.specialisation, enterWhen: { yearAtLeast: 1380 }, effects: [] },
];

const OBJECTIVES: readonly ObjectiveDef[] = [
  { id: "selfSufficient", conditions: { all: [
    { kind: "population_at_least", value: 20 },
    { kind: "supplied_percent_at_least", value: 90 },
  ], holdTicks: 600 } },
  { id: "palisade", conditions: { all: [
    { kind: "population_at_least", value: 60 },
    { kind: "stage_at_least", stage: "market_town" },
    { kind: "wall_completed" },
  ] } },
];

const WALLS = {
  palisade: "required",
  stoneWall: "optional",
  stoneWallPrereq: { all: [
    { kind: "population_at_least", value: 140 },
    { kind: "building_count_at_least", building: "market", value: 1 },
    { kind: "building_count_at_least", building: "masonry", value: 1 },
    { kind: "spendable_resource_at_least", resource: "stone", value: 400 },
    // M-7: the same sum is spent when the project is proclaimed.
    { kind: "treasury_coin_at_least", value: MONEY_BALANCE.stoneWallProjectCost },
  ] },
} as const satisfies ScenarioDef["walls"];

/** C2 money rules: the lord's mill monopoly is on, demesne sales are off (goods belong to residents). */
const ECONOMY_RULES = { millMonopoly: true, demesneSale: false } as const satisfies ScenarioDef["economyRules"];

export const CORE_ARCHETYPES: readonly ArchetypeDef[] = [{ id: "core:open_field", resourcePackage: {} }];

/** F0-B (EV-1): the weather and chapter 1's events — the first fire, later fires and the first dearth (the rehearsal). */
const CHAPTER_ONE_EVENTS = [WEATHER_EVENT_ID, FIRST_FIRE_EVENT_ID, FIRE_EVENT_ID, DEARTH_REHEARSAL_EVENT_ID] as const;

export const CORE_SCENARIOS: readonly ScenarioDef[] = [
  {
    id: "core:campaign_market_town",
    name: SCENARIO_COPY.scenarios.campaign_market_town,
    mode: "campaign",
    startYear: 1300,
    archetype: "core:open_field",
    stages: STAGES,
    eras: ERAS,
    objectives: OBJECTIVES,
    // K4-1: no stone-town era or stone wall; a completed stone wall is only a victory-screen bonus.
    victory: { all: [
      { kind: "population_at_least", value: 140 },
      { kind: "occupied_l4_lots_at_least", value: 4 },
      { kind: "supplied_percent_at_least", value: 90 },
    ], holdTicks: 1200 },
    failure: { all: [{ kind: "settlement_empty_for", ticks: 600 }] },
    walls: WALLS,
    activeEvents: CHAPTER_ONE_EVENTS,
    economyRules: ECONOMY_RULES,
  },
  {
    id: "core:sandbox",
    name: SCENARIO_COPY.scenarios.sandbox,
    mode: "sandbox",
    startYear: 1300,
    archetype: "core:open_field",
    stages: STAGES,
    eras: ERAS,
    objectives: [],
    victory: null,
    failure: null,
    walls: WALLS,
    activeEvents: CHAPTER_ONE_EVENTS,
    economyRules: ECONOMY_RULES,
  },
];

export const DEFAULT_SCENARIO_ID = "core:campaign_market_town";
export const SANDBOX_SCENARIO_ID = "core:sandbox";
