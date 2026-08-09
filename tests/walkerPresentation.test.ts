import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import type { BuilderWalker, CarterWalker, DistributorWalker } from "../src/agents/walker.types";
import {
  WALKER_PRESENTATION_DIRECTIONS,
  WALKER_PRESENTATION_GAIT_FRAMES,
  WALKER_PRESENTATION_ROLES,
  walkerPresentationFor,
} from "../src/render/walkerPresentation";
import { drawProceduralWalkerSprite } from "../src/render/walkerProceduralSprite";

const carterBase: CarterWalker = {
  id: "carter-a",
  kind: "carter",
  homeBuildingId: "logging-camp",
  destination: { kind: "building", buildingId: "storehouse" },
  mission: "deliver",
  phase: "outbound",
  position: { tx: 2.25, ty: 2 },
  path: [{ tx: 2, ty: 2 }, { tx: 3, ty: 2 }],
  pathIndex: 0,
  previousTile: null,
  cargo: { resource: "logs", amount: 4 },
  spawnedTick: 10,
  reservation: {
    destination: { kind: "building", buildingId: "storehouse" },
    resource: "logs",
    amount: 4,
    sourceStockClaim: null,
    homeCapacityClaim: null,
  },
  cancellation: null,
};

function carter(input: Partial<CarterWalker> = {}): CarterWalker {
  return { ...carterBase, ...input };
}

test("walkerPresentationFor derives presentation roles from real walker cargo semantics", () => {
  // Given
  const distributor: DistributorWalker = {
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
  };
  const builder: BuilderWalker = {
    id: "builder-a",
    kind: "builder",
    homeBuildingId: "site-a",
    cargo: null,
    position: { tx: 1, ty: 1 },
    path: [],
    pathIndex: 0,
    previousTile: null,
    spawnedTick: 0,
    siteId: "site-a",
    slotIndex: 1,
  };
  const farmer = carter({
    homeBuildingId: "wheat-farm",
    cargo: { resource: "wheat", amount: 6 },
    reservation: {
      destination: { kind: "building", buildingId: "granary" },
      resource: "wheat",
      amount: 6,
      sourceStockClaim: { kind: "building", buildingId: "wheat-farm", resource: "wheat", amount: 6 },
      homeCapacityClaim: null,
    },
  });
  const logger = carter({
    cargo: { resource: "logs", amount: 6 },
    reservation: {
      destination: { kind: "building", buildingId: "storehouse" },
      resource: "logs",
      amount: 6,
      sourceStockClaim: { kind: "building", buildingId: "logging-camp", resource: "logs", amount: 6 },
      homeCapacityClaim: null,
    },
  });
  const transport = carter({
    cargo: { resource: "stone", amount: 2 },
    reservation: {
      destination: { kind: "building", buildingId: "storehouse" },
      resource: "stone",
      amount: 2,
      sourceStockClaim: null,
      homeCapacityClaim: null,
    },
    path: [{ tx: 1, ty: 1 }],
    pathIndex: 0,
    position: { tx: 1, ty: 1 },
    previousTile: null,
  });

  // When
  const roles = [
    walkerPresentationFor(farmer).role,
    walkerPresentationFor(logger).role,
    walkerPresentationFor(transport).role,
    walkerPresentationFor(distributor).role,
    walkerPresentationFor(builder).role,
  ];

  // Then
  assert.deepEqual(roles, ["farmer", "logger", "carter", "farmer", "builder"]);
});

test("walkerPresentationFor derives the four isometric directions from route motion", () => {
  // Given
  const movingEast = carter({
    position: { tx: 2.25, ty: 2 },
    path: [{ tx: 2, ty: 2 }, { tx: 3, ty: 2 }],
  });
  const movingSouth = carter({
    position: { tx: 2, ty: 2.25 },
    path: [{ tx: 2, ty: 2 }, { tx: 2, ty: 3 }],
  });
  const movingWest = carter({
    position: { tx: 2.75, ty: 2 },
    path: [{ tx: 3, ty: 2 }, { tx: 2, ty: 2 }],
  });
  const movingNorth = carter({
    position: { tx: 2, ty: 2.75 },
    path: [{ tx: 2, ty: 3 }, { tx: 2, ty: 2 }],
  });

  // When
  const directions = [
    walkerPresentationFor(movingEast).direction,
    walkerPresentationFor(movingSouth).direction,
    walkerPresentationFor(movingWest).direction,
    walkerPresentationFor(movingNorth).direction,
  ];

  // Then
  assert.deepEqual(directions, ["SE", "SW", "NW", "NE"]);
});

test("walkerPresentationFor exposes exactly two fallback gait frames from fractional motion", () => {
  // Given
  const quarterSteps = [0, 0.25, 0.5, 0.75].map((offset) =>
    carter({
      position: { tx: 2 + offset, ty: 2 },
      path: [{ tx: 2, ty: 2 }, { tx: 3, ty: 2 }],
    }),
  );

  // When
  const frames = quarterSteps.map((step) => walkerPresentationFor(step).gaitFrame);

  // Then
  assert.deepEqual([...new Set(frames)].sort(), [0, 1]);
  assert.deepEqual(frames, [0, 0, 1, 1]);
});

test("walker procedural presentation contract exposes four roles, four directions, and two gait frames", () => {
  // Given / When
  const contract = {
    roles: WALKER_PRESENTATION_ROLES,
    directions: WALKER_PRESENTATION_DIRECTIONS,
    gaitFrames: WALKER_PRESENTATION_GAIT_FRAMES,
  };

  // Then
  assert.deepEqual(contract.roles, ["builder", "farmer", "logger", "carter"]);
  assert.deepEqual(contract.directions, ["NE", "SE", "SW", "NW"]);
  assert.deepEqual(contract.gaitFrames, [0, 1]);
});

test("drawProceduralWalkerSprite gives each planned role an observable silhouette cue", () => {
  // Given
  const traces = WALKER_PRESENTATION_ROLES.map((role) => {
    const context = recordingCanvasContext();

    // When
    drawProceduralWalkerSprite(context as unknown as CanvasRenderingContext2D, {
      footX: 40,
      footY: 60,
      scale: 1,
      zoom: 1,
      presentation: { role, direction: "SE", gaitFrame: 0 },
    });

    return context.calls.join("|");
  });

  // Then
  assert.equal(new Set(traces).size, WALKER_PRESENTATION_ROLES.length);
});

test("walker presentation switches keep compiler-backed exhaustive defaults", () => {
  // Given
  const sources = [
    readFileSync("src/render/walkerPresentation.ts", "utf8"),
    readFileSync("src/render/walkerProceduralSprite.ts", "utf8"),
  ];

  // When
  const assertNeverDefaults = sources.flatMap((source) =>
    [...source.matchAll(/default:\s*\n\s*return assertNever\(/g)],
  );

  // Then
  assert.equal(assertNeverDefaults.length, 6);
});

function recordingCanvasContext(): {
  fillStyle: string;
  lineWidth: number;
  strokeStyle: string;
  lineCap: CanvasLineCap;
  lineJoin: CanvasLineJoin;
  readonly calls: string[];
  arc(x: number, y: number, radius: number): void;
  beginPath(): void;
  ellipse(x: number, y: number, rx: number, ry: number): void;
  fill(): void;
  fillRect(x: number, y: number, w: number, h: number): void;
  lineTo(x: number, y: number): void;
  moveTo(x: number, y: number): void;
  stroke(): void;
  strokeRect(x: number, y: number, w: number, h: number): void;
} {
  const calls: string[] = [];
  return {
    fillStyle: "",
    lineWidth: 0,
    strokeStyle: "",
    lineCap: "butt",
    lineJoin: "miter",
    calls,
    arc: (x, y, radius) => calls.push(`arc:${x},${y},${radius}`),
    beginPath: () => calls.push("beginPath"),
    ellipse: (x, y, rx, ry) => calls.push(`ellipse:${x},${y},${rx},${ry}`),
    fill: () => calls.push("fill"),
    fillRect: (x, y, w, h) => calls.push(`fillRect:${x},${y},${w},${h}`),
    lineTo: (x, y) => calls.push(`lineTo:${x},${y}`),
    moveTo: (x, y) => calls.push(`moveTo:${x},${y}`),
    stroke: () => calls.push("stroke"),
    strokeRect: (x, y, w, h) => calls.push(`strokeRect:${x},${y},${w},${h}`),
  };
}
