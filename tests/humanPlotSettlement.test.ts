/**
 * FIX-4 gate ② (spec docs/design/human-play-rules.md HR-6): a person's plots fill. After the tutorial the player lays a
 * road west of the fields and south into the open ground, puts two wells on it and paints burgage plots on both sides —
 * twelve plots (house lots: "12필지", as "24필지" counts lots). Within two years at least eight of them receive a
 * household, each move-in in the ledger (`person.move_in`). No bot and no other building.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { advanceTick } from "../src/engine/tick";
import { burgageParcels } from "../src/zones/zoneFillAgent";
import { layStreet } from "./helpers/humanStreet";
import { playAtPace } from "./helpers/tutorialPlay";

const TWO_YEARS = 8_000;

test("FIX-4 gate ②: twelve plots painted after the tutorial receive eight or more households within two years", () => {
  const { state: tutorial, doneAt } = playAtPace(1, 2_400);
  assert.ok(doneAt !== null, "the tutorial finished");
  const before = new Set(burgageParcels(tutorial).map(parcel => parcel.id));
  const street = layStreet(tutorial);
  const plots = burgageParcels(street).filter(parcel => !before.has(parcel.id));
  assert.ok(plots.length >= 12, `new plots ${plots.length}`);
  const plotOfCell = new Map<string, string>();
  for (const plot of plots) for (const cell of plot.cells) plotOfCell.set(`${cell.tx},${cell.ty}`, plot.id);
  let state = street;
  for (let step = 0; step < TWO_YEARS; step += 1) state = advanceTick(state);
  const settled = new Set<string>();
  for (const record of state.history!.records) {
    if (record.template !== "person.move_in" || record.tick <= street.tick) continue;
    const home = state.buildings.find(building => building.id === record.place?.buildingId);
    const plot = home === undefined ? undefined : plotOfCell.get(`${home.tx},${home.ty}`);
    if (plot !== undefined) settled.add(plot);
  }
  assert.ok(settled.size >= 8, `plots that received a household ${settled.size} of ${plots.length} (population ${state.population})`);
});
