/**
 * C5 human path (CL-1…CL-8): pasture to the first cloth as a player sets it up — in the town that came through
 * chapters 1–3 (fixture `chapter-four-town`), game commands only: two pasture strokes, a pastoral farm beside them, the
 * weaver's house, the fulling mill and the dyehouse by the water (a road laid to each), the tenter yard; then the world
 * runs: the flocks are shorn, the women spin, the loom weaves, the mill fulls, the dyers dye, the tenters finish, and the
 * market sells the first cloth to the long-distance merchants. No state is edited between the commands.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import type { GameState } from "../src/engine/engine.types";
import { advanceTick } from "../src/engine/tick";
import { clothTown, paintPasture, placeNear } from "./helpers/clothTown";

test("humanPath cloth: two pasture strokes and five buildings (commands) bring the town its first finished cloth sold within two years", () => {
  let state: GameState = clothTown();
  const store = state.buildings.filter(building => building.kind === "storehouse").sort((a, b) => a.id.localeCompare(b.id))[0]!;
  state = paintPasture(paintPasture(state, store), store);
  const pasture = (state.zones ?? []).filter(zone => zone.kind === "pasture").flatMap(zone => zone.membership);
  assert.ok(pasture.length >= 60, `pasture ${pasture.length}`);
  const middle = { tx: Math.round(pasture.reduce((sum, index) => sum + index % state.width, 0) / pasture.length),
    ty: Math.round(pasture.reduce((sum, index) => sum + Math.floor(index / state.width), 0) / pasture.length) };
  state = placeNear(state, "pastoral_farm", middle);
  for (const kind of ["weaver_house", "fulling_mill", "dyehouse", "tenter_yard"] as const) state = placeNear(state, kind, store);
  const start = state.tick;
  const seen: Record<string, number> = {};
  const note = (key: string, now: boolean) => { if (now && seen[key] === undefined) seen[key] = state.tick; };
  const has = (resource: string) => state.buildings.some(building => (building.inventory[resource as "fleece"] ?? 0) > 0);
  for (let step = 0; step < 8000 && seen.sold === undefined; step += 1) {
    state = advanceTick(state);
    note("fleece", has("fleece"));
    note("yarn", has("yarn"));
    note("woven", has("raw_cloth"));
    note("fulled", has("fulled_cloth"));
    note("dyed", has("dyed_cloth"));
    note("finished", has("finished_cloth"));
    note("sold", (state.ledger?.entries ?? []).some(entry => entry.category === "ulnage"));
  }
  assert.deepEqual(Object.keys(seen).sort(), ["dyed", "finished", "fleece", "fulled", "sold", "woven", "yarn"]);
  assert.ok(seen.fleece! <= seen.yarn! && seen.yarn! <= seen.woven! && seen.woven! <= seen.fulled! && seen.fulled! <= seen.dyed!
    && seen.dyed! <= seen.finished! && seen.finished! <= seen.sold!, JSON.stringify(seen));
  assert.ok(seen.sold! - start <= 8000, `first cloth sold ${seen.sold! - start} ticks after the commands`);
});
