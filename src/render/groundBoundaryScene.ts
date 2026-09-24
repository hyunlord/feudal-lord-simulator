import type { GameState } from "../engine/engine.types";
import { buildingFootprint } from "../geometry/buildingFootprint";
import { boundsOf, hashNumbers, type BoundaryBounds, type BoundaryPoint } from "../world/boundary/boundaryGeometry";
import { roadCenterlineGraph, type RoadCenterlineGraph } from "../world/boundary/roadCenterline";
import { fieldClusters, forestBoundary, type FieldCluster, type ForestBoundary } from "../world/boundary/terrainBoundaries";
import { roadTopologySignature } from "../world/roadTopologySignature";
import type { Tile } from "../world/world.types";

// Everything the V2 ground pass draws, derived once per ground change and split into 8x8-tile chunks.
//
// Cache (AGENTS rule 10):
// (a) Scene key: `tiles` identity (every road, terrain or building-footprint change replaces the tiles array),
//     the palisade signature (completed wall edges + gates + polygon, which decide road links and stone paving),
//     the seed, and the wheat-farm footprint list (farm clusters).
// (b) Left out on purpose: walkers, stocks, ticks, crop growth, house levels, construction progress. None of them is
//     read by road chains, forest or field outlines (crop state only changes what is drawn inside a field, which
//     stays in the live object pass), so they cannot change a scene.
// (c) Measured in docs/verification/d1a/REPORT.md (scene build time per fixture, and chunk-key hit rates).
//
// Chunk content keys hash exactly the primitives a chunk draws (tiles within 3 of it, every loop/chain/decal whose
// bounds reach it), so a chunk re-rasters iff something it draws changed, and never keeps a stale picture.

export const GROUND_CHUNK_TILES = 8;
/** Tile-space reach of anything drawn around a primitive (decal sprites rise ~1.5 tiles above their anchor). */
const PRIMITIVE_MARGIN = 2;
const TILE_RING = 3;

export type GroundBoundaryScene = {
  readonly width: number;
  readonly height: number;
  readonly columns: number;
  readonly rows: number;
  readonly roads: RoadCenterlineGraph;
  readonly forest: ForestBoundary;
  readonly fields: readonly FieldCluster[];
  readonly chunks: readonly GroundChunkPlan[];
  readonly buildMs: number;
};

export type GroundChunkPlan = {
  readonly cx: number;
  readonly cy: number;
  readonly forestLoops: readonly number[];
  /** Odd number of forest loops that enclose the chunk without touching it: its background is forest. */
  readonly forestParity: boolean;
  readonly fieldClusters: readonly number[];
  readonly chains: readonly number[];
  readonly fixedPoints: readonly number[];
  readonly plazas: readonly number[];
  readonly groundKey: number;
  readonly roadKey: number;
  readonly hasRoads: boolean;
};

type SceneKey = { readonly tiles: readonly Tile[]; readonly palisade: string; readonly seed: number; readonly farms: string;
  readonly reversed: boolean };
let last: { readonly key: SceneKey; readonly scene: GroundBoundaryScene } | null = null;
let reverseInputForProof = false;

/** Proof hook (gate 2): build from the tiles in reverse order; the scene must not change. */
export function setGroundSceneReverseInput(value: boolean): void { reverseInputForProof = value; last = null; }

export function groundBoundaryScene(state: GameState): GroundBoundaryScene {
  const farmList = state.buildings.filter(building => building.kind === "wheat_farm");
  const key: SceneKey = {
    tiles: state.tiles,
    palisade: palisadeSignature(state.palisade),
    seed: state.seed,
    farms: farmList.map(farm => `${farm.id}@${farm.tx},${farm.ty}`).join("|"),
    reversed: reverseInputForProof,
  };
  if (last !== null && last.key.tiles === key.tiles && last.key.palisade === key.palisade && last.key.seed === key.seed
    && last.key.farms === key.farms && last.key.reversed === key.reversed) return last.scene;
  const scene = buildGroundBoundaryScene(state, reverseInputForProof);
  last = { key, scene };
  sceneBuilds += 1;
  return scene;
}

let sceneBuilds = 0;
/** Proof diagnostics: how many times the scene was rebuilt and what the last build cost. */
export function groundBoundarySceneStats(): { readonly builds: number; readonly lastBuildMs: number | null } {
  return { builds: sceneBuilds, lastBuildMs: last?.scene.buildMs ?? null };
}

export function buildGroundBoundaryScene(state: GameState, reverseInput = false): GroundBoundaryScene {
  const started = typeof performance === "undefined" ? 0 : performance.now();
  const tiles = reverseInput ? [...state.tiles].reverse() : state.tiles;
  const grid = { width: state.width, height: state.height, tiles };
  const roads = roadCenterlineGraph({ ...grid, palisade: state.palisade });
  const forest = forestBoundary(grid, state.seed);
  const farms = state.buildings.filter(building => building.kind === "wheat_farm")
    .map(farm => ({ id: farm.id, tx: farm.tx, ty: farm.ty, ...buildingFootprint(farm) }));
  const fields = fieldClusters(grid, reverseInput ? [...farms].reverse() : farms);
  const columns = Math.ceil(state.width / GROUND_CHUNK_TILES);
  const rows = Math.ceil(state.height / GROUND_CHUNK_TILES);
  const cells: Tile[] = new Array(state.width * state.height);
  for (const tile of tiles) cells[tile.ty * state.width + tile.tx] = tile;

  const forestBounds = forest.loops.map((loop, index) => boundsOf([...loop.smoothed, ...(forest.decals[index] ?? []).map(decal => decal.anchor)], PRIMITIVE_MARGIN));
  const fieldBounds = fields.map(field => boundsOf([...field.loops.flatMap(loop => loop.smoothed), ...field.decals.map(decal => decal.anchor)], PRIMITIVE_MARGIN));
  const chainBounds = roads.chains.map(chain => boundsOf(chain.centreline, PRIMITIVE_MARGIN));
  const fixedBounds = roads.fixedPoints.map(point => boundsOf([{ x: point.tx, y: point.ty }], PRIMITIVE_MARGIN));
  const plazaBounds = roads.plazaLoops.map(loop => boundsOf(loop.smoothed, PRIMITIVE_MARGIN));
  const forestDecalHashes = forest.decals.map(decals => hashNumbers(decals.flatMap(decal =>
    [decal.edgeKey, decal.variant, decal.flipX ? 1 : 0, decal.scale, decal.anchor.x, decal.anchor.y])));
  const fieldDecalHashes = fields.map(field => hashNumbers(field.decals.flatMap(decal =>
    [decal.kind === "furrow" ? 1 : 2, decal.axis === "x" ? 1 : 2, decal.length, decal.anchor.x, decal.anchor.y])));

  const chunks: GroundChunkPlan[] = [];
  for (let cy = 0; cy < rows; cy += 1) for (let cx = 0; cx < columns; cx += 1) {
    const box = chunkTileBounds(cx, cy);
    const hits = (bounds: readonly BoundaryBounds[]): number[] =>
      bounds.flatMap((bound, index) => overlaps(bound, box) ? [index] : []);
    const forestLoops = hits(forestBounds);
    const centre = { x: (box.left + box.right) / 2, y: (box.top + box.bottom) / 2 };
    // Beyond the map edge counts as forest (the mask's outside value), so a point enclosed by no loop is forest.
    const enclosing = 1 + forest.loops.filter((loop, index) => !forestLoops.includes(index) && pointInPolygon(centre, loop.smoothed)).length;
    const fieldIndexes = hits(fieldBounds);
    const chains = hits(chainBounds);
    const fixedPoints = hits(fixedBounds);
    const plazas = hits(plazaBounds);
    const tileValues: number[] = [];
    for (let ty = cy * GROUND_CHUNK_TILES - TILE_RING; ty < (cy + 1) * GROUND_CHUNK_TILES + TILE_RING; ty += 1) {
      for (let tx = cx * GROUND_CHUNK_TILES - TILE_RING; tx < (cx + 1) * GROUND_CHUNK_TILES + TILE_RING; tx += 1) {
        const tile = tx < 0 || ty < 0 || tx >= state.width || ty >= state.height ? undefined : cells[ty * state.width + tx];
        tileValues.push(tile === undefined ? -1 : terrainCode(tile.terrain) + (tile.hasRoad ? 8 : 0) + (tile.buildingId === null ? 0 : 16));
      }
    }
    const groundKey = hashNumbers([
      state.seed, enclosing % 2, ...tileValues,
      ...forestLoops.flatMap(index => [forest.loops[index]?.hash ?? 0, forestDecalHashes[index] ?? 0]),
      ...fieldIndexes.flatMap(index => [fields[index]?.hash ?? 0, fieldDecalHashes[index] ?? 0]),
    ]);
    const roadKey = hashNumbers([
      ...chains.map(index => roads.chains[index]?.hash ?? 0),
      ...fixedPoints.flatMap(index => {
        const point = roads.fixedPoints[index];
        return point === undefined ? [] : [point.tx, point.ty, point.degree, point.material === "stone" ? 1 : 0,
          point.kinds.length, ...point.kinds.map(kind => kind.length), ...point.bridgeDirections.flatMap(direction => [direction.x, direction.y])];
      }),
      ...plazas.flatMap(index => [roads.plazaLoops[index]?.hash ?? 0, roads.plazaLoops[index]?.material === "stone" ? 1 : 0]),
    ]);
    chunks.push({
      cx, cy, forestLoops, forestParity: enclosing % 2 === 1, fieldClusters: fieldIndexes, chains, fixedPoints, plazas,
      groundKey, roadKey, hasRoads: chains.length + fixedPoints.length + plazas.length > 0,
    });
  }
  const buildMs = typeof performance === "undefined" ? 0 : performance.now() - started;
  return { width: state.width, height: state.height, columns, rows, roads, forest, fields, chunks, buildMs };
}

/** Tile-centre bounds of a chunk's own tiles (their squares). */
export function chunkTileBounds(cx: number, cy: number): BoundaryBounds {
  return {
    left: cx * GROUND_CHUNK_TILES - 0.5, top: cy * GROUND_CHUNK_TILES - 0.5,
    right: (cx + 1) * GROUND_CHUNK_TILES - 0.5, bottom: (cy + 1) * GROUND_CHUNK_TILES - 0.5,
  };
}

const palisadeSignatures = new WeakMap<object, string>();
function palisadeSignature(palisade: GameState["palisade"]): string {
  if (palisade === null) return "";
  const cached = palisadeSignatures.get(palisade);
  if (cached !== undefined) return cached;
  const signature = `${roadTopologySignature(palisade)}|${palisade.polygon.map(point => `${point.x},${point.y}`).join(";")}`;
  palisadeSignatures.set(palisade, signature);
  return signature;
}

function overlaps(a: BoundaryBounds, b: BoundaryBounds): boolean {
  return a.left <= b.right && a.right >= b.left && a.top <= b.bottom && a.bottom >= b.top;
}

function pointInPolygon(point: BoundaryPoint, polygon: readonly BoundaryPoint[]): boolean {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
    const a = polygon[index] as BoundaryPoint; const b = polygon[previous] as BoundaryPoint;
    if ((a.y > point.y) !== (b.y > point.y) && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

function terrainCode(terrain: Tile["terrain"]): number {
  switch (terrain) {
    case "grass": return 0;
    case "forest": return 1;
    case "water": return 2;
    case "rock": return 3;
  }
}
