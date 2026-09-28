/**
 * CODE-1a human path (a gate run with every guardrail, `scripts/remote/tasks.sh guardrail`): a person's chapter 1 as
 * commands only — the tutorial by its card buttons (pace 1), then the street, two wells and twelve burgage plots — and
 * the town left to run to the end of 1302. It must live (FIX-4 gate ①: 60+ people, no facility stopped for upkeep, no
 * construction a year old, the mill staffed) and fill its plots (gate ②: eight or more receive a household). No bot, and
 * no state edited between the commands. `humanPathAle.test.ts` carries the path on to chapter 2's ale.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { advanceTick } from "../src/engine/tick";
import { burgageParcels } from "../src/zones/zoneFillAgent";
import { layStreet } from "./helpers/humanStreet";
import { playAtPace } from "./helpers/tutorialPlay";

const END_OF_1302 = 12_000;
const YEAR = 4_000;

test("humanPath chapter 1: the tutorial, a street of twelve plots, and the town lives to the end of 1302 with its plots filling", () => {
  const { state: tutorial, doneAt } = playAtPace(1, 2_400);
  assert.ok(doneAt !== null, "the tutorial finished");
  const before = new Set(burgageParcels(tutorial).map(parcel => parcel.id));
  const street = layStreet(tutorial);
  const plots = burgageParcels(street).filter(parcel => !before.has(parcel.id));
  assert.ok(plots.length >= 12, `new plots ${plots.length}`);
  const plotOfCell = new Map<string, string>();
  for (const plot of plots) for (const cell of plot.cells) plotOfCell.set(`${cell.tx},${cell.ty}`, plot.id);
  let state = street;
  while (state.tick < END_OF_1302) state = advanceTick(state);
  // Chapter 1 lives.
  assert.ok(state.population >= 60, `population ${state.population} at tick ${state.tick}`);
  const mill = state.buildings.find(building => building.kind === "mill");
  assert.ok(mill !== undefined && mill.workers > 0 && mill.upkeepUnpaid !== true, "the mill stands, staffed and paid");
  assert.deepEqual(state.buildings.filter(building => building.upkeepUnpaid === true).map(building => building.kind), [], "no facility stopped for upkeep");
  const stuck = state.constructionSites.filter(site => "startedTick" in site && typeof site.startedTick === "number" && state.wallTick - site.startedTick > YEAR);
  assert.deepEqual(stuck.map(site => site.id), [], "no construction left for a year");
  // Its plots fill.
  const settled = new Set<string>();
  for (const record of state.history!.records) {
    if (record.template !== "person.move_in" || record.tick <= street.tick) continue;
    const home = state.buildings.find(building => building.id === record.place?.buildingId);
    const plot = home === undefined ? undefined : plotOfCell.get(`${home.tx},${home.ty}`);
    if (plot !== undefined) settled.add(plot);
  }
  assert.ok(settled.size >= 8, `plots that received a household ${settled.size} of ${plots.length}`);
});
