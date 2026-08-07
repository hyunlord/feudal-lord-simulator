import assert from "node:assert/strict";
import test from "node:test";

import { PALETTE } from "../src/content/palette";
import type { Building } from "../src/economy/economy.types";
import type { GameState } from "../src/engine/engine.types";
import { drawSelectedRoadComponent } from "../src/render/diagnosticOverlays";
import { withAlpha } from "../src/render/style";
import {
  distributionReachTiles,
  highlightedHouseTiles,
  selectedBuildingRoadComponent,
} from "../src/ui/diagnosticOverlayModel";

function building(id: string, kind: Building["kind"], tx: number, ty: number): Building {
  return {
    id,
    kind,
    tx,
    ty,
    workers: 0,
    inventory: {},
    reserved: {},
    stockReserved: {},
    productionProgress: 0,
  };
}

function roadWorld(): GameState {
  const width = 46;
  const height = 5;
  return {
    tick: 0,
    seed: 1,
    width,
    height,
    tiles: Array.from({ length: width * height }, (_unused, index) => {
      const tx = index % width;
      const ty = Math.floor(index / width);
      return {
        tx,
        ty,
        terrain: "grass" as const,
        buildingId: null,
        hasRoad: ty === 2 || (ty === 4 && tx >= 43 && tx < 45),
      };
    }),
    buildings: [
      building("granary", "granary", 0, 0),
      building("connected", "house", 45, 1),
      building("isolated", "house", 45, 4),
    ],
    constructionSites: [],
    wallTick: 0,
    era: "hamlet",
    eraProclaimedTick: null,
    palisade: null,
    nextConstructionOrdinal: 1,
    houses: [],
    walkers: [],
    population: 0,
    idleWorkers: 0,
    treasuryTimber: 0,
    roadRevision: 0,
    pathCache: {},
    forestHarvests: [],
  };
}

function keys(coordinates: readonly { readonly tx: number; readonly ty: number }[]): string[] {
  return coordinates.map((coordinate) => `${coordinate.tx},${coordinate.ty}`).sort();
}

test("distribution reach is an exact bounded multi-source road BFS", () => {
  // Given
  const state = roadWorld();

  // When
  const reached = new Set(keys(distributionReachTiles(state)));

  // Then: the closest granary access is (1, 2)
  assert.equal(reached.has("1,2"), true); // 0
  assert.equal(reached.has("2,2"), true); // 1
  assert.equal(reached.has("40,2"), true); // 39
  assert.equal(reached.has("41,2"), true); // 40
  assert.equal(reached.has("42,2"), false); // 41
  assert.equal(reached.has("43,4"), false); // disconnected
});

test("population event highlight includes only the involved house footprints", () => {
  const state = roadWorld();
  assert.deepEqual(keys(highlightedHouseTiles(state, ["connected"])), ["45,1"]);
  assert.deepEqual(highlightedHouseTiles(state, ["granary", "missing"]), []);
});

test("selected building overlay returns only its adjacent road component", () => {
  // Given
  const state = roadWorld();

  // When / Then
  assert.deepEqual(
    keys(selectedBuildingRoadComponent(state, "connected")),
    Array.from({ length: 46 }, (_unused, tx) => `${tx},2`).sort(),
  );
  assert.deepEqual(keys(selectedBuildingRoadComponent(state, "isolated")), ["43,4", "44,4"]);
  assert.deepEqual(selectedBuildingRoadComponent(state, "missing"), []);
  assert.deepEqual(selectedBuildingRoadComponent(state, null), []);
});

test("selected road component uses a presentation-strength ultramarine fill", () => {
  const fillStyles: string[] = [];
  const context = {
    save() {}, restore() {}, beginPath() {}, closePath() {}, fill() {},
    moveTo() {}, lineTo() {},
    set fillStyle(value: string) { fillStyles.push(value); },
  } as unknown as CanvasRenderingContext2D;

  drawSelectedRoadComponent({
    context,
    state: roadWorld(),
    zoom: 1,
    selectedBuildingId: "connected",
  });

  assert.ok(fillStyles.includes(withAlpha(PALETTE.ultramarine, 0.55)));
});
