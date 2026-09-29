/**
 * ARCH-1 gate ③ (spec docs/design/map-archetypes.md MA-7): the chapter-1 human path on every new land — a new game on
 * the land (seed 1) by the start screen's command, the tutorial by its card buttons (pace 1), then the street, two
 * wells and twelve burgage plots, and the town left to run to the end of 1302. It must live as the riverside town's
 * does (`humanPathChapterOne.test.ts`, FIX-4 gate ①): 60+ people, no facility stopped for upkeep, no construction a year
 * old, the mill staffed; and its plots fill (eight or more receive a household). Then on through chapter 1's years to
 * the end of 1318 (`CHAPTER_ONE.toYear`): the town is not abandoned and keeps 60+ people. No bot, and no state edited.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { CHAPTER_ONE } from "../src/content/chapterConfig";
import { COASTAL_ARCHETYPE_ID, DOWNS_ARCHETYPE_ID, FEN_ARCHETYPE_ID, WOODLAND_ARCHETYPE_ID } from "../src/content/scenario/archetypes";
import { DEFAULT_SCENARIO_ID } from "../src/content/scenario/coreScenarios";
import { advanceTick } from "../src/engine/tick";
import { DEFAULT_GAME_STATE, gameReducer } from "../src/state/gameStore";
import { burgageParcels } from "../src/zones/zoneFillAgent";
import { layStreet } from "./helpers/humanStreet";
import { playAtPace } from "./helpers/tutorialPlay";

const YEAR = 4_000;
const END_OF_1302 = 3 * YEAR;
const END_OF_CHAPTER_ONE = (CHAPTER_ONE.toYear - CHAPTER_ONE.fromYear + 1) * YEAR;

for (const archetypeId of [COASTAL_ARCHETYPE_ID, DOWNS_ARCHETYPE_ID, WOODLAND_ARCHETYPE_ID, FEN_ARCHETYPE_ID]) {
  test(`humanPath ${archetypeId}: a new game on the land, the tutorial, a street of twelve plots, and the town lives to the end of 1302 and through chapter 1's years`, () => {
    const opening = gameReducer(DEFAULT_GAME_STATE, { type: "start_new_game", scenarioId: DEFAULT_SCENARIO_ID, archetypeId, seed: 1 });
    assert.equal(opening.archetypeId, archetypeId, "the start screen's command opens the land");
    const { state: tutorial, doneAt } = playAtPace(1, 2_400, opening);
    assert.ok(doneAt !== null, "the tutorial finished");
    const before = new Set(burgageParcels(tutorial).map(parcel => parcel.id));
    const street = layStreet(tutorial);
    const plots = burgageParcels(street).filter(parcel => !before.has(parcel.id));
    assert.ok(plots.length >= 12, `new plots ${plots.length}`);
    const plotOfCell = new Map<string, string>();
    for (const plot of plots) for (const cell of plot.cells) plotOfCell.set(`${cell.tx},${cell.ty}`, plot.id);
    let state = street;
    while (state.tick < END_OF_1302) state = advanceTick(state);
    assert.ok(state.population >= 60, `population ${state.population} at tick ${state.tick}`);
    const mill = state.buildings.find(building => building.kind === "mill");
    assert.ok(mill !== undefined && mill.workers > 0 && mill.upkeepUnpaid !== true, "the mill stands, staffed and paid");
    assert.deepEqual(state.buildings.filter(building => building.upkeepUnpaid === true).map(building => building.kind), [], "no facility stopped for upkeep");
    const stuck = state.constructionSites.filter(site => "startedTick" in site && typeof site.startedTick === "number" && state.wallTick - site.startedTick > YEAR);
    assert.deepEqual(stuck.map(site => site.id), [], "no construction left for a year");
    const settled = new Set<string>();
    for (const record of state.history!.records) {
      if (record.template !== "person.move_in" || record.tick <= street.tick) continue;
      const home = state.buildings.find(building => building.id === record.place?.buildingId);
      const plot = home === undefined ? undefined : plotOfCell.get(`${home.tx},${home.ty}`);
      if (plot !== undefined) settled.add(plot);
    }
    assert.ok(settled.size >= 8, `plots that received a household ${settled.size} of ${plots.length}`);
    // Chapter 1's years: the town lives on.
    let low = state.population;
    while (state.tick < END_OF_CHAPTER_ONE) { state = advanceTick(state); low = Math.min(low, state.population); }
    assert.notEqual(state.settlement?.outcome, "abandoned", "the town is not abandoned");
    assert.ok(low >= 60, `the fewest people through ${CHAPTER_ONE.toYear}: ${low}`);
  });
}
