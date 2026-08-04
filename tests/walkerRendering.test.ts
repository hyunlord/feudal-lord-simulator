import assert from "node:assert/strict";
import test from "node:test";

import type { Walker } from "../src/agents/walker.types";
import { PALETTE } from "../src/content/palette";
import type { GameState } from "../src/engine/engine.types";
import { cargoColor, drawWalkers } from "../src/render/drawWalkers";

interface MockContext {
  fillStyle: string;
  lineCap: CanvasLineCap;
  lineJoin: CanvasLineJoin;
  lineWidth: number;
  strokeStyle: string;
  readonly calls: string[];
  beginPath(): void;
  closePath(): void;
  fill(): void;
  fillRect(x: number, y: number, w: number, h: number): void;
  lineTo(x: number, y: number): void;
  moveTo(x: number, y: number): void;
  stroke(): void;
  strokeRect(x: number, y: number, w: number, h: number): void;
}

function createMockContext(): MockContext {
  const calls: string[] = [];
  return {
    fillStyle: "",
    lineCap: "butt",
    lineJoin: "miter",
    lineWidth: 0,
    strokeStyle: "",
    calls,
    beginPath: () => calls.push("beginPath"),
    closePath: () => calls.push("closePath"),
    fill: () => calls.push("fill"),
    fillRect: (x, y, w, h) => calls.push(`fillRect:${x},${y},${w},${h}`),
    lineTo: (x, y) => calls.push(`lineTo:${x},${y}`),
    moveTo: (x, y) => calls.push(`moveTo:${x},${y}`),
    stroke: () => calls.push("stroke"),
    strokeRect: (x, y, w, h) => calls.push(`strokeRect:${x},${y},${w},${h}`),
  };
}

const stateBase: Omit<GameState, "walkers"> = {
  width: 8,
  height: 8,
  tiles: [],
  tick: 30,
  seed: 1,
  treasuryTimber: 0,
  buildings: [],
  houses: [],
  population: 0,
  idleWorkers: 0,
  roadRevision: 0,
  pathCache: {},
};

function carter(input: Partial<Walker> = {}): Walker {
  return {
    id: "carter-a",
    kind: "carter",
    homeBuildingId: "logging-camp",
    destinationBuildingId: "storehouse",
    mission: "deliver",
    phase: "outbound",
    position: { tx: 2.5, ty: 1 },
    path: [{ tx: 2, ty: 1 }, { tx: 3, ty: 1 }],
    pathIndex: 0,
    previousTile: null,
    cargo: { resource: "logs", amount: 4 },
    spawnedTick: 10,
    reservation: {
      destinationBuildingId: "storehouse",
      resource: "logs",
      amount: 4,
      sourceStockClaim: null,
      homeCapacityClaim: null,
    },
    cancellation: null,
    ...input,
  } as Walker;
}

function distributor(input: Partial<Walker> = {}): Walker {
  return {
    id: "distributor-a",
    kind: "distributor",
    homeBuildingId: "granary",
    position: { tx: 1, ty: 1 },
    path: [{ tx: 1, ty: 1 }],
    pathIndex: 0,
    previousTile: null,
    cargo: { resource: "bread", amount: 3 },
    spawnedTick: 20,
    phase: "roaming",
    junctionVisits: 0,
    tilesTravelled: 0,
    priorTile: null,
    ...input,
  } as Walker;
}

test("cargo colour mapping stays tied to canonical palette tokens", () => {
  assert.equal(cargoColor("wheat"), PALETTE.gold);
  assert.equal(cargoColor("bread"), PALETTE.earth);
  assert.equal(cargoColor("logs"), PALETTE.forest);
  assert.equal(cargoColor("timber"), PALETTE.earthDark);
});

test("drawWalkers renders cargo squares at fractional tile screen positions", () => {
  const context = createMockContext();

  drawWalkers(context as unknown as CanvasRenderingContext2D, {
    ...stateBase,
    walkers: [carter(), distributor()],
  });

  assert.ok(context.calls.includes("fillRect:41,49,14,6"));
  assert.ok(context.calls.includes("fillRect:44,39,8,8"));
  assert.ok(context.calls.includes("fillRect:-4,15,8,8"));
  assert.ok(context.calls.includes("stroke"));
});

test("walker outlines stay one screen pixel across camera zoom", () => {
  const context = createMockContext();

  drawWalkers(
    context as unknown as CanvasRenderingContext2D,
    { ...stateBase, walkers: [carter()] },
    2,
  );

  assert.equal(context.lineWidth, 0.5);
});
