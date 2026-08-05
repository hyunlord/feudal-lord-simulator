import assert from "node:assert/strict";
import test from "node:test";

import type { Building, BuildingKind } from "../src/content/buildingConfig";
import { PALETTE } from "../src/content/palette";
import type { House } from "../src/population/population.types";
import { drawKindDetail } from "../src/render/drawBuildingDetails";
import {
  buildBuildingVisualState,
  houseBodyProfile,
} from "../src/render/buildingVisualState";

type LoggedContext = CanvasRenderingContext2D & {
  readonly calls: readonly string[];
};

function building(
  id: string,
  kind: BuildingKind,
  patch: Partial<Building> = {},
): Building {
  return {
    id,
    kind,
    tx: 0,
    ty: 0,
    workers: 0,
    inventory: {},
    reserved: {},
    stockReserved: {},
    productionProgress: 0,
    ...patch,
  };
}

function house(buildingId: string, level: number): House {
  return {
    buildingId,
    level,
    residents: 4,
    hasWater: true,
    breadStock: 1,
    lastServicedTick: 0,
    unmetRequirementTicks: 0,
  };
}

function loggedContext(): LoggedContext {
  const calls: string[] = [];
  let fillStyle = "";
  let strokeStyle = "";
  const context = {
    calls,
    get fillStyle() {
      return fillStyle;
    },
    set fillStyle(value: string) {
      fillStyle = value;
      calls.push(`fillStyle:${value}`);
    },
    get strokeStyle() {
      return strokeStyle;
    },
    set strokeStyle(value: string) {
      strokeStyle = value;
      calls.push(`strokeStyle:${value}`);
    },
    lineWidth: 0,
    lineJoin: "miter",
    lineCap: "butt",
    beginPath: () => calls.push("beginPath"),
    closePath: () => calls.push("closePath"),
    ellipse: (x: number, y: number, radiusX: number, radiusY: number) =>
      calls.push(`ellipse:${x},${y},${radiusX},${radiusY}`),
    fill: () => calls.push("fill"),
    stroke: () => calls.push("stroke"),
    moveTo: (x: number, y: number) => calls.push(`moveTo:${x},${y}`),
    lineTo: (x: number, y: number) => calls.push(`lineTo:${x},${y}`),
    arc: (x: number, y: number, radius: number) =>
      calls.push(`arc:${x},${y},${radius}`),
  };
  return context as unknown as LoggedContext;
}

test("house body profile visibly changes for each housing level", () => {
  // Given / When
  const profiles = [0, 1, 2, 3].map((level) => houseBodyProfile(level));

  // Then
  assert.deepEqual(
    profiles.map(({ height, roof, roofShape }) => ({ height, roof, roofShape })),
    [
      { height: 20, roof: 16, roofShape: "triangle" },
      { height: 30, roof: 18, roofShape: "triangle" },
      { height: 42, roof: 16, roofShape: "gable" },
      { height: 52, roof: 20, roofShape: "tower" },
    ],
  );
});

test("building visual state derives house level from matching house record", () => {
  // Given
  const home = building("home", "house");

  // When
  const visual = buildBuildingVisualState(home, [house("home", 3)]);

  // Then
  assert.equal(visual.houseLevel, 3);
  assert.equal(visual.production, "idle");
});

test("working mill detail animates only when production can advance", () => {
  // Given
  const working = building("mill", "mill", {
    workers: 2,
    inventory: { wheat: 2 },
  });
  const stopped = building("stopped", "mill", {
    workers: 2,
    inventory: {},
  });
  const workingContext = loggedContext();
  const stoppedContext = loggedContext();

  // When
  drawKindDetail(workingContext, {
    tick: 9,
    center: { x: 100, y: 100 },
    kind: "mill",
    zoom: 1,
    visualState: buildBuildingVisualState(working, []),
  });
  drawKindDetail(stoppedContext, {
    tick: 9,
    center: { x: 100, y: 100 },
    kind: "mill",
    zoom: 1,
    visualState: buildBuildingVisualState(stopped, []),
  });

  // Then
  assert.ok(
    workingContext.calls.includes("moveTo:100,38"),
    "working flag is allowed to sway",
  );
  assert.ok(
    stoppedContext.calls.every((call) => call !== "moveTo:100,38"),
    "stopped mill has no working-motion flag",
  );
});

test("sawmill working detail appears only when staffed with input and capacity", () => {
  // Given
  const working = building("sawmill", "sawmill", {
    workers: 2,
    inventory: { logs: 2 },
  });
  const missingInput = building("empty-sawmill", "sawmill", {
    workers: 2,
  });
  const fullProducer = building("full-camp", "logging_camp", {
    workers: 3,
    inventory: { logs: 20 },
    productionProgress: 50,
  });
  const inputFullConverter = building("input-full-sawmill", "sawmill", {
    workers: 2,
    inventory: { logs: 20 },
  });
  const inboundReservedProducer = building("reserved-camp", "logging_camp", {
    workers: 3,
    inventory: { logs: 19 },
    reserved: { logs: 1 },
    productionProgress: 50,
  });
  const fullButAdvancing = building("advancing-camp", "logging_camp", {
    workers: 3,
    inventory: { logs: 20 },
    productionProgress: 49,
  });

  // When / Then
  assert.equal(buildBuildingVisualState(working, []).production, "working");
  assert.equal(buildBuildingVisualState(missingInput, []).production, "no_input");
  assert.equal(buildBuildingVisualState(fullProducer, []).production, "storage_full");
  assert.equal(
    buildBuildingVisualState(inputFullConverter, []).production,
    "working",
  );
  assert.equal(
    buildBuildingVisualState(inboundReservedProducer, []).production,
    "storage_full",
  );
  assert.equal(
    buildBuildingVisualState(fullButAdvancing, []).production,
    "working",
  );
});

test("problem marker is vermilion and only appears for actual blocked production", () => {
  // Given
  const noWorkers = building("camp", "logging_camp", { workers: 1 });
  const inactive = building("well", "well");
  const blockedContext = loggedContext();
  const inactiveContext = loggedContext();

  // When
  drawKindDetail(blockedContext, {
    tick: 0,
    center: { x: 80, y: 90 },
    kind: "logging_camp",
    zoom: 1,
    visualState: buildBuildingVisualState(noWorkers, []),
  });
  drawKindDetail(inactiveContext, {
    tick: 0,
    center: { x: 80, y: 90 },
    kind: "well",
    zoom: 1,
    visualState: buildBuildingVisualState(inactive, []),
  });

  // Then
  assert.ok(blockedContext.calls.includes(`fillStyle:${PALETTE.vermilion}`));
  assert.ok(blockedContext.calls.some((call) => call === "arc:96,47,5"));
  assert.ok(inactiveContext.calls.every((call) => call !== `fillStyle:${PALETTE.vermilion}`));
});

test("problem markers use enlarged true-condition glyphs with a gentle pulse", () => {
  // Given
  const dryHouse = house("home", 1);
  const hungryHouse = { ...house("hungry", 2), breadStock: 0 };
  const noWorkers = building("camp", "logging_camp", { workers: 1 });
  const fullCamp = building("full-camp", "logging_camp", {
    workers: 3,
    inventory: { logs: 20 },
    productionProgress: 50,
  });
  const dryContext = loggedContext();
  const breadContext = loggedContext();
  const labourContext = loggedContext();
  const storageContext = loggedContext();

  // When
  drawKindDetail(dryContext, {
    tick: 0,
    center: { x: 80, y: 90 },
    kind: "house",
    zoom: 1,
    visualState: buildBuildingVisualState(building("home", "house"), [{ ...dryHouse, hasWater: false }]),
  });
  drawKindDetail(breadContext, {
    tick: 0,
    center: { x: 80, y: 90 },
    kind: "house",
    zoom: 1,
    visualState: buildBuildingVisualState(building("hungry", "house"), [hungryHouse]),
  });
  drawKindDetail(labourContext, {
    tick: 0,
    center: { x: 80, y: 90 },
    kind: "logging_camp",
    zoom: 1,
    visualState: buildBuildingVisualState(noWorkers, []),
  });
  drawKindDetail(storageContext, {
    tick: 0,
    center: { x: 80, y: 90 },
    kind: "logging_camp",
    zoom: 1,
    visualState: buildBuildingVisualState(fullCamp, []),
  });

  // Then
  assert.ok(dryContext.calls.some((call) => call === "moveTo:96,37"), "water drop has a pointed top");
  assert.ok(breadContext.calls.some((call) => call.startsWith("ellipse:96,51,")), "bread loaf uses a rounded loaf silhouette");
  assert.ok(labourContext.calls.some((call) => call.startsWith("arc:96,47,")), "worker figure has a head glyph");
  assert.ok(storageContext.calls.some((call) => call === "lineTo:104,59"), "full crate has a boxed corner");
  assert.ok(
    [...dryContext.calls, ...breadContext.calls, ...labourContext.calls, ...storageContext.calls]
      .some((call) => /(?:arc|ellipse):[^,]+,[^,]+,(?:8|9|10|11)/.test(call)),
    "markers are larger than the old radius-three dot",
  );
});

test("problem marker pulse changes glyph size without changing the true condition", () => {
  // Given
  const noWorkers = building("camp", "logging_camp", { workers: 1 });
  const firstContext = loggedContext();
  const laterContext = loggedContext();
  const visualState = buildBuildingVisualState(noWorkers, []);

  // When
  drawKindDetail(firstContext, {
    tick: 0,
    center: { x: 80, y: 90 },
    kind: "logging_camp",
    zoom: 1,
    visualState,
  });
  drawKindDetail(laterContext, {
    tick: 13,
    center: { x: 80, y: 90 },
    kind: "logging_camp",
    zoom: 1,
    visualState,
  });

  // Then
  assert.notDeepEqual(
    laterContext.calls.filter((call) => call.startsWith("arc:")),
    firstContext.calls.filter((call) => call.startsWith("arc:")),
  );
  assert.deepEqual(visualState, buildBuildingVisualState(noWorkers, []));
});
