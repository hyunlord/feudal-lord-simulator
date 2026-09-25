import type { GameState } from "../engine/engine.types";
import { buildingFootprint } from "../geometry/buildingFootprint";
import { boundsOf, hashNumbers, type BoundaryBounds, type BoundaryPoint } from "../world/boundary/boundaryGeometry";
import { roadCenterlineGraph, type RoadCenterlineGraph } from "../world/boundary/roadCenterline";
import { roadRibbonLayout, type RoadRibbonLayout } from "../world/boundary/roadRibbonLayout";
import { fieldClusters, forestBoundary, type FieldCluster, type ForestBoundary } from "../world/boundary/terrainBoundaries";
import { roadTopologySignature } from "../world/roadTopologySignature";
import type { Tile } from "../world/world.types";
import { roadRibbonWidth, roadStripSignature } from "./roadRibbonStyle";
import { buildZoneLayer, zoneSignature, type ZoneLayer } from "./zoneLayer";
import { zonesOf } from "../zones/zoneEdits";
import { buildingRoadAccessTiles } from "../engine/routing";
import { buildingGrounds, type BuildingApron, type BuildingGrounds } from "../world/boundary/buildingGrounds";
import { distanceToSegment } from "../world/boundary/boundaryGeometry";
import { yardProps, type YardProps } from "../world/boundary/yardProps";

// Everything the V2 ground pass draws, derived once per ground change and split into 8x8-tile chunks.
//
// Cache (AGENTS rule 10):
// (a) Scene key: `tiles` identity (every road, terrain or building-footprint change replaces the tiles array),
//     the palisade signature (completed wall edges + gates + polygon, which decide road links and stone paving),
//     the seed, the wheat-farm footprint list (farm clusters), and the road ribbon width + strip set (D1a-2: the
//     ribbon layout's shoulder tufts and caps are placed from the width; the strip set is only in the road chunk key),
//     and the zone signature (C1b: id, kind and membership of every zone; plots follow roads and buildings, which
//     replace the tiles array). Building yards and aprons (C1d) follow the buildings themselves (the building
//     signature: id, kind, position and lot of every building in claim order; a construction site claims its tiles
//     when placed, so completing it leaves the tiles array alone and only this signature moves), roads (tiles), the
//     wall (palisade signature) and the ribbon width. Yard props (C1e: croft beds, hurdles) follow the yards and aprons
//     and which buildings are houses (building signature). Arable ridge layouts (C1e) follow zone membership and the
//     tiles; the crop state of each strip is read every frame and enters only the chunk content key of the chunks that
//     draw that strip (drawTerrainBoundaryV2), since it moves with farm production.
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
  readonly ribbons: RoadRibbonLayout;
  readonly zones: ZoneLayer;
  /** Building yards and aprons (C1d), and the croft beds and hurdles in house yards (C1e). */
  readonly grounds: BuildingGrounds;
  readonly yardProps: YardProps;
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

type SceneKey = { readonly tiles: readonly Tile[]; readonly palisade: string; readonly seed: number; readonly farms: string; readonly buildings: string;
  readonly reversed: boolean; readonly width: number; readonly strips: string; readonly zones: string };
let last: { readonly key: SceneKey; readonly scene: GroundBoundaryScene } | null = null;
let reverseInputForProof = false;

// Zone-only rebuild deferral (C1d, live canvas only): the frame that first sees a zone edit keeps the previous scene
// (its chunks and props are all still valid pictures of the ground, just without the new zones) and the next frame
// rebuilds, so the stroke-end frame does not pay the zone layer (4-8 ms on the 24-lot town) on top of its rasters.
// Off by default: tests, the Node C25 board and proof resets always see the scene of the state they pass.
let deferZoneRebuilds = false;
let sceneFrame = 0;
let deferredAtFrame: number | null = null;
let frameStartedAt: number | undefined;
export function setGroundSceneZoneDeferral(enabled: boolean): void { deferZoneRebuilds = enabled; deferredAtFrame = null; frameStartedAt = undefined; }
/** Called once at the start of every live frame. */
export function beginGroundSceneFrame(): void { sceneFrame += 1; frameStartedAt = deferZoneRebuilds ? performance.now() : undefined; }
/** When the current live frame started (undefined unless deferral is on): the chunk cache's defer budget. */
export function groundSceneFrameStart(): number | undefined { return frameStartedAt; }

/** Proof hook (gate 2): build from the tiles in reverse order; the scene must not change. */
export function setGroundSceneReverseInput(value: boolean): void { reverseInputForProof = value; last = null; }

export function groundBoundaryScene(state: GameState): GroundBoundaryScene {
  const farmList = state.buildings.filter(building => building.kind === "wheat_farm");
  const key: SceneKey = {
    tiles: state.tiles,
    palisade: palisadeSignature(state.palisade),
    seed: state.seed,
    farms: farmList.map(farm => `${farm.id}@${farm.tx},${farm.ty}`).join("|"),
    buildings: buildingSignature(state.buildings),
    reversed: reverseInputForProof,
    width: roadRibbonWidth(),
    strips: roadStripSignature(),
    zones: zoneSignature(zonesOf(state)),
  };
  const sameGround = last !== null && last.key.tiles === key.tiles && last.key.palisade === key.palisade && last.key.seed === key.seed
    && last.key.farms === key.farms && last.key.buildings === key.buildings && last.key.reversed === key.reversed && last.key.width === key.width && last.key.strips === key.strips;
  if (sameGround && last?.key.zones === key.zones) return (last as NonNullable<typeof last>).scene;
  if (sameGround && deferZoneRebuilds && last !== null && (deferredAtFrame === null || deferredAtFrame === sceneFrame)) {
    deferredAtFrame = sceneFrame;
    return last.scene;
  }
  deferredAtFrame = null;
  // A zone edit keeps the ground: reuse roads, forest, fields and ribbons (the costly part, 10-40 ms on the 24-lot town)
  // and derive only the zone layer and the chunk plans again.
  const scene = buildGroundBoundaryScene(state, reverseInputForProof, sameGround ? last?.scene : undefined);
  // A zone-only rebuild keeps every chunk's ground base key (drawTerrainBoundaryV2 may then spread the re-rasters).
  last = { key, scene };
  sceneBuilds += 1;
  return scene;
}

let sceneBuilds = 0;
/** Proof diagnostics: how many times the scene was rebuilt and what the last build cost. */
export function groundBoundarySceneStats(): { readonly builds: number; readonly lastBuildMs: number | null } {
  return { builds: sceneBuilds, lastBuildMs: last?.scene.buildMs ?? null };
}

export function buildGroundBoundaryScene(state: GameState, reverseInput = false,
  ground?: Pick<GroundBoundaryScene, "roads" | "forest" | "fields" | "ribbons" | "grounds" | "yardProps" | "chunks">): GroundBoundaryScene {
  const started = typeof performance === "undefined" ? 0 : performance.now();
  const tiles = reverseInput ? [...state.tiles].reverse() : state.tiles;
  const grid = { width: state.width, height: state.height, tiles };
  const roads = ground?.roads ?? roadCenterlineGraph({ ...grid, palisade: state.palisade });
  const forest = ground?.forest ?? forestBoundary(grid, state.seed);
  const farms = state.buildings.filter(building => building.kind === "wheat_farm")
    .map(farm => ({ id: farm.id, tx: farm.tx, ty: farm.ty, ...buildingFootprint(farm) }));
  const fields = ground?.fields ?? fieldClusters(grid, reverseInput ? [...farms].reverse() : farms);
  const columns = Math.ceil(state.width / GROUND_CHUNK_TILES);
  const rows = Math.ceil(state.height / GROUND_CHUNK_TILES);
  const cells: Tile[] = new Array(state.width * state.height);
  for (const tile of tiles) cells[tile.ty * state.width + tile.tx] = tile;
  const grounds = ground?.grounds ?? buildingGrounds({
    mapWidth: state.width, mapHeight: state.height, cells, graph: roads, ribbonWidth: roadRibbonWidth(),
    wall: state.palisade === null ? null : state.palisade.polygon.map(point => ({ x: point.x - 0.5, y: point.y - 0.5 })),
    buildings: state.buildings.filter(building => building.kind !== "wheat_farm").map(building => ({
      id: building.id, tx: building.tx, ty: building.ty, ...buildingFootprint(building),
      roadAccess: buildingRoadAccessTiles(state, building).map(tile => tile.ty * state.width + tile.tx),
    })),
  });
  const yard = ground?.yardProps ?? yardProps({ yards: grounds.yards, aprons: grounds.aprons, seed: state.seed,
    houses: new Set(state.buildings.filter(building => building.kind === "house").map(building => building.id)) });
  const ribbons = ground?.ribbons ?? roadRibbonLayout({ graph: roads, width: roadRibbonWidth(), mapWidth: state.width, mapHeight: state.height, cells, seed: state.seed,
    keepOut: apronKeepOut(grounds.aprons, state.width) });
  const strips = hashNumbers([...roadStripSignature()].map(character => character.charCodeAt(0)));
  const zones = buildZoneLayer(state, cells);
  const zoneBounds: BoundaryBounds[] = zones.zones.map(zone => ({ left: zone.bounds.left - PRIMITIVE_MARGIN, top: zone.bounds.top - PRIMITIVE_MARGIN,
    right: zone.bounds.right + PRIMITIVE_MARGIN, bottom: zone.bounds.bottom + PRIMITIVE_MARGIN }));
  const zoneChainBounds: readonly BoundaryBounds[] = zones.outlines.chains.map(chain => chain.bounds);
  const yardBounds = grounds.yards.map(yard => yard.bounds);
  const apronBounds = grounds.aprons.map(apron => apron.bounds);
  const bedBounds = yard.beds.map(bed => bed.bounds);
  const arableBandBounds = zones.arableBands.map(band => band.bounds);

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
  const zonePart = (box: BoundaryBounds, zoneIndexes: readonly number[], zoneChains: readonly number[]): number[] =>
    // Zones only enter the key where they are drawn, so a zone-free chunk keeps its key and picture.
    zoneIndexes.length + zoneChains.length === 0 ? [] : zoneChunkKey(zones, box, zoneIndexes, zoneChains);
  if (ground?.chunks !== undefined && ground.chunks.length === columns * rows) {
    // Zone-only edit: everything but the zone part of each chunk is the previous scene's.
    for (const previous of ground.chunks) {
      const box = chunkTileBounds(previous.cx, previous.cy);
      const zoneIndexes = zoneBounds.flatMap((bound, index) => overlaps(bound, box) ? [index] : []);
      const zoneChains = zoneChainBounds.flatMap((bound, index) => overlaps(bound, box) ? [index] : []);
      const arableBands = arableBandBounds.flatMap((bound, index) => overlaps(bound, box) ? [index] : []);
      chunks.push({ ...previous, zoneIndexes, zoneChains, arableBands, groundKey: hashNumbers([previous.groundBaseKey, ...zonePart(box, zoneIndexes, zoneChains)]) });
    }
    const buildMs = typeof performance === "undefined" ? 0 : performance.now() - started;
    return { width: state.width, height: state.height, columns, rows, roads, ribbons, zones, grounds, yardProps: yard, forest, fields, chunks, buildMs };
  }
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
    const zoneIndexes = hits(zoneBounds);
    const zoneChains = hits(zoneChainBounds);
    const yards = hits(yardBounds);
    const aprons = hits(apronBounds);
    const beds = hits(bedBounds);
    const arableBands = hits(arableBandBounds);
    const tileValues: number[] = [];
    for (let ty = cy * GROUND_CHUNK_TILES - TILE_RING; ty < (cy + 1) * GROUND_CHUNK_TILES + TILE_RING; ty += 1) {
      for (let tx = cx * GROUND_CHUNK_TILES - TILE_RING; tx < (cx + 1) * GROUND_CHUNK_TILES + TILE_RING; tx += 1) {
        const tile = tx < 0 || ty < 0 || tx >= state.width || ty >= state.height ? undefined : cells[ty * state.width + tx];
        tileValues.push(tile === undefined ? -1 : terrainCode(tile.terrain) + (tile.hasRoad ? 8 : 0) + (tile.buildingId === null ? 0 : 16));
      }
    }
    const groundBaseKey = hashNumbers([
      state.seed, enclosing % 2, ...tileValues,
      ...forestLoops.flatMap(index => [forest.loops[index]?.hash ?? 0, forestDecalHashes[index] ?? 0]),
      ...fieldIndexes.flatMap(index => [fields[index]?.hash ?? 0, fieldDecalHashes[index] ?? 0]),
      // Yards and aprons (C1d) enter with their full hashes, like zones; a chunk without any keeps its key.
      ...(yards.length + aprons.length === 0 ? [] : [-7, ...yards.map(index => grounds.yards[index]?.hash ?? 0), -8, ...aprons.map(index => grounds.aprons[index]?.hash ?? 0)]),
      ...(beds.length === 0 ? [] : [-9, ...beds.map(index => yard.beds[index]?.hash ?? 0)]),
    ]);
    const groundKey = hashNumbers([groundBaseKey, ...zonePart(box, zoneIndexes, zoneChains)]);
    const roadKey = hashNumbers([
      strips, ribbons.width,
      ...chains.flatMap(index => [roads.chains[index]?.hash ?? 0, ribbons.chainHashes[index] ?? 0]),
      ...fixedPoints.flatMap(index => {
        const point = roads.fixedPoints[index];
        return point === undefined ? [] : [point.tx, point.ty, point.degree, point.material === "stone" ? 1 : 0,
          point.kinds.length, ...point.kinds.map(kind => kind.length), ...point.bridgeDirections.flatMap(direction => [direction.x, direction.y]),
          ribbons.fixedHashes[index] ?? 0];
      }),
      ...plazas.flatMap(index => [roads.plazaLoops[index]?.hash ?? 0, roads.plazaLoops[index]?.material === "stone" ? 1 : 0]),
    ]);
    chunks.push({
      cx, cy, forestLoops, forestParity: enclosing % 2 === 1, fieldClusters: fieldIndexes, zoneIndexes, zoneChains, yards, aprons, beds, arableBands, chains, fixedPoints, plazas,
      groundKey, groundBaseKey, roadKey, hasRoads: chains.length + fixedPoints.length + plazas.length > 0,
    });
  }
  const buildMs = typeof performance === "undefined" ? 0 : performance.now() - started;
  return { width: state.width, height: state.height, columns, rows, roads, ribbons, zones, grounds, yardProps: yard, forest, fields, chunks, buildMs };
}

/** Shoulder tufts stay this far off an apron: a tuft crop (40 source px at 0.8) reaches ~0.2 tile from its anchor. */
const TUFT_APRON_CLEARANCE = 0.3;
function apronKeepOut(aprons: readonly BuildingApron[], mapWidth: number): (point: BoundaryPoint) => boolean {
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
function zoneChunkKey(zones: ZoneLayer, box: BoundaryBounds, zoneIndexes: readonly number[], zoneChains: readonly number[]): number[] {
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

const buildingSignatures = new WeakMap<object, string>();
function buildingSignature(buildings: GameState["buildings"]): string {
  const cached = buildingSignatures.get(buildings);
  if (cached !== undefined) return cached;
  const signature = buildings.map(building => `${building.id}:${building.kind}@${building.tx},${building.ty}${building.houseLot ?? ""}`).join("|");
  buildingSignatures.set(buildings, signature);
  return signature;
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
