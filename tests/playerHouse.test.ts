/**
 * MANOR-1 (HOUSE-1, save v50): the player's house is the lord's first house — one name and one arms. A v49 lord-mode
 * save's chosen house (`registry.house`) becomes it everywhere the save wrote the old name; a save without a chosen house
 * keeps the house it had; a later house never takes the name of the one before it.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { LORD_HOUSE_NAMES } from "../src/content/lordshipConfig";
import type { GameState } from "../src/engine/engine.types";
import { armsHeraldrySeed, lordHouseName } from "../src/engine/lordshipState";
import { migrateV49ToV50 } from "../src/save/migrations/v49ToV50";

const raw = (name: string) => JSON.parse(readFileSync(`fixtures/saves/v49/${name}.save.json`, "utf8"));
const migrated = (envelope: unknown) => (migrateV49ToV50(envelope) as { state: GameState }).state;

test("HOUSE-1 a v49 lord-mode save: the chosen house becomes the first house — its name everywhere, its arms — and the registry keeps no house", () => {
  const envelope = raw("chapter-two-town");
  const old = envelope.state.lordship.house.name as string;
  assert.ok(JSON.stringify(envelope.state).includes(`"${old}"`));
  assert.ok((envelope.state.persons.people as { surname: string }[]).some(person => person.surname === old), "the lord's family carries the old name");
  envelope.state.registry = { occurrences: [], terms: [], nextTerm: 1, house: { name: "de Wyke", arms: "wyke" } };
  const state = migrated(envelope);
  assert.ok(!JSON.stringify(state).includes(`"${old}"`), "the old name is nowhere");
  const house = state.lordship!.house;
  assert.deepEqual([house.order, house.name, house.arms, house.heraldrySeed], [1, "de Wyke", "wyke", armsHeraldrySeed("wyke")]);
  assert.ok(state.persons!.people.some(person => person.surname === "de Wyke"));
  assert.equal("house" in state.registry!, false);
});

test("HOUSE-1 a v49 save without a chosen house (the campaign) keeps its house; one whose lordship was unwritten gets v49's by seed", () => {
  const envelope = raw("chapter-two-town");
  const kept = migrated(structuredClone(envelope));
  assert.deepEqual(kept.lordship!.house, envelope.state.lordship.house);
  const unwritten = structuredClone(envelope);
  delete unwritten.state.lordship;
  const written = migrated(unwritten).lordship!.house;
  assert.deepEqual([written.order, written.name, written.heraldrySeed, written.since], [1, envelope.state.lordship.house.name, envelope.state.seed, 0]);
});

test("FL-7 with HOUSE-1 a later house never takes the name of the house before it", () => {
  for (let seed = 1; seed <= 60; seed += 1) for (const previous of LORD_HOUSE_NAMES) assert.notEqual(lordHouseName(seed, 2, previous), previous);
});
