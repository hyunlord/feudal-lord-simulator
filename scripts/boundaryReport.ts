// D1a gate tables measured in Node: tolerance per fixture (gate 1), scene determinism under reversed tile order
// (gate 2, data level), and chunk freshness after a road build/removal and a farm completion (gate 4).
// Usage: npx tsx scripts/boundaryReport.ts > docs/verification/d1a/gates-node.json
import { createHash } from "node:crypto";
import type { GameState } from "../src/engine/engine.types";
import { completeEligibleConstruction } from "../src/engine/constructionLifecycle";
import { placeBuilding, placeRoadLine, removeRoad } from "../src/engine/gameActions";
import { BOUNDARY_ASSETS } from "../src/render/boundaryAssetManifest";
import { setBoundaryAssetsForTest } from "../src/render/boundaryAssets";
import { drawCurrentCanvasFrame } from "../src/render/canvasRuntimeFrame";
import { createConstructionCompletionTracker } from "../src/render/constructionCompletionEffects";
import { groundChunkCacheFor, setGroundChunkCacheFactoryForTest } from "../src/render/drawTerrainBoundaryV2";
import { buildGroundBoundaryScene } from "../src/render/groundBoundaryScene";
import { createGroundChunkCache } from "../src/render/groundChunkCache";
import { setBoundaryV2Enabled } from "../src/render/renderBoundaryFlag";
import { outlineTolerance, roadCentrelineTolerance } from "../src/world/boundary/boundaryTolerance";
import { BOUNDARY_FIXTURES, fixedSceneState } from "./boundaryFixtureStates";
import { recordingCanvas, type Recording } from "./recordingCanvas";

const round = (value: number): number => Math.round(value * 1000) / 1000;
const tolerance = BOUNDARY_FIXTURES.map(fixture => {
  const state = fixture.state();
  const scene = buildGroundBoundaryScene(state);
  const reversed = buildGroundBoundaryScene(state, true);
  const road = roadCentrelineTolerance(scene.roads, 0.25);
  const forest = outlineTolerance(scene.forest.loops, 0.35);
  const fields = outlineTolerance(scene.fields.flatMap(field => field.loops), 0.35);
  const strip = (value: typeof scene) => JSON.stringify({ ...value, buildMs: 0 });
  return {
    fixture: fixture.name,
    road: { samples: road.samples, maxOutsideRoadCells: round(road.max), over025: road.over, maxToCellCentreChain: round(road.maxToCentreChain),
      chains: scene.roads.chains.length, fixedPoints: scene.roads.fixedPoints.length, plazas: scene.roads.plazaLoops.length },
    forest: { samples: forest.samples, maxToCellEdge: round(forest.max), over035: forest.over, loops: scene.forest.loops.length,
      decals: scene.forest.decals.reduce((sum, list) => sum + list.length, 0) },
    fields: { samples: fields.samples, maxToCellEdge: round(fields.max), over035: fields.over, clusters: scene.fields.length },
    reversedInputIdentical: strip(scene) === strip(reversed),
    sceneBuildMs: round(scene.buildMs),
  };
});

setBoundaryAssetsForTest(Object.fromEntries(BOUNDARY_ASSETS.map(asset => [asset.key,
  { label: asset.key, width: asset.width, height: asset.height, naturalWidth: asset.width, naturalHeight: asset.height } as unknown as HTMLImageElement])));
setGroundChunkCacheFactoryForTest(() => createGroundChunkCache(((width: number, height: number) => recordingCanvas(width, height)) as unknown as Parameters<typeof createGroundChunkCache>[0]));
setBoundaryV2Enabled(true);
const CENTRE = [42, 56] as const;
const draw = (context: CanvasRenderingContext2D, state: GameState): void => drawCurrentCanvasFrame({
  canvas: { getBoundingClientRect: () => ({ width: 1280, height: 800 }) } as unknown as HTMLCanvasElement,
  context,
  refs: {
    cameraRef: { current: { zoom: 1, panX: 640 - (CENTRE[0] - CENTRE[1]) * 32, panY: 400 - (CENTRE[0] + CENTRE[1]) * 16 } },
    hoverRef: { current: null }, feedbackRef: { current: null },
    dragRef: { current: { mode: "none", startCanvasPoint: null, startCamera: null, lastCanvasPoint: null, roadStart: null, moved: false } },
    pixelRatioRef: { current: 1 }, completionTracker: createConstructionCompletionTracker(),
  },
  state, selectedTool: null, overlayMode: "none", selection: null, previousRenderState: state, interpolationAlpha: () => 1, highlightedHouseIds: [],
});
const ids = (state: GameState): string[] => {
  const list: string[] = [];
  for (let cy = 0; cy < state.height / 8; cy += 1) for (let cx = 0; cx < state.width / 8; cx += 1) list.push(`ground:${cx},${cy}`, `roads:${cx},${cy}`);
  return list;
};
const held = (context: CanvasRenderingContext2D, state: GameState): Map<string, string> => new Map(ids(state).flatMap(id => {
  const entry = groundChunkCacheFor(context).entry(id);
  return entry === null ? [] : [[id, `${entry.contentKey}|${createHash("sha256").update((entry.raster.canvas as unknown as Recording["canvas"]).ops.join("\n")).digest("hex")}`]];
}));
const stale = (live: CanvasRenderingContext2D, state: GameState): string[] => {
  const fresh = recordingCanvas(1280, 800).context;
  draw(fresh, state);
  const expected = held(fresh, state); const current = held(live, state);
  return [...expected].filter(([id, value]) => current.get(id) !== value).map(([id]) => id);
};

const live = recordingCanvas(1280, 800).context;
let state = fixedSceneState();
draw(live, state);
const cache = groundChunkCacheFor(live);
const freshness: unknown[] = [];
const steps: [string, (current: GameState) => GameState][] = [
  ["redraw, nothing changed", current => current],
  ["build road (43,57)-(44,57)", current => placeRoadLine(current, { tx: 43, ty: 57 }, { tx: 44, ty: 57 })],
  ["remove road (39,61)", current => removeRoad(current, { tx: 39, ty: 61 })],
  ["place wheat farm at (42,51)", current => placeBuilding(current, "wheat_farm", { tx: 42, ty: 51 })],
  ["complete that farm", current => completeEligibleConstruction({ ...current, wallTick: current.wallTick + 120,
    constructionSites: current.constructionSites.map(site => ({ ...site, delivered: { ...site.required }, builderTicks: site.requiredBuilderTicks })) })],
];
for (const [label, change] of steps) {
  const next = change(state);
  const staleBeforeRedraw = stale(live, next).length;
  const before = new Map(held(live, next));
  state = next;
  draw(live, state);
  const after = held(live, state);
  freshness.push({ step: label, chunksChangedByTheStep: staleBeforeRedraw,
    reRasteredInSameFrame: [...after].filter(([id, value]) => before.get(id) !== value).map(([id]) => id),
    rastersThisFrame: cache.stats().lastFrameRasters, staleAfterRedraw: stale(live, state).length });
}
setBoundaryV2Enabled(false);
process.stdout.write(`${JSON.stringify({ tolerance, freshness, cache: cache.stats() }, null, 2)}\n`);
