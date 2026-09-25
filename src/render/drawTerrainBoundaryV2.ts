import type { GameState } from "../engine/engine.types";
import type { Tile } from "../world/world.types";
import { boundaryAssetReadiness, boundaryAssetStatuses, preloadBoundaryAssets } from "./boundaryAssets";
import { drawBridgeDeck } from "./drawBridges";
import { drawFieldClusters, drawForestFill, drawForestFringeDecals } from "./drawGroundBoundaries";
import { drawRoadRibbons } from "./drawRoadRibbons";
import { drawZoneFills, drawZoneLines } from "./drawZones";
import { clipOutYards, drawAprons, drawYards } from "./drawBuildingGrounds";
import { preloadZoneAssets, zoneAssetReadiness } from "./zoneAssets";
import { arableStripStateLookup, drawArableFields, stripStateKey } from "./drawArableFields";
import { drawCroftBeds } from "./drawYardProps";
import { ZONE_VARIANTS } from "./zoneAssetManifest";
import { drawGroundDecalDetail } from "./drawTerrainDetails";
import { drawTerrainTransitions } from "./drawTerrainSeams";
import { waterSurface } from "./drawWater";
import { drawBridgeAbutments, drawShoreline } from "./drawShoreline";
import { preloadShoreAssets, shoreAssetReadiness } from "./terrainVariantAssets";
import { farmSoilReadiness, preloadFarmAssets } from "./farmAssets";
import { createGroundChunkCache, groundChunkZoomBucket, type ChunkRasterRequest, type GroundChunkCache } from "./groundChunkCache";
import { GROUND_CHUNK_TILES, chunkTileBounds, groundBoundaryScene, groundSceneFrameStart, groundBoundarySceneStats, setGroundSceneReverseInput, type GroundBoundaryScene, type GroundChunkPlan } from "./groundBoundaryScene";
import { boundaryV2Enabled } from "./renderBoundaryFlag";
import { tileToScreen } from "./iso";
import { renderStageProbe } from "./renderStageProbe";
import type { TileRange } from "./renderVisibility";
import { TERRAIN_TEXTURE_KEYS, type TerrainPatternAssets } from "./terrainPatterns";
import { drawTownLandscape } from "./townLandscapeAssets";
import { getSprite } from "./worldAssets";

// RENDER_BOUNDARY_V2 ground pass. Order: water (live) -> ground chunks (diamonds, seams, forest outline + fringe,
// zone fills, building yards, field clusters, zone lines, building aprons) -> town landscape (live) -> road-ribbon
// chunks -> bridge decks (live) -> tree and stump grounding shadows (live). Shadows stay live: they follow tree
// harvests and art loading, which the chunk key deliberately leaves out (they cost ~1 ms on the B11 baseline).
// C1d: yards and aprons replace the live building frontage pads and paths, and a building's contact shadow moved to
// the object pass (drawn just before the building, directly under its body), so demolishing it removes it at once.
// C1e: arable zones draw soil + ridge strips + furrow stamps right after the zone fills; croft beds sit on the house
// yards; hurdles are object-pass props.
// D3a: water moved into the ground chunks. Water cells are laid as grass, then the curved water body (the old water
// surface), a shallow band, shallow stones / weed and the shore strips are drawn from the shoreline loops right after
// the forest; bridge abutments follow the live bridge decks. The old per-tile shore seams are off in V2.

export type TerrainV2Input = {
  readonly state: GameState;
  readonly tiles: readonly Tile[];
  readonly range: TileRange;
  readonly zoom: number;
  readonly terrainPatterns?: TerrainPatternAssets;
};

export type TerrainV2Parts = {
  readonly drawGroundDiamond: (context: CanvasRenderingContext2D, tile: Tile, seed: number, patterns: TerrainPatternAssets | undefined) => void;
  readonly drawGrounding: (context: CanvasRenderingContext2D) => void;
};

const caches = new WeakMap<CanvasRenderingContext2D, GroundChunkCache>();
let cacheFactoryForTest: ((context: CanvasRenderingContext2D) => GroundChunkCache) | null = null;

export function groundChunkCacheFor(context: CanvasRenderingContext2D): GroundChunkCache {
  let cache = caches.get(context);
  if (cache === undefined) {
    cache = cacheFactoryForTest?.(context) ?? createGroundChunkCache();
    caches.set(context, cache);
  }
  return cache;
}

/** Proof port: flag state, chunk cache counters, scene rebuilds and boundary art status. */
export function groundBoundaryDiagnostics(context: CanvasRenderingContext2D) {
  return {
    enabled: boundaryV2Enabled(),
    chunks: caches.get(context)?.stats() ?? null,
    scene: groundBoundarySceneStats(),
    assets: boundaryAssetStatuses(),
  };
}

/** Proof port (gate 2): rebuild the scene from tiles in reverse order and drop every chunk raster. */
export function resetGroundBoundaryForProof(context: CanvasRenderingContext2D, reverseInput: boolean): void {
  setGroundSceneReverseInput(reverseInput);
  caches.get(context)?.clear();
}

export function setGroundChunkCacheFactoryForTest(factory: ((context: CanvasRenderingContext2D) => GroundChunkCache) | null): void {
  cacheFactoryForTest = factory;
}

export function drawTerrainBoundaryV2(context: CanvasRenderingContext2D, input: TerrainV2Input, parts: TerrainV2Parts): void {
  const probe = renderStageProbe.current;
  probe?.enter("terrain.water");
  const waterReady = waterSurface() !== null;
  probe?.enter("terrain.fill");
  void preloadBoundaryAssets();
  void preloadFarmAssets();
  const scene = groundBoundaryScene(input.state);
  if (scene.shore.loops.length > 0) void preloadShoreAssets();
  if (scene.zones.zones.length > 0 || scene.yardProps.beds.length + scene.yardProps.hurdles.length > 0) void preloadZoneAssets();
  const cache = groundChunkCacheFor(context);
  cache.beginFrame(groundSceneFrameStart());
  const transform = typeof context.getTransform === "function" ? context.getTransform() : null;
  const dpr = transform === null || input.zoom <= 0 ? 1 : Math.hypot(transform.a, transform.b) / input.zoom;
  const zoom = groundChunkZoomBucket(input.zoom);
  const scale = zoom * dpr;
  const readiness = `${boundaryAssetReadiness()}:${TERRAIN_TEXTURE_KEYS.map(key => getSprite(key) === null ? 0 : 1).join("")}`
    + `:${farmSoilReadiness()}:${waterReady ? 1 : 0}`;
  // Zone art readiness only in chunks that draw zones (a zone-free chunk keeps its D1a key), and never in the road
  // chunks, which draw no zone art (C1d: the first painted zone no longer re-rasters every other chunk).
  const zoneReadiness = scene.zones.zones.length > 0 ? `:z${zoneAssetReadiness()}` : "";
  // Croft bed art only in chunks with beds; crop states only in chunks with arable strips (read this frame).
  const bedReadiness = scene.yardProps.beds.length > 0 ? `:b${zoneAssetReadiness(ZONE_VARIANTS.croftBed)}` : "";
  // Shore art only in chunks that draw water.
  const shoreReadiness = scene.shore.loops.length > 0 ? `:w${shoreAssetReadiness()}` : "";
  const cropStates = scene.zones.arableBands.length > 0 ? arableStripStateLookup(input.state) : null;
  const groundReadiness = (plan: GroundChunkPlan): string => (plan.zoneIndexes.length > 0 ? readiness + zoneReadiness : readiness)
    + (plan.beds.length > 0 ? bedReadiness : "") + (plan.waterLoops.length > 0 || plan.waterParity ? shoreReadiness : "") + (plan.arableBands.length > 0 && cropStates !== null ? `:a${stripStateKey(scene.zones, plan.arableBands, cropStates)}` : "");
  const visible = visibleChunks(scene, input.range);
  const groundRequest = (plan: GroundChunkPlan): ChunkRasterRequest => ({
    id: `ground:${plan.cx},${plan.cy}`, contentKey: `${plan.groundKey}|${groundReadiness(plan)}|${zoom.toFixed(2)}`, scale, diamond: chunkDiamond(plan),
    // Same ground base = the chunk only changed its zones: its old raster may stand in until the frame budget allows.
    deferKey: `${plan.groundBaseKey}|${readiness}|${zoom.toFixed(2)}`,
  });
  const roadRequest = (plan: GroundChunkPlan): ChunkRasterRequest => ({
    id: `roads:${plan.cx},${plan.cy}`, contentKey: `${plan.roadKey}|${readiness}|${zoom.toFixed(2)}`, scale, diamond: chunkDiamond(plan),
  });
  for (const plan of visible) {
    cache.draw(context, groundRequest(plan), paint => drawGroundChunk(paint, input, scene, plan, zoom, parts));
  }
  schedulePrefetch(context, cache, ringChunks(scene, input.range, visible).flatMap(plan => [
    { request: groundRequest(plan), paint: (paint: CanvasRenderingContext2D) => drawGroundChunk(paint, input, scene, plan, zoom, parts) },
    ...(plan.hasRoads ? [{ request: roadRequest(plan), paint: (paint: CanvasRenderingContext2D) => drawRoadRibbons(paint, scene.roads, scene.ribbons, plan) }] : []),
  ]));
  probe?.enter("terrain.landscape");
  drawTownLandscape(context, input.state, input.tiles);
  probe?.enter("roads.ground");
  for (const plan of visible) {
    if (plan.hasRoads) cache.draw(context, roadRequest(plan), paint => drawRoadRibbons(paint, scene.roads, scene.ribbons, plan));
  }
  for (const tile of input.tiles) if (tile.hasRoad && tile.terrain === "water") drawBridgeDeck(context, input.state, tile);
  if (scene.shore.bridgeEnds.length > 0) drawBridgeAbutments(context, scene.shore);
  probe?.enter("terrain.grounding");
  parts.drawGrounding(context);
}

function drawGroundChunk(
  context: CanvasRenderingContext2D,
  input: TerrainV2Input,
  scene: GroundBoundaryScene,
  plan: GroundChunkPlan,
  zoom: number,
  parts: TerrainV2Parts,
): void {
  const tiles = chunkTiles(input.state, plan, 1);
  for (const tile of tiles) {
    // Forest and water tiles are laid as grass; the smoothed forest outline and shoreline below paint over them.
    parts.drawGroundDiamond(context, tile.terrain === "forest" || tile.terrain === "water" ? { ...tile, terrain: "grass" } : tile, input.state.seed, input.terrainPatterns);
  }
  for (const tile of tiles) {
    if (tile.terrain === "water") continue;
    if (zoom > 0.7) drawGroundDecalDetail(context, tile, input.state.seed);
    drawTerrainTransitions(context, input.state, tile, zoom, input.terrainPatterns, false, false);
  }
  const bounds = chunkTileBounds(plan.cx, plan.cy);
  const diamond = chunkDiamond(plan);
  drawForestFill(context, scene.forest, plan.forestLoops, plan.forestParity, {
    left: diamond[3].x - 4, top: diamond[0].y - 4, right: diamond[1].x + 4, bottom: diamond[2].y + 4,
  }, { tx: bounds.left + 0.5, ty: bounds.top + 0.5 }, input.state.seed, input.terrainPatterns);
  drawForestFringeDecals(context, scene.forest, plan.forestLoops);
  drawShoreline(context, scene.shore, plan.waterLoops, plan.waterParity, {
    left: diamond[3].x - 4, top: diamond[0].y - 4, right: diamond[1].x + 4, bottom: diamond[2].y + 4,
  }, bounds, input.state.seed);
  if (plan.zoneIndexes.length > 0) {
    // A plot's tone stops at a yard: the yard is its own trodden ground.
    context.save();
    if (plan.yards.length > 0) clipOutYards(context, scene.grounds, plan.yards, [
      { x: bounds.left - 4, y: bounds.top - 4 }, { x: bounds.right + 4, y: bounds.top - 4 },
      { x: bounds.right + 4, y: bounds.bottom + 4 }, { x: bounds.left - 4, y: bounds.bottom + 4 }]);
    drawZoneFills(context, scene.zones, plan.zoneIndexes);
    context.restore();
    if (plan.arableBands.length > 0) drawArableFields(context, scene.zones, plan.zoneIndexes, arableStripStateLookup(input.state));
  }
  drawYards(context, scene.grounds, plan.yards, input.state.seed);
  if (plan.beds.length > 0) drawCroftBeds(context, scene.yardProps, plan.beds);
  drawFieldClusters(context, scene.fields, plan.fieldClusters);
  if (plan.zoneIndexes.length + plan.zoneChains.length > 0) drawZoneLines(context, scene.zones, plan.zoneChains, bounds, zoom);
  drawAprons(context, scene.grounds, plan.aprons, scene.ribbons.width);
}

function chunkTiles(state: GameState, plan: GroundChunkPlan, ring: number): Tile[] {
  const tiles: Tile[] = [];
  const x0 = plan.cx * GROUND_CHUNK_TILES - ring; const y0 = plan.cy * GROUND_CHUNK_TILES - ring;
  const size = GROUND_CHUNK_TILES + ring * 2;
  // Painter's order (depth, then x) so overlapping diamond edges match the full-frame pass.
  for (let depth = 0; depth <= (size - 1) * 2; depth += 1) {
    for (let dx = Math.max(0, depth - size + 1); dx <= Math.min(size - 1, depth); dx += 1) {
      const tx = x0 + dx; const ty = y0 + depth - dx;
      if (tx < 0 || ty < 0 || tx >= state.width || ty >= state.height) continue;
      const tile = state.tiles[ty * state.width + tx];
      if (tile !== undefined) tiles.push(tile);
    }
  }
  return tiles;
}

function chunkDiamond(plan: GroundChunkPlan): readonly [Point, Point, Point, Point] {
  const b = chunkTileBounds(plan.cx, plan.cy);
  const point = (x: number, y: number): Point => { const screen = tileToScreen(x, y); return { x: screen.sx, y: screen.sy }; };
  return [point(b.left, b.top), point(b.right, b.top), point(b.right, b.bottom), point(b.left, b.bottom)];
}
type Point = { readonly x: number; readonly y: number };

type PrefetchJob = { readonly request: ChunkRasterRequest; readonly paint: (context: CanvasRenderingContext2D) => void };
const prefetchQueues = new WeakMap<CanvasRenderingContext2D, { jobs: PrefetchJob[]; scheduled: boolean }>();
/** Idle slices shorter than this are left alone (one chunk raster takes a few ms). */
const PREFETCH_MIN_IDLE_MS = 6;

/**
 * Rasters the ring of chunks around the view in idle time, nearest first. Each job carries the content key of the
 * frame that queued it, so a raster made from an older state is simply re-rastered when the key moves on.
 */
function schedulePrefetch(context: CanvasRenderingContext2D, cache: GroundChunkCache, jobs: PrefetchJob[]): void {
  if (typeof requestIdleCallback !== "function") return;
  let queue = prefetchQueues.get(context);
  if (queue === undefined) { queue = { jobs: [], scheduled: false }; prefetchQueues.set(context, queue); }
  queue.jobs = jobs.filter(job => cache.needs(job.request));
  if (queue.scheduled || queue.jobs.length === 0) return;
  queue.scheduled = true;
  const run = (deadline: IdleDeadline): void => {
    const current = prefetchQueues.get(context);
    if (current === undefined) return;
    while (current.jobs.length > 0 && deadline.timeRemaining() > PREFETCH_MIN_IDLE_MS) {
      const job = current.jobs.shift() as PrefetchJob;
      cache.prefetch(job.request, job.paint);
    }
    current.scheduled = current.jobs.length > 0;
    if (current.scheduled) requestIdleCallback(run);
  };
  requestIdleCallback(run);
}

function ringChunks(scene: GroundBoundaryScene, range: TileRange, visible: readonly GroundChunkPlan[]): GroundChunkPlan[] {
  const grown = { minTx: range.minTx - GROUND_CHUNK_TILES, maxTx: range.maxTx + GROUND_CHUNK_TILES,
    minTy: range.minTy - GROUND_CHUNK_TILES, maxTy: range.maxTy + GROUND_CHUNK_TILES };
  const seen = new Set(visible);
  const centre = { cx: (range.minTx + range.maxTx) / 2 / GROUND_CHUNK_TILES, cy: (range.minTy + range.maxTy) / 2 / GROUND_CHUNK_TILES };
  return visibleChunks(scene, grown).filter(plan => !seen.has(plan))
    .sort((a, b) => Math.hypot(a.cx - centre.cx, a.cy - centre.cy) - Math.hypot(b.cx - centre.cx, b.cy - centre.cy) || a.cy - b.cy || a.cx - b.cx);
}

function visibleChunks(scene: GroundBoundaryScene, range: Pick<TileRange, "minTx" | "maxTx" | "minTy" | "maxTy">): GroundChunkPlan[] {
  const minCx = Math.max(0, Math.floor(range.minTx / GROUND_CHUNK_TILES));
  const maxCx = Math.min(scene.columns - 1, Math.floor(range.maxTx / GROUND_CHUNK_TILES));
  const minCy = Math.max(0, Math.floor(range.minTy / GROUND_CHUNK_TILES));
  const maxCy = Math.min(scene.rows - 1, Math.floor(range.maxTy / GROUND_CHUNK_TILES));
  const plans: GroundChunkPlan[] = [];
  for (let cy = minCy; cy <= maxCy; cy += 1) for (let cx = minCx; cx <= maxCx; cx += 1) {
    const plan = scene.chunks[cy * scene.columns + cx];
    if (plan !== undefined) plans.push(plan);
  }
  return plans;
}
