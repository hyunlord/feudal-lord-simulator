/**
 * LAND-UI gate states (scripts/landStates.ts): the seasons come by play (no tick edited), the fen works stand at the
 * stages the render reads (LU-D5: a drained patch, 20 %, 80 %), and the downs' ford roads are fords, not bridges'
 * water (FD-1). Runs the bot only to the first summer and winter (ticks = 0) to stay light.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { COASTAL_ARCHETYPE_ID, DOWNS_ARCHETYPE_ID, FEN_ARCHETYPE_ID } from "../src/content/scenario/archetypes";
import { stateCalendar } from "../src/engine/scenarioState";
import { isFordRoad } from "../src/world/bridges";
import { characterTile, fenWorks, fordRoads, grownLand, nextSeasonTick } from "../scripts/landStates";

test("LAND-UI states: mid-summer and mid-winter are the next ones at or after the growth ticks", () => {
  assert.equal(nextSeasonTick(30_000, 1_500), 33_500);
  assert.equal(nextSeasonTick(33_500, 3_500), 35_500);
  assert.equal(nextSeasonTick(1_500, 1_500), 1_500);
  const { summer, winter } = grownLand(COASTAL_ARCHETYPE_ID, 0);
  assert.deepEqual([summer.tick, stateCalendar(summer).season, winter.tick, stateCalendar(winter).season], [1_500, 1, 3_500, 3]);
  assert.equal(characterTile(summer, "coastal_port")?.what, "shore");
});

test("LAND-UI fen works: one drained patch (meadow, in drainage.drained) and two open works at 20 % and 80 %, the timber paid by the added treasury", () => {
  const { summer } = grownLand(FEN_ARCHETYPE_ID, 0);
  const { state, works } = fenWorks(summer);
  assert.deepEqual(works.map(work => work.stage), ["done (drained)", "stage 1 staked", "stage 3 drying"]);
  const open = state.drainage!.works;
  assert.equal(open.length, 2);
  assert.deepEqual(open.map(work => Math.round((work.workDone / work.workNeeded) * 10) / 10), [0.2, 0.8]);
  assert.deepEqual(open.map(work => work.diggers ?? 0), [0, 4]);
  assert.ok(state.drainage!.drained.length >= 9 && state.drainage!.drained.every(cell => state.tiles[cell]!.terrain === "grass"));
  assert.equal(state.treasuryTimber, summer.treasuryTimber, "the works' timber was added, then paid");
});

test("LAND-UI downs fords: a road across a ford group of each width, every water cell a ford road", () => {
  const { summer } = grownLand(DOWNS_ARCHETYPE_ID, 0);
  const { state, fords } = fordRoads(summer);
  assert.deepEqual(fords.map(ford => ford.width).sort(), [1, 2]);
  for (const ford of fords) assert.ok(ford.cells.every(cell => isFordRoad(state, cell)), `ford w${ford.width}`);
});
