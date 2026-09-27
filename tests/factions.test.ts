/**
 * FACTION-0 factions (spec docs/design/factions.md FX-1…FX-8): scenarios X1–X8.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { PRESSURE_BALANCE } from "../src/content/balanceConfig";
import { FACTION_DEFS, FACTION_EVENT_PERMILLE, FACTION_PORTRAIT_POOLS, RELATION_RULES } from "../src/content/factionConfig";
import type { GameState } from "../src/engine/engine.types";
import {
  advanceFactions, applyFactionRecords, factionChanges, factionChronicle, factionOfPetitioner, factionsList, kingOf, worldTimeline,
} from "../src/engine/factions";
import type { FactionState } from "../src/engine/faction.types";
import { advanceHistory, historySummary } from "../src/engine/history";
import { advancePersons, personById } from "../src/engine/persons";
import { initialPolitics } from "../src/engine/politics";
import { identityFaction } from "../src/engine/portraits";
import { hashSeed } from "../src/engine/prng";
import { decodeSave, encodeSave } from "../src/save/saveCodec";
import { SAVE_SCHEMA_VERSION } from "../src/save/saveTypes";
import { gameReducer } from "../src/state/gameStore";

const SEASON = PRESSURE_BALANCE.seasonTicks;
const YEAR = 4 * SEASON;

/** The 24-house walled town (v20 fixture) at the start of a year, with the politics of a new chapter 1. */
function town(): GameState {
  const state = decodeSave(new Uint8Array(readFileSync("fixtures/saves/v20/palisade-construction.save.json"))).envelope.state as GameState;
  const tick = Math.ceil(state.tick / YEAR) * YEAR;
  return { ...state, tick, politics: initialPolitics(state) };
}
const withFactions = (state: GameState): GameState => advanceFactions({ ...state, factions: undefined as never } as GameState);
function created(): GameState {
  const { factions: _factions, ...rest } = town();
  return advanceFactions(rest as GameState);
}
const factionOf = (state: GameState, id: string) => state.factions!.factions.find(entry => entry.id === id)!;
const petition = (state: GameState, defId: string, petitioner: Parameters<typeof factionOfPetitioner>[0]): GameState =>
  ({ ...state, politics: { ...state.politics!, petitions: [...state.politics!.petitions, { id: `${defId}@${state.tick}`, defId, petitioner, arrivedTick: state.tick }] } });

test("X1 (FX-1, FX-2) nine factions from the seed: names, heraldry and leaders — the outside factions' own people, the king by the calendar, the town's heads", () => {
  const state = created();
  const factions = state.factions!;
  assert.deepEqual(factions.factions.map(entry => [entry.id, entry.kind]), FACTION_DEFS.map(def => [def.id, def.kind]));
  assert.deepEqual(created().factions, factions, "the same seed, the same factions");
  assert.equal(new Set(factions.factions.map(entry => entry.heraldrySeed)).size, 9);
  assert.equal(factionOf(state, "overlord").relation, 20);
  const year = Math.floor(state.tick / YEAR) + 1300;
  const king = personById(state, factionOf(state, "crown").leaderId!)!;
  assert.equal(king.givenName, kingOf(year).name);
  for (const id of ["overlord", "neighbour_1", "neighbour_2", "bishop"]) {
    const leader = personById(state, factionOf(state, id).leaderId!)!;
    assert.ok(leader.id.startsWith("f-") && leader.householdId === `faction:${id}` && leader.portraitIdentity.length > 0, id);
    assert.equal(leader.classBand, id === "bishop" ? "clerical" : "gentry");
  }
  assert.notEqual(factionOf(state, "neighbour_1").name, factionOf(state, "neighbour_2").name);
  // The town's factions are led by its household heads: two merchant families, an artisan, the reeve.
  const heads = new Set(state.persons!.people.filter(person => person.role === "head").map(person => person.id));
  for (const id of ["merchant_house_1", "merchant_house_2", "town", "commons"]) assert.ok(heads.has(factionOf(state, id).leaderId!), id);
  assert.equal(new Set(["merchant_house_1", "merchant_house_2", "town", "commons"].map(id => factionOf(state, id).leaderId)).size, 4);
  assert.notEqual(factionOf(state, "merchant_house_1").name, factionOf(state, "merchant_house_2").name);
  const other = advanceFactions({ ...town(), seed: town().seed + 1, factions: undefined } as unknown as GameState).factions!;
  assert.notDeepEqual(other.factions.map(entry => entry.name), factions.factions.map(entry => entry.name));
});

test("X2 (FX-3) petitions belong to factions: the Crown's writs name the king, the refugees the bishop; the town's own name its heads", () => {
  assert.deepEqual(["merchants", "overlord", "crown", "townsfolk", "refugees"].map(petitioner => factionOfPetitioner(petitioner as never)),
    ["merchant_house_1", "overlord", "crown", "town", "bishop"]);
  let state = created();
  state = petition(petition(petition(state, "wool_payment", "crown"), "refugee_admission", "refugees"), "market_charter", "merchants");
  const named = advancePersons({ ...state, tick: state.tick + 1 });
  const byDef = (defId: string) => named.politics!.petitions.find(entry => entry.defId === defId)!.petitionerIds!;
  assert.deepEqual(byDef("wool_payment"), [factionOf(state, "crown").leaderId]);
  assert.deepEqual(byDef("refugee_admission"), [factionOf(state, "bishop").leaderId]);
  assert.ok(byDef("market_charter").length >= 2 && byDef("market_charter").every(id => id.startsWith("p-")));
  const demands = factionsList(named);
  assert.deepEqual(demands.find(entry => entry.id === "crown")!.demands.map(entry => entry.defId), ["wool_payment"]);
  assert.deepEqual(demands.find(entry => entry.id === "bishop")!.demands.map(entry => entry.defId), ["refugee_admission"]);
  assert.deepEqual(demands.find(entry => entry.id === "merchant_house_1")!.demands.map(entry => entry.defId), ["market_charter"]);
});

test("X3 (FX-4) an answer moves its faction's relation, and the faction remembers it by the ledger's record", () => {
  const base = petition(created(), "market_charter", "merchants");
  const id = base.politics!.petitions.at(-1)!.id;
  const accepted = gameReducer(base, { type: "petition_response", petitionId: id, response: "accept" });
  const house = factionOf(accepted, "merchant_house_1");
  assert.equal(house.relation, factionOf(base, "merchant_house_1").relation + RELATION_RULES.petition.accept);
  const memory = house.memory.at(-1)!;
  assert.equal(memory.reason, "petition:market_charter:accept");
  const record = accepted.history!.records.find(entry => entry.id === memory.recordId)!;
  assert.equal(record.template, "faction.relation");
  assert.equal(historySummary(record), `${house.name} 상인 가문의 마음이 누그러졌다(+10, 이제 ${house.relation}) — 시장권 청원에 수락`);
  // The decision itself names the faction.
  const decision = accepted.history!.records.find(entry => entry.template === "decision.petition_response")!;
  assert.deepEqual(decision.actors, [{ type: "faction", id: "merchant_house_1" }]);
  const refused = gameReducer(base, { type: "petition_response", petitionId: id, response: "refuse" });
  assert.equal(factionOf(refused, "merchant_house_1").relation, factionOf(base, "merchant_house_1").relation + RELATION_RULES.petition.refuse);
  // The Crown's writ refused costs more.
  const writ = petition(created(), "levy_response", "crown");
  const defied = gameReducer({ ...writ, war: { messengerTick: writ.tick, favour: true, answers: {}, instalments: [] } },
    { type: "petition_response", petitionId: writ.politics!.petitions.at(-1)!.id, response: "refuse" });
  assert.equal(factionOf(defied, "crown").relation, factionOf(writ, "crown").relation + RELATION_RULES.crown.refuse);
});

test("X4 (FX-4) the famine's answer, a decline and its end, a new lord's house and the raid move the factions they touch", () => {
  const base = created();
  const famine = { ...base, events: { records: [{ id: "great_famine@60", defId: "great_famine", kind: "dearth" as const, season: 60, arrivalTick: base.tick,
    losses: { burntHouses: 0, departures: 0, harvestLost: 0 } }], burning: [] } };
  const relieved = { ...famine, events: { ...famine.events, records: [{ ...famine.events.records[0]!, response: { choice: "relief" as const, tick: base.tick } }] } };
  assert.deepEqual(factionChanges(famine, relieved), [{ factionId: "commons", delta: 15, reason: "famine:relief" }, { factionId: "bishop", delta: 10, reason: "famine:relief" }]);
  const lordship = { house: { order: 1, name: "de Haverel", heraldrySeed: 1, since: 0 }, pastHouses: [], lostRights: [], titleDemoted: false, decline: null };
  const declined = { ...base, lordship: { ...lordship, titleDemoted: true, decline: { since: base.tick, cause: "arrears" as const, lost: "tolls" as const, by: "overlord" as const } } };
  assert.deepEqual(factionChanges({ ...base, lordship }, declined), [{ factionId: "overlord", delta: -20, reason: "decline:arrears" }]);
  assert.deepEqual(factionChanges(declined, { ...base, lordship }), [{ factionId: "overlord", delta: 10, reason: "restored" }]);
  const cooled = { ...base, factions: { ...base.factions!, factions: base.factions!.factions.map(entry => entry.id === "overlord" ? { ...entry, relation: -40 } : entry) } };
  const changed = { ...cooled, lordship: { ...lordship, house: { order: 2, name: "de Coldmere", heraldrySeed: 2, since: base.tick } } };
  assert.deepEqual(factionChanges({ ...cooled, lordship }, changed).find(change => change.factionId === "overlord"), { factionId: "overlord", delta: 30, reason: "house_change" });
  const war = { messengerTick: base.tick, favour: true, answers: {}, instalments: [] };
  const raid = (defencePermille: number) => ({ ...base, war: { ...war, raid: { tick: base.tick, defencePermille, losses: { burntHouses: 3, looted: 0, coin: 0 } } } });
  assert.deepEqual(factionChanges({ ...base, war }, raid(600)), [{ factionId: "town", delta: 5, reason: "raid:held" }]);
  assert.deepEqual(factionChanges({ ...base, war }, raid(0)), [{ factionId: "town", delta: -10, reason: "raid:breached" }]);
  // Through the ledger: one record each, remembered.
  const recorded = advanceHistory(famine, relieved);
  assert.deepEqual([factionOf(recorded, "commons").relation, factionOf(recorded, "bishop").relation], [factionOf(base, "commons").relation + 15, factionOf(base, "bishop").relation + 10]);
  assert.equal(factionOf(recorded, "commons").memory.length, 1);
});

test("X5 (FX-2) leaders age and die: an heir of the same house, a new king by the calendar, a new head when the town's leader is gone", () => {
  const base = created();
  const overlord = factionOf(base, "overlord");
  // An earl of ninety dies at the year's roll (most years); his heir carries the name.
  const old = { ...base, factions: { ...base.factions!, people: base.factions!.people.map(person => person.id === overlord.leaderId ? { ...person, birthYear: 1200 } : person) } };
  let state: GameState = old;
  for (let year = 1; year <= 5 && factionOf(state, "overlord").leaderId === overlord.leaderId; year += 1) state = advanceFactions({ ...state, tick: base.tick + year * YEAR });
  const heir = personById(state, factionOf(state, "overlord").leaderId!)!;
  assert.notEqual(heir.id, overlord.leaderId);
  assert.equal(heir.surname, personById(base, overlord.leaderId!)!.surname);
  assert.equal(personById(state, overlord.leaderId!)!.alive, false);
  assert.deepEqual(factionOf(state, "overlord").timeline.filter(entry => entry.kind === "leader").map(entry => [entry.id, entry.personId]), [["succeeded", heir.id]]);
  // The Crown: Edward III from 1327.
  const in1327 = advanceFactions({ ...base, tick: (1327 - 1300) * YEAR });
  assert.equal(personById(in1327, factionOf(in1327, "crown").leaderId!)!.givenName, "Edward III");
  // The town's leader left: the next season has another.
  const leader = factionOf(base, "town").leaderId!;
  const gone = { ...base, persons: { ...base.persons!, people: base.persons!.people.filter(person => person.id !== leader) } };
  const next = advanceFactions({ ...gone, tick: base.tick + SEASON });
  assert.notEqual(factionOf(next, "town").leaderId, leader);
  assert.equal(factionOf(next, "town").timeline.at(-1)!.id, "chosen");
});

test("X6 (FX-5) the world's timeline by the year, and the outside factions' own affairs from the seed", () => {
  const base = created();
  const at1337 = advanceFactions({ ...base, tick: (1337 - 1300) * YEAR });
  assert.ok(factionOf(at1337, "crown").timeline.some(entry => entry.kind === "world" && entry.id === "hundred_years_war" && entry.year === 1337));
  assert.deepEqual(worldTimeline({ ...base, tick: (1340 - 1300) * YEAR }).map(event => event.id).slice(-3), ["edward_iii", "hundred_years_war", "sluys"]);
  // A neighbour's affairs over 1300–1450: exactly the years the seed's roll falls under a quarter.
  let state = base;
  for (let year = 1301; year <= 1450; year += 1) state = advanceFactions({ ...state, tick: (year - 1300) * YEAR });
  const affairs = factionOf(state, "neighbour_1").timeline.filter(entry => entry.kind === "affair").length;
  const expected = Array.from({ length: 150 }, (_, index) => 1301 + index).filter(year => hashSeed(base.seed, "faction-affair:neighbour_1", year) % 1000 < FACTION_EVENT_PERMILLE).length;
  assert.equal(affairs, expected);
  assert.ok(affairs > 20 && affairs < 60, `${affairs} affairs in 150 years`);
  assert.equal(factionOf(state, "town").timeline.filter(entry => entry.kind === "affair").length, 0, "the town's factions have no outside affairs");
});

test("X7 (FX-6) the API: promises (rights, loans), the faction's chronicle page and its people", () => {
  const base = created();
  const granted = { ...base, politics: { ...base.politics!, rights: [{ id: "market_charter", holder: "merchants" as const, grantedTick: base.tick, petitionId: "market_charter@1", stallFeePermille: 750 }] },
    war: { messengerTick: base.tick, favour: true, answers: {}, instalments: [{ category: "war_loan" as const, perSeason: 10, seasonsLeft: 4 }] } };
  const house = factionsList(granted).find(entry => entry.id === "merchant_house_1")!;
  assert.deepEqual(house.promises, [{ kind: "right", id: "market_charter" }, { kind: "loan", id: "war_loan" }]);
  const answered = gameReducer(petition(base, "market_charter", "merchants"), { type: "petition_response", petitionId: `market_charter@${base.tick}`, response: "accept_with_price" });
  const page = factionChronicle(answered, "merchant_house_1")!;
  assert.deepEqual(page.records.map(record => record.template), ["decision.petition_response", "faction.relation"]);
  assert.equal(page.faction.relation, factionOf(base, "merchant_house_1").relation + RELATION_RULES.petition.accept_with_price);
  assert.equal(factionChronicle(answered, "bishop")!.records.length, 0);
  // Chapter 2's events belong to factions too: the messenger to the Crown, the raid to the town.
  const war = { messengerTick: base.tick, favour: true, answers: {}, instalments: [] };
  const met = advanceHistory(base, { ...base, war });
  assert.deepEqual(factionChronicle(met, "crown")!.records.map(record => record.template), ["war.messenger"]);
  const raided = advanceHistory({ ...base, war }, { ...base, war: { ...war, raid: { tick: base.tick, defencePermille: 600, losses: { burntHouses: 3, looted: 10, coin: 5 } } } });
  assert.deepEqual(factionChronicle(raided, "town")!.records.map(record => record.template), ["war.raid", "faction.relation"]);
});

test("X8 (FX-7, FX-8) the save round trip (v21), a v20 town gets its factions at its next tick, and the factions touch nothing else", () => {
  const state = created();
  assert.ok(SAVE_SCHEMA_VERSION >= 21);
  const saved = decodeSave(encodeSave({ state, createdAt: "2026-09-27T00:00:00.000Z", savedAt: "2026-09-27T00:00:00.000Z" }).bytes);
  assert.deepEqual(saved.envelope.state, state);
  const v20 = decodeSave(new Uint8Array(readFileSync("fixtures/saves/v20/palisade-construction.save.json")));
  assert.deepEqual([v20.migratedFrom, (v20.envelope.state as GameState).factions], [20, undefined]);
  const opened = advanceFactions({ ...(v20.envelope.state as GameState), tick: (v20.envelope.state as GameState).tick + 1 });
  assert.equal(opened.factions!.factions.length, 9);
  // Only `factions` changes — and (CODE-1a) the town factions' leaders take their faction's pool-3 face.
  const townLeaders = new Map(opened.factions!.factions.filter(faction => FACTION_DEFS.find(def => def.id === faction.id)!.leaders === "town" && faction.leaderId !== null)
    .map(faction => [faction.leaderId!, faction.id]));
  const { factions: _added, ...rest } = opened;
  const { factions: _none, ...before } = { ...(v20.envelope.state as GameState), tick: opened.tick };
  const faces = rest.persons!.people.filter((person, index) => person.portraitIdentity !== before.persons!.people[index]!.portraitIdentity);
  assert.ok(faces.length > 0 && faces.every(person => townLeaders.has(person.id)
    && FACTION_PORTRAIT_POOLS[townLeaders.get(person.id)!].includes(identityFaction(person.portraitIdentity) ?? "")), "the changed faces are town leaders' pool-3 faces");
  assert.deepEqual({ ...rest, persons: { ...rest.persons!, people: rest.persons!.people.map((person, index) => ({ ...person, portraitIdentity: before.persons!.people[index]!.portraitIdentity })) } }, before);
  // Records without a faction change nothing.
  const same: FactionState = applyFactionRecords(state.factions!, []);
  assert.equal(same, state.factions);
  assert.equal(withFactions(state).factions!.factions.length, 9);
});

/**
 * FIX-5 (decision FN12): the factions' own pin, apart from the world hashes (which leave the factions out, FN7). A fixed
 * run — the seed's factions, a charter accepted, the famine relieved, a Crown writ refused, a raid held, then the
 * outside factions' years to 1450 (deaths, heirs, kings, affairs, the world) — gives the same relations, memories,
 * leaders and timelines every time. A change of the relation rules, the names or the seed's picks re-records it.
 */
function pinnedRun(): FactionState {
  let state = petition(created(), "market_charter", "merchants");
  state = gameReducer(state, { type: "petition_response", petitionId: state.politics!.petitions.at(-1)!.id, response: "accept" });
  const famine = { ...state, events: { records: [{ id: "great_famine@92", defId: "great_famine", kind: "dearth" as const, season: 92, arrivalTick: state.tick,
    losses: { burntHouses: 0, departures: 0, harvestLost: 0 } }], burning: [] } };
  state = advanceHistory(famine, { ...famine, events: { ...famine.events, records: [{ ...famine.events.records[0]!, response: { choice: "relief" as const, tick: state.tick } }] } });
  const war = { messengerTick: state.tick, favour: true, answers: {}, instalments: [] };
  state = petition({ ...state, war }, "levy_response", "crown");
  state = gameReducer(state, { type: "petition_response", petitionId: state.politics!.petitions.at(-1)!.id, response: "refuse" });
  state = advanceHistory(state, { ...state, war: { ...state.war!, raid: { tick: state.tick, defencePermille: 600, losses: { burntHouses: 3, looted: 0, coin: 0 } } } });
  for (let year = 1324; year <= 1450; year += 1) state = advanceFactions({ ...state, tick: (year - 1300) * YEAR });
  return state.factions!;
}

test("X9 (FX-4, FX-5) the same seed and the same commands give the same factions — relations, memories, leaders, timelines (pinned)", () => {
  const once = pinnedRun();
  assert.deepEqual(pinnedRun(), once);
  assert.deepEqual(once.factions.map(entry => [entry.id, entry.relation, entry.memory.map(memory => memory.reason)]), [
    ["overlord", 20, []], ["crown", -10, ["petition:levy_response:refuse"]], ["neighbour_1", 0, []], ["neighbour_2", 0, []],
    ["bishop", 20, ["famine:relief"]], ["merchant_house_1", 10, ["petition:market_charter:accept"]], ["merchant_house_2", 0, []],
    ["town", 15, ["raid:held"]], ["commons", 25, ["famine:relief"]]]);
  // CODE-1a (decision FX6-2): the leaders and heirs wear their pool-3 faces (was 83ac82e83047d496f101ccb6f5974cc1512cde416ddbc4b08bc8949a5f17e0f9).
  assert.equal(createHash("sha256").update(JSON.stringify(once)).digest("hex"), "9dcbe59c87fa6768743debf96f09fc9a57057af1faa066461147bf940c988020");
});
