/** FIX-11 (11): the lord's manor house has a site on every new map (MH-1) and old saves get one (MH-2). */
import assert from "node:assert/strict";
import test from "node:test";

import { createGrowthOpening } from "../scripts/phase21OpeningTranslation";
import { MAP_ARCHETYPE_IDS } from "../src/content/scenario/archetypes";
import { newGameState } from "../src/state/newGame";
import { manorVacant, placeManorSite } from "../src/state/openingVillage";
import type { GameState } from "../src/engine/engine.types";
import { MANOR_HOUSEHOLD } from "../src/engine/persons.types";

const footprint = (state: GameState, tx: number, ty: number) =>
  [0, 1].flatMap(dy => [0, 1].map(dx => state.tiles[(ty + dy) * state.width + tx + dx]!));

test("MH-1 every land's new map and every growth opening has one manor house on free grass, its tiles its own", () => {
  const check = (state: GameState, label: string) => {
    const manors = state.buildings.filter(building => building.kind === "manor_house");
    assert.equal(manors.length, 1, label);
    const manor = manors[0]!;
    for (const tile of footprint(state, manor.tx, manor.ty)) {
      assert.equal(tile.buildingId, manor.id, label);
      assert.equal(tile.terrain, "grass", label);
      assert.equal(tile.hasRoad, false, label);
    }
    return manor;
  };
  for (const archetypeId of MAP_ARCHETYPE_IDS) {
    const state = newGameState({ scenarioId: "core:campaign_market_town", archetypeId, seed: 1 });
    assert.ok(state !== null, archetypeId);
    check(state, archetypeId);
    for (const seed of [1, 2, 3, 4, 5]) check(createGrowthOpening(seed, archetypeId).state as GameState, `${archetypeId} opening ${seed}`);
  }
});

test("MH-2 an old save gets the new game's site, or the nearest free 2×2 when that is taken; a second pass changes nothing", () => {
  const fresh = newGameState({ scenarioId: "core:campaign_market_town", archetypeId: MAP_ARCHETYPE_IDS[0]!, seed: 1 })!;
  const site = fresh.buildings.find(building => building.kind === "manor_house")!;
  const strip = (state: GameState): GameState => ({ ...state, buildings: state.buildings.filter(building => building.kind !== "manor_house"),
    tiles: state.tiles.map(tile => tile.buildingId === site.id ? { ...tile, buildingId: null } : tile) });
  const old = strip(fresh);
  const placed = placeManorSite(old);
  assert.deepEqual(placed.buildings.filter(building => building.kind === "manor_house").map(building => [building.tx, building.ty]), [[site.tx, site.ty]]);
  assert.equal(placeManorSite(placed), placed);
  const taken = { ...old, tiles: old.tiles.map(tile => tile.tx === site.tx && tile.ty === site.ty ? { ...tile, hasRoad: true } : tile) };
  const again = placeManorSite(taken);
  const moved = again.buildings.find(building => building.kind === "manor_house")!;
  assert.notDeepEqual([moved.tx, moved.ty], [site.tx, site.ty]);
  assert.ok((moved.tx - site.tx) ** 2 + (moved.ty - site.ty) ** 2 <= 4, `${moved.tx},${moved.ty}`);
  for (const tile of footprint(again, moved.tx, moved.ty)) assert.equal(tile.buildingId, moved.id);
});

test("MH-3 the manor stands empty when no one of the lord's household lives", () => {
  const state = newGameState({ scenarioId: "core:campaign_market_town", archetypeId: MAP_ARCHETYPE_IDS[0]!, seed: 1 })!;
  const withLord = { ...state, persons: { ...(state.persons ?? { people: [], past: [] }), people: [{ householdId: MANOR_HOUSEHOLD } as never] } } as GameState;
  const empty = { ...state, persons: { ...(state.persons ?? { people: [], past: [] }), people: [] } } as GameState;
  assert.equal(manorVacant(empty), true);
  assert.equal(manorVacant(withLord), false);
});
