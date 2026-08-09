import { BUILDING_CONFIG_BY_KIND, type Building } from "../content/buildingConfig";
import type { GameState } from "../engine/engine.types";
import { depthKey } from "./iso";
import { visibleTilesInDrawOrder, type TileRange } from "./visibleTiles";

export type { TileRange } from "./visibleTiles";

type RenderKind = "building" | "tree";

export interface ObjectRenderItem {
  readonly id: string;
  readonly kind: RenderKind;
  readonly tx: number;
  readonly ty: number;
}

function overlapsRange(
  tx: number,
  ty: number,
  width: number,
  height: number,
  range: TileRange,
): boolean {
  return !(
    tx + width - 1 < range.minTx ||
    ty + height - 1 < range.minTy ||
    tx > range.maxTx ||
    ty > range.maxTy
  );
}

function buildingItem(building: Building): ObjectRenderItem {
  return {
    id: building.id,
    kind: "building",
    tx: building.tx,
    ty: building.ty,
  };
}

function treeItem(tx: number, ty: number): ObjectRenderItem {
  return {
    id: `tree-${tx}-${ty}`,
    kind: "tree",
    tx,
    ty,
  };
}

function renderKindRank(kind: RenderKind): number {
  return kind === "building" ? 0 : 1;
}

export function objectRenderItems(
  state: GameState,
  range: TileRange,
): readonly ObjectRenderItem[] {
  const items: ObjectRenderItem[] = [];

  for (const building of state.buildings) {
    const definition = BUILDING_CONFIG_BY_KIND[building.kind];
    if (overlapsRange(building.tx, building.ty, definition.width, definition.height, range)) {
      items.push(buildingItem(building));
    }
  }

  for (const tile of visibleTilesInDrawOrder(state, range)) {
    if (tile.terrain === "forest" && tile.buildingId === null && tile.hasRoad === false) {
      items.push(treeItem(tile.tx, tile.ty));
    }
  }

  return items.sort((left, right) => {
    const depthDiff = depthKey(left.tx, left.ty) - depthKey(right.tx, right.ty);
    if (depthDiff !== 0) return depthDiff;
    const kindDiff = renderKindRank(left.kind) - renderKindRank(right.kind);
    if (kindDiff !== 0) return kindDiff;
    const txDiff = left.tx - right.tx;
    if (txDiff !== 0) return txDiff;
    const tyDiff = left.ty - right.ty;
    if (tyDiff !== 0) return tyDiff;
    return left.id.localeCompare(right.id);
  });
}
