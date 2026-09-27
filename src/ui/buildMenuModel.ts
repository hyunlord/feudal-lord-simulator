import {
  BUILDING_CONFIG_BY_KIND,
  isRetiredBuildingKind,
  type BuildingKind,
} from "../content/buildingConfig";
import { RESOURCE_TYPES, type ResourceType } from "../content/resourceConfig";
import type { GameState } from "../engine/engine.types";
import type { PlacementTool } from "../render/renderer";
import { buildingUnlockStage, isBuildingUnlocked, placementSpendableResource } from "../world/placement";
import { SCENARIO_COPY } from "../content/scenario/scenarioCopy.ko";
import { resourceName } from "../content/resourceCatalog.ko";
import { BUILD_MENU_MODEL_COPY, BUILD_TOOL_GROUP_LABELS, buildToolPurpose } from "./buildMenuCopy.ko";
import { buildingEntry, CATALOG_BUILDING_KINDS, type BuildToolGroup as CatalogToolGroup } from "../content/buildingCatalog";
import { buildingCopy } from "../content/buildingCatalog.ko";

export type BuildToolOption = {
  readonly tool: PlacementTool;
  readonly label: string;
  readonly timberCost: number;
  readonly cost: Partial<Record<ResourceType, number>>;
  readonly group: BuildToolGroupKey;
  readonly purpose: string;
  readonly requirements: readonly string[];
};

type BuildingToolOption = BuildToolOption & {
  readonly tool: BuildingKind;
};

export type BuildToolGroupKey = CatalogToolGroup;

export type BuildToolGroup = {
  readonly key: BuildToolGroupKey;
  readonly label: string;
  readonly options: readonly BuildToolOption[];
};

const GROUP_LABELS: Record<BuildToolGroupKey, string> = BUILD_TOOL_GROUP_LABELS;

const GROUP_ORDER = ["dwelling", "production", "storage", "service"] as const satisfies readonly BuildToolGroupKey[];

// BLD-REG: a building's group and purpose are its catalog lines; the road is a service tool.
const toolGroup = (tool: PlacementTool): BuildToolGroupKey => tool === "road" ? "service" : buildingEntry(tool).group;

function requirementsFor(kind: BuildingKind, scenarioId?: string): readonly string[] {
  const definition = BUILDING_CONFIG_BY_KIND[kind];
  const requirements: string[] = [];
  if (definition.requiresRoad) requirements.push(BUILD_MENU_MODEL_COPY.requiresRoad);
  if (definition.requiresAdjacentTerrain === "forest") requirements.push(BUILD_MENU_MODEL_COPY.requiresForest);
  if (definition.requiresAdjacentTerrain === "rock") requirements.push(BUILD_MENU_MODEL_COPY.requiresRock);
  const stage = buildingUnlockStage(kind, scenarioId);
  if (stage !== "village") requirements.push(SCENARIO_COPY.unlockedAfter(SCENARIO_COPY.stages[stage]));
  return requirements.length === 0 ? [BUILD_MENU_MODEL_COPY.noRequirements] : requirements;
}

export const ROAD_TOOL_OPTION: BuildToolOption = {
  tool: "road",
  label: BUILD_MENU_MODEL_COPY.roadLabel,
  timberCost: 0,
  cost: {},
  group: "service",
  purpose: buildToolPurpose("road"),
  requirements: [BUILD_MENU_MODEL_COPY.noRequirements],
};

// AF-12: retired kinds (the wheat farm) have no build tool. BLD-REG: in the catalog's order, named by its words.
const BUILDING_TOOL_OPTIONS: readonly BuildingToolOption[] = CATALOG_BUILDING_KINDS.filter(kind => !isRetiredBuildingKind(kind)).map((kind) => ({
  tool: kind,
  label: buildingCopy(kind).name,
  timberCost: BUILDING_CONFIG_BY_KIND[kind].buildCost.timber ?? 0,
  cost: BUILDING_CONFIG_BY_KIND[kind].buildCost,
  group: toolGroup(kind),
  purpose: buildToolPurpose(kind),
  requirements: requirementsFor(kind),
}));

export const BUILD_TOOL_OPTIONS: readonly BuildToolOption[] = [
  ...BUILDING_TOOL_OPTIONS,
  ROAD_TOOL_OPTION,
];

export function buildMenuGroups(state: GameState, { includeEraLocked = false }: { readonly includeEraLocked?: boolean } = {}): readonly BuildToolGroup[] {
  const options = BUILDING_TOOL_OPTIONS
    .filter((option) => includeEraLocked || isBuildingUnlocked(option.tool, state.era, state.scenarioId))
    .map((option) => ({
      ...option,
      affordable: buildToolAffordability(option.tool, state).affordable,
    }));
  return GROUP_ORDER.map((key) => ({
    key,
    label: GROUP_LABELS[key],
    options: options.filter((option) => option.group === key),
  }));
}

export function buildToolAffordability(
  tool: PlacementTool,
  state: GameState,
): {
  readonly affordable: boolean;
  readonly shortfalls: Partial<Record<ResourceType, number>>;
  readonly spendable: Partial<Record<ResourceType, number>>;
  readonly shortfall: number;
  readonly spendableTimber: number;
} {
  const option = BUILD_TOOL_OPTIONS.find((candidate) => candidate.tool === tool);
  const cost = option?.cost ?? {};
  const spendable = positiveResourceAmounts((resource) =>
    cost[resource] === undefined ? 0 : placementSpendableResource(state, resource),
  );
  const shortfalls = positiveResourceAmounts((resource) =>
    Math.max(0, (cost[resource] ?? 0) - (spendable[resource] ?? 0)),
  );
  const spendableTimber = spendable.timber ?? placementSpendableResource(state, "timber");
  return {
    affordable: RESOURCE_TYPES.every((resource) => (shortfalls[resource] ?? 0) === 0),
    shortfalls,
    spendable,
    shortfall: shortfalls.timber ?? 0,
    spendableTimber,
  };
}

export function buildToolTooltipLines(tool: PlacementTool, state: GameState): readonly string[] {
  const option = BUILD_TOOL_OPTIONS.find((candidate) => candidate.tool === tool);
  if (option === undefined) return [];
  const affordability = buildToolAffordability(tool, state);
  const affordabilityLine = affordability.affordable
    ? BUILD_MENU_MODEL_COPY.buildable(resourceAmountsLabel(affordability.spendable))
    : BUILD_MENU_MODEL_COPY.notBuildable(shortfallLabel(affordability.shortfalls));
  const costLine = tool === "road" ? BUILD_MENU_MODEL_COPY.roadCost : BUILD_MENU_MODEL_COPY.cost(resourceAmountsLabel(option.cost));
  return [
    option.label,
    costLine,
    BUILD_MENU_MODEL_COPY.purpose(option.purpose),
    BUILD_MENU_MODEL_COPY.requirements(option.requirements.join(", ")),
    affordabilityLine,
  ];
}

function positiveResourceAmounts(
  valueForResource: (resource: ResourceType) => number,
): Partial<Record<ResourceType, number>> {
  const result: Partial<Record<ResourceType, number>> = {};
  for (const resource of RESOURCE_TYPES) {
    const value = valueForResource(resource);
    if (value > 0) result[resource] = value;
  }
  return result;
}

function resourceAmountsLabel(amounts: Partial<Record<ResourceType, number>>): string {
  const parts = RESOURCE_TYPES
    .filter((resource) => (amounts[resource] ?? 0) > 0)
    .map((resource) => BUILD_MENU_MODEL_COPY.resourceAmount(resourceName(resource), amounts[resource] ?? 0));
  return parts.length === 0 ? BUILD_MENU_MODEL_COPY.none : parts.join(" · ");
}

function shortfallLabel(amounts: Partial<Record<ResourceType, number>>): string {
  const resources = RESOURCE_TYPES.filter((resource) => (amounts[resource] ?? 0) > 0);
  if (resources.length === 1 && resources[0] === "timber") {
    return String(amounts.timber ?? 0);
  }
  return resourceAmountsLabel(amounts);
}

/**
 * UX-0 / UX-1 "해금 안내": a building the settlement stage has not opened yet is shown with a lock and the stage that
 * opens it (e.g. "시장도시 이후"), not hidden; null when it is open.
 */
export function eraLockReason(tool: PlacementTool, state: Pick<GameState, "era" | "scenarioId">): string | null {
  if (tool === "road" || isBuildingUnlocked(tool, state.era, state.scenarioId)) return null;
  return SCENARIO_COPY.unlockedAfter(SCENARIO_COPY.stages[buildingUnlockStage(tool, state.scenarioId)]);
}
