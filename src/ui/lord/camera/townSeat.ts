import type { GameState } from "../../../engine/engine.types";
import { townCentre } from "../../../engine/townAgency";
import { buildingFootprint } from "../../../geometry/buildingFootprint";
import type { TileCoordinate } from "../../../world/grid";

// DEC-CARD A2: the town's seat — where "내 도시로" and a first look at a lord's game go. The manor house (the lord's
// seat, where his court sits), else the keep (as [위치로] on the lord's cards looks: lordStoryBeats `seatTile`), at the
// middle of its footprint (MANOR-1: the manor is 3 × 3 now, and its tile is the top-left one); with neither, the
// town's centre as the town agency reads it (its first market, else the middle of its houses).

export function townSeatTile(state: GameState): TileCoordinate | null {
  const seat = state.buildings.find(building => building.kind === "manor_house") ?? state.buildings.find(building => building.kind === "keep");
  if (seat === undefined) return townCentre(state);
  const size = buildingFootprint(seat);
  return { tx: seat.tx + Math.floor((size.width - 1) / 2), ty: seat.ty + Math.floor((size.height - 1) / 2) };
}
