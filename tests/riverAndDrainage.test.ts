/**
 * ARCH-1b (spec docs/design/map-archetypes.md MA-9…MA-11): a river across every land (the riverside town's and the fen's
 * 2–4 wide, the others' brook), its flow for the render, the fulling mill on running water only, and the fen's drainage
 * works — a player command paid in timber and dug by the town's spare men, the mere turned to meadow.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { DRAINAGE_BALANCE } from "../src/content/drainageConfig";
import { FEN_ARCHETYPE_ID, MAP_ARCHETYPES, RIVERSIDE_ARCHETYPE_ID } from "../src/content/scenario/archetypes";
import { DEFAULT_SCENARIO_ID } from "../src/content/scenario/coreScenarios";
import { drainagePlan } from "../src/engine/drainage";
import type { GameState } from "../src/engine/engine.types";
import { advanceTick } from "../src/engine/tick";
import { decodeSave } from "../src/save/saveCodec";
import { DEFAULT_GAME_STATE, gameReducer } from "../src/state/gameStore";
import { newGameState } from "../src/state/newGame";
import { buildArchetypeWorld, RIVER_CLOSED } from "../src/world/archetypeTerrain";
import { placementSpendableResource, canPlaceBuildingBeforeRoad, PlacementFailure } from "../src/world/placement";
import { currentArrowKey, isFlowingWater, type RiverData } from "../src/world/river";

const SIZE = { width: 64, height: 64 };
const inRect = (rect: (typeof RIVER_CLOSED)[number], index: number) => {
  const tx = index % 64, ty = Math.floor(index / 64);
  return tx >= rect.minTx && tx <= rect.maxTx && ty >= rect.minTy && ty <= rect.maxTy;
};
const block = (cells: ReadonlySet<number>, side: number) => [...cells].some(cell => {
  for (let dy = 0; dy < side; dy += 1) for (let dx = 0; dx < side; dx += 1) if (!cells.has(cell + dy * 64 + dx) || cell % 64 + dx > 63) return false;
  return true;
});

test("MA-9 every land has its flowing water across the map — the riverside town's and the fen's a river, the others' a brook — off the town site, with its flow, fords and bridge sites", () => {
  for (const archetype of MAP_ARCHETYPES) for (const seed of [1, 2, 3]) {
    const world = buildArchetypeWorld(archetype, { ...SIZE, seed });
    const river = world.river!;
    const label = `${archetype.id} seed ${seed}`;
    assert.equal(river.kind, archetype.terrain.river.kind, label);
    assert.equal(river.flow.length, river.cells.length);
    assert.ok(/^[nesw]+$/.test(river.flow), label);
    assert.ok(river.cells.every(cell => world.terrains[cell] === "water"), label);
    assert.ok(river.cells.every(cell => !RIVER_CLOSED.some(rect => inRect(rect, cell))), `${label}: off the town site and the camp's copse`);
    const channel = new Set(river.cells);
    const edges = [river.cells.some(cell => cell < 64), river.cells.some(cell => cell >= 63 * 64), river.cells.some(cell => cell % 64 === 0), river.cells.some(cell => cell % 64 === 63)];
    assert.ok(edges.filter(Boolean).length >= (archetype.terrain.sea === undefined ? 2 : 1), `${label}: reaches the map's edges ${edges}`);
    if (river.kind === "river") assert.ok(block(channel, 3), `${label}: a river is wider in its reaches`);
    else assert.ok(!block(channel, 3), `${label}: a brook stays narrow`);
    assert.ok(river.fords.every(cell => channel.has(cell)), label);
    for (const site of river.bridgeSites) {
      assert.equal(world.terrains[site.ty * 64 + site.tx], "grass", `${label}: a bridge site's bank is open`);
      const step = site.axis === "x" ? 1 : 64;
      assert.ok(channel.has(site.ty * 64 + site.tx + step) || channel.has(site.ty * 64 + site.tx - step), `${label}: the bank faces the channel`);
    }
    assert.ok(river.bridgeSites.length > 0, `${label}: somewhere to bridge`);
  }
  assert.deepEqual((["n", "e", "s", "w"] as const).map(currentArrowKey),
    ["water/current_arrows_ne_sheet", "water/current_arrows_se_sheet", "water/current_arrows_sw_sheet", "water/current_arrows_nw_sheet"]);
  // The new game and the default town carry their river.
  assert.deepEqual(DEFAULT_GAME_STATE.river, buildArchetypeWorld(MAP_ARCHETYPES[0]!, { ...SIZE, seed: 1 }).river);
  assert.deepEqual(newGameState({ scenarioId: DEFAULT_SCENARIO_ID, archetypeId: FEN_ARCHETYPE_ID, seed: 2 })!.river,
    buildArchetypeWorld(MAP_ARCHETYPES.find(entry => entry.id === FEN_ARCHETYPE_ID)!, { ...SIZE, seed: 2 }).river);
});

test("MA-10 the fulling mill's wheel needs running water: beside the river it stands, beside a still mere it does not; an older save's water all runs", () => {
  const town: GameState = { ...DEFAULT_GAME_STATE, era: "palisade", treasuryTimber: 999 };
  const channel = new Set(town.river!.cells);
  const ring = (tx: number, ty: number) => { const cells: number[] = []; for (let dy = -1; dy <= 2; dy += 1) for (let dx = -1; dx <= 2; dx += 1) {
    if (dx >= 0 && dx < 2 && dy >= 0 && dy < 2) continue; const x = tx + dx, y = ty + dy; if (x >= 0 && y >= 0 && x < 64 && y < 64) cells.push(y * 64 + x); } return cells; };
  const { river: _river, ...older } = town;
  const spots = town.tiles.filter(tile => canPlaceBuildingBeforeRoad(older, "fulling_mill", tile.tx, tile.ty).ok);
  const byRiver = spots.find(tile => ring(tile.tx, tile.ty).some(cell => channel.has(cell)));
  const byMere = spots.find(tile => ring(tile.tx, tile.ty).every(cell => !channel.has(cell)) && ring(tile.tx, tile.ty).some(cell => town.tiles[cell]!.terrain === "water"));
  assert.ok(byRiver !== undefined && byMere !== undefined, "a spot by the river and one by a still mere");
  assert.deepEqual(canPlaceBuildingBeforeRoad(town, "fulling_mill", byRiver.tx, byRiver.ty), { ok: true });
  assert.deepEqual(canPlaceBuildingBeforeRoad(town, "fulling_mill", byMere.tx, byMere.ty), { ok: false, reason: PlacementFailure.needs_adjacent_terrain });
  assert.deepEqual(canPlaceBuildingBeforeRoad(older, "fulling_mill", byMere.tx, byMere.ty), { ok: true }, "an older save: all water runs");
  assert.ok(town.tiles.every((tile, index) => tile.terrain !== "water" || isFlowingWater(older, index)));
});

/** A grown town on a fen (the v32 fixture's town, its land set to the fen and no channel near its meres). */
function fenTown(): GameState {
  const saved = decodeSave(new Uint8Array(readFileSync("fixtures/saves/v32/population-176.save.json"))).envelope.state as GameState;
  const river: RiverData = { kind: "river", cells: [], flow: "", fords: [], bridgeSites: [] };
  return { ...saved, archetypeId: FEN_ARCHETYPE_ID, river, treasuryTimber: 500 };
}

function bankOfMere(state: GameState): { tx: number; ty: number } {
  const tile = state.tiles.find(entry => entry.terrain === "water" && !entry.hasRoad && drainagePlan(state, entry.tx, entry.ty).ok
    && (drainagePlan(state, entry.tx, entry.ty) as { cells: readonly number[] }).cells.length >= 9);
  assert.ok(tile !== undefined, "a mere with a bank");
  return { tx: tile.tx, ty: tile.ty };
}

test("MA-11 ① the drainage plan: the fen's still water within two tiles, on a bank; not the river, not another land, not without the timber, two works at most", () => {
  const town = fenTown();
  const at = bankOfMere(town);
  const plan = drainagePlan(town, at.tx, at.ty);
  assert.ok(plan.ok);
  assert.ok(plan.cells.length <= 25 && plan.cells.every(cell => town.tiles[cell]!.terrain === "water"));
  assert.ok(plan.cells.every(cell => Math.abs(cell % 64 - at.tx) <= 2 && Math.abs(Math.floor(cell / 64) - at.ty) <= 2));
  assert.equal(plan.timber, plan.cells.length * DRAINAGE_BALANCE.timberPerCell);
  assert.equal(plan.seasons, Math.ceil(plan.cells.length * DRAINAGE_BALANCE.workPerCell / DRAINAGE_BALANCE.diggers / 1000));
  assert.deepEqual(drainagePlan({ ...town, archetypeId: RIVERSIDE_ARCHETYPE_ID }, at.tx, at.ty), { ok: false, reason: "not_fen" });
  assert.deepEqual(drainagePlan({ ...town, river: { ...town.river!, cells: [at.ty * 64 + at.tx], flow: "s" } }, at.tx, at.ty), { ok: false, reason: "not_still_water" });
  assert.deepEqual(drainagePlan({ ...town, treasuryTimber: 0, buildings: town.buildings.map(building => ({ ...building, inventory: { ...building.inventory, timber: 0 } })) }, at.tx, at.ty),
    { ok: false, reason: "insufficient_timber" });
  const started = gameReducer(town, { type: "drain_fen", tx: at.tx, ty: at.ty });
  assert.equal(started.drainage!.works.length, 1);
  assert.equal(placementSpendableResource(started, "timber"), placementSpendableResource(town, "timber") - plan.timber, "the timber is paid at the command");
  assert.deepEqual(drainagePlan(started, at.tx, at.ty), { ok: false, reason: "busy" });
  assert.equal(gameReducer(started, { type: "drain_fen", tx: at.tx, ty: at.ty }), started, "a refused command leaves the state");
  const decision = started.history!.records.at(-1)!;
  assert.deepEqual([decision.template, decision.decision?.chosen, decision.decision?.alternatives], ["decision.drainage", "drain", ["leave"]]);
});

test("MA-11 ② the works dig with the men the fields left and, when their work is done, the mere is meadow — a record in the ledger", () => {
  const town = fenTown();
  const at = bankOfMere(town);
  const plan = drainagePlan(town, at.tx, at.ty);
  assert.ok(plan.ok);
  let state = gameReducer(town, { type: "drain_fen", tx: at.tx, ty: at.ty });
  let dug = 0;
  for (let step = 0; step < 6000 && (state.drainage?.works.length ?? 0) > 0; step += 1) {
    state = advanceTick(state);
    const men = state.labour?.drainage ?? 0;
    assert.ok(men <= DRAINAGE_BALANCE.diggers);
    dug += men;
  }
  assert.equal(state.drainage!.works.length, 0, "the works finished");
  assert.ok(dug >= plan.workNeeded, `dug ${dug} of ${plan.workNeeded}`);
  assert.ok(plan.cells.every(cell => state.tiles[cell]!.terrain === "grass"), "the mere is meadow");
  assert.deepEqual(state.drainage!.drained, plan.cells);
  assert.equal(state.history!.records.filter(record => record.template === "drainage.done").length, 1);
});
