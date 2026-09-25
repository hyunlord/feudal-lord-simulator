import type { GameState } from "../engine/engine.types";
import { buildMenuGroups } from "../ui/buildMenuModel";
import type { PlacementTool } from "./renderer";

/**
 * `toolStep` (Q / E, controller LB / RB): the next or previous placement tool in build-menu order (road first, then
 * the unlocked buildings), wrapping around; from no tool, E arms the first and Q the last.
 */
export function steppedPlacementTool(state: GameState, current: PlacementTool | null, step: -1 | 1): PlacementTool {
  const tools: PlacementTool[] = ["road", ...buildMenuGroups(state).flatMap(group => group.options.map(option => option.tool))];
  const index = current === null ? -1 : tools.indexOf(current);
  if (index < 0) return (step === 1 ? tools[0] : tools[tools.length - 1]) as PlacementTool;
  return tools[(index + step + tools.length) % tools.length] as PlacementTool;
}
