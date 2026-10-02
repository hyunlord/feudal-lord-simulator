import assert from "node:assert/strict";
import test from "node:test";

import { DEFAULT_SCENARIO_ID } from "../src/content/scenario/coreScenarios";
import { RIVERSIDE_ARCHETYPE_ID } from "../src/content/scenario/archetypes";
import { landGroundOf } from "../src/render/archetypeGroundModel";
import { groundBoundaryScene } from "../src/render/groundBoundaryScene";
import { groundTileAs } from "../src/render/landRockRegions";
import { riversideRockGround, riversideRockToken } from "../src/render/riversideRock";
import { newGameState } from "../src/state/newGame";

// NAT-5 decision N5-D1 (QA-039 on the riverside): the riverside's rock is one smoothed region like the other lands',
// while the rest of its ground keeps LAND-UI's code (LU-D2: no land layer).

const riverside = () => newGameState({ scenarioId: DEFAULT_SCENARIO_ID, archetypeId: RIVERSIDE_ARCHETYPE_ID, seed: 1 })!;

test("Given the riverside map 1 When its ground is read Then it has no land layer but a rock-only ground with every rock tile", () => {
  const state = riverside();
  assert.equal(landGroundOf(state), null);
  const rock = riversideRockGround(state);
  assert.ok(rock !== null);
  const rockTiles = state.tiles.filter(tile => tile.terrain === "rock").length;
  assert.ok(rockTiles > 0);
  assert.equal(rock.rock.reduce((sum, cell) => sum + cell, 0), rockTiles);
  assert.equal(riversideRockGround(state), rock, "cached on the same tiles");
  assert.equal(riversideRockGround({ ...state, tiles: [...state.tiles] }), rock, "same rock mask: the same ground and its region caches");
  const tile = state.tiles.find(entry => entry.terrain === "rock")!;
  assert.equal(groundTileAs(tile, rock).terrain, "grass", "laid as grass under its region");
});

test("Given the riverside's chunks When their keys are built Then only chunks with rock carry a rock token", () => {
  const state = riverside();
  const scene = groundBoundaryScene(state);
  const tokens = scene.chunks.map(plan => riversideRockToken(state, plan));
  const withRock = tokens.filter(token => token !== "").length;
  assert.ok(withRock > 0 && withRock < scene.chunks.length, `${withRock} of ${scene.chunks.length} chunks`);
  assert.ok(tokens.every(token => token === "" || token.startsWith("|R")));
});

test("Given a land other than the riverside When the riverside rock is asked for Then there is none", () => {
  const coast = newGameState({ scenarioId: DEFAULT_SCENARIO_ID, archetypeId: "core:coastal_port", seed: 1 })!;
  assert.equal(riversideRockGround(coast), null);
});
