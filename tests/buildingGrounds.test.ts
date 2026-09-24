import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import type { GameState } from "../src/engine/engine.types";
import { buildGroundBoundaryScene, type GroundBoundaryScene } from "../src/render/groundBoundaryScene";
import { createGroundChunkCache } from "../src/render/groundChunkCache";
import { zoneBrushPreview } from "../src/render/zoneBrushOverlay";
import { gameReducer } from "../src/state/gameStore";
import { pointInPolygon, WALL_CLEARANCE, YARD_SUBCELLS } from "../src/world/boundary/buildingGrounds";
import { distanceToSegment, type BoundaryPoint } from "../src/world/boundary/boundaryGeometry";
import { buildingFootprint } from "../src/geometry/buildingFootprint";
import { seedGroundState } from "../scripts/boundaryFixtureStates";
import { c25ZonedState } from "../scripts/c25Board";
import { recordingCanvas } from "../scripts/recordingCanvas";

// C1d building ground: yards never overlap each other, the road envelope, water or the wall (gate 2); the contact
// shadow lives in the object pass and leaves with its building (gate 3); and the zone brush friction fixes (gate 4).

const scenes = (): readonly [string, GameState, GroundBoundaryScene][] => [seedGroundState(2), seedGroundState(3), c25ZonedState()]
  .map((state, index) => [["seed2", "seed3", "c25-zoned"][index] as string, state, buildGroundBoundaryScene(state)]);

const centreOf = (subcell: number, stride: number): BoundaryPoint => {
  const ai = subcell % stride; const aj = (subcell - ai) / stride;
  return { x: (ai + 0.5) / YARD_SUBCELLS - 0.5, y: (aj + 0.5) / YARD_SUBCELLS - 0.5 };
};
const insideRings = (point: BoundaryPoint, rings: readonly (readonly BoundaryPoint[])[]): boolean =>
  rings.reduce((inside, ring) => pointInPolygon(point, ring) ? !inside : inside, false);

test("Given the seed 2, seed 3 and zoned boards When yards are derived Then no two yards share ground and none reaches the road envelope, water, another footprint or across the wall", () => {
  for (const [name, state, scene] of scenes()) {
    const { yards } = scene.grounds;
    const half = scene.ribbons.width / 2;
    const wall = state.palisade === null ? null : state.palisade.polygon.map(point => ({ x: point.x - 0.5, y: point.y - 0.5 }));
    const owner = new Map<number, string>();
    for (const building of state.buildings) {
      const size = buildingFootprint(building);
      for (let dy = 0; dy < size.height; dy += 1) for (let dx = 0; dx < size.width; dx += 1) owner.set((building.ty + dy) * state.width + building.tx + dx, building.id);
    }
    assert.ok(yards.length > 40, `${name}: yards derived`);
    assert.ok(state.buildings.filter(building => building.kind === "wheat_farm").every(farm => !yards.some(yard => yard.buildingId === farm.id)), `${name}: fields have no yard`);
    const claimed = new Map<number, string>();
    for (const yard of yards) {
      const building = state.buildings.find(candidate => candidate.id === yard.buildingId);
      assert.ok(building !== undefined);
      const size = buildingFootprint(building);
      const centre = { x: building.tx + (size.width - 1) / 2, y: building.ty + (size.height - 1) / 2 };
      for (const subcell of yard.subcells) {
        assert.equal(claimed.get(subcell), undefined, `${name}: ${yard.buildingId} overlaps ${claimed.get(subcell)}`);
        claimed.set(subcell, yard.buildingId);
        const point = centreOf(subcell, yard.subcellStride);
        const tx = Math.round(point.x); const ty = Math.round(point.y);
        if (owner.get(ty * state.width + tx) === yard.buildingId) continue;
        const tile = state.tiles[ty * state.width + tx];
        assert.equal(tile?.terrain, "grass", `${name}: ${yard.buildingId} yard on ${tile?.terrain}`);
        assert.equal(owner.get(ty * state.width + tx), undefined, `${name}: ${yard.buildingId} yard on another footprint`);
        assert.ok(scene.grounds.roadDistance(point) >= half, `${name}: ${yard.buildingId} yard inside the road envelope at ${point.x},${point.y}`);
        if (wall !== null) {
          assert.equal(pointInPolygon(point, wall), pointInPolygon(centre, wall), `${name}: ${yard.buildingId} yard crosses the wall`);
          let clearance = Infinity;
          for (let index = 1; index < wall.length; index += 1) clearance = Math.min(clearance, distanceToSegment(point, wall[index - 1]!, wall[index]!));
          assert.ok(clearance >= WALL_CLEARANCE, `${name}: ${yard.buildingId} yard within ${clearance} of the wall`);
        }
      }
    }
    // The drawn outlines are the subcell sets: every subcell centre is inside its own yard's rings and no other's.
    const byId = new Map(yards.map(yard => [yard.buildingId, yard]));
    for (const [subcell, id] of claimed) {
      const yard = byId.get(id)!; const point = centreOf(subcell, yard.subcellStride);
      assert.ok(insideRings(point, yard.rings), `${name}: ${id} outline misses its own subcell`);
      for (const other of yards) {
        if (other === yard || point.x < other.bounds.left || point.x > other.bounds.right || point.y < other.bounds.top || point.y > other.bounds.bottom) continue;
        assert.ok(!insideRings(point, other.rings), `${name}: ${other.buildingId} outline covers ${id}'s subcell`);
      }
    }
  }
});

test("Given the boards When aprons are derived Then each apron reaches the ribbon from its frontage, keeps one winding, and no shoulder tuft stands on it", () => {
  for (const [name, , scene] of scenes()) {
    const { aprons } = scene.grounds;
    assert.ok(aprons.length > 40, `${name}: aprons derived`);
    const winding = (points: readonly BoundaryPoint[]): number => points.reduce((sum, a, index) => {
      const b = points[(index + 1) % points.length]!; return sum + a.x * b.y - b.x * a.y;
    }, 0);
    for (const apron of aprons) {
      assert.ok(winding(apron.polygon) > 0, `${name}: ${apron.buildingId} apron winding`);
      apron.ribbonGaps.forEach((gap, index) => {
        if (gap === null) return;
        // The frontage ray is covered from the footprint edge to the ribbon's visible edge.
        assert.ok((apron.depths[index] ?? 0) >= gap, `${name}: ${apron.buildingId} apron stops ${gap - (apron.depths[index] ?? 0)} short of the ribbon`);
        const edge = apron.edge[index]!;
        for (let t = 0.02; t <= gap; t += 1 / 32) {
          assert.ok(pointInPolygon({ x: edge.x + apron.normal.x * t, y: edge.y + apron.normal.y * t }, apron.polygon), `${name}: ${apron.buildingId} ray leaves its apron at ${t}`);
        }
      });
    }
    const tufts = [...scene.ribbons.shoulders.flat(), ...scene.ribbons.capDecals.filter(decal => decal !== null)];
    for (const tuft of tufts) {
      assert.ok(!aprons.some(apron => pointInPolygon(tuft!.anchor, apron.polygon)), `${name}: a shoulder tuft stands on an apron`);
    }
  }
});

test("Given the seed 2 town When the scene is built from tiles in reverse order Then yards and aprons are identical", () => {
  const state = seedGroundState(2);
  const strip = (scene: GroundBoundaryScene) => JSON.stringify({ yards: scene.grounds.yards, aprons: scene.grounds.aprons });
  assert.equal(strip(buildGroundBoundaryScene(state, true)), strip(buildGroundBoundaryScene(state, false)));
});

test("Given a drawn frame When a house is demolished Then its contact shadow is gone the same frame and no ground chunk ever held one", async () => {
  const { BOUNDARY_ASSETS } = await import("../src/render/boundaryAssetManifest");
  const { setBoundaryAssetsForTest } = await import("../src/render/boundaryAssets");
  const { setGroundChunkCacheFactoryForTest } = await import("../src/render/drawTerrainBoundaryV2");
  const { setBoundaryV2Enabled } = await import("../src/render/renderBoundaryFlag");
  const { drawCurrentCanvasFrame } = await import("../src/render/canvasRuntimeFrame");
  const { createConstructionCompletionTracker } = await import("../src/render/constructionCompletionEffects");
  const { buildingContactEllipse } = await import("../src/render/buildingContactShadow");
  setBoundaryAssetsForTest(Object.fromEntries(BOUNDARY_ASSETS.map(asset => [asset.key,
    { label: asset.key, width: asset.width, height: asset.height, naturalWidth: asset.width, naturalHeight: asset.height } as unknown as HTMLImageElement])));
  const rasters: ReturnType<typeof recordingCanvas>[] = [];
  setGroundChunkCacheFactoryForTest(() => createGroundChunkCache(((w: number, h: number) => { const made = recordingCanvas(w, h); rasters.push(made); return made; }) as unknown as Parameters<typeof createGroundChunkCache>[0]));
  setBoundaryV2Enabled(true);
  const camera = { zoom: 1, panX: 640 - (44 - 38) * 32, panY: 400 - (44 + 38) * 16 };
  const draw = (context: CanvasRenderingContext2D, state: GameState): void => drawCurrentCanvasFrame({
    canvas: { getBoundingClientRect: () => ({ width: 1280, height: 800 }) } as unknown as HTMLCanvasElement, context,
    refs: { cameraRef: { current: camera }, hoverRef: { current: null }, feedbackRef: { current: null },
      dragRef: { current: { mode: "none", startCanvasPoint: null, startCamera: null, lastCanvasPoint: null, roadStart: null, moved: false } },
      pixelRatioRef: { current: 1 }, completionTracker: createConstructionCompletionTracker() },
    state, selectedTool: null, overlayMode: "none", selection: null, previousRenderState: state, interpolationAlpha: () => 1, highlightedHouseIds: [],
  });
  const ellipseOf = (ops: readonly string[], building: GameState["buildings"][number]): boolean => {
    const shape = buildingContactEllipse(building)!;
    const round = (value: number) => String(Math.round(value * 1000) / 1000);
    return ops.includes(`ellipse(${[shape.x, shape.y, shape.radiusX, shape.radiusY, 0, 0, Math.PI * 2].map(round).join(",")})`);
  };
  const before = seedGroundState(2);
  const house = before.buildings.find(building => building.kind === "house" && building.tx === 44 && building.ty === 37)!;
  assert.ok(house !== undefined);
  const live = recordingCanvas(1280, 800);
  draw(live.context, before);
  assert.ok(ellipseOf(live.canvas.ops, house), "the house's contact shadow is drawn in the frame");
  assert.ok(rasters.every(raster => !ellipseOf(raster.canvas.ops, house)), "no chunk raster holds it");
  const after = gameReducer(before, { type: "demolish_house", buildingId: house.id } as Parameters<typeof gameReducer>[1]);
  assert.ok(!after.buildings.some(building => building.id === house.id), "demolished");
  live.canvas.ops.length = 0;
  draw(live.context, after);
  assert.ok(!ellipseOf(live.canvas.ops, house), "gone the very next frame");
  assert.ok(!buildGroundBoundaryScene(after).grounds.yards.some(yard => yard.buildingId === house.id), "and so is its yard");
  setGroundChunkCacheFactoryForTest(null);
});

test("Given an armed zone tool When the pointer only hovers Then no cells or prediction text show until a stroke starts", () => {
  const state = seedGroundState(2);
  const tool = { target: "burgage" as const, radius: 2, polygon: false };
  const idle = zoneBrushPreview(state, { tool, gesture: null, hover: { x: 36.5, y: 41.5 } });
  assert.equal(idle.cells.length, 0); assert.equal(idle.lines.length, 0);
  const drag = zoneBrushPreview(state, { tool, gesture: { mode: "brush", points: [{ x: 36.5, y: 41.5 }, { x: 37.5, y: 42.5 }] }, hover: { x: 37.5, y: 42.5 } });
  assert.ok(drag.cells.length > 0); assert.ok(drag.lines.length > 0);
});

test("Given an arable stroke away from roads When it is previewed Then the cells no farm could reach a road from are counted in a prediction line", () => {
  const state = seedGroundState(2);
  const tool = { target: "arable" as const, radius: 1, polygon: false };
  // Open ground west of the town, far from any road, and a stroke that touches the curved road outside the wall.
  const far = zoneBrushPreview(state, { tool, gesture: { mode: "brush", points: [{ x: 20.5, y: 44.5 }, { x: 21.5, y: 45.5 }] }, hover: null });
  assert.ok(far.noRoad.size > 0 && far.noRoad.size === far.cells.length, "every far cell lacks road access");
  assert.ok(far.lines.some(line => line.id === "zone-road-access" && line.severity === "warn" && line.text.includes(String(far.noRoad.size))));
  const near = zoneBrushPreview(state, { tool, gesture: { mode: "brush", points: [{ x: 35.5, y: 41.5 }, { x: 36.5, y: 42.5 }] }, hover: null });
  assert.ok(near.noRoad.size < near.cells.length, "cells next to the road have access");
});

test("Given the zone brush When the wheel turns Then it zooms: the brush runtime no longer handles the wheel", async () => {
  const runtime = await readFile(new URL("../src/render/useGameCanvasRuntime.ts", import.meta.url), "utf8");
  const brush = await readFile(new URL("../src/render/canvasZoneBrushRuntime.ts", import.meta.url), "utf8");
  assert.ok(!/zoneWheel/.test(runtime) && !/export function zoneWheel/.test(brush));
});

test("Given a held chunk raster When only its zones changed in a live frame past the budget Then the held raster stands in and the next frames catch up", () => {
  const cache = createGroundChunkCache(((w: number, h: number) => recordingCanvas(w, h)) as unknown as Parameters<typeof createGroundChunkCache>[0]);
  const diamond = [{ x: 0, y: -64 }, { x: 128, y: 0 }, { x: 0, y: 64 }, { x: -128, y: 0 }] as const;
  const target = recordingCanvas(512, 512).context;
  let painted = 0;
  const paint = (): void => { painted += 1; };
  cache.beginFrame();
  cache.draw(target, { id: "ground:0,0", contentKey: "a|zones1", deferKey: "a", scale: 1, diamond }, paint);
  assert.equal(painted, 1);
  // A zone-only change in a frame that is already 20 ms old: shown from the held raster, not painted.
  cache.beginFrame(performance.now() - 20);
  cache.draw(target, { id: "ground:0,0", contentKey: "a|zones2", deferKey: "a", scale: 1, diamond }, paint);
  assert.equal(painted, 1); assert.equal(cache.pending(), 1);
  // A different ground base (roads, buildings, fields) is never deferred.
  cache.draw(target, { id: "ground:1,0", contentKey: "b", deferKey: "b", scale: 1, diamond }, paint);
  cache.beginFrame(performance.now() - 20);
  cache.draw(target, { id: "ground:1,0", contentKey: "c", deferKey: "c", scale: 1, diamond }, paint);
  assert.equal(painted, 3);
  // Outside live frames (no frame start: tests, tools) nothing waits.
  cache.beginFrame();
  cache.draw(target, { id: "ground:0,0", contentKey: "a|zones2", deferKey: "a", scale: 1, diamond }, paint);
  assert.equal(painted, 4); assert.equal(cache.pending(), 0);
  // A chunk that keeps waiting is re-rastered after MAX_DEFERRED_FRAMES frames even when every frame is late.
  for (let frame = 0; frame < 5; frame += 1) {
    cache.beginFrame(performance.now() - 20);
    cache.draw(target, { id: "ground:0,0", contentKey: "a|zones3", deferKey: "a", scale: 1, diamond }, paint);
  }
  assert.equal(painted, 5, "re-rastered once within the frames it waited");
});
