import type { GameState } from "../engine/engine.types";
import type { Tile } from "../world/world.types";
import { depthKey } from "./iso";
import { buildObjectRenderItems, type ObjectRenderItem } from "./objectRenderOrder";
import type { TileRange } from "./renderVisibility";
import { tileIsVisibleInRange } from "./renderVisibility";
import { walkerVisualAnchor } from "./walkerAnchor";

type ObjectRenderFrameInput = {
  readonly state: GameState;
  readonly visibleTiles: readonly Tile[];
  readonly range: TileRange;
  readonly includeGroundCover: boolean;
};

type StaticObjectRenderCacheEntry = {
  readonly buildings: GameState["buildings"];
  readonly visibleTiles: readonly Tile[];
  readonly cacheKey: string;
  readonly items: readonly ObjectRenderItem[];
};

const staticObjectRenderCache = new WeakMap<readonly Tile[], StaticObjectRenderCacheEntry>();

export const objectRenderItemsForFrame = (
  input: ObjectRenderFrameInput,
): readonly ObjectRenderItem[] => {
  const staticItems = staticObjectRenderItemsForFrame(input);
  const walkerItems = walkerRenderItemsForFrame(input.state.walkers, input.range);
  return walkerItems.length === 0 ? staticItems : mergeObjectRenderItems(staticItems, walkerItems);
};

const staticObjectRenderItemsForFrame = (
  input: ObjectRenderFrameInput,
): readonly ObjectRenderItem[] => {
  const cacheKey = objectRenderCacheKey(input);
  const cached = staticObjectRenderCache.get(input.state.tiles);
  if (
    cached?.buildings === input.state.buildings &&
    cached.visibleTiles === input.visibleTiles &&
    cached.cacheKey === cacheKey
  ) {
    return cached.items;
  }
  const items = buildObjectRenderItems({
    tiles: input.visibleTiles,
    worldTiles: input.state.tiles,
    buildings: input.state.buildings,
    walkers: [],
    range: input.range,
    seed: input.state.seed,
    includeGroundCover: input.includeGroundCover,
  });
  staticObjectRenderCache.set(input.state.tiles, {
    buildings: input.state.buildings,
    visibleTiles: input.visibleTiles,
    cacheKey,
    items,
  });
  return items;
};

const walkerRenderItemsForFrame = (
  walkers: GameState["walkers"],
  range: TileRange,
): readonly ObjectRenderItem[] => {
  const items: ObjectRenderItem[] = [];
  for (const walker of walkers) {
    if (!tileIsVisibleInRange(walker.position.tx, walker.position.ty, range)) continue;
    const anchor = walkerVisualAnchor(walker.position);
    insertSortedObjectRenderItem(items, {
      kind: "walker",
      id: walker.id,
      walker,
      depth: depthKey(anchor.tx, anchor.ty),
      anchorTx: anchor.tx,
    });
  }
  return items;
};

const insertSortedObjectRenderItem = (
  items: ObjectRenderItem[],
  item: ObjectRenderItem,
): void => {
  let index = items.length;
  while (index > 0) {
    const previous = items[index - 1];
    if (previous === undefined || compareObjectRenderItems(previous, item) <= 0) {
      break;
    }
    items[index] = previous;
    index -= 1;
  }
  items[index] = item;
};

const mergeObjectRenderItems = (
  left: readonly ObjectRenderItem[],
  right: readonly ObjectRenderItem[],
): readonly ObjectRenderItem[] => {
  const merged: ObjectRenderItem[] = [];
  let leftIndex = 0;
  let rightIndex = 0;
  while (leftIndex < left.length && rightIndex < right.length) {
    const leftItem = left[leftIndex];
    const rightItem = right[rightIndex];
    if (leftItem === undefined || rightItem === undefined) break;
    if (compareObjectRenderItems(leftItem, rightItem) <= 0) {
      merged.push(leftItem);
      leftIndex += 1;
    } else {
      merged.push(rightItem);
      rightIndex += 1;
    }
  }
  for (; leftIndex < left.length; leftIndex += 1) {
    const item = left[leftIndex];
    if (item !== undefined) merged.push(item);
  }
  for (; rightIndex < right.length; rightIndex += 1) {
    const item = right[rightIndex];
    if (item !== undefined) merged.push(item);
  }
  return merged;
};

const compareObjectRenderItems = (left: ObjectRenderItem, right: ObjectRenderItem): number => {
  const depthDifference = left.depth - right.depth;
  if (depthDifference !== 0) return depthDifference;
  const anchorDifference = left.anchorTx - right.anchorTx;
  return anchorDifference !== 0 ? anchorDifference : left.id.localeCompare(right.id);
};

const objectRenderCacheKey = (input: ObjectRenderFrameInput): string =>
  [
    input.state.width,
    input.state.height,
    input.state.seed,
    input.includeGroundCover ? 1 : 0,
    input.range.minTx,
    input.range.minTy,
    input.range.maxTx,
    input.range.maxTy,
    input.range.minDepth ?? "",
    input.range.maxDepth ?? "",
    input.range.minDiagonal ?? "",
    input.range.maxDiagonal ?? "",
  ].join(":");
