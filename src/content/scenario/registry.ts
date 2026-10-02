import { BUILDING_CONFIG_BY_KIND, isPreplacedBuildingKind, type BuildingKind } from "../buildingConfig";
import { EVENT_DEF_BY_ID, WEATHER_EVENT_ID } from "../eventConfig";
import { WAR_SEQUENCE_ID } from "../warConfig";
import { PLAGUE_SEQUENCE_ID } from "../plagueConfig";
import { REORGANISATION_SEQUENCE_ID } from "../reorganisationConfig";
import { LEGACY_SEQUENCE_ID } from "../legacyConfig";
import { CORE_ARCHETYPES, CORE_SCENARIOS, DEFAULT_SCENARIO_ID, LORD_SLICE_SCENARIO } from "./coreScenarios";
import { CONDITION_KINDS, STAGE_ORDER, type ArchetypeDef, type Condition, type ConditionSet, type ScenarioDef, type StageDef, type StageId } from "./types";

const ID_PATTERN = /^[a-z][a-z0-9_]*:[a-z][a-z0-9_]*$/;

export class ScenarioValidationError extends Error {}

/** Validates and stores scenario data in declaration order; ids are `namespace:id` and unique. */
export class ScenarioRegistry {
  private readonly scenarios = new Map<string, ScenarioDef>();
  private readonly archetypes = new Map<string, ArchetypeDef>();

  registerArchetype(archetype: ArchetypeDef): void {
    if (!ID_PATTERN.test(archetype.id)) throw new ScenarioValidationError(`Archetype id must be namespace:id: ${archetype.id}`);
    validateArchetype(archetype);
    if (this.archetypes.has(archetype.id)) throw new ScenarioValidationError(`Duplicate archetype ${archetype.id}`);
    this.archetypes.set(archetype.id, archetype);
  }

  register(scenario: ScenarioDef): void {
    validateScenario(scenario, this.archetypes);
    if (this.scenarios.has(scenario.id)) throw new ScenarioValidationError(`Duplicate scenario ${scenario.id}`);
    this.scenarios.set(scenario.id, scenario);
  }

  get(id: string): ScenarioDef | undefined {
    return this.scenarios.get(id);
  }

  archetype(id: string): ArchetypeDef | undefined {
    return this.archetypes.get(id);
  }

  /** ARCH-1 (MA-6): the lands in registration order, the order the start screen offers them. */
  listArchetypes(): readonly ArchetypeDef[] {
    return [...this.archetypes.values()];
  }

  /** Registration order, which is also the order shown to the player. */
  list(): readonly ScenarioDef[] {
    return [...this.scenarios.values()];
  }
}

function fail(scenario: string, message: string): never {
  throw new ScenarioValidationError(`${scenario}: ${message}`);
}

function validateNumber(scenario: string, value: unknown, label: string): void {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) fail(scenario, `${label} must be a finite non-negative number`);
}

/** ARCH-1 (MA-2, MA-4): shares that leave open ground, a sea's depths whole and ordered, coefficients whole and positive. */
function validateArchetype(archetype: ArchetypeDef): void {
  const fail = (message: string): never => { throw new ScenarioValidationError(`${archetype.id}: ${message}`); };
  const { terrain, rules } = archetype;
  const shares = terrain.shares;
  if ((shares === undefined) !== (terrain.kind === "river")) fail("every land but the riverside town has its shares");
  if (shares !== undefined && (Object.values(shares).some(value => !Number.isInteger(value) || value < 0)
    || shares.water + shares.rock + shares.forest >= 1000)) fail("shares are whole permille and leave open ground");
  if (terrain.detailPermille !== undefined && (!Number.isInteger(terrain.detailPermille) || terrain.detailPermille < 0 || terrain.detailPermille > 1000)) {
    fail("detailPermille must lie in [0, 1000]");
  }
  if (terrain.sea !== undefined && (!Number.isInteger(terrain.sea.minDepth) || !Number.isInteger(terrain.sea.maxDepth)
    || terrain.sea.minDepth < 1 || terrain.sea.maxDepth < terrain.sea.minDepth)) fail("the sea needs whole depths, least first");
  for (const [key, value] of Object.entries(rules)) if (!Number.isInteger(value) || value <= 0) fail(`${key} must be a positive whole permille`);
  if (archetype.ground.decalPermille < 0 || archetype.ground.decalPermille > 1000) fail("decalPermille must lie in [0, 1000]");
}

function validateCondition(scenario: string, condition: Condition): void {
  if (!(CONDITION_KINDS as readonly string[]).includes(condition.kind)) fail(scenario, `unknown condition ${String((condition as { kind: unknown }).kind)}`);
  switch (condition.kind) {
    case "population_at_least": case "supplied_percent_at_least": case "occupied_l4_lots_at_least": case "treasury_coin_at_least":
    case "housing_lots_at_least":
      return validateNumber(scenario, condition.value, condition.kind);
    case "stage_at_least":
      if (!(STAGE_ORDER as readonly string[]).includes(condition.stage)) fail(scenario, `unknown stage ${condition.stage}`);
      return;
    case "building_count_at_least":
      if (BUILDING_CONFIG_BY_KIND[condition.building] === undefined) fail(scenario, `unknown building ${condition.building}`);
      return validateNumber(scenario, condition.value, condition.kind);
    case "spendable_resource_at_least":
      if (condition.resource !== "timber" && condition.resource !== "stone") fail(scenario, `unknown resource ${String(condition.resource)}`);
      return validateNumber(scenario, condition.value, condition.kind);
    case "settlement_empty_for":
      return validateNumber(scenario, condition.ticks, condition.kind);
    case "wall_completed": case "stone_wall_completed":
      return;
  }
}

function validateSet(scenario: string, set: ConditionSet | null | undefined, label: string): void {
  if (set === null || set === undefined) return;
  if (!Array.isArray(set.all)) fail(scenario, `${label}.all must be an array`);
  if (set.holdTicks !== undefined) validateNumber(scenario, set.holdTicks, `${label}.holdTicks`);
  for (const condition of set.all) validateCondition(scenario, condition);
}

function validateScenario(scenario: ScenarioDef, archetypes: ReadonlyMap<string, ArchetypeDef>): void {
  const id = scenario.id;
  if (!ID_PATTERN.test(id)) fail(id, "id must be namespace:id");
  if (scenario.mode !== "campaign" && scenario.mode !== "sandbox") fail(id, "mode must be campaign or sandbox");
  if (typeof scenario.name !== "string" || scenario.name.length === 0) fail(id, "name is required");
  if (!Number.isInteger(scenario.startYear)) fail(id, "startYear must be an integer");
  if (!archetypes.has(scenario.archetype)) fail(id, `unknown archetype ${scenario.archetype}`);
  if (typeof scenario.economyRules?.millMonopoly !== "boolean" || typeof scenario.economyRules.demesneSale !== "boolean") {
    fail(id, "economyRules needs millMonopoly and demesneSale flags");
  }
  const stageIds = scenario.stages.map(stage => stage.id);
  if (stageIds.join() !== STAGE_ORDER.join()) fail(id, `stages must be ${STAGE_ORDER.join(", ")} in order`);
  const unlocked = new Set<string>();
  for (const stage of scenario.stages) {
    validateSet(id, stage.enterWhen, `stage ${stage.id}`);
    for (const kind of stage.unlocks) {
      if (BUILDING_CONFIG_BY_KIND[kind] === undefined) fail(id, `stage ${stage.id} unlocks unknown building ${kind}`);
      if (unlocked.has(kind)) fail(id, `building ${kind} is unlocked twice`);
      unlocked.add(kind);
    }
  }
  // FIX-11 (MH-4): a pre-placed kind (the manor house) is never unlocked.
  const missing = Object.keys(BUILDING_CONFIG_BY_KIND).filter(kind => !unlocked.has(kind) && !isPreplacedBuildingKind(kind as BuildingKind));
  if (missing.length > 0) fail(id, `buildings never unlocked: ${missing.join(", ")}`);
  let previousYear = Number.NEGATIVE_INFINITY;
  const eraIds = new Set<string>();
  for (const era of scenario.eras) {
    if (eraIds.has(era.id)) fail(id, `duplicate era ${era.id}`);
    eraIds.add(era.id);
    const year = era.enterWhen.yearAtLeast;
    if (year !== undefined) {
      if (!Number.isInteger(year) || year < previousYear) fail(id, "eras must be in ascending yearAtLeast order");
      previousYear = year;
    }
    validateSet(id, era.enterWhen.state, `era ${era.id}`);
    const delay = era.enterWhen.maxDelayYears;
    if (delay !== undefined && (!Number.isInteger(delay) || delay < 0 || year === undefined)) fail(id, `era ${era.id} maxDelayYears needs yearAtLeast and a whole number of years`);
  }
  if (scenario.eras.length === 0 || scenario.eras[0]?.enterWhen.yearAtLeast === undefined
    || scenario.eras[0].enterWhen.yearAtLeast > scenario.startYear) fail(id, "the first era must start by startYear");
  const objectiveIds = scenario.objectives.map(objective => objective.id);
  if (new Set(objectiveIds).size !== objectiveIds.length) fail(id, "objectives must be unique");
  for (const objective of scenario.objectives) validateSet(id, objective.conditions, `objective ${objective.id}`);
  validateSet(id, scenario.victory, "victory");
  validateSet(id, scenario.failure, "failure");
  if (scenario.mode === "sandbox" && (scenario.victory !== null || scenario.failure !== null)) fail(id, "sandbox has no victory or failure");
  if (scenario.walls.palisade !== "required") fail(id, "palisade policy other than required is reserved for C1 (decision K4-2)");
  if (!["required", "optional", "off"].includes(scenario.walls.stoneWall)) fail(id, "unknown stone wall policy");
  if (scenario.walls.stoneWall === "optional" && scenario.walls.stoneWallPrereq === undefined) fail(id, "optional stone wall needs stoneWallPrereq");
  validateSet(id, scenario.walls.stoneWallPrereq, "walls.stoneWallPrereq");
  // F0-B (EV-1): active events name known definitions; events need the weather.
  for (const eventId of scenario.activeEvents) {
    if (eventId !== WEATHER_EVENT_ID && eventId !== WAR_SEQUENCE_ID && eventId !== PLAGUE_SEQUENCE_ID && eventId !== REORGANISATION_SEQUENCE_ID && eventId !== LEGACY_SEQUENCE_ID && !EVENT_DEF_BY_ID.has(eventId)) fail(id, `unknown active event ${eventId}`);
  }
  if (scenario.activeEvents.some(eventId => eventId !== WEATHER_EVENT_ID) && !scenario.activeEvents.includes(WEATHER_EVENT_ID)) fail(id, "events need the weather");
}

function coreRegistry(): ScenarioRegistry {
  const registry = new ScenarioRegistry();
  for (const archetype of CORE_ARCHETYPES) registry.registerArchetype(archetype);
  for (const scenario of CORE_SCENARIOS) registry.register(scenario);
  // LM-E8 (LS-1): the lord's slice, registered after the core two (not on the start screen's list).
  registry.register(LORD_SLICE_SCENARIO);
  return registry;
}

export const SCENARIOS = coreRegistry();

/** A state without `scenarioId` (created before save v5) belongs to the default campaign. */
export function scenarioById(id: string | undefined): ScenarioDef {
  const scenario = SCENARIOS.get(id ?? DEFAULT_SCENARIO_ID);
  if (scenario === undefined) throw new ScenarioValidationError(`Unknown scenario ${String(id)}`);
  return scenario;
}

/** F2-A (WR-5): the scenario's map archetype (its coast). ARCH-1: a state's own land is `stateArchetype` (engine). */
export function archetypeOf(scenario: ScenarioDef): ArchetypeDef | undefined {
  return SCENARIOS.archetype(scenario.archetype);
}

/** ARCH-1 (MA-6): a land by id, or undefined. */
export function archetypeById(id: string): ArchetypeDef | undefined {
  return SCENARIOS.archetype(id);
}

export function stageDef(scenario: ScenarioDef, stage: StageId): StageDef {
  const found = scenario.stages.find(candidate => candidate.id === stage);
  if (found === undefined) throw new ScenarioValidationError(`${scenario.id}: missing stage ${stage}`);
  return found;
}
