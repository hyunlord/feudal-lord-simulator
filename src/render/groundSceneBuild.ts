import type { GameState } from "../engine/engine.types";
import { buildingFootprint } from "../geometry/buildingFootprint";
import { boundsOf, hashNumbers, type BoundaryBounds } from "../world/boundary/boundaryGeometry";
import { roadCenterlineGraph } from "../world/boundary/roadCenterline";
import { roadRibbonLayout } from "../world/boundary/roadRibbonLayout";
import { fieldClusters, forestBoundary } from "../world/boundary/terrainBoundaries";
import type { Tile } from "../world/world.types";
import { roadRibbonWidth, roadStripSignature } from "./roadRibbonStyle";
import { buildZoneLayer } from "./zoneLayer";
import { buildingRoadAccessTiles } from "../engine/routing";
import { buildingGroundsSteps } from "../world/boundary/buildingGrounds";
import { yardProps } from "../world/boundary/yardProps";
import { shoreline } from "../world/boundary/shoreline";
import {
  GROUND_CHUNK_TILES, PRIMITIVE_MARGIN, TILE_RING, apronKeepOut, bridgeSpans, chunkTileBounds, overlaps, pointInPolygon, terrainCode, waterSideWalls,
  zoneChunkKey, type GroundBoundaryScene, type GroundChunkPlan,
} from "./groundSceneParts";

// The ground scene build as steps (SMOOTH-2R): the same work, in the same order, as the one synchronous build it was,
// with a `yield` after each stage, each building's yard and apron, and each row of chunk plans. Run to the end at once
// (`runGroundSceneSteps`) it is that build; the live canvas runs it a few steps a frame within a time budget
// (groundBoundaryScene.ts). Each yield names the stage it ended, for the stage timings. The scene's `buildMs` is set by
// the runner (the time spent in the steps, not the frames between them).

export type GroundSceneReuse = Pick<GroundBoundaryScene, "roads" | "forest" | "fields" | "ribbons" | "grounds" | "yardProps" | "shore" | "chunks">;
export type GroundSceneSteps = Generator<string, GroundBoundaryScene, void>;

/** Runs every step now; `stageMs` (if given) collects the time of each named stage. */
export function runGroundSceneSteps(steps: GroundSceneSteps, stageMs?: Map<string, number>): GroundBoundaryScene {
  let buildMs = 0;
  for (;;) {
    const started = now();
    const step = steps.next();
    const spent = now() - started;
    buildMs += spent;
    if (step.done === true) return { ...step.value, buildMs };
    stageMs?.set(step.value, (stageMs.get(step.value) ?? 0) + spent);
  }
}

export function* groundSceneSteps(state: GameState, reverseInput = false, ground?: GroundSceneReuse): GroundSceneSteps {
  const tiles = reverseInput ? [...state.tiles].reverse() : state.tiles;
  const grid = { width: state.width, height: state.height, tiles };
  const roads = ground?.roads ?? roadCenterlineGraph({ ...grid, palisade: state.palisade });
  if (ground === undefined) yield "roads";
  const forest = ground?.forest ?? forestBoundary(grid, state.seed);
  if (ground === undefined) yield "forest";
  const shore = ground?.shore ?? shoreline({ ...grid, seed: state.seed, bridges: bridgeSpans(state, tiles), walls: waterSideWalls(state) });
  if (ground === undefined) yield "shore";
  // Field clusters outline 2x2 wheat farms; the building is retired (C1c-2; v10 saves hold none) and its art too (C1f),
  // so only an unmigrated test state still gets an outline here.
  const farms = state.buildings.filter(building => building.kind === "wheat_farm")
    .map(farm => ({ id: farm.id, tx: farm.tx, ty: farm.ty, ...buildingFootprint(farm) }));
  const fields = ground?.fields ?? fieldClusters(grid, reverseInput ? [...farms].reverse() : farms);
  const columns = Math.ceil(state.width / GROUND_CHUNK_TILES);
  const rows = Math.ceil(state.height / GROUND_CHUNK_TILES);
  const cells: Tile[] = new Array(state.width * state.height);
  for (const tile of tiles) cells[tile.ty * state.width + tile.tx] = tile;
  let grounds = ground?.grounds;
  if (grounds === undefined) {
    const buildings = state.buildings.filter(building => building.kind !== "wheat_farm").map(building => ({
      id: building.id, tx: building.tx, ty: building.ty, ...buildingFootprint(building),
      roadAccess: buildingRoadAccessTiles(state, building).map(tile => tile.ty * state.width + tile.tx),
    }));
    yield "fields+access";
    const steps = buildingGroundsSteps({
      mapWidth: state.width, mapHeight: state.height, cells, graph: roads, ribbonWidth: roadRibbonWidth(),
      wall: state.palisade === null ? null : state.palisade.polygon.map(point => ({ x: point.x - 0.5, y: point.y - 0.5 })),
      buildings,
    });
    for (;;) {
      const step = steps.next();
      if (step.done === true) { grounds = step.value; break; }
      yield "grounds";
    }
  }
  const built = grounds as NonNullable<typeof grounds>;
  const yard = ground?.yardProps ?? yardProps({ yards: built.yards, aprons: built.aprons, seed: state.seed,
    houses: new Set(state.buildings.filter(building => building.kind === "house").map(building => building.id)) });
  if (ground === undefined) yield "yardProps";
  const ribbons = ground?.ribbons ?? roadRibbonLayout({ graph: roads, width: roadRibbonWidth(), mapWidth: state.width, mapHeight: state.height, cells, seed: state.seed,
    keepOut: apronKeepOut(built.aprons, state.width) });
  if (ground === undefined) yield "ribbons";
  const strips = hashNumbers([...roadStripSignature()].map(character => character.charCodeAt(0)));
  const zones = buildZoneLayer(state, cells);
  yield "zones";
  const zoneBounds: BoundaryBounds[] = zones.zones.map(zone => ({ left: zone.bounds.left - PRIMITIVE_MARGIN, top: zone.bounds.top - PRIMITIVE_MARGIN,
    right: zone.bounds.right + PRIMITIVE_MARGIN, bottom: zone.bounds.bottom + PRIMITIVE_MARGIN }));
  const zoneChainBounds: readonly BoundaryBounds[] = zones.outlines.chains.map(chain => chain.bounds);
  const yardBounds = built.yards.map(yard => yard.bounds);
  const apronBounds = built.aprons.map(apron => apron.bounds);
  const bedBounds = yard.beds.map(bed => bed.bounds);
  const arableBandBounds = zones.arableBands.map(band => band.bounds);

  const waterBounds = shore.loops.map(loop => loop.bounds);
  const forestBounds = forest.loops.map((loop, index) => boundsOf([...loop.smoothed, ...(forest.decals[index] ?? []).map(decal => decal.anchor)], PRIMITIVE_MARGIN));
  const fieldBounds = fields.map(field => boundsOf([...field.loops.flatMap(loop => loop.smoothed), ...field.decals.map(decal => decal.anchor)], PRIMITIVE_MARGIN));
  const chainBounds = roads.chains.map(chain => boundsOf(chain.centreline, PRIMITIVE_MARGIN));
  const fixedBounds = roads.fixedPoints.map(point => boundsOf([{ x: point.tx, y: point.ty }], PRIMITIVE_MARGIN));
  const plazaBounds = roads.plazaLoops.map(loop => boundsOf(loop.smoothed, PRIMITIVE_MARGIN));
  const forestDecalHashes = forest.decals.map(decals => hashNumbers(decals.flatMap(decal =>
    [decal.edgeKey, decal.variant, decal.flipX ? 1 : 0, decal.scale, decal.anchor.x, decal.anchor.y])));
  const fieldDecalHashes = fields.map(field => hashNumbers(field.decals.flatMap(decal =>
    [decal.kind === "furrow" ? 1 : 2, decal.axis === "x" ? 1 : 2, decal.length, decal.anchor.x, decal.anchor.y])));
  yield "bounds";

  const chunks: GroundChunkPlan[] = [];
  const zonePart = (box: BoundaryBounds, zoneIndexes: readonly number[], zoneChains: readonly number[]): number[] =>
    // Zones only enter the key where they are drawn, so a zone-free chunk keeps its key and picture.
    zoneIndexes.length + zoneChains.length === 0 ? [] : zoneChunkKey(zones, box, zoneIndexes, zoneChains);
  const scene = (): GroundBoundaryScene =>
    ({ width: state.width, height: state.height, columns, rows, roads, ribbons, zones, grounds: built, yardProps: yard, shore, forest, fields, chunks, buildMs: 0 });
  if (ground?.chunks !== undefined && ground.chunks.length === columns * rows) {
    // Zone-only edit: everything but the zone part of each chunk is the previous scene's.
    for (const previous of ground.chunks) {
      const box = chunkTileBounds(previous.cx, previous.cy);
      const zoneIndexes = zoneBounds.flatMap((bound, index) => overlaps(bound, box) ? [index] : []);
      const zoneChains = zoneChainBounds.flatMap((bound, index) => overlaps(bound, box) ? [index] : []);
      const arableBands = arableBandBounds.flatMap((bound, index) => overlaps(bound, box) ? [index] : []);
      chunks.push({ ...previous, zoneIndexes, zoneChains, arableBands, groundKey: hashNumbers([previous.groundBaseKey, ...zonePart(box, zoneIndexes, zoneChains)]) });
      if (previous.cx === columns - 1) yield "chunks";
    }
    return scene();
  }
  for (let cy = 0; cy < rows; cy += 1) {
    for (let cx = 0; cx < columns; cx += 1) {
      const box = chunkTileBounds(cx, cy);
      const hits = (bounds: readonly BoundaryBounds[]): number[] =>
        bounds.flatMap((bound, index) => overlaps(bound, box) ? [index] : []);
      const forestLoops = hits(forestBounds);
      const centre = { x: (box.left + box.right) / 2, y: (box.top + box.bottom) / 2 };
      // Beyond the map edge counts as forest (the mask's outside value), so a point enclosed by no loop is forest.
      const enclosing = 1 + forest.loops.filter((loop, index) => !forestLoops.includes(index) && pointInPolygon(centre, loop.smoothed)).length;
      const waterLoops = hits(waterBounds);
      // Beyond the map counts as land for water: a chunk inside water without an outline in it lies in an odd number of loops.
      const waterParity = shore.loops.filter((loop, index) => !waterLoops.includes(index) && pointInPolygon(centre, loop.smoothed)).length % 2 === 1;
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
        // Water (D3a): the outline, shallow decals and bridge lock of every shore loop the chunk draws.
        ...(waterLoops.length === 0 && !waterParity ? [] : [-10, waterParity ? 1 : 0, ...waterLoops.map(index => shore.loops[index]?.drawHash ?? 0)]),
        ...forestLoops.flatMap(index => [forest.loops[index]?.hash ?? 0, forestDecalHashes[index] ?? 0]),
        ...fieldIndexes.flatMap(index => [fields[index]?.hash ?? 0, fieldDecalHashes[index] ?? 0]),
        // Yards and aprons (C1d) enter with their full hashes, like zones; a chunk without any keeps its key.
        ...(yards.length + aprons.length === 0 ? [] : [-7, ...yards.map(index => built.yards[index]?.hash ?? 0), -8, ...aprons.map(index => built.aprons[index]?.hash ?? 0)]),
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
        cx, cy, forestLoops, forestParity: enclosing % 2 === 1, waterLoops, waterParity, fieldClusters: fieldIndexes, zoneIndexes, zoneChains, yards, aprons, beds, arableBands, chains, fixedPoints, plazas,
        groundKey, groundBaseKey, roadKey, hasRoads: chains.length + fixedPoints.length + plazas.length > 0,
      });
    }
    yield "chunks";
  }
  return scene();
}

function now(): number { return typeof performance === "undefined" ? 0 : performance.now(); }
