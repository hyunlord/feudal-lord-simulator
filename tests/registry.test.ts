/**
 * LM-E9 (spec docs/design/registry.md ER-1…ER-12): the registry — entries checked at load (a wrong one left out whole),
 * answers applied whole or not at all, the home petitions as entries, the home precedent, a timed term to its end, a
 * right's scope ruled, the player's house; and nothing outside lord mode.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { HOME_PETITION_ENTRIES, homeCycleKinds } from "../src/content/registry/homePetitions";
import type { RegistryEntry } from "../src/content/registry/registryTypes";
import { HOME_PETITION_ORDER } from "../src/content/stewardshipConfig";
import type { GameState } from "../src/engine/engine.types";
import { estatePortfolio, estatesOf } from "../src/engine/estates";
import { fileSuit } from "../src/engine/estateSuits";
import { advanceRegistry, applyChoice, enabledChoices, entryProblem, initialRegistry, registryLoad, registryOf } from "../src/engine/registry";
import { DEFAULT_PLAYER_HOUSE } from "../src/content/lordshipConfig";
import { armsHeraldrySeed, lordHouse } from "../src/engine/lordshipState";
import { advanceStewardship, answerEstatePetition, lordEstatePetitions, precedentReport, setExceptionRules, stewardshipOf } from "../src/engine/stewardship";
import { initialAgency } from "../src/engine/townAgency";
import { HISTORY_TEMPLATES } from "../src/content/historyCopy.ko";
import { decodeSave } from "../src/save/saveCodec";
import { LORD_SLICE_SCENARIO_ID } from "../src/content/lordSliceConfig";
import { postLedgerEntries, treasuryBalance } from "../src/ledger/ledger";
import { newGameState } from "../src/state/newGame";

const YEAR = 4000;
const load = (name: string): GameState => decodeSave(new Uint8Array(readFileSync(`fixtures/saves/v47/${name}.save.json`))).envelope.state as GameState;

/** A treasury of exactly `amount` (the treasury is the ledger's cash balance). */
function funded(state: GameState, amount: number): GameState {
  const posted = postLedgerEntries(state, [{ account: "cash", category: "rent", amount: amount - treasuryBalance(state), sourceRefs: [{ type: "actor", id: "test" }] }]);
  return { ...state, ledger: posted.ledger, treasuryCoin: posted.treasuryCoin };
}

const entry = (overrides: Partial<RegistryEntry> = {}): RegistryEntry => ({
  id: "test:entry", kind: "event", source: "test", years: { fromYear: 1300, toYear: 1450 },
  frequency: { chancePermille: 1000, weight: 1, minGapSeasons: 0, maxPerYear: 1 }, recurrence: { mode: "once", cooldownSeasons: 0, maxOccurrences: 1 },
  sender: "town", bind: "none", choices: [{ id: "a", effects: [{ command: "none" }] }, { id: "b", effects: [{ command: "treasury", amount: -10 }] }],
  precedent: false, artId: null, ...overrides,
});

test("ER-2 a wrong entry is left out whole, with its reason; the rest load", () => {
  assert.equal(entryProblem(entry()), null);
  const loaded = registryLoad([entry({ id: "ok" }), entry({ id: "one-choice", choices: [{ id: "a", effects: [] }] }),
    entry({ id: "bad-field", conditions: { field: "calendar.year" as never, op: "gte", value: "x" } }),
    entry({ id: "bad-command", choices: [{ id: "a", effects: [{ command: "launch" } as never] }, { id: "b", effects: [] }] }),
    entry({ id: "ok" })]);
  assert.deepEqual(loaded.entries.map(item => item.id), ["ok"]);
  assert.deepEqual(loaded.rejected.map(item => [item.id, item.reason]), [["one-choice", "fewer than two choices"], ["bad-field", "gte needs a number"],
    ["bad-command", "unknown command launch"], ["ok", "id repeats"]]);
  // The game's own registry loads whole.
  assert.deepEqual(registryLoad().rejected, []);
});

test("ER-4 a choice's effects apply whole or not at all", () => {
  const town = { ...load("population-176"), agency: initialAgency() };
  const poor = funded(town, 5);
  const twoSteps = entry({ choices: [{ id: "a", effects: [{ command: "none" }] }, { id: "pay-then-pay", effects: [{ command: "treasury", amount: -4 }, { command: "treasury", amount: -4 }] }] });
  assert.equal(applyChoice(poor, twoSteps, "pay-then-pay", "", "occ"), null, "the second payment fails, so the first is not kept");
  const paid = applyChoice(funded(town, 100), twoSteps, "pay-then-pay", "", "occ")!;
  assert.equal(treasuryBalance(paid), 92);
});

test("FIX-17 (A05) a refused command makes the whole choice fail: subsidies 7 + 9 against a limit of 15", () => {
  const town = funded({ ...load("population-176"), agency: initialAgency() }, 60);
  const both = entry({ choices: [{ id: "a", effects: [{ command: "none" }] },
    { id: "split", effects: [{ command: "set_project_subsidy", kind: "granary", amount: 7 }, { command: "set_project_subsidy", kind: "mill", amount: 9 }] },
    { id: "fits", effects: [{ command: "set_project_subsidy", kind: "granary", amount: 7 }, { command: "set_project_subsidy", kind: "mill", amount: 8 }] }] });
  assert.equal(applyChoice(town, both, "split", "", "occ"), null, "the mill's 9 is refused (7 + 9 > 15), so the granary's 7 is not kept");
  assert.ok(!enabledChoices(town, both, "", "occ").includes("split"), "and the choice is not offered");
  const fits = applyChoice(town, both, "fits", "", "occ")!;
  assert.deepEqual(fits.agency!.subsidies.map(subsidy => `${subsidy.kind}:${subsidy.amount}`), ["granary:7", "mill:8"]);
  const refusedFirst = entry({ choices: [{ id: "a", effects: [{ command: "none" }] }, { id: "big", effects: [{ command: "set_project_subsidy", kind: "granary", amount: 16 }] }] });
  assert.equal(applyChoice(town, refusedFirst, "big", "", "occ"), null, "a refusal recorded on the state is not an effect");
});

test("ER-5 the home petitions are registry entries in FIX-14's order and chance", () => {
  assert.deepEqual(homeCycleKinds(), HOME_PETITION_ORDER);
  assert.equal(HOME_PETITION_ENTRIES.length, 12);
  assert.ok(HOME_PETITION_ENTRIES.every(item => item.generator === "home_cycle" && item.precedent && entryProblem(item) === null));
});

test("ER-6 a home petition of a kind the lord answered before is answered by precedent; the exceptions bring it up again", () => {
  // Play home seasons with the lord granting each petition, until a kind comes round again.
  const opening = (): GameState => { const town = newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed: 1 })!; return { ...town, estates: estatesOf(town), tick: 4000 }; };
  let state: GameState = opening();
  const kinds = new Set<string>();
  let precedent = null as null | { kind: string; status: string };
  for (let season = 0; season < 80 && precedent === null; season += 1) {
    state = advanceStewardship({ ...state, tick: state.tick + 1000 });
    for (const petition of lordEstatePetitions(state)) { kinds.add(petition.kind); state = answerEstatePetition(state, petition.id, true); }
    const found = stewardshipOf(state).petitions.find(petition => petition.precedent === true && petition.estateId === "estate-home");
    if (found !== undefined) precedent = { kind: found.kind, status: found.status };
  }
  assert.ok(precedent !== null, "a kind came round and the steward answered it");
  assert.ok(kinds.has(precedent!.kind), "the lord had answered that kind");
  assert.equal(precedent!.status, "granted", "as the lord did");
  // The user's rule: the lord's same answer twice before the first precedent; never the year's first home petition.
  const homesNow = stewardshipOf(state).petitions.filter(petition => petition.estateId === "estate-home");
  const first = homesNow.find(petition => petition.precedent === true)!;
  assert.ok(homesNow.filter(petition => petition.kind === first.kind && petition.decidedBy === "lord" && petition.tick < first.tick).length >= 2, "two answers by the lord first");
  for (const petition of homesNow.filter(entry => entry.precedent === true)) {
    const year = Math.floor(petition.tick / 4000);
    assert.ok(homesNow.some(earlier => Math.floor(earlier.tick / 4000) === year && earlier.tick < petition.tick && earlier.precedent !== true), "not the year's first");
  }
  // The season report lists it.
  assert.ok(precedentReport({ ...state, tick: (Math.floor(first.tick / 1000) + 1) * 1000 }).some(petition => petition.id === first.id));
  assert.match(HISTORY_TEMPLATES["manor.petition_precedent"]!({ kind: precedent!.kind, granted: 1, amount: 0 }), /^청지기가 선례대로 /);
  // With "bring recurring kinds up", none is answered by precedent.
  // (The lord sets his exceptions once there is a stewardship — after the first home petition.)
  let recurring: GameState = opening();
  for (let season = 0; season < 80; season += 1) {
    recurring = advanceStewardship({ ...recurring, tick: recurring.tick + 1000 });
    if (recurring.stewardship !== undefined && stewardshipOf(recurring).rules.recurring !== true) recurring = setExceptionRules(recurring, { ...stewardshipOf(recurring).rules, recurring: true });
    for (const petition of lordEstatePetitions(recurring)) recurring = answerEstatePetition(recurring, petition.id, true);
  }
  assert.equal(stewardshipOf(recurring).petitions.filter(petition => petition.precedent === true && petition.estateId === "estate-home").length, 0);
});

test("ER-7 an instalment plan pays each year (arrears for what the cash cannot cover) and ends at its term; a dues remission waives and restores the dues", () => {
  let state: GameState = funded({ ...load("population-176"), agency: { ...initialAgency(), duesPermille: 1000 }, tick: 10 * YEAR }, 1000);
  const plan = entry({ choices: [{ id: "a", effects: [{ command: "none" }] }, { id: "plan", effects: [{ command: "term", term: "installments", what: "debt", amountPerYear: 50, years: 3 }] }] });
  state = applyChoice(state, plan, "plan", "", "occ-plan")!;
  const term = registryOf(state).terms[0]!;
  assert.deepEqual([term.kind, term.years, term.endTick, term.status], ["installments", 3, 13 * YEAR, "running"]);
  for (let year = 11; year <= 14; year += 1) state = advanceRegistry({ ...state, tick: year * YEAR });
  assert.equal(registryOf(state).terms[0]!.status, "ended");
  assert.equal(1000 - treasuryBalance(state), 150, "three years of 50");
  // What the cash cannot cover goes to the arrears, as the war's charges do; the treasury does not go below nothing.
  let short = applyChoice(funded({ ...state, registry: initialRegistry() }, 30), plan, "plan", "", "occ-short")!;
  short = advanceRegistry({ ...short, tick: 15 * YEAR });
  assert.equal(treasuryBalance(short), 0);
  assert.deepEqual(short.money!.arrears.filter(arrear => arrear.category === "instalment").map(arrear => arrear.amount), [20]);
  const remission = entry({ choices: [{ id: "a", effects: [{ command: "none" }] }, { id: "free", effects: [{ command: "term", term: "remission", what: "market_dues", amountPerYear: 250, years: 2 }] }] });
  let dues = applyChoice({ ...state, registry: initialRegistry() }, remission, "free", "", "occ-free")!;
  assert.equal(dues.agency!.duesPermille, 250, "lowered to the lowest dues");
  for (let year = 15; year <= 17; year += 1) dues = advanceRegistry({ ...dues, tick: year * YEAR });
  assert.equal(registryOf(dues).terms[0]!.status, "ended");
  assert.equal(dues.agency!.duesPermille, 1000, "restored at the term's end");
});

test("ER-8 a ruling narrows a right's scope: the piece keeps its share of the year's worth", () => {
  const town = { ...load("chapter-two-town"), agency: initialAgency() };
  const suing = fileSuit(town, "claim-1");
  const suit = estatesOf(suing).suits[0]!;
  assert.ok(suit.pieceId !== undefined);
  const ruling = entry({ bind: "open_suit", choices: [{ id: "a", effects: [{ command: "none" }] }, { id: "narrow", effects: [{ command: "rights_scope", sharePermille: 600 }] }] });
  const ruled = applyChoice(suing, ruling, "narrow", suit.id, "occ-rule")!;
  const before = estatePortfolio(suing).find(estate => estate.id === suit.estateId)!.pieces.find(piece => piece.id === suit.pieceId)!;
  const after = estatePortfolio(ruled).find(estate => estate.id === suit.estateId)!.pieces.find(piece => piece.id === suit.pieceId)!;
  assert.deepEqual(after.scope, { sharePermille: 600, ruledTick: suing.tick, suitId: suit.id });
  assert.equal(after.yearValue, Math.round(before.yearValue * 600 / 1000));
  assert.equal(applyChoice(suing, ruling, "narrow", "suit-none", "occ-rule"), null, "no suit, no ruling");
});

test("ER-9, MANOR-1 (HOUSE-1) the player's house is the lord's first house: de Haverel by default, the new game's choice otherwise, in lord mode and the campaign alike", () => {
  for (const scenarioId of [LORD_SLICE_SCENARIO_ID, "core:campaign_market_town"]) {
    for (const seed of [1, 2, 3]) {
      const house = lordHouse(newGameState({ scenarioId, seed })!);
      assert.deepEqual([house.order, house.name, house.arms, house.heraldrySeed], [1, "de Haverel", "haverel", armsHeraldrySeed("haverel")], `${scenarioId} ${seed}`);
    }
    const named = newGameState({ scenarioId, seed: 1, house: { name: "de Wyke", arms: "wyke" } })!;
    assert.deepEqual([lordHouse(named).name, lordHouse(named).arms, lordHouse(named).heraldrySeed], ["de Wyke", "wyke", armsHeraldrySeed("wyke")], scenarioId);
  }
  assert.equal(DEFAULT_PLAYER_HOUSE.name, "de Haverel");
  assert.notEqual(armsHeraldrySeed("haverel"), armsHeraldrySeed("wyke"), "the arms' id draws the arms");
  assert.equal(newGameState({ scenarioId: "core:campaign_market_town", seed: 1 })?.registry, undefined);
});

test("ER-12 outside lord mode the registry does nothing", () => {
  const sandbox = { ...load("population-176"), tick: 8 * YEAR };
  assert.equal(advanceRegistry(sandbox), sandbox);
});
