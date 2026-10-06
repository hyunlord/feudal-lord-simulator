/**
 * DEC-TRACE (docs/design/dec-trace.md, the user's decisions 2026-10-06): the layers of decision, the thread of
 * consequence, a faction's mind becoming an act, and the read models the screens use.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { FACTION_ACT_BALANCE } from "../src/content/factionActConfig";
import { LORD_SLICE_SCENARIO_ID } from "../src/content/lordSliceConfig";
import { DECISION_WEIGHT_BALANCE } from "../src/content/stewardPolicyConfig";
import { decisionRemembers, standingPolicies, stewardReport, traceInRange, yearReview } from "../src/engine/decisionReads";
import { largeSumLine, stewardPick, type ChoiceWeighing } from "../src/engine/decisionLayer";
import { traceOf } from "../src/engine/decisionTrace";
import type { GameState } from "../src/engine/engine.types";
import { advanceFactionActs } from "../src/engine/factionActs";
import { registryV4Support, v4Entry } from "../src/engine/registryV4";
import { advanceTick } from "../src/engine/tick";
import { postLedgerEntries } from "../src/ledger/ledger";
import { answerOutlook } from "../src/state/decisionOutlook";
import { gameReducer } from "../src/state/gameStore";
import { newGameState } from "../src/state/newGame";

const lordGame = (): GameState => newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed: 1 })!;
const run = (state: GameState, ticks: number): GameState => { let next = state; for (let tick = 0; tick < ticks; tick += 1) next = advanceTick(next); return next; };

test("§1 a large sum is a tenth of the estate's year of income, a pound at least (the user's decision)", () => {
  const state = run(lordGame(), 10);
  assert.equal(largeSumLine(state), Math.max(DECISION_WEIGHT_BALANCE.largeSumFloor, 0), "no income yet: the floor, a pound");
  const paid = postLedgerEntries(state, [{ account: "cash", category: "rent", amount: 9_000, sourceRefs: [{ type: "actor", id: "test" }] }]);
  assert.equal(largeSumLine({ ...state, ledger: paid.ledger, treasuryCoin: paid.treasuryCoin }), 900);
});

test("§1 the steward's pick by the standing policy: lightly the most given, strictly the least, as custom the least change; he holds only when nothing else is open", () => {
  const choice = (id: string, spend: number, commands = ["set_market_dues"]): ChoiceWeighing => ({ id, commands, spend, senderDelta: 0, weights: [] });
  const choices = [choice("a", 40), choice("b", -20), choice("c", 5), choice("hold", 0, [])];
  assert.equal(stewardPick("lenient", choices), "a");
  assert.equal(stewardPick("strict", choices), "b");
  assert.equal(stewardPick("customary", choices), "c");
  assert.equal(stewardPick("lord", choices), null);
  assert.equal(stewardPick("customary", [choice("hold", 0, [])]), "hold");
});

test("§1 v4.2 applied: the held events never run, and no running event offers a choice that only sets a subsidy or the policy", () => {
  const support = registryV4Support();
  const indirect = new Set(["set_project_subsidy", "set_estate_policy"]);
  const offending = support.filter(entry => entry.runs).flatMap(entry => entry.choices.filter(choice => choice.supported)
    .filter(choice => { const commands = v4Entry(entry.id)!.choices.find(item => item.id === choice.id)!.commands; return commands.length > 0 && commands.every(command => indirect.has(command.type)); })
    .map(choice => `${entry.id}:${choice.id}`));
  assert.deepEqual(offending, []);
  for (const id of ["ck_evt_004", "ck_evt_102", "ck_evt_123", "ck_evt_138"]) assert.match(support.find(entry => entry.id === id)!.reason ?? "", /^held/, id);
});

test("§2 a command of the lord's is a decision whose id is its history record; its relation records are tied to it; the read models find it", () => {
  let state = run(lordGame(), 50);
  const before = state;
  state = gameReducer(state, { type: "set_market_dues", permille: 1200 });
  const decision = traceOf(state).decisions.at(-1)!;
  assert.equal(decision.kind, "dues");
  assert.equal(decision.by, "lord");
  const record = state.history!.records.find(entry => entry.id === decision.id)!;
  assert.equal(record.kind, "decision", "the id is the decision's own history record");
  assert.ok(decision.targets.includes("dues") && decision.targets.includes("faction:merchant_house_1"), decision.targets.join(","));
  // A2: the merchants remember it (−10 for +200‰), both houses.
  const remembers = decisionRemembers(state, decision.id);
  assert.deepEqual(remembers.map(entry => [entry.actor, entry.delta]).sort(), [["merchant_house_1", -10], ["merchant_house_2", -10]]);
  assert.ok(traceInRange(state, before.tick, state.tick + 1).some(row => row.decisionId === decision.id && row.key === "relation"));
  assert.ok(yearReview(state, 1300).decisions.some(entry => entry.decisionId === decision.id && entry.kind === "dues"));
});

test("§2 answerOutlook runs the answer on a copy: now (the treasury, the minds it moves), later, and who remembers — the state untouched", () => {
  const state = run(lordGame(), 50);
  const outlook = answerOutlook(state, { type: "set_market_dues", permille: 800 })!;
  assert.ok(outlook.remembers.some(entry => entry.actor === "merchant_house_1" && entry.delta === 10));
  assert.ok(outlook.later.some(entry => entry.key === "stall_dues" && entry.amount === 800));
  assert.equal(traceOf(state).decisions.length, 0, "nothing decided on the state itself");
});

test("§3 a faction past +30 that a decision moved acts small once a year; past ±60 large once in ten years; the act is in the history with the decision behind it", () => {
  let state = run(lordGame(), 50);
  state = gameReducer(state, { type: "set_market_dues", permille: 1200 });
  const decision = traceOf(state).decisions.at(-1)!;
  // The merchants' mind past −30 by that decision (its memory carries the decision's id).
  const factions = state.factions!.factions.map(faction => faction.id !== "merchant_house_1" ? faction
    : { ...faction, relation: -35, memory: faction.memory.map(memory => memory.decisionId === decision.id ? { ...memory, delta: -35 } : memory) });
  state = { ...state, factions: { ...state.factions!, factions } };
  const season = Math.ceil((state.tick + 1) / 1000) * 1000;
  const acted = advanceFactionActs({ ...state, tick: season });
  const act = traceOf(acted).acts.at(-1)!;
  assert.deepEqual([act.factionId, act.size, act.direction, act.act], ["merchant_house_1", "small", -1, "merchant_withdraw"]);
  const record = acted.history!.records.at(-1)!;
  assert.equal(record.template, "faction.act");
  assert.equal(record.because?.[0]?.decisionId, decision.id, "the decision that turned it");
  // Not again within the year; large past −60, once in ten years.
  assert.equal(traceOf(advanceFactionActs({ ...acted, tick: season + 1000 })).acts.length, traceOf(acted).acts.length);
  const angry = { ...acted, factions: { ...acted.factions!, factions: acted.factions!.factions.map(faction => faction.id === "merchant_house_1" ? { ...faction, relation: -65 } : faction) } };
  const large = advanceFactionActs({ ...angry, tick: season + 2000 });
  assert.equal(traceOf(large).acts.at(-1)!.size, "large");
  const again = advanceFactionActs({ ...large, tick: season + 2000 + FACTION_ACT_BALANCE.largeEveryYears * 4000 - 1000 });
  assert.equal(traceOf(again).acts.filter(entry => entry.factionId === "merchant_house_1" && entry.size === "large").length, 1, "no second large act within ten years");
  const decade = advanceFactionActs({ ...large, tick: traceOf(large).acts.at(-1)!.tick + FACTION_ACT_BALANCE.largeEveryYears * 4000 });
  assert.equal(traceOf(decade).acts.filter(entry => entry.factionId === "merchant_house_1" && entry.size === "large").length, 2, "ten years on, again");
});

test("§1 the standing policies and the steward's report: every small kind with its setting and what each does; the season's handled list", () => {
  let state = lordGame();
  const views = standingPolicies(state);
  assert.equal(views.filter(view => view.family === "manor").length, 12);
  assert.ok(views.every(view => view.setting === "customary" && !view.heavy));
  const heriot = views.find(view => view.kind === "heriot")!;
  assert.deepEqual([heriot.answers.customary.granted, heriot.answers.lenient.granted, heriot.answers.strict.granted], [false, true, false]);
  state = gameReducer(state, { type: "set_standing_policy", kind: "heriot", setting: "lenient" });
  assert.equal(standingPolicies(state).find(view => view.kind === "heriot")!.setting, "lenient");
  state = run(state, 8_000);
  const report = stewardReport(state, 0, state.tick + 1);
  assert.ok(report.handled.length > 0 && report.handled.every(entry => entry.policy !== undefined));
  assert.ok(report.handled.filter(entry => entry.kind === "heriot").every(entry => entry.granted && entry.policy === "lenient"));
});
