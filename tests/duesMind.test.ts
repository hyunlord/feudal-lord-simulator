/**
 * DUES-REL (decision DTR-18; the user's instruction 2026-10-08): the merchant houses' mind follows the stall fee as it
 * stands — a little each season above or below the agreed or customary rate, once sharply when the lord breaks an
 * agreement of his own — not each change of it.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { BUILDING_CONFIG_BY_KIND } from "../src/content/buildingConfig";
import { DUES_MIND } from "../src/content/duesMindConfig";
import { LORD_SLICE_SCENARIO_ID } from "../src/content/lordSliceConfig";
import { AGENCY_WEEK_TICKS } from "../src/content/townAgencyConfig";
import { activeDuesAgreement, duesReference } from "../src/engine/duesMind";
import type { GameState } from "../src/engine/engine.types";
import { lordBotCommands } from "../src/engine/lordBot";
import { registryOf } from "../src/engine/registry";
import { advanceTick } from "../src/engine/tick";
import { gameReducer } from "../src/state/gameStore";
import { newGameState } from "../src/state/newGame";

const lordGame = (): GameState => newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed: 1 })!;
const run = (state: GameState, ticks: number): GameState => { let next = state; for (let tick = 0; tick < ticks; tick += 1) next = advanceTick(next); return next; };
const relation = (state: GameState, id: string) => state.factions!.factions.find(faction => faction.id === id)!.relation;
const withRelation = (state: GameState, id: string, value: number): GameState =>
  ({ ...state, factions: { ...state.factions!, factions: state.factions!.factions.map(faction => faction.id === id ? { ...faction, relation: value } : faction) } });
const toSeason = (state: GameState) => run(state, 1_000 - (state.tick % 1_000));
const reasons = (state: GameState, from: number) => (state.history?.records ?? []).filter(record => record.tick >= from && record.template === "faction.relation")
  .map(record => String(record.params?.reason));

test("DTR-18: changing the fee moves no mind; while it stands over the custom the houses sour a point per 100‰ a season (at most 3), down to −40", () => {
  let state = run(lordGame(), 10);
  const before = relation(state, "merchant_house_1");
  for (const permille of [1100, 900, 1300]) state = gameReducer(state, { type: "set_market_dues", permille });
  assert.equal(relation(state, "merchant_house_1"), before, "three changes, no move");
  assert.equal(duesReference(state), DUES_MIND.customPermille);
  state = toSeason(state);
  assert.equal(relation(state, "merchant_house_1"), before - 3, "300‰ over: −3 at the season's turn");
  assert.ok(reasons(state, 0).includes("dues_held:1300:1000"));
  const near = toSeason(withRelation(state, "merchant_house_2", DUES_MIND.floor + 1));
  assert.equal(relation(near, "merchant_house_2"), DUES_MIND.floor, "the season's souring stops at the floor");
  assert.equal(relation(toSeason(near), "merchant_house_2"), DUES_MIND.floor);
});

test("DTR-18: below the custom the houses warm the same way, up to +30; at the reference nothing moves", () => {
  let state = gameReducer(run(lordGame(), 10), { type: "set_market_dues", permille: 800 });
  state = withRelation(state, "merchant_house_1", DUES_MIND.ceiling - 1);
  const was2 = relation(state, "merchant_house_2");
  state = toSeason(state);
  assert.equal(relation(state, "merchant_house_1"), DUES_MIND.ceiling);
  assert.equal(relation(state, "merchant_house_2"), Math.min(DUES_MIND.ceiling, was2 + 2));
  const even = gameReducer(state, { type: "set_market_dues", permille: 1000 });
  const after = toSeason(even);
  assert.equal(relation(after, "merchant_house_2"), relation(even, "merchant_house_2"));
});

test("DTR-18: a fee set at a registry answer is an agreement for ten years; the lord's own fee above it breaks it once, sharply, the agreement behind it", () => {
  // After the first season (the merchant house has its head: the event binds to him).
  let state = run(lordGame(), 1_100);
  // The event wants a market standing (its trigger): one is put up for the test from a standing building's record.
  const stand = state.buildings.find(building => building.kind === "storehouse")!;
  state = { ...state, buildings: [...state.buildings, { ...stand, id: "market-test", kind: "market", workers: BUILDING_CONFIG_BY_KIND.market.workersRequired }] };
  state = gameReducer(state, { type: "set_market_dues", permille: 1100 });
  const offer = { id: "registry:ck_evt_211:test:1", entryId: "ck_evt_211", boundId: "", offeredTick: state.tick, deadline: state.tick + 1000,
    status: "offered" as const, receipt: { draw: 0, chancePermille: 1000, conditions: [] }, source: "v4" as const, bound: {}, key: "test", context: "" };
  state = { ...state, registry: { ...registryOf(state), occurrences: [offer] } };
  state = gameReducer(state, { type: "answer_registry_offer", occurrenceId: offer.id, choiceId: "a" });
  const agreement = activeDuesAgreement(state);
  assert.ok(agreement !== null, "the lowered fee is agreed");
  assert.equal(agreement!.permille, state.agency!.duesPermille);
  assert.ok(agreement!.permille < 1100);
  assert.equal(agreement!.faction, "merchant_house_1");
  assert.equal(duesReference(state), agreement!.permille, "the houses measure against the agreement");
  // Lowering further keeps it; raising over it breaks it: −15 the house it was made with, −5 the other, once.
  const lower = gameReducer(state, { type: "set_market_dues", permille: agreement!.permille - 100 });
  assert.ok(activeDuesAgreement(lower) !== null);
  const [one, two] = [relation(state, "merchant_house_1"), relation(state, "merchant_house_2")];
  const broken = gameReducer(state, { type: "set_market_dues", permille: agreement!.permille + 200 });
  assert.equal(activeDuesAgreement(broken), null);
  assert.equal(broken.agency!.duesAgreement!.brokenTick, broken.tick);
  assert.equal(relation(broken, "merchant_house_1"), Math.max(-100, one + DUES_MIND.breachParty));
  assert.equal(relation(broken, "merchant_house_2"), Math.max(-100, two + DUES_MIND.breachOther));
  const record = broken.history!.records.filter(entry => entry.template === "faction.relation" && String(entry.params?.reason).startsWith("agreement_broken:"));
  assert.equal(record.length, 2);
  assert.equal(String(record[0]!.params?.reason), "agreement_broken:1300");
  const agreedDecision = broken.trace!.decisions.find(decision => decision.source.startsWith("registry:ck_evt_211"))!;
  assert.equal(record[0]!.because?.[0]?.decisionId, agreedDecision.id, "the agreement is the reason (○○년 합의를 어겨서)");
  const again = gameReducer(broken, { type: "set_market_dues", permille: agreement!.permille + 300 });
  assert.equal(again.history!.records.filter(entry => String(entry.params?.reason).startsWith("agreement_broken:")).length, 2, "broken once");
  // Ten years on, the agreement no longer binds.
  assert.equal(activeDuesAgreement({ ...state, tick: agreement!.tick + DUES_MIND.agreementTicks }), null);
});

test("DTR-17/18: the bot keeps an agreed fee while it binds (neither undoes nor breaks it)", () => {
  const state = run(lordGame(), AGENCY_WEEK_TICKS + 1);
  const off: GameState = { ...state, agency: { ...state.agency!, duesPermille: 950 } };
  const dues = (at: GameState) => lordBotCommands(at).filter(entry => entry.command.type === "set_market_dues").length;
  assert.equal(dues(off), 1, "the bot's schedule otherwise");
  const agreed: GameState = { ...off, agency: { ...off.agency!, duesAgreement: { permille: 950, tick: off.tick - 10, faction: "merchant_house_1", occurrenceId: "x" } } };
  assert.equal(dues(agreed), 0, "the agreed fee kept");
});
