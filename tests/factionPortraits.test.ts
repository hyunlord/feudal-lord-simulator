/**
 * CODE-1a (decision FX6-2): the portrait pool 3 (I101–I124) is the factions' leaders' — the nine leaders wear their own
 * faction's faces and every one is installed (the render manifest has it); the town's other people never draw them.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { PRESSURE_BALANCE } from "../src/content/balanceConfig";
import { FACTION_DEFS, FACTION_PORTRAIT_POOLS } from "../src/content/factionConfig";
import { PORTRAIT_POOL } from "../src/content/portraitPool";
import type { GameState } from "../src/engine/engine.types";
import { advanceFactions } from "../src/engine/factions";
import { personById, personPortrait } from "../src/engine/persons";
import { initialPolitics } from "../src/engine/politics";
import { identityFaction } from "../src/engine/portraits";
import { decodeSave } from "../src/save/saveCodec";
import { PORTRAIT_IMAGES } from "../src/ui/portraitArtManifest.generated";

const YEAR = 4 * PRESSURE_BALANCE.seasonTicks;

function town(seed: number): GameState {
  const state = decodeSave(new Uint8Array(readFileSync("fixtures/saves/v22/palisade-construction.save.json"))).envelope.state as GameState;
  const { factions: _factions, ...rest } = { ...state, seed, tick: Math.ceil(state.tick / YEAR) * YEAR, politics: initialPolitics(state) };
  return advanceFactions(rest as GameState);
}

function leaders(state: GameState) {
  return state.factions!.factions.map(faction => {
    const leader = personById(state, faction.leaderId!)!;
    return { faction: faction.id, leader, portrait: personPortrait(state, leader) };
  });
}

test("pool 3 is in the pool (I101–I124, three ages each, with its factions) and the render manifest has every picture", () => {
  const third = PORTRAIT_POOL.filter(entry => entry.faction !== undefined);
  assert.equal(third.length, 72);
  assert.deepEqual([...new Set(third.map(entry => entry.identityId))].sort(), Array.from({ length: 24 }, (_, index) => `I${101 + index}`));
  assert.ok(PORTRAIT_POOL.every(entry => Object.hasOwn(PORTRAIT_IMAGES, entry.id)), "every pool picture has its web derivative");
  for (const pools of Object.values(FACTION_PORTRAIT_POOLS)) {
    assert.ok(pools.every(pool => third.some(entry => entry.faction === pool)), pools.join(","));
  }
});

test("the nine faction leaders all wear their faction's pool-3 face, installed in the manifest (seeds 1–5, and again after 1450's heirs)", () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    let state = town(seed);
    for (const when of ["first", "1450"] as const) {
      const rows = leaders(state);
      assert.equal(rows.length, 9);
      for (const { faction, leader, portrait } of rows) {
        assert.ok(Object.hasOwn(PORTRAIT_IMAGES, portrait.portraitId), `seed ${seed} ${when} ${faction}: ${portrait.portraitId}`);
        const own = FACTION_PORTRAIT_POOLS[faction].includes(identityFaction(leader.portraitIdentity) ?? "");
        const sexes = new Set(PORTRAIT_POOL.filter(entry => FACTION_PORTRAIT_POOLS[faction].includes(entry.faction ?? "")).map(entry => entry.sex));
        assert.ok(own || !sexes.has(leader.sex), `seed ${seed} ${when} ${faction}: ${leader.portraitIdentity} (${leader.sex})`);
      }
      if (when === "first") for (let year = Math.floor(state.tick / YEAR) + 1301; year <= 1450; year += 1) state = advanceFactions({ ...state, tick: (year - 1300) * YEAR });
    }
  }
});

test("the town's other people never draw a pool-3 face", () => {
  const state = town(3);
  const leading = new Set(state.factions!.factions.filter(faction => FACTION_DEFS.find(def => def.id === faction.id)!.leaders === "town").map(faction => faction.leaderId));
  const wearing = state.persons!.people.filter(person => identityFaction(person.portraitIdentity) !== undefined);
  assert.ok(wearing.every(person => leading.has(person.id)), wearing.map(person => person.id).join(","));
});
