import type { Building } from "../content/buildingConfig";
import { buildingFootprint } from "../geometry/buildingFootprint";
import { buildingSpriteOverlapsCursorTile } from "./occlusionModel";

type Input = Parameters<typeof buildingSpriteOverlapsCursorTile>[0] & {
  readonly selectionMode: boolean;
};

/**
 * Whether hovering may outline the building in front of the cursor tile (UX1). With nothing armed and nothing
 * selected, a bare hover reading as "the house vanished" looked like a demolition, so the reveal runs only while a
 * placement tool is armed (aiming at ground behind a building) or a building is selected.
 */
export function hoverOcclusionActive(input: {
  readonly toolArmed: boolean;
  readonly selectedBuildingId: string | null;
}): boolean {
  return input.toolArmed || input.selectedBuildingId !== null;
}

/** Reveal the hovered ground tile without changing the global render mode. */
export function outlinesOccludingBuilding(input: Input): boolean {
  if (!input.selectionMode || input.building.kind === "wheat_farm") return false;
  const { building, hoveredTile } = input;
  const footprint = buildingFootprint(building);
  if (containsTile(building, hoveredTile)) return false;
  const frontDepth = building.tx + footprint.width - 1 + building.ty + footprint.height - 1;
  if (frontDepth <= hoveredTile.tx + hoveredTile.ty) return false;
  return buildingSpriteOverlapsCursorTile(input);
}

function containsTile(building: Building, tile: Input["hoveredTile"]): boolean {
  const size = buildingFootprint(building);
  return tile.tx >= building.tx && tile.tx < building.tx + size.width
    && tile.ty >= building.ty && tile.ty < building.ty + size.height;
}
