import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_GAME_STATE } from "../src/state/gameStore";
import { townLandscapeAt } from "../src/render/townLandscape";
import type { GameState } from "../src/engine/engine.types";

function town(): GameState {
  return { ...DEFAULT_GAME_STATE, width: 30, height: 30, buildings: [], constructionSites: [],
    tiles: Array.from({ length: 900 }, (_, i) => ({ tx: i % 30, ty: Math.floor(i / 30), terrain: "grass", buildingId: null, hasRoad: false })),
    palisade: { id: "wall", polygon: [{ x: 2, y: 2 }, { x: 28, y: 2 }, { x: 28, y: 28 }, { x: 2, y: 28 }, { x: 2, y: 2 }], gate: { x: 15, y: 2 }, segments: [{ id: "segment", order: 0, edgePath: [], tileCount: 104, completed: true, material: "stone", constructionSiteId: null }] } };
}

test("landscape remains sparse, deterministic and inside a completed stone enclosure", () => {
  const state = town();
  const patches = state.tiles.filter(tile => townLandscapeAt(state, tile) !== null);
  assert.ok(patches.length > 0);
  assert.ok(patches.length < state.tiles.length / 10);
  assert.deepEqual(patches.map(tile => townLandscapeAt(state, tile)), patches.map(tile => townLandscapeAt(structuredClone(state), tile)));
  const first = patches[0];
  assert.ok(first);
  assert.equal(townLandscapeAt({ ...state, palisade: null }, first), null);
  for (const tile of patches) assert.ok(tile.tx > 2 && tile.ty > 2 && tile.tx < 27 && tile.ty < 27);
});

test("roads, buildings and construction footprints remove decoration without changing state", () => {
  const state = town();
  const tile = state.tiles.find(candidate => townLandscapeAt(state, candidate) !== null);
  assert.ok(tile);
  const before = structuredClone(state);
  assert.equal(townLandscapeAt(state, { ...tile, hasRoad: true }), null);
  assert.equal(townLandscapeAt(state, { ...tile, buildingId: "site" }), null);
  assert.deepEqual(state, before);
});

test("unfinished or timber walls do not acquire enclosed stone-town decoration", () => {
  const state = town();
  assert.ok(state.palisade);
  for (const completed of [false, true]) {
    const palisade: NonNullable<GameState["palisade"]> = { ...state.palisade, segments: state.palisade.segments.map(segment => ({ ...segment, completed, material: "timber" as const })) };
    assert.equal(state.tiles.filter(tile => townLandscapeAt({ ...state, palisade }, tile) !== null).length, 0);
  }
});

test("decoration withdraws beside a new occupied tile and returns after its removal", () => {
  const state = town();
  const tile = state.tiles.find(candidate => townLandscapeAt(state, candidate) !== null);
  assert.ok(tile);
  const kind = townLandscapeAt(state, tile);
  const occupied = { ...state, tiles: state.tiles.map(candidate => candidate.tx === tile.tx + 1 && candidate.ty === tile.ty ? { ...candidate, buildingId: "construction-site" } : candidate) };
  assert.equal(townLandscapeAt(occupied, tile), null);
  assert.equal(townLandscapeAt(state, tile), kind);
});
