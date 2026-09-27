/**
 * C4 human path (AL-2, AL-3, AL-4, AL-5): what a player does to get ale — two game commands replayed through the
 * reducer (a barn to barley, a malt kiln placed), then the world left to run: the barley is sown and harvested, the
 * kiln malts it, a household brews and its alehouse sells the first cask. No state is edited between the commands.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { CHAPTER_TWO } from "../src/content/chapterConfig";
import type { GameState } from "../src/engine/engine.types";
import { initialPolitics } from "../src/engine/politics";
import { advanceTick } from "../src/engine/tick";
import { decodeSave } from "../src/save/saveCodec";
import { gameReducer } from "../src/state/gameStore";
import { canPlaceBuilding } from "../src/world/placement";

test("humanPath ale: a barn to barley and a malt kiln (two commands) bring the town its first ale sold within a year", () => {
  const saved = decodeSave(new Uint8Array(readFileSync("fixtures/saves/v22/palisade-construction.save.json"))).envelope.state as GameState;
  const politics = initialPolitics(saved);
  let state: GameState = { ...saved, politics: { ...politics, chapter: { ...politics.chapter, number: CHAPTER_TWO.chapter } } };
  const barn = state.buildings.filter(building => building.kind === "farmstead").sort((a, b) => a.id.localeCompare(b.id))[0]!;
  state = gameReducer(state, { type: "set_farmstead_crop", buildingId: barn.id, crop: "barley" });
  const spot = state.tiles.find(tile => canPlaceBuilding(state, "malt_kiln", tile.tx, tile.ty).ok && Math.abs(tile.tx - barn.tx) + Math.abs(tile.ty - barn.ty) < 14)!;
  state = gameReducer(state, { type: "place_building", kind: "malt_kiln", tx: spot.tx, ty: spot.ty });
  assert.ok(state.constructionSites.some(site => "kind" in site && site.kind === "malt_kiln"), "the kiln's site");
  const start = state.tick;
  const seen: Record<string, number> = {};
  const note = (key: string, now: boolean) => { if (now && seen[key] === undefined) seen[key] = state.tick; };
  for (let step = 0; step < 4000 && seen.sold === undefined; step += 1) {
    state = advanceTick(state);
    note("barleySown", (state.arableFields ?? []).some(field => field.strips.some(strip => strip.crop === "barley")));
    note("kiln", state.buildings.some(building => building.kind === "malt_kiln"));
    note("barley", state.buildings.some(building => (building.inventory.barley ?? 0) > 0));
    note("malt", state.buildings.some(building => (building.inventory.malt ?? 0) > 0));
    note("sold", (state.ledger?.entries ?? []).some(entry => entry.category === "stall_fee" && entry.sourceRefs.some(ref => String(ref.detail ?? "").startsWith("alehouse:"))));
  }
  assert.deepEqual(Object.keys(seen).sort(), ["barley", "barleySown", "kiln", "malt", "sold"]);
  assert.ok(seen.barleySown! < seen.barley! && seen.barley! <= seen.malt! && seen.malt! <= seen.sold!, JSON.stringify(seen));
  assert.ok(seen.sold! - start <= 4000, `first ale sold ${seen.sold! - start} ticks after the commands`);
});
