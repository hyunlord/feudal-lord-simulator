import type { Walker } from "../agents/walker.types";
import type { GameState } from "../engine/engine.types";
import type { Tile } from "../world/world.types";
import { depthKey } from "./iso";
import {
  buildObjectRenderItems,
  forestHarvestAgeSignature,
  type ObjectRenderItem,
  type RenderQueueItem,
} from "./objectRenderOrder";
import type { TileRange } from "./renderVisibility";
import { tileIsVisibleInRange } from "./renderVisibility";
import { walkerVisualAnchor } from "./walkerAnchor";

type ObjectRenderFrameInput = {
  readonly state: GameState;
  readonly visibleTiles: readonly Tile[];
  readonly range: TileRange;
  readonly includeGroundCover: boolean;
  readonly renderWalkers?: readonly Walker[] | undefined;
};

type StaticObjectRenderCacheEntry = {
  readonly buildings: GameState["buildings"];
  readonly constructionSites: GameState["constructionSites"];
  readonly palisade: GameState["palisade"];
  readonly forestHarvests: GameState["forestHarvests"];
  readonly visibleTiles: readonly Tile[];
  readonly cacheKey: string;
  readonly items: readonly RenderQueueItem[];
};

const staticObjectRenderCache = new WeakMap<readonly Tile[], StaticObjectRenderCacheEntry>();

export const objectRenderItemsForFrame = (
  input: ObjectRenderFrameInput,
): readonly RenderQueueItem[] => {
  const staticItems = staticObjectRenderItemsForFrame(input);
  const walkerItems = walkerRenderItemsForFrame(input.renderWalkers ?? input.state.walkers, input.range);
  return walkerItems.length === 0 ? staticItems : mergeObjectRenderItems(staticItems, walkerItems);
};

const staticObjectRenderItemsForFrame = (
  input: ObjectRenderFrameInput,
): readonly RenderQueueItem[] => {
  const cacheKey = objectRenderCacheKey(input);
  const cached = staticObjectRenderCache.get(input.state.tiles);
  if (
    cached?.buildings === input.state.buildings &&
    cached.constructionSites === input.state.constructionSites &&
    cached.palisade === input.state.palisade &&
    cached.forestHarvests === input.state.forestHarvests &&
    cached.visibleTiles === input.visibleTiles &&
    cached.cacheKey === cacheKey
  ) {
    return cached.items;
  }
  const items = buildObjectRenderItems({
    tiles: input.visibleTiles,
    worldTiles: input.state.tiles,
    buildings: input.state.buildings,
    palisade: input.state.palisade,
    constructionSites: input.state.constructionSites,
    walkers: [],
    range: input.range,
    seed: input.state.seed,
    tick: input.state.tick,
    forestHarvests: input.state.forestHarvests,
    includeGroundCover: input.includeGroundCover,
  });
  staticObjectRenderCache.set(input.state.tiles, {
    buildings: input.state.buildings,
    constructionSites: input.state.constructionSites,
    palisade: input.state.palisade,
    forestHarvests: input.state.forestHarvests,
    visibleTiles: input.visibleTiles,
    cacheKey,
    items,
  });
  return items;
};

const walkerRenderItemsForFrame = (
  walkers: readonly Walker[],
  range: TileRange,
): readonly ObjectRenderItem[] => {
  const items: ObjectRenderItem[] = [];
  for (const walker of walkers) {
    if (!tileIsVisibleInRange(walker.position.tx, walker.position.ty, range)) continue;
    const anchor = walkerVisualAnchor(walker.position);
    items.push({
      kind: "walker",
      id: walker.id,
      walker,
      depth: depthKey(anchor.tx, anchor.ty),
      anchorTx: anchor.tx,
    });
  }
  return items;
};

const mergeObjectRenderItems = (
  left: readonly RenderQueueItem[],
  right: readonly ObjectRenderItem[],
): readonly RenderQueueItem[] => {
  const merged: RenderQueueItem[] = [];
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

const compareObjectRenderItems = (left: RenderQueueItem, right: RenderQueueItem): number => {
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
    forestHarvestAgeSignature(input.state.forestHarvests, input.state.tick),
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
