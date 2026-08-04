import { BUILDING_CONFIG_BY_KIND, type Building } from "../content/buildingConfig";
import type { Tile } from "../world/world.types";
import { depthKey } from "./iso";
import type { TileRange } from "./renderer";

export type ObjectRenderItem =
  | {
      readonly kind: "tree";
      readonly id: string;
      readonly tile: Tile;
      readonly depth: number;
    }
  | {
      readonly kind: "building";
      readonly id: string;
      readonly building: Building;
      readonly depth: number;
    };

type ObjectRenderInput = {
  readonly tiles: readonly Tile[];
  readonly buildings: readonly Building[];
  readonly range: TileRange;
};

export function buildObjectRenderItems(input: ObjectRenderInput): readonly ObjectRenderItem[] {
  const items: ObjectRenderItem[] = [];

  for (const tile of input.tiles) {
    if (
      tileIsWithinRange(tile, input.range) &&
      tile.terrain === "forest" &&
      tile.buildingId === null &&
      !tile.hasRoad
    ) {
      items.push({
        kind: "tree",
        id: `tree:${tile.tx}:${tile.ty}`,
        tile,
        depth: depthKey(tile.tx, tile.ty),
      });
    }
  }

  for (const building of input.buildings) {
    const config = BUILDING_CONFIG_BY_KIND[building.kind];
    if (!footprintOverlapsRange(building.tx, building.ty, config.width, config.height, input.range)) {
      continue;
    }
    items.push({
      kind: "building",
      id: building.id,
      building,
      depth: depthKey(building.tx + config.width - 1, building.ty + config.height - 1),
    });
  }

  return items.sort(compareRenderItems);
}

function compareRenderItems(left: ObjectRenderItem, right: ObjectRenderItem): number {
  const depthDifference = left.depth - right.depth;
  if (depthDifference !== 0) return depthDifference;

  const kindDifference = left.kind.localeCompare(right.kind);
  return kindDifference !== 0 ? kindDifference : left.id.localeCompare(right.id);
}

function tileIsWithinRange(tile: Tile, range: TileRange): boolean {
  return (
    tile.tx >= range.minTx &&
    tile.tx <= range.maxTx &&
    tile.ty >= range.minTy &&
    tile.ty <= range.maxTy
  );
}

function footprintOverlapsRange(
  tx: number,
  ty: number,
  width: number,
  height: number,
  range: TileRange,
): boolean {
  return (
    tx <= range.maxTx &&
    tx + width - 1 >= range.minTx &&
    ty <= range.maxTy &&
    ty + height - 1 >= range.minTy
  );
}
