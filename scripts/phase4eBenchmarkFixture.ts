import type { Walker } from "../src/agents/walker.types";
import type { BuildingKind } from "../src/content/buildingConfig";
import type { Building } from "../src/economy/economy.types";
import type { GameState } from "../src/engine/engine.types";
import { advanceFrame } from "../src/engine/frameClock";
import { buildObjectRenderItems } from "../src/render/objectRenderOrder";
import { renderFrame, visibleTilesInDrawOrder, computeVisibleTileRange } from "../src/render/renderer";
import { preloadWorldAssets } from "../src/render/worldAssets";
import type { Tile } from "../src/world/world.types";

export type FrameSummary = {
  readonly averageMs: number;
  readonly p95Ms: number;
  readonly worstMs: number;
};

export type BenchmarkEntityCounts = {
  readonly buildings: number;
  readonly roads: number;
  readonly trees: number;
  readonly groundCover: number;
  readonly walkers: number;
};

export type Phase4eBenchmarkResult = FrameSummary & {
  readonly competition: "1x" | "5x";
  readonly warmupFrames: 20;
  readonly measuredFrames: 120;
  readonly viewport: { readonly width: 1280; readonly height: 720 };
  readonly entities: BenchmarkEntityCounts;
  readonly overBudgetFrames: number;
  readonly simulation: FrameSummary;
  readonly render: FrameSummary;
};

const BUILDING_KINDS = [
  "house",
  "well",
  "storehouse",
  "granary",
  "wheat_farm",
  "mill",
  "logging_camp",
  "sawmill",
] as const satisfies readonly BuildingKind[];
const VIEWPORT = { width: 1280, height: 720 } as const;
const EMPTY_PREVIEW = {
  tool: "house",
  tile: null,
  footprint: [],
  roadPath: [],
  ok: true,
  reason: null,
  cursor: null,
} as const;

export function summarizeFrameTimes(frameTimes: readonly number[]): FrameSummary {
  if (frameTimes.length === 0) {
    return { averageMs: 0, p95Ms: 0, worstMs: 0 };
  }
  const sorted = [...frameTimes].sort((left, right) => left - right);
  const total = sorted.reduce((sum, value) => sum + value, 0);
  const p95Index = Math.max(0, Math.ceil(sorted.length * 0.95) - 1);
  return {
    averageMs: roundMilliseconds(total / sorted.length),
    p95Ms: roundMilliseconds(sorted[p95Index] ?? 0),
    worstMs: roundMilliseconds(sorted[sorted.length - 1] ?? 0),
  };
}

export function countFramesOverBudget(
  frameTimes: readonly number[],
  budgetMs: number,
): number {
  return frameTimes.filter((frameTime) => frameTime > budgetMs).length;
}

export async function runPhase4eRenderBenchmark(
  competition: "1x" | "5x",
): Promise<Phase4eBenchmarkResult> {
  await preloadWorldAssets();
  const canvas = document.createElement("canvas");
  canvas.width = VIEWPORT.width;
  canvas.height = VIEWPORT.height;
  const context = canvas.getContext("2d");
  if (context === null) {
    throw new Error("Phase 4E benchmark requires a Canvas 2D context");
  }
  const camera = { zoom: 1, panX: 640, panY: -664 } as const;
  let state = benchmarkState();
  const initialEntityCounts = benchmarkEntityCounts(state, camera);
  const ticksPerFrame = competition === "5x" ? 5 : 1;
  const advanceSimulation = (): void => {
    state = advanceFrame(state, ticksPerFrame);
  };
  const render = (): void => {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, VIEWPORT.width, VIEWPORT.height);
    context.save();
    context.translate(camera.panX, camera.panY);
    context.scale(camera.zoom, camera.zoom);
    renderFrame({ context, state, camera, viewport: VIEWPORT, preview: EMPTY_PREVIEW });
    context.restore();
  };
  for (let frame = 0; frame < 20; frame += 1) {
    advanceSimulation();
    render();
  }
  const frameTimes: number[] = [];
  const simulationTimes: number[] = [];
  const renderTimes: number[] = [];
  for (let frame = 0; frame < 120; frame += 1) {
    const startedAt = performance.now();
    advanceSimulation();
    const simulationFinishedAt = performance.now();
    render();
    const renderFinishedAt = performance.now();
    simulationTimes.push(simulationFinishedAt - startedAt);
    renderTimes.push(renderFinishedAt - simulationFinishedAt);
    frameTimes.push(renderFinishedAt - startedAt);
  }
  return {
    competition,
    warmupFrames: 20,
    measuredFrames: 120,
    viewport: VIEWPORT,
    entities: initialEntityCounts,
    overBudgetFrames: countFramesOverBudget(frameTimes, 12),
    simulation: summarizeFrameTimes(simulationTimes),
    render: summarizeFrameTimes(renderTimes),
    ...summarizeFrameTimes(frameTimes),
  };
}

function benchmarkState(): GameState {
  const buildings = benchmarkBuildings();
  const buildingByTile = new Map(buildings.map((building) => [`${building.tx}:${building.ty}`, building.id]));
  const tiles: Tile[] = [];
  for (let ty = 0; ty < 64; ty += 1) {
    for (let tx = 0; tx < 64; tx += 1) {
      const hasRoad = tx === 32 || ty === 32;
      const isForest = !hasRoad && (tx * 17 + ty * 31) % 6 === 0;
      tiles.push({
        tx,
        ty,
        terrain: isForest ? "forest" : "grass",
        buildingId: buildingByTile.get(`${tx}:${ty}`) ?? null,
        hasRoad,
      });
    }
  }
  return {
    tick: 0,
    seed: 1,
    tiles,
    width: 64,
    height: 64,
    buildings,
    constructionSites: [],
    wallTick: 0,
    nextConstructionOrdinal: 1,
    houses: [],
    walkers: benchmarkWalkers(),
    population: 0,
    idleWorkers: 0,
    treasuryTimber: 0,
    roadRevision: 0,
    pathCache: {},
  };
}

function benchmarkBuildings(): Building[] {
  return Array.from({ length: 40 }, (_, index) => ({
    id: `benchmark-building-${index}`,
    kind: BUILDING_KINDS[index % BUILDING_KINDS.length] ?? "house",
    tx: 18 + (index % 8) * 4,
    ty: 20 + Math.floor(index / 8) * 4,
    workers: 0,
    inventory: {},
    reserved: {},
    stockReserved: {},
    productionProgress: 0,
  }));
}

function benchmarkWalkers(): Walker[] {
  return Array.from({ length: 20 }, (_, index) => {
    const tx = 25 + (index % 10) * 0.6;
    const ty = 25 + Math.floor(index / 10) * 2;
    return {
      id: `benchmark-walker-${index}`,
      kind: "distributor",
      homeBuildingId: "benchmark-building-0",
      position: { tx, ty },
      path: [{ tx, ty }],
      pathIndex: 0,
      previousTile: null,
      cargo: null,
      spawnedTick: 0,
      phase: "roaming",
      junctionVisits: 0,
      tilesTravelled: 0,
      priorTile: null,
    };
  });
}

function benchmarkEntityCounts(
  state: GameState,
  camera: { readonly zoom: number; readonly panX: number; readonly panY: number },
): BenchmarkEntityCounts {
  const range = computeVisibleTileRange({ camera, viewport: VIEWPORT, world: state });
  const tiles = visibleTilesInDrawOrder({ grid: state, range });
  const items = buildObjectRenderItems({
    tiles,
    worldTiles: state.tiles,
    buildings: state.buildings,
    walkers: state.walkers,
    range,
    seed: state.seed,
  });
  return {
    buildings: state.buildings.length,
    roads: state.tiles.filter((tile) => tile.hasRoad).length,
    trees: items.filter((item) => item.kind === "tree").length,
    groundCover: items.filter((item) => item.kind === "groundCover").length,
    walkers: state.walkers.length,
  };
}

function roundMilliseconds(value: number): number {
  return Math.round(value * 1_000) / 1_000;
}
