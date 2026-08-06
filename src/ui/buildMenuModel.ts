import {
  BUILDING_CONFIG,
  BUILDING_CONFIG_BY_KIND,
  type BuildingKind,
} from "../content/buildingConfig";
import type { GameState } from "../engine/engine.types";
import type { PlacementTool } from "../render/renderer";
import { placementSpendableResource } from "../world/placement";

export type BuildToolOption = {
  readonly tool: PlacementTool;
  readonly label: string;
  readonly timberCost: number;
  readonly group: BuildToolGroupKey;
  readonly purpose: string;
  readonly requirements: readonly string[];
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
  storehouse: "storage",
  granary: "storage",
  well: "service",
  road: "service",
};

const TOOL_PURPOSES: Record<PlacementTool, string> = {
  house: "주민을 받아 인구 목표를 늘립니다",
  wheat_farm: "밀을 길러 방앗간에 보냅니다",
  mill: "밀을 빵으로 바꿔 배급을 돕습니다",
  logging_camp: "숲 가장자리에서 통나무를 냅니다",
  sawmill: "통나무를 목재로 켭니다",
  storehouse: "목재와 통나무를 보관합니다",
  granary: "밀과 빵을 보관합니다",
  well: "주변 집에 물을 공급합니다",
  road: "일꾼과 짐꾼이 이동할 길을 잇습니다",
};

function requirementsFor(kind: BuildingKind): readonly string[] {
  const definition = BUILDING_CONFIG_BY_KIND[kind];
  const requirements: string[] = [];
  if (definition.requiresRoad) requirements.push("길 인접 필요");
  if (definition.requiresAdjacentTerrain === "forest") requirements.push("숲 인접 필요");
  return requirements.length === 0 ? ["요구 조건 없음"] : requirements;
}

export const ROAD_TOOL_OPTION: BuildToolOption = {
  tool: "road",
  label: "길",
  timberCost: 0,
  group: "service",
  purpose: TOOL_PURPOSES.road,
  requirements: ["요구 조건 없음"],
};

const BUILDING_TOOL_OPTIONS: readonly BuildToolOption[] = BUILDING_CONFIG.map((definition) => ({
  tool: definition.kind,
  label: definition.name,
  timberCost: definition.buildCost.timber ?? 0,
  group: TOOL_GROUPS[definition.kind],
  purpose: TOOL_PURPOSES[definition.kind],
  requirements: requirementsFor(definition.kind),
}));

export const BUILD_TOOL_OPTIONS: readonly BuildToolOption[] = [
  ...BUILDING_TOOL_OPTIONS,
  ROAD_TOOL_OPTION,
];

export function buildMenuGroups(state: GameState): readonly BuildToolGroup[] {
  const options = BUILDING_TOOL_OPTIONS.map((option) => ({
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
): { readonly affordable: boolean; readonly shortfall: number; readonly spendableTimber: number } {
  const option = BUILD_TOOL_OPTIONS.find((candidate) => candidate.tool === tool);
  const timberCost = option?.timberCost ?? 0;
  const spendableTimber = placementSpendableResource(state, "timber");
  return {
    affordable: spendableTimber >= timberCost,
    shortfall: Math.max(0, timberCost - spendableTimber),
    spendableTimber,
  };
}

export function buildToolTooltipLines(tool: PlacementTool, state: GameState): readonly string[] {
  const option = BUILD_TOOL_OPTIONS.find((candidate) => candidate.tool === tool);
  if (option === undefined) return [];
  const affordability = buildToolAffordability(tool, state);
  const affordabilityLine = affordability.affordable
    ? `건설 가능 · 보유 목재 ${affordability.spendableTimber}`
    : `건설 불가 · 부족 ${affordability.shortfall}`;
  return [
    option.label,
    `비용 목재 ${option.timberCost}`,
    `목적 ${option.purpose}`,
    `조건 ${option.requirements.join(", ")}`,
    affordabilityLine,
  ];
}
