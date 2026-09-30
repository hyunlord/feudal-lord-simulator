import type { GameState } from "../engine/engine.types";
import type { BoundaryBounds, BoundaryPoint } from "../world/boundary/boundaryGeometry";
import { distanceToSegment, hashNumbers } from "../world/boundary/boundaryGeometry";
import type { BuildingApron, BuildingGrounds } from "../world/boundary/buildingGrounds";
import type { RoadCenterlineGraph } from "../world/boundary/roadCenterline";
import type { RoadRibbonLayout } from "../world/boundary/roadRibbonLayout";
import type { Shoreline } from "../world/boundary/shoreline";
import type { FieldCluster, ForestBoundary } from "../world/boundary/terrainBoundaries";
import type { YardProps } from "../world/boundary/yardProps";
import { bridgeAt, type BridgeSpan } from "../world/bridges";
import type { Tile } from "../world/world.types";
import { wallBaselinesFor } from "./wallBaselineCache";
import type { ZoneLayer } from "./zoneLayer";

// The ground scene's types and the pieces its build uses (SMOOTH-2R: split out of groundBoundaryScene.ts, which keeps
// the scene key and cache, when the build became resumable in groundSceneBuild.ts). Unchanged from there.

export const GROUND_CHUNK_TILES = 8;
/** Tile-space reach of anything drawn around a primitive (decal sprites rise ~1.5 tiles above their anchor). */
export const PRIMITIVE_MARGIN = 2;
export const TILE_RING = 3;

export type GroundBoundaryScene = {
  readonly width: number;
  readonly height: number;
  readonly columns: number;
  readonly rows: number;
  readonly roads: RoadCenterlineGraph;
  readonly ribbons: RoadRibbonLayout;
  readonly zones: ZoneLayer;
  /** Building yards and aprons (C1d), and the croft beds and hurdles in house yards (C1e). */
  readonly grounds: BuildingGrounds;
  readonly yardProps: YardProps;
  /** Curved water edge, shallow band decals and bridge ends (D3a). */
  readonly shore: Shoreline;
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
  /** Zones whose rings reach the chunk, and zone outline chains that do. */
  readonly zoneIndexes: readonly number[];
  readonly zoneChains: readonly number[];
  /** Yards and aprons whose bounds reach the chunk. */
  readonly yards: readonly number[];
  readonly aprons: readonly number[];
  /** Shoreline loops that reach the chunk, and whether the chunk otherwise lies inside water (odd enclosing loops). */
  readonly waterLoops: readonly number[];
  readonly waterParity: boolean;
  /** Croft beds (C1e) and arable strip runs (zone layer `arableBands`) whose bounds reach the chunk. */
  readonly beds: readonly number[];
  readonly arableBands: readonly number[];
  readonly chains: readonly number[];
  readonly fixedPoints: readonly number[];
  readonly plazas: readonly number[];
  readonly groundKey: number;
  /** groundKey without the zone part: equal before and after a zone-only edit (lets that re-raster wait a frame). */
  readonly groundBaseKey: number;
  readonly roadKey: number;
  readonly hasRoads: boolean;
};


/** The drawn wall baselines' water-side stretches in tile-centre coordinates (D3b: the shoreline shares them). */
export function waterSideWalls(state: GameState): BoundaryPoint[][] {
  const lines: BoundaryPoint[][] = [];
  for (const chain of wallBaselinesFor(state).walls.chains) {
    let run: BoundaryPoint[] = [];
    for (const sample of chain.samples) {
      if (sample.water) run.push({ x: sample.point.x - 0.5, y: sample.point.y - 0.5 });
      else { if (run.length > 1) lines.push(run); run = []; }
    }
    if (run.length > 1) lines.push(run);
  }
  return lines;
}

/** Every bridge span once (bridgeAt lists it for each of its water tiles), in tile order. */
export function bridgeSpans(state: GameState, tiles: readonly Tile[]): BridgeSpan[] {
  const spans = new Map<string, BridgeSpan>();
  for (const tile of tiles) {
    if (tile.terrain !== "water" || !tile.hasRoad) continue;
    const span = bridgeAt(state, tile);
    if (span !== null) spans.set(span.banks.map(bank => `${bank.tx},${bank.ty}`).join("|"), span);
  }
  return [...spans.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([, span]) => span);
}

/** Shoulder tufts stay this far off an apron: a tuft crop (40 source px at 0.8) reaches ~0.2 tile from its anchor. */
const TUFT_APRON_CLEARANCE = 0.3;
export function apronKeepOut(aprons: readonly BuildingApron[], mapWidth: number): (point: BoundaryPoint) => boolean {
  const buckets = new Map<number, BuildingApron[]>();
  for (const apron of aprons) {
    for (let y = Math.floor(apron.bounds.top - 1); y <= Math.ceil(apron.bounds.bottom + 1); y += 1) {
      for (let x = Math.floor(apron.bounds.left - 1); x <= Math.ceil(apron.bounds.right + 1); x += 1) {
        const key = (y + 2) * (mapWidth + 4) + x + 2; const list = buckets.get(key);
        if (list === undefined) buckets.set(key, [apron]); else list.push(apron);
      }
    }
  }
  return point => (buckets.get((Math.floor(point.y) + 2) * (mapWidth + 4) + Math.floor(point.x) + 2) ?? []).some(apron => {
    if (pointInPolygon(point, apron.polygon)) return true;
    for (let index = 0; index < apron.polygon.length; index += 1) {
      if (distanceToSegment(point, apron.polygon[index] as BoundaryPoint, apron.polygon[(index + 1) % apron.polygon.length] as BoundaryPoint) < TUFT_APRON_CLEARANCE) return true;
    }
    return false;
  });
}

/**
 * The zone part of a chunk's content key. Fills and outlines are whole paths, and the rasteriser's sub-pixel result
 * inside a chunk can depend on the entire path (a localised key left 8-level differences at DPR 2 in the browser
 * freshness check), so each zone and chain the chunk draws enters with its full hash: editing one zone re-rasters
 * that zone's chunks only. Plot lines and frontage marks are short segments, so only those near the chunk count.
 */
export function zoneChunkKey(zones: ZoneLayer, box: BoundaryBounds, zoneIndexes: readonly number[], zoneChains: readonly number[]): number[] {
  const margin = 1.5;
  const near = (point: BoundaryPoint): boolean => point.x >= box.left - margin && point.x <= box.right + margin && point.y >= box.top - margin && point.y <= box.bottom + margin;
  const values: number[] = [zoneIndexes.length, zoneChains.length];
  for (const index of zoneIndexes) values.push(index, zones.zones[index]?.hash ?? 0);
  for (const index of zoneChains) {
    const chain = zones.outlines.chains[index];
    values.push(-1 - index, chain?.hash ?? 0, chain?.labels[0] ?? 0, chain?.labels[1] ?? 0);
  }
  for (const edge of zones.parcelEdges) if (near(edge.a)) values.push(edge.a.x, edge.a.y, edge.b.x, edge.b.y, edge.built ? 1 : 0);
  for (const mark of zones.frontage) if (near({ x: mark.cell.tx, y: mark.cell.ty })) values.push(mark.cell.tx, mark.cell.ty, mark.toward.x, mark.toward.y, mark.built ? 1 : 0);
  return [hashNumbers(values)];
}

/** Tile-centre bounds of a chunk's own tiles (their squares). */
export function chunkTileBounds(cx: number, cy: number): BoundaryBounds {
  return {
    left: cx * GROUND_CHUNK_TILES - 0.5, top: cy * GROUND_CHUNK_TILES - 0.5,
    right: (cx + 1) * GROUND_CHUNK_TILES - 0.5, bottom: (cy + 1) * GROUND_CHUNK_TILES - 0.5,
  };
}

export function overlaps(a: BoundaryBounds, b: BoundaryBounds): boolean {
  return a.left <= b.right && a.right >= b.left && a.top <= b.bottom && a.bottom >= b.top;
}

export function pointInPolygon(point: BoundaryPoint, polygon: readonly BoundaryPoint[]): boolean {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
    const a = polygon[index] as BoundaryPoint; const b = polygon[previous] as BoundaryPoint;
    if ((a.y > point.y) !== (b.y > point.y) && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

export function terrainCode(terrain: Tile["terrain"]): number {
  switch (terrain) {
    case "grass": return 0;
    case "forest": return 1;
    case "water": return 2;
    case "rock": return 3;
  }
}
