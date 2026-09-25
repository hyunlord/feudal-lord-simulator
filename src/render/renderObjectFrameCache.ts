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
import type { ZoneLayer } from "./zoneLayer";
import { groundBoundaryScene } from "./groundBoundaryScene";
import { boundaryV2Enabled } from "./renderBoundaryFlag";
import { farmProps } from "./farmProps";
import { hurdleAssetKey } from "./hurdleArt";

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
  const staticItems = withFarmProps(withYardHurdles(withZoneProps(staticObjectRenderItemsForFrame(input), input), input), input);
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

/**
 * Zone props (C1b) join the queue only while curved ground is on and a zone exists; their positions come from the
 * ground scene, which is cached on the same inputs as the zone outlines, so they never go stale against them.
 */
const zonePropItems = new WeakMap<object, readonly ObjectRenderItem[]>();
const withZoneProps = (queue: readonly RenderQueueItem[], input: ObjectRenderFrameInput): readonly RenderQueueItem[] => {
  if ((input.state.zones ?? []).length === 0 || !boundaryV2Enabled()) return queue;
  const layer = groundBoundaryScene(input.state).zones;
  const items = withoutCoverOnCrops(queue, layer);
  if (layer.props.length === 0) return items;
  let all = zonePropItems.get(layer);
  if (all === undefined) {
    all = layer.props.map(prop => ({ kind: "zone_prop" as const, id: prop.id, prop, depth: depthKey(Math.round(prop.x), Math.round(prop.y)), anchorTx: Math.round(prop.x) }))
      .sort(compareObjectRenderItems);
    zonePropItems.set(layer, all);
  }
  const visible = all.filter(item => item.kind === "zone_prop" && tileIsVisibleInRange(Math.round(item.prop.x), Math.round(item.prop.y), input.range));
  return visible.length === 0 ? items : mergeObjectRenderItems(items, visible);
};

/** Farm animals and ox teams (C1f), with the zone props: curved ground on and a zone painted. */
const withFarmProps = (queue: readonly RenderQueueItem[], input: ObjectRenderFrameInput): readonly RenderQueueItem[] => {
  if ((input.state.zones ?? []).length === 0 || !boundaryV2Enabled()) return queue;
  const visible = farmProps(input.state).filter(prop => tileIsVisibleInRange(Math.round(prop.x), Math.round(prop.y), input.range))
    .map(prop => ({ kind: "farm_prop" as const, id: prop.id, prop, depth: depthKey(Math.round(prop.x), Math.round(prop.y)), anchorTx: Math.round(prop.x) }))
    .sort(compareObjectRenderItems);
  return visible.length === 0 ? queue : mergeObjectRenderItems(queue, visible);
};

/**
 * Grass tufts, bushes and stones stay off the ridge strips of arable zones (C1e): the crop area is ploughed ground.
 * Cached on the static item list and the zone layer (both keep their identity until the ground or the zones change).
 */
const coverFilters = new WeakMap<object, WeakMap<object, readonly RenderQueueItem[]>>();
const withoutCoverOnCrops = (items: readonly RenderQueueItem[], layer: ZoneLayer): readonly RenderQueueItem[] => {
  if (layer.arableBands.length === 0) return items;
  let byLayer = coverFilters.get(items);
  if (byLayer === undefined) { byLayer = new WeakMap(); coverFilters.set(items, byLayer); }
  const cached = byLayer.get(layer);
  if (cached !== undefined) return cached;
  const crops = new Set<string>();
  for (const field of layer.fields) {
    if (field === null) continue;
    for (const band of field.bands) for (let along = band.from; along <= band.to; along += 1) {
      crops.add(field.axis === "x" ? `${along},${band.line}` : `${band.line},${along}`);
    }
  }
  const kept = items.filter(item => item.kind !== "groundCover" || !crops.has(`${Math.round(item.descriptor.anchorTx)},${Math.round(item.descriptor.anchorTy)}`));
  byLayer.set(layer, kept);
  return kept;
};

/**
 * Yard hurdles (C1e) join the queue while curved ground is on; like zone props they come from the ground scene, whose
 * key covers the buildings, roads and wall the yards are cut from. Each panel sorts by the middle of the edge it
 * covers, so a panel behind a house draws before it and one in front after it.
 */
const yardHurdleItems = new WeakMap<object, readonly ObjectRenderItem[]>();
const withYardHurdles = (items: readonly RenderQueueItem[], input: ObjectRenderFrameInput): readonly RenderQueueItem[] => {
  if (!boundaryV2Enabled()) return items;
  const props = groundBoundaryScene(input.state).yardProps;
  if (props.hurdles.length === 0) return items;
  let all = yardHurdleItems.get(props);
  if (all === undefined) {
    all = props.hurdles.map(piece => ({ kind: "zone_prop" as const, id: piece.id, depth: piece.depth, anchorTx: Math.round(piece.anchor.x),
      prop: { kind: hurdleAssetKey(piece), x: piece.anchor.x, y: piece.anchor.y,
        flip: piece.mirror, scale: 1, id: piece.id, depth: piece.depth } }))
      .sort(compareObjectRenderItems);
    yardHurdleItems.set(props, all);
  }
  const visible = all.filter(item => item.kind === "zone_prop" && tileIsVisibleInRange(Math.round(item.prop.x), Math.round(item.prop.y), input.range));
  return visible.length === 0 ? items : mergeObjectRenderItems(items, visible);
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
