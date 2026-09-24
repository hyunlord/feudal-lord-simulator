import type { GameState } from "../engine/engine.types";
import type { Tile } from "../world/world.types";
import { boundaryAssetReadiness, boundaryAssetStatuses, preloadBoundaryAssets } from "./boundaryAssets";
import { drawBridgeDeck } from "./drawBridges";
import { drawFieldClusters, drawForestFill, drawForestFringeDecals } from "./drawGroundBoundaries";
import { drawRoadRibbons } from "./drawRoadRibbons";
import { drawGroundDecalDetail } from "./drawTerrainDetails";
import { drawTerrainTransitions } from "./drawTerrainSeams";
import { drawHistoricalWater } from "./drawWater";
import { farmSoilReadiness, preloadFarmAssets } from "./farmAssets";
import { createGroundChunkCache, groundChunkZoomBucket, type GroundChunkCache } from "./groundChunkCache";
import { GROUND_CHUNK_TILES, chunkTileBounds, groundBoundaryScene, groundBoundarySceneStats, setGroundSceneReverseInput, type GroundBoundaryScene, type GroundChunkPlan } from "./groundBoundaryScene";
import { boundaryV2Enabled } from "./renderBoundaryFlag";
import { tileToScreen } from "./iso";
import { renderStageProbe } from "./renderStageProbe";
import type { TileRange } from "./renderVisibility";
import { TERRAIN_TEXTURE_KEYS, type TerrainPatternAssets } from "./terrainPatterns";
import { drawTownLandscape } from "./townLandscapeAssets";
import { getSprite } from "./worldAssets";

// RENDER_BOUNDARY_V2 ground pass. Order: water (live) -> ground chunks (diamonds, seams, forest outline + fringe,
// field clusters) -> town landscape + frontage (live) -> road-ribbon chunks -> bridge decks (live) -> grounding
// shadows (live). Shadows stay live: they follow tree harvests, house levels and art loading, which the chunk key
// deliberately leaves out (they cost ~1 ms on the B11 baseline).

export type TerrainV2Input = {
  readonly state: GameState;
  readonly tiles: readonly Tile[];
  readonly range: TileRange;
  readonly zoom: number;
  readonly terrainPatterns?: TerrainPatternAssets;
};

export type TerrainV2Parts = {
  readonly drawGroundDiamond: (context: CanvasRenderingContext2D, tile: Tile, seed: number, patterns: TerrainPatternAssets | undefined) => void;
  readonly drawFrontage: (context: CanvasRenderingContext2D) => void;
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
  const waterReady = drawHistoricalWater(context, input.tiles.filter(tile => tile.terrain === "water"));
  probe?.enter("terrain.fill");
  void preloadBoundaryAssets();
  void preloadFarmAssets();
  const scene = groundBoundaryScene(input.state);
  const cache = groundChunkCacheFor(context);
  cache.beginFrame();
  const transform = typeof context.getTransform === "function" ? context.getTransform() : null;
  const dpr = transform === null || input.zoom <= 0 ? 1 : Math.hypot(transform.a, transform.b) / input.zoom;
  const zoom = groundChunkZoomBucket(input.zoom);
  const scale = zoom * dpr;
  const readiness = `${boundaryAssetReadiness()}:${TERRAIN_TEXTURE_KEYS.map(key => getSprite(key) === null ? 0 : 1).join("")}`
    + `:${farmSoilReadiness()}:${waterReady ? 1 : 0}`;
  const visible = visibleChunks(scene, input.range);
  for (const plan of visible) {
    cache.draw(context, {
      id: `ground:${plan.cx},${plan.cy}`,
      contentKey: `${plan.groundKey}|${readiness}|${zoom.toFixed(2)}`,
      scale, diamond: chunkDiamond(plan),
    }, paint => drawGroundChunk(paint, input, scene, plan, zoom, waterReady, parts));
  }
  probe?.enter("terrain.landscape");
  drawTownLandscape(context, input.state, input.tiles);
  probe?.enter("terrain.frontage");
  parts.drawFrontage(context);
  probe?.enter("roads.ground");
  for (const plan of visible) {
    if (!plan.hasRoads) continue;
    cache.draw(context, {
      id: `roads:${plan.cx},${plan.cy}`,
      contentKey: `${plan.roadKey}|${readiness}|${zoom.toFixed(2)}`,
      scale, diamond: chunkDiamond(plan),
    }, paint => drawRoadRibbons(paint, scene.roads, plan));
  }
  for (const tile of input.tiles) if (tile.hasRoad && tile.terrain === "water") drawBridgeDeck(context, input.state, tile);
  probe?.enter("terrain.grounding");
  parts.drawGrounding(context);
}

function drawGroundChunk(
  context: CanvasRenderingContext2D,
  input: TerrainV2Input,
  scene: GroundBoundaryScene,
  plan: GroundChunkPlan,
  zoom: number,
  waterReady: boolean,
  parts: TerrainV2Parts,
): void {
  const tiles = chunkTiles(input.state, plan, 1);
  for (const tile of tiles) {
    if (waterReady && tile.terrain === "water") continue;
    // Forest tiles are laid as grass; the smoothed forest outline below paints the forest floor.
    parts.drawGroundDiamond(context, tile.terrain === "forest" ? { ...tile, terrain: "grass" } : tile, input.state.seed, input.terrainPatterns);
  }
  for (const tile of tiles) {
    if (zoom > 0.7) drawGroundDecalDetail(context, tile, input.state.seed);
    drawTerrainTransitions(context, input.state, tile, zoom, input.terrainPatterns, false);
  }
  const bounds = chunkTileBounds(plan.cx, plan.cy);
  const diamond = chunkDiamond(plan);
  drawForestFill(context, scene.forest, plan.forestLoops, plan.forestParity, {
    left: diamond[3].x - 4, top: diamond[0].y - 4, right: diamond[1].x + 4, bottom: diamond[2].y + 4,
  }, { tx: bounds.left + 0.5, ty: bounds.top + 0.5 }, input.state.seed, input.terrainPatterns);
  drawForestFringeDecals(context, scene.forest, plan.forestLoops);
  drawFieldClusters(context, scene.fields, plan.fieldClusters);
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

function visibleChunks(scene: GroundBoundaryScene, range: TileRange): GroundChunkPlan[] {
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
