/** FIX-11 (11): the lord's manor house has a site on every new map (MH-1) and old saves get one (MH-2). */
import assert from "node:assert/strict";
import test from "node:test";

import { createGrowthOpening } from "../scripts/phase21OpeningTranslation";
import { MAP_ARCHETYPE_IDS } from "../src/content/scenario/archetypes";
import { newGameState } from "../src/state/newGame";
import { growManorHouse, manorVacant, placeManorSite } from "../src/state/openingVillage";
import type { GameState } from "../src/engine/engine.types";
import { MANOR_HOUSEHOLD } from "../src/engine/persons.types";
import { BUILDING_CONFIG_BY_KIND } from "../src/content/buildingConfig";
import { migrateV49ToV50 } from "../src/save/migrations/v49ToV50";
import { readdirSync, readFileSync } from "node:fs";

const SIDE = [0, 1, 2];
const footprint = (state: GameState, tx: number, ty: number) =>
  SIDE.flatMap(dy => SIDE.map(dx => state.tiles[(ty + dy) * state.width + tx + dx]!));

test("MH-1 (MANOR-1) the manor house is 3×3, the village's biggest house", () => {
  const def = BUILDING_CONFIG_BY_KIND.manor_house;
  assert.deepEqual([def.width, def.height], [3, 3]);
  // Bigger than the cottage the town lives in.
  assert.ok(BUILDING_CONFIG_BY_KIND.house.width * BUILDING_CONFIG_BY_KIND.house.height < def.width * def.height);
});

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

test("MH-2 an old save gets the new game's site, or the nearest free 3×3 when that is taken; a second pass changes nothing", () => {
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
  assert.ok(Math.abs(moved.tx - site.tx) <= 16 && Math.abs(moved.ty - site.ty) <= 16, `${moved.tx},${moved.ty}`);
  // Five tiles clear of every building and road (the village's wall keeps its room).
  for (let y = moved.ty - 5; y < moved.ty + 8; y += 1) for (let x = moved.tx - 5; x < moved.tx + 8; x += 1) {
    const tile = again.tiles[y * again.width + x];
    if (tile !== undefined && x >= 0 && y >= 0 && x < again.width && tile.buildingId !== moved.id) assert.ok(tile.buildingId === null && !tile.hasRoad, `${x},${y}`);
  }
  for (const tile of footprint(again, moved.tx, moved.ty)) assert.equal(tile.buildingId, moved.id);
});

test("MH-3 the manor stands empty when no one of the lord's household lives", () => {
  const state = newGameState({ scenarioId: "core:campaign_market_town", archetypeId: MAP_ARCHETYPE_IDS[0]!, seed: 1 })!;
  const withLord = { ...state, persons: { ...(state.persons ?? { people: [], past: [] }), people: [{ householdId: MANOR_HOUSEHOLD } as never] } } as GameState;
  const empty = { ...state, persons: { ...(state.persons ?? { people: [], past: [] }), people: [] } } as GameState;
  assert.equal(manorVacant(empty), true);
  assert.equal(manorVacant(withLord), false);
});

test("MH-5 (MANOR-1, save v50) a v49 town's 2×2 manor house becomes 3×3 — in place where its new tiles are free, else on the nearest free 3×3; the v35 migration still places 2×2", () => {
  const v49 = readdirSync("fixtures/saves/v49").filter(name => name.endsWith(".save.json"));
  assert.ok(v49.length >= 10);
  let inPlace = 0;
  for (const name of v49) {
    const raw = JSON.parse(readFileSync(`fixtures/saves/v49/${name}`, "utf8"));
    const old = raw.state as GameState;
    const before = old.buildings.find(building => building.kind === "manor_house")!;
    assert.equal(old.tiles.filter(tile => tile.buildingId === before.id).length, 4, `${name} was 2×2`);
    const state = (migrateV49ToV50(raw) as { state: GameState }).state;
    const manors = state.buildings.filter(building => building.kind === "manor_house");
    assert.equal(manors.length, 1, name);
    const manor = manors[0]!;
    const own = state.tiles.filter(tile => tile.buildingId === manor.id);
    assert.equal(own.length, 9, name);
    for (const tile of footprint(state, manor.tx, manor.ty)) {
      assert.equal(tile.buildingId, manor.id, name);
      assert.equal(tile.terrain, "grass", name);
      assert.equal(tile.hasRoad, false, name);
    }
    // No other building lost a tile; the old tiles not under the new house are free again.
    for (const building of old.buildings.filter(entry => entry.kind !== "manor_house")) {
      assert.equal(state.tiles.filter(tile => tile.buildingId === building.id).length, old.tiles.filter(tile => tile.buildingId === building.id).length, `${name} ${building.id}`);
    }
    if (manor.tx <= before.tx && before.tx <= manor.tx + 1 && manor.ty <= before.ty && before.ty <= manor.ty + 1) inPlace += 1;
    assert.equal(growManorHouse(state), state, `${name}: a 3×3 stays`);
  }
  assert.ok(inPlace >= 1, `${inPlace} of ${v49.length} grew in place`);
  // The v35 step (saves before FIX-11) still gives a 2×2, which v50 then grows.
  const fresh = newGameState({ scenarioId: "core:campaign_market_town", archetypeId: MAP_ARCHETYPE_IDS[0]!, seed: 1 })!;
  const site = fresh.buildings.find(building => building.kind === "manor_house")!;
  const bare = { ...fresh, buildings: fresh.buildings.filter(building => building.id !== site.id), tiles: fresh.tiles.map(tile => tile.buildingId === site.id ? { ...tile, buildingId: null } : tile) };
  const small = placeManorSite(bare, { width: 2, height: 2 });
  const smallId = small.buildings.find(building => building.kind === "manor_house")!.id;
  assert.equal(small.tiles.filter(tile => tile.buildingId === smallId).length, 4);
  assert.equal(growManorHouse(small).tiles.filter(tile => tile.buildingId !== null && tile.buildingId.startsWith("manor-house-")).length, 9);
});
