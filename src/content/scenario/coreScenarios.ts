import { MONEY_BALANCE } from "../balanceConfig";
import { DEARTH_REHEARSAL_EVENT_ID, FIRE_EVENT_ID, FIRST_FIRE_EVENT_ID, GREAT_FAMINE_EFFECTS, GREAT_FAMINE_EVENT_ID, WEATHER_EVENT_ID } from "../eventConfig";
import { PLAGUE_SEQUENCE_ID } from "../plagueConfig";
import { REORGANISATION_SEQUENCE_ID } from "../reorganisationConfig";
import { LEGACY_SEQUENCE_ID } from "../legacyConfig";
import { WAR_ERA_EFFECTS, WAR_SEQUENCE_ID } from "../warConfig";
import { MAP_ARCHETYPES } from "./archetypes";
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
    // C4 (AL-3): the malt kiln with the market town (ale is a choice in chapter 1, a need from 1318).
    // C5 (CL-2…CL-7): the pastoral farm and the cloth trades with the market town (the hamlet's first menu unchanged).
    unlocks: ["quarry", "masonry", "market", "church", "malt_kiln", "pastoral_farm", "weaver_house", "fulling_mill", "dyehouse", "tenter_yard"],
  },
  {
    id: "fortified_town",
    enterWhen: { all: [{ kind: "stage_at_least", stage: "market_town" }] },
    unlocks: ["keep"],
  },
];

/**
 * Five historical eras (content design §1, K9). F0-A (F2, spec FP-5): the Great Famine waits for a town that can meet
 * it (a granary, 12 lots, a market), at most five years. F0-C1 (FC-1): its effects are the Great Famine's.
 */
const ERAS: readonly EraDef[] = [
  { id: "saturation", name: SCENARIO_COPY.eras.saturation, enterWhen: { yearAtLeast: 1300 }, effects: [] },
  { id: "famine", name: SCENARIO_COPY.eras.famine, enterWhen: { yearAtLeast: 1315, maxDelayYears: 5, state: { all: [
    { kind: "building_count_at_least", building: "granary", value: 1 },
    { kind: "housing_lots_at_least", value: 12 },
    { kind: "building_count_at_least", building: "market", value: 1 },
  ] } }, effects: GREAT_FAMINE_EFFECTS },
  // F2-A (WR-1): the War era brings the royal messenger and what follows (`war.ts`).
  { id: "war", name: SCENARIO_COPY.eras.war, enterWhen: { yearAtLeast: 1337 }, effects: WAR_ERA_EFFECTS },
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

/** ARCH-1 (MA-1): the five lands — the open field (the riverside town, a tidal river's mouth) first. */
export const CORE_ARCHETYPES: readonly ArchetypeDef[] = MAP_ARCHETYPES;

/**
 * F0-B (EV-1): the weather and chapter 1's events — the first fire, later fires and the first dearth (the rehearsal).
 * F0-C1 (FC-1): and the Great Famine, which comes with the famine era. F2-A (WR-1): and the war of 1337. F3-A (PL-1): and the Black Death.
 */
const CORE_EVENTS = [WEATHER_EVENT_ID, FIRST_FIRE_EVENT_ID, FIRE_EVENT_ID, DEARTH_REHEARSAL_EVENT_ID, GREAT_FAMINE_EVENT_ID, WAR_SEQUENCE_ID, PLAGUE_SEQUENCE_ID, REORGANISATION_SEQUENCE_ID, LEGACY_SEQUENCE_ID] as const;

/** LM-E8 (LS-1): the lord's vertical slice (`lordSliceConfig.ts` holds its rules). */
export const LORD_SLICE_SCENARIO_ID = "core:lord_slice";

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
    activeEvents: CORE_EVENTS,
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
    activeEvents: CORE_EVENTS,
    economyRules: ECONOMY_RULES,
  },
];

/**
 * LM-E8 (spec docs/design/lord-slice.md LS-1): the lord's vertical slice — the demesne and its market town, the three
 * neighbour estates off the map, from 1300; always lord mode (the town builds itself). No chapters' victory: it ends
 * after twenty years or five after a second estate (`lordSliceOutcome`). Registered beside the core two but not among
 * them: the start screen lists `CORE_SCENARIOS`, and the slice's own start is render's (LM-R3).
 */
export const LORD_SLICE_SCENARIO: ScenarioDef = {
  id: LORD_SLICE_SCENARIO_ID,
  name: SCENARIO_COPY.scenarios.lord_slice,
  mode: "sandbox",
  startYear: 1300,
  archetype: "core:open_field",
  stages: STAGES,
  eras: ERAS,
  objectives: [],
  victory: null,
  failure: null,
  walls: WALLS,
  activeEvents: CORE_EVENTS,
  economyRules: ECONOMY_RULES,
};

export const DEFAULT_SCENARIO_ID = "core:campaign_market_town";
export const SANDBOX_SCENARIO_ID = "core:sandbox";
