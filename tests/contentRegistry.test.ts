/**
 * EXT-1 (docs/design/ext-1-plan.md): the content registry — the core pack's kinds as data, known ids checked when a
 * save loads (an unknown id is refused, naming where and what), the definitions' references known; the values moved
 * onto the definitions are the old tables' (behaviour unchanged).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { BUILDING_CONFIG_BY_KIND, BUILDING_KINDS } from "../src/content/buildingConfig";
import { CONTENT_REGISTRY, contentDefinitionProblems, contentStateProblem } from "../src/content/contentRegistry";
import { FACTION_DEFS, FACTION_IDS, FACTION_LEADER_MIN_AGE, FACTION_PORTRAIT_POOLS } from "../src/content/factionConfig";
import { RESOURCE_TYPES } from "../src/content/resourceCatalog";
import { TRADE_IDS } from "../src/content/trades";
import { CONSTRUCTION } from "../src/economy/constructionSites";
import { assertGameStateSnapshot, SaveFormatError } from "../src/save/saveCodec";

const raw = () => JSON.parse(readFileSync("fixtures/saves/v51/chapter-two-town.save.json", "utf8")).state as Record<string, unknown>;

test("the registry's families are the data: ids, has, get — an unknown id is an error naming the family", () => {
  assert.deepEqual(CONTENT_REGISTRY.building.ids(), BUILDING_KINDS);
  assert.deepEqual(Object.keys(BUILDING_CONFIG_BY_KIND).sort(), [...BUILDING_KINDS].sort(), "every kind has its definition");
  assert.deepEqual(CONTENT_REGISTRY.resource.ids(), RESOURCE_TYPES);
  assert.deepEqual(CONTENT_REGISTRY.trade.ids(), TRADE_IDS);
  assert.deepEqual(CONTENT_REGISTRY.faction.ids(), FACTION_IDS);
  assert.deepEqual(FACTION_DEFS.map(def => def.id), [...FACTION_IDS]);
  assert.equal(CONTENT_REGISTRY.building.get("mill").kind, "mill");
  assert.equal(CONTENT_REGISTRY.building.has("dragon_lair"), false);
  assert.throws(() => CONTENT_REGISTRY.building.get("dragon_lair"), /unknown building id "dragon_lair"/);
  assert.throws(() => CONTENT_REGISTRY.faction.get("elves"), /unknown faction id "elves"/);
});

test("the core pack's definitions name only known content", () => {
  assert.deepEqual(contentDefinitionProblems(), []);
});

test("a save naming an unknown building, resource, trade or faction is refused, saying where and what", () => {
  assert.equal(contentStateProblem(raw()), null);
  const cases: [string, (state: Record<string, unknown>) => void, RegExp][] = [
    ["building", state => { (state.buildings as Record<string, unknown>[])[0]!.kind = "dragon_lair"; }, /buildings\[0\] is an unknown building kind "dragon_lair"/],
    ["resource", state => { (state.buildings as Record<string, unknown>[])[0]!.inventory = { mithril: 3 }; }, /buildings\[0\]\.inventory names an unknown resource "mithril"/],
    ["site", state => { state.constructionSites = [{ kind: "dragon_lair" }]; }, /constructionSites\[0\] is an unknown building kind/],
    ["trade", state => { state.trades = { households: [{ tradeId: "alchemist" }] }; }, /trades\.households\[0\] has an unknown trade "alchemist"/],
    ["faction", state => { state.factions = { factions: [{ id: "elves", kind: "town" }] }; }, /unknown faction "elves"/],
    ["faction kind", state => { state.factions = { factions: [{ id: "town", kind: "guild_of_mages" }] }; }, /unknown faction kind "guild_of_mages"/],
  ];
  for (const [what, change, message] of cases) {
    const state = raw();
    change(state);
    assert.throws(() => assertGameStateSnapshot(state), (error: unknown) => error instanceof SaveFormatError && message.test(error.message), what);
  }
  // Wall segments keep their own kinds.
  const walled = raw();
  walled.constructionSites = [{ kind: "palisade_segment" }, { kind: "stone_wall_segment" }];
  assert.equal(contentStateProblem(walled), null);
});

test("the values moved onto the definitions are the old tables' (behaviour unchanged)", () => {
  assert.deepEqual(CONSTRUCTION.REQUIRED_BUILDER_TICKS, {
    house: 240, well: 200, logging_camp: 400, sawmill: 600, mill: 600, storehouse: 800, granary: 800, chapel: 600, wheat_farm: 500,
    farmstead: 400, quarry: 700, masonry: 600, market: 700, church: 900, keep: 1200, malt_kiln: 500, pastoral_farm: 400,
    weaver_house: 500, fulling_mill: 800, dyehouse: 600, tenter_yard: 400, manor_house: 0,
  });
  assert.deepEqual(FACTION_PORTRAIT_POOLS, {
    overlord: ["earl_house"], crown: ["crown"], neighbour_1: ["neighbor_a"], neighbour_2: ["neighbor_b"], bishop: ["diocese"],
    merchant_house_1: ["merchant_a"], merchant_house_2: ["merchant_b"], town: ["town", "town_council", "guild"], commons: ["rural_community", "community"],
  });
  assert.deepEqual(FACTION_LEADER_MIN_AGE, { overlord: 25, crown: 25, neighbour_1: 25, neighbour_2: 25, bishop: 40, merchant_house_1: 25, merchant_house_2: 25, town: 30, commons: 25 });
});
