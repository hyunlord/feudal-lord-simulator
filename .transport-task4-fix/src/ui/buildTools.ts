import { BUILDING_CONFIG_BY_KIND, type BuildingKind } from "../content/buildingConfig";

export type PlacementTool = BuildingKind | "road";

export interface BuildToolOption {
  readonly id: PlacementTool;
  readonly label: string;
}

const BUILDING_TOOL_ORDER: readonly BuildingKind[] = [
  "house",
  "well",
  "storehouse",
  "granary",
  "wheat_farm",
  "mill",
  "logging_camp",
  "sawmill",
];

function titleCase(label: string): string {
  return label
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export const BUILD_TOOL_OPTIONS: readonly BuildToolOption[] = [
  ...BUILDING_TOOL_ORDER.map((kind) => ({
    id: kind,
    label: titleCase(BUILDING_CONFIG_BY_KIND[kind].name),
  })),
  {
    id: "road",
    label: "Road",
  },
];
