import {
  BUILDING_CONFIG,
  BUILDING_CONFIG_BY_KIND,
  type BuildingKind,
} from "../content/buildingConfig";
import { RESOURCE_TYPES, type ResourceType } from "../content/resourceConfig";
import type { GameState } from "../engine/engine.types";
import type { PlacementTool } from "../render/renderer";
import { isBuildingUnlocked, placementSpendableResource } from "../world/placement";

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

export type BuildToolGroupKey = "dwelling" | "production" | "storage" | "service";

export type BuildToolGroup = {
  readonly key: BuildToolGroupKey;
  readonly label: string;
  readonly options: readonly BuildToolOption[];
};

const GROUP_LABELS: Record<BuildToolGroupKey, string> = {
  dwelling: "주거",
  production: "생산",
  storage: "저장",
  service: "서비스",
};

const GROUP_ORDER = ["dwelling", "production", "storage", "service"] as const satisfies readonly BuildToolGroupKey[];

const TOOL_GROUPS: Record<PlacementTool, BuildToolGroupKey> = {
  house: "dwelling",
  wheat_farm: "production",
  mill: "production",
  logging_camp: "production",
  sawmill: "production",
  quarry: "production",
  masonry: "production",
  market: "service",
  church: "service",
  keep: "service",
  storehouse: "storage",
  granary: "storage",
  chapel: "service",
  well: "service",
  road: "service",
};

const TOOL_PURPOSES: Record<PlacementTool, string> = {
  house: "주민을 받아 인구 목표를 늘립니다",
  wheat_farm: "밀을 길러 방앗간에 보냅니다",
  mill: "밀을 빵으로 바꿔 배급을 돕습니다",
  logging_camp: "숲 가장자리에서 통나무를 냅니다",
  sawmill: "통나무를 목재로 켭니다",
  quarry: "바위 가장자리에서 원석을 캐냅니다",
  masonry: "원석을 석재로 다듬습니다",
  market: "잉여 물자를 팔아 금화를 모읍니다",
  church: "주변 집에 신앙 서비스를 제공합니다",
  keep: "석조 도시의 중심 성채를 세웁니다",
  storehouse: "목재와 통나무를 보관합니다",
  granary: "밀과 빵을 보관합니다",
  chapel: "목책마을 선포 조건을 준비합니다",
  well: "주변 집에 물을 공급합니다",
  road: "일꾼과 짐꾼이 이동할 길을 잇습니다",
};

function requirementsFor(kind: BuildingKind): readonly string[] {
  const definition = BUILDING_CONFIG_BY_KIND[kind];
  const requirements: string[] = [];
  if (definition.requiresRoad) requirements.push("길 인접 필요");
  if (definition.requiresAdjacentTerrain === "forest") requirements.push("숲 인접 필요");
  if (definition.requiresAdjacentTerrain === "rock") requirements.push("바위 인접 필요");
  if (definition.unlockEra === "palisade") requirements.push("목책마을 이후");
  if (definition.unlockEra === "stone_town") requirements.push("석조 도시 이후");
  return requirements.length === 0 ? ["요구 조건 없음"] : requirements;
}

export const ROAD_TOOL_OPTION: BuildToolOption = {
  tool: "road",
  label: "길",
  timberCost: 0,
  cost: {},
  group: "service",
  purpose: TOOL_PURPOSES.road,
  requirements: ["요구 조건 없음"],
};

const BUILDING_TOOL_OPTIONS: readonly BuildingToolOption[] = BUILDING_CONFIG.map((definition) => ({
  tool: definition.kind,
  label: definition.name,
  timberCost: definition.buildCost.timber ?? 0,
  cost: definition.buildCost,
  group: TOOL_GROUPS[definition.kind],
  purpose: TOOL_PURPOSES[definition.kind],
  requirements: requirementsFor(definition.kind),
}));

export const BUILD_TOOL_OPTIONS: readonly BuildToolOption[] = [
  ...BUILDING_TOOL_OPTIONS,
  ROAD_TOOL_OPTION,
];

export function buildMenuGroups(state: GameState): readonly BuildToolGroup[] {
  const options = BUILDING_TOOL_OPTIONS
    .filter((option) => isBuildingUnlocked(option.tool, state.era))
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
    ? `건설 가능 · 보유 ${resourceAmountsLabel(affordability.spendable)}`
    : `건설 불가 · 부족 ${shortfallLabel(affordability.shortfalls)}`;
  const costLine = tool === "road" ? "비용 목재 0" : `비용 ${resourceAmountsLabel(option.cost)}`;
  return [
    option.label,
    costLine,
    `목적 ${option.purpose}`,
    `조건 ${option.requirements.join(", ")}`,
    affordabilityLine,
  ];
}

const RESOURCE_LABELS = {
  wheat: "밀",
  bread: "빵",
  logs: "통나무",
  timber: "목재",
  stone_raw: "원석",
  stone: "석재",
  coin: "금화",
} as const satisfies Record<ResourceType, string>;

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
    .map((resource) => `${RESOURCE_LABELS[resource]} ${amounts[resource] ?? 0}`);
  return parts.length === 0 ? "없음" : parts.join(" · ");
}

function shortfallLabel(amounts: Partial<Record<ResourceType, number>>): string {
  const resources = RESOURCE_TYPES.filter((resource) => (amounts[resource] ?? 0) > 0);
  if (resources.length === 1 && resources[0] === "timber") {
    return String(amounts.timber ?? 0);
  }
  return resourceAmountsLabel(amounts);
}
