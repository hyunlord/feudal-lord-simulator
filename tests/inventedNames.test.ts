/**
 * FIX-5 invented names (decision FN11, roadmap "실존 인물·가문 복원 안 함"): N1–N3. The lord's houses, the earls and
 * their titles, the neighbours, the sees and the bishops are invented; the kings and the world's events are history's.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { BISHOP_SURNAMES, EARLDOMS, KINGS, NEIGHBOUR_HOUSES, SEES, WORLD_EVENTS } from "../src/content/factionConfig";
import { EARLDOM_TITLES, GENTRY_NAMES_KO, GENTRY_SURNAMES, RETIRED_NAMES } from "../src/content/gentryNames";
import { LORD_HOUSE_NAMES } from "../src/content/lordshipConfig";
import type { GameState } from "../src/engine/engine.types";
import { migrateStateV21ToV22 } from "../src/save/migrations/v21ToV22";

const RETIRED = [...new Set(Object.values(RETIRED_NAMES).flatMap(table => Object.keys(table)))];

test("N1 invented names only: 30+ Anglo-Norman surnames and 8+ earldoms, every one with a Korean reading, none of the retired real ones", () => {
  assert.ok(new Set(GENTRY_SURNAMES).size === GENTRY_SURNAMES.length && GENTRY_SURNAMES.length >= 30, `${GENTRY_SURNAMES.length} surnames`);
  assert.ok(new Set(EARLDOM_TITLES).size >= 8);
  assert.ok(GENTRY_SURNAMES.every(name => /^(de [A-Z][a-z]+|Fitz[a-z]+)$/.test(name)), "de + place, or Fitz + name");
  const used = [...LORD_HOUSE_NAMES, ...EARLDOMS.flatMap(entry => [entry.title, entry.surname]), ...NEIGHBOUR_HOUSES, ...SEES, ...BISHOP_SURNAMES];
  assert.deepEqual(used.filter(name => RETIRED.includes(name)), []);
  assert.deepEqual(used.filter(name => GENTRY_NAMES_KO[name] === undefined), []);
  // History stays history's: the kings and the world's events.
  assert.deepEqual(KINGS.map(king => king.name), ["Edward I", "Edward II", "Edward III", "Richard II", "Henry IV", "Henry V", "Henry VI"]);
  assert.equal(WORLD_EVENTS.length, 19);
});

test("N2 no retired real house, earldom, see or bishop is named anywhere in the game's code but the save migration's table", () => {
  const offenders: string[] = [];
  const pattern = new RegExp(`["'\`](${RETIRED.join("|")})["'\`]`);
  const walk = (directory: string) => {
    for (const name of readdirSync(directory)) {
      const path = join(directory, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.(ts|tsx)$/.test(name) && !path.endsWith("gentryNames.ts") && !/generated/.test(name) && pattern.test(readFileSync(path, "utf8"))) offenders.push(path);
    }
  };
  walk("src");
  assert.deepEqual(offenders, []);
});

test("N3 (save v22) a v21 town's real names become the invented ones at the same place: the lord's houses, the factions, their people, the ledger", () => {
  const person = (id: string, householdId: string, surname: string) => ({ id, givenName: "John", surname, sex: "male" as const, birthYear: 1290, householdId,
    role: "head" as const, classBand: "gentry" as const, occupation: "lord", build: "average" as const, hair: "fair", alive: true, portraitIdentity: "x", tags: [] });
  const faction = (id: string, name: string, leaderId: string | null) => ({ id, kind: "overlord", name, leaderId, heraldrySeed: 1, relation: 0, memory: [], timeline: [] });
  const v21 = {
    lordship: { house: { order: 2, name: "Neville", heraldrySeed: 2, since: 10 }, pastHouses: [{ order: 1, name: "Mortimer", heraldrySeed: 1, since: 0, until: 10 }],
      titleDemoted: false, decline: null },
    factions: { nextOrdinal: 4, people: [person("f-000001", "faction:overlord", "Beauchamp"), person("f-000002", "faction:neighbour_1", "Basset"), person("f-000003", "faction:bishop", "de Stratford")],
      factions: [faction("overlord", "Warwick", "f-000001"), faction("neighbour_1", "Basset", "f-000002"), faction("bishop", "Winchester", "f-000003"), faction("merchant_house_1", "Chapman", null)] },
    history: { records: [
      { id: "h-1", tick: 10, kind: "milestone", template: "house.withdrew", params: { name: "Mortimer", order: 1 }, subject: { type: "town", id: "town" }, severity: 3 },
      { id: "h-2", tick: 11, kind: "faction", template: "faction.relation", params: { faction: "overlord", name: "Warwick", delta: 5, reason: "x", relation: 25 }, subject: { type: "faction", id: "overlord" }, severity: 1 },
    ], snapshots: [], nextOrdinal: 3, seasonDecisions: {}, milestones: [], pendingActuals: [] },
  } as unknown as GameState;
  const v22 = migrateStateV21ToV22(v21);
  assert.deepEqual([v22.lordship!.house.name, v22.lordship!.pastHouses[0]!.name], ["de Vauterre", "de Haverel"]);
  assert.deepEqual(v22.factions!.factions.map(entry => entry.name), ["Wessingford", "de Corbelle", "Kelborough", "Chapman"]);
  assert.deepEqual(v22.factions!.people.map(entry => entry.surname), ["de Valbrise", "de Corbelle", "de Brokeshaw"]);
  assert.deepEqual(v22.history!.records.map(record => record.params?.name), ["de Haverel", "Wessingford"]);
  assert.equal(migrateStateV21ToV22(v22).factions!.factions[0]!.name, "Wessingford", "an invented name stays");
});
