import assert from "node:assert/strict";
import { test } from "node:test";
import { playAtPace } from "./helpers/tutorialPlay";

// UX-0b (cold start audit v2): a new goal game played by the tutorial's card buttons only, at the pace of a person who
// reads each card, then left alone. The audit town (tutorial done in about 3 minutes of 1x) starved to nothing in the
// winter of 1301: its barn missed the 1300 sowing and its mill, charged from a 0d treasury, stopped for good. The food
// first order places the barn and the mill inside the sowing window at these paces, and the sawmill step leaves
// timber for the next building.
//
// FIX-4 gate ① (spec docs/design/human-play-rules.md): at the end of 1302 the town has at least 60 people and no
// deadlock — no facility stopped for unpaid upkeep, no construction left standing for a year, the mill staffed.
const END_OF_1302 = 12_000;
const YEAR = 4_000;

for (const pace of [1, 1.8, 2.4]) {
  test(`UX-0b / FIX-4 gate ①: a tutorial played at pace x${pace} and then left alone has 60+ people and no deadlock at the end of 1302`, () => {
    const { state, doneAt } = playAtPace(pace, END_OF_1302);
    assert.ok(doneAt !== null, "the tutorial finished");
    assert.ok(state.population >= 60, `population ${state.population} at tick ${state.tick}`);
    const mill = state.buildings.find(building => building.kind === "mill");
    assert.ok(mill !== undefined && mill.upkeepUnpaid !== true, "the mill stands and is not stopped for unpaid upkeep");
    assert.ok(mill.workers > 0, "the mill is staffed");
    assert.deepEqual(state.buildings.filter(building => building.upkeepUnpaid === true).map(building => building.kind), [], "no facility stopped for upkeep");
    const stuck = state.constructionSites.filter(site => "startedTick" in site && typeof site.startedTick === "number" && state.wallTick - site.startedTick > YEAR);
    assert.deepEqual(stuck.map(site => site.id), [], "no construction left for a year");
    assert.ok(state.buildings.some(building => building.kind === "sawmill"), "the sawmill step built a sawmill");
  });
}
