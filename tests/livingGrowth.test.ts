/** LM-E5 living growth (spec docs/design/living-growth.md LG-1…LG-5): the scenarios. */
import assert from "node:assert/strict";
import test from "node:test";

import { FOOTPATH_KEEP, FOOTPATH_MAKE, GROWN_YEARS, STUMP_YEARS } from "../src/content/landConfig";
import { TEMPERAMENT_SPREAD } from "../src/content/townAgencyConfig";
import type { GameState } from "../src/engine/engine.types";
import { advanceLand, fallowStage, landOf, treeStage } from "../src/engine/land";
import { advanceTick } from "../src/engine/tick";
import { actorTemperament, initialAgency, townProposals } from "../src/engine/townAgency";
import { migrateV42ToV43 } from "../src/save/migrations/v42ToV43";
import { DEFAULT_GAME_STATE } from "../src/state/gameStore";
import { NEW_GAME_SEED_MAX, newGameState, randomNewGameSeed } from "../src/state/newGame";

const SCENARIO = "core:campaign_market_town";
const YEAR = 4000;
const terrains = (state: GameState) => state.tiles.map(tile => tile.terrain[0]).join("");

test("LG-1 the riverside town takes any seed: seed 1 is today's map, another seed its own river and woods; the same seed, the same map", () => {
  const one = newGameState({ scenarioId: SCENARIO, seed: 1 })!;
  assert.equal(terrains(one), terrains(DEFAULT_GAME_STATE));
  const maps = [2, 31, 4242].map(seed => newGameState({ scenarioId: SCENARIO, seed })!);
  assert.ok(maps.every(state => state !== null && state.seed !== 1));
  assert.equal(new Set([one, ...maps].map(terrains)).size, 4, "four seeds, four maps");
  assert.deepEqual(newGameState({ scenarioId: SCENARIO, seed: 31 }), maps[1], "the same seed gives the same game");
  assert.equal(newGameState({ scenarioId: SCENARIO, seed: 0 }), null);
});

test("LG-1 a new game draws its seed at random (shown, reusable): the draw is a playable seed within six digits", () => {
  const draws = [0, 0.25, 0.5, 0.999999].map(value => randomNewGameSeed({ scenarioId: SCENARIO }, () => value));
  assert.ok(draws.every(seed => Number.isInteger(seed) && seed >= 1 && seed <= NEW_GAME_SEED_MAX));
  assert.equal(new Set(draws).size, draws.length);
  for (const seed of draws) assert.notEqual(newGameState({ scenarioId: SCENARIO, seed }), null);
});

test("LG-2 each actor has a temperament from the seed; the same seed, the same temperaments; seeds differ in them", () => {
  const kinds = initialAgency().actors.map(actor => actor.kind);
  const of = (seed: number) => kinds.map(kind => actorTemperament({ seed }, kind)).join(",");
  assert.equal(of(7), of(7));
  assert.ok(new Set([1, 2, 3, 4, 5, 6, 7, 8].map(of)).size > 1);
  assert.ok(TEMPERAMENT_SPREAD.bold > TEMPERAMENT_SPREAD.cautious, "a bold actor's draw is flatter");
});

test("LG-2 a lord-mode town chooses by chance: its receipts carry the project's (and site's) chance; the same seed draws the same", () => {
  const run = (seed: number) => {
    let state: GameState = newGameState({ scenarioId: SCENARIO, seed, mode: "lord" })!;
    for (let tick = 0; tick < 2_400; tick += 1) state = advanceTick(state);
    return state;
  };
  const a = run(31);
  const receipts = a.agency!.receipts;
  assert.ok(receipts.length > 0);
  for (const receipt of receipts) {
    assert.ok(receipt.chance !== undefined && receipt.chance.project.permille > 0 && receipt.chance.project.permille <= 1000);
    assert.ok(receipt.chance.project.of >= 1 && receipt.chance.project.place >= 1);
  }
  assert.deepEqual(run(31).agency!.receipts, receipts, "the same seed, the same draws");
  // A candidate site drawn by chance says so on its proposal.
  const proposals = townProposals(a).filter(proposal => proposal.sites !== undefined && proposal.sites.count > 1);
  assert.ok(proposals.every(proposal => proposal.siteChance !== undefined && proposal.siteChance.of >= 1));
});

test("LG-3 ① a felled tree is a stump, then a sapling, then grown; grown outside a zone it stands as forest again", () => {
  assert.equal(treeStage({ harvestedAtTick: 0 }, STUMP_YEARS * YEAR - 1), "stump");
  assert.equal(treeStage({ harvestedAtTick: 0 }, STUMP_YEARS * YEAR), "sapling");
  assert.equal(treeStage({ harvestedAtTick: 0 }, GROWN_YEARS * YEAR), "grown");
  const base = structuredClone(DEFAULT_GAME_STATE);
  const forest = base.tiles.filter(tile => tile.terrain === "forest" && !tile.hasRoad && tile.buildingId === null).slice(0, 2);
  const zoned = forest[1]!;
  const state: GameState = { ...base, tick: GROWN_YEARS * YEAR,
    forestHarvests: forest.map(tile => ({ tx: tile.tx, ty: tile.ty, harvestedAtTick: 0 })),
    zones: [{ id: "zone-000001", kind: "arable", strokes: [], membership: [zoned.ty * base.width + zoned.tx], createdOrdinal: 1 }] };
  const next = advanceLand(state);
  assert.deepEqual(next.forestHarvests.map(harvest => `${harvest.tx},${harvest.ty}`), [`${zoned.tx},${zoned.ty}`], "the zoned cell stays cleared");
});

test("LG-3 ② a year's footfall makes a footpath, a path barely walked grows over; ③ a left plot goes grass, scrub, saplings", () => {
  const base = structuredClone(DEFAULT_GAME_STATE);
  const open = base.tiles.filter(tile => tile.terrain === "grass" && !tile.hasRoad && tile.buildingId === null).slice(0, 2).map(tile => tile.ty * base.width + tile.tx);
  const state: GameState = { ...base, tick: YEAR, land: { footfall: [[open[0]!, FOOTPATH_MAKE], [open[1]!, FOOTPATH_KEEP - 1]], footpaths: [open[1]!], fallow: [] } };
  const land = landOf(advanceLand(state));
  assert.ok(land.footpaths.includes(open[0]!), "walked enough: a path");
  assert.ok(!land.footpaths.includes(open[1]!), "barely walked: grown over");
  assert.deepEqual(land.footfall, [], "the year's count starts again");
  assert.equal(fallowStage(0, YEAR - 1), "grass");
  assert.equal(fallowStage(0, YEAR), "scrub");
  assert.equal(fallowStage(0, 2 * YEAR), "sapling");
});

test("LG-5 v43: a v42 save moves only its version", () => {
  assert.deepEqual(migrateV42ToV43({ schemaVersion: 42, state: { tick: 1 } }), { schemaVersion: 43, state: { tick: 1 } });
});
