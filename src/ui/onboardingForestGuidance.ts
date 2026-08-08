import type { BuildingKind } from "../content/buildingConfig";
import type { GameState } from "../engine/engine.types";
import type { TileCoordinate } from "../world/grid";
import { canPlaceBuilding } from "../world/placement";
import { reservedOverlaps } from "./onboardingGuidanceGeometry";

type ForestGuidanceWorld = Pick<
  GameState,
  "buildings" | "height" | "houses" | "tiles" | "treasuryTimber" | "width"
> & Partial<Pick<GameState, "era">>;

export function buildableForestAdjacentOrigins(
  state: ForestGuidanceWorld,
  kind: Extract<BuildingKind, "logging_camp">,
  reserved: ReadonlySet<string>,
  candidateOrigins: readonly TileCoordinate[],
): readonly TileCoordinate[] {
  return candidateOrigins.filter((origin) =>
    !reservedOverlaps(kind, origin, reserved) &&
    canPlaceBuilding(state, kind, origin.tx, origin.ty).ok,
  );
}
