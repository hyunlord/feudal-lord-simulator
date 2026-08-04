import { BUILDING_CONFIG } from "../content/buildingConfig";
import type { PlacementTool } from "../render/renderer";

export type BuildToolOption = {
  readonly tool: PlacementTool;
  readonly label: string;
  readonly timberCost: number;
};

export const BUILD_TOOL_OPTIONS: readonly BuildToolOption[] = [
  ...BUILDING_CONFIG.map((definition) => ({
    tool: definition.kind,
    label: definition.name,
    timberCost: definition.buildCost.timber ?? 0,
  })),
  { tool: "road", label: "Road", timberCost: 0 },
];
