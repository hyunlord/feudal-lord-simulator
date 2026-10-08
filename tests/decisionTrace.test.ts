/**
 * DEC-TRACE (docs/design/dec-trace.md, the user's decisions 2026-10-06): the layers of decision, the thread of
 * consequence, a faction's mind becoming an act, and the read models the screens use.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { FACTION_ACT_BALANCE } from "../src/content/factionActConfig";
import { LORD_SLICE_SCENARIO_ID } from "../src/content/lordSliceConfig";
import { DECISION_WEIGHT_BALANCE, HOME_PETITION_CUSTOM, homePetitionFactions } from "../src/content/stewardPolicyConfig";
import { HOME_ESTATE_ID } from "../src/content/estateConfig";
import { HOME_PETITION_KINDS } from "../src/content/stewardshipConfig";
import { decisionRemembers, standingPolicies, stewardReport, traceInRange, yearReview } from "../src/engine/decisionReads";
import { cameHeavyToLord, heavyLoad, largeSumLine, stewardPick, type ChoiceWeighing } from "../src/engine/decisionLayer";
import { hamletTimberKeep } from "../src/engine/marketSettlement";
import { advanceTrace, traceOf } from "../src/engine/decisionTrace";
import type { GameState } from "../src/engine/engine.types";
import { advanceFactionActs } from "../src/engine/factionActs";
import { registryV4Support, v4Entry } from "../src/engine/registryV4";
import { advanceTick } from "../src/engine/tick";
import { postLedgerEntries, treasuryBalance } from "../src/ledger/ledger";
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
  // He pays no more than the treasury holds: the dearest then goes to the next.
  const paying = [{ ...choice("a", 40), paid: 40 }, choice("c", 5), choice("hold", 0, [])];
  assert.equal(stewardPick("lenient", paying, 30), "c");
  assert.equal(stewardPick("lenient", paying, 40), "a");
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
  assert.ok(decision.targets.includes("dues"), decision.targets.join(","));
  // DUES-REL (DTR-18): the command itself moves no mind; at the season's turn the fee standing 200‰ over the custom sours
  // both houses by 2, the record naming this decision — the merchants remember it.
  assert.deepEqual(decisionRemembers(state, decision.id), []);
  state = run(state, 1_000 - state.tick);
  const remembers = decisionRemembers(state, decision.id);
  assert.deepEqual(remembers.map(entry => [entry.actor, entry.delta]).sort(), [["merchant_house_1", -2], ["merchant_house_2", -2]]);
  assert.ok(traceInRange(state, before.tick, state.tick + 1).some(row => row.decisionId === decision.id && row.key === "dues_held"));
  assert.ok(yearReview(state, 1300).decisions.some(entry => entry.decisionId === decision.id && entry.kind === "dues"));
});

test("§2 DTR-11: the first posting of a ledger line a decision set going is its consequence (the dues' stall fees), once", () => {
  let state = run(lordGame(), 50);
  state = gameReducer(state, { type: "set_market_dues", permille: 1200 });
  const decision = traceOf(state).decisions.at(-1)!;
  const fee = (from: GameState, amount: number): GameState => {
    const posted = postLedgerEntries({ ...from, tick: from.tick + 1 }, [{ account: "cash", category: "stall_fee", amount, sourceRefs: [{ type: "actor", id: "test" }] }]);
    return { ...from, tick: from.tick + 1, ledger: posted.ledger, treasuryCoin: posted.treasuryCoin };
  };
  const once = advanceTrace(state, fee(state, 12));
  const flows = (at: GameState) => at.history!.records.filter(record => record.template === "consequence" && record.params?.key === "payment_flow");
  assert.equal(flows(once).length, 1);
  assert.deepEqual([flows(once)[0]!.params?.target, flows(once)[0]!.params?.category, flows(once)[0]!.params?.income], ["dues", "stall_fee", 12]);
  assert.equal(flows(once)[0]!.because?.[0]?.decisionId, decision.id);
  assert.equal(flows(advanceTrace(once, fee(once, 9))).length, 1, "only the first posting after the decision");
});

test("§1 the steward never grants a home petition that costs more than the treasury holds, whatever the policy (FIX-14's rule)", () => {
  let state = lordGame();
  for (const kind of Object.keys(HOME_PETITION_CUSTOM)) state = gameReducer(state, { type: "set_standing_policy", kind, setting: "lenient" });
  const empty = (from: GameState): GameState => {
    const held = treasuryBalance(from);
    if (held <= 0) return from;
    const posted = postLedgerEntries(from, [{ account: "cash", category: "upkeep", amount: -held, sourceRefs: [{ type: "actor", id: "test" }] }]);
    return { ...from, ledger: posted.ledger, treasuryCoin: posted.treasuryCoin };
  };
  for (let tick = 0; tick < 12_000; tick += 1) state = advanceTick(empty(state));
  const homes = (state.stewardship?.petitions ?? []).filter(petition => petition.estateId === HOME_ESTATE_ID && petition.decidedBy === "steward");
  const costs = (kind: string) => HOME_PETITION_KINDS[kind as keyof typeof HOME_PETITION_KINDS].grant.income < 0;
  assert.ok(homes.length > 0);
  // Lenient grants all; with the treasury kept empty, the costly kinds are refused and the rest granted.
  for (const petition of homes) assert.equal(petition.status, costs(petition.kind) ? "refused" : "granted", `${petition.id} ${petition.kind}`);
});

test("§1 DTR-14: the heavy matters that came to the lord in the year (not his own initiatives) — the registry's heavy offer waits at three", () => {
  const state = run(lordGame(), 10);
  const decision = (id: string, source: string, weights: string[], tick = state.tick) => ({ id, tick, by: "lord" as const, kind: "registry" as const, source, weights: weights as never, targets: [] });
  assert.equal(cameHeavyToLord(decision("h-1", "registry:ck_evt_211:a", ["faction_rupture"])), true);
  assert.equal(cameHeavyToLord(decision("h-2", "file_suit:claim-1", ["rights"])), false, "his own suit");
  assert.equal(cameHeavyToLord(decision("h-3", "registry:ck_evt_002:a", [])), false, "no weight");
  const crowded = { ...state, trace: { acts: [], decisions: [decision("h-1", "petition:wages:accept", ["crisis"]), decision("h-2", "audit:tolerate:a-1", ["land"]),
    decision("h-3", "set_audit_mode:e-1", ["land"]), decision("h-4", "registry:ck_evt_140:a", ["land"], state.tick - 4_000)] } };
  assert.equal(heavyLoad(crowded), 2, "the setting is his own, the last is over a year old");
  assert.ok(DECISION_WEIGHT_BALANCE.registryCrowded < DECISION_WEIGHT_BALANCE.heavyPerYear);
});

test("§6 DTR-13: a lord-mode hamlet's market keeps the timber its market-town proclamation needs; elsewhere nothing is kept", () => {
  const lord = lordGame();
  assert.ok(hamletTimberKeep(lord) > 0);
  assert.equal(hamletTimberKeep({ ...lord, era: "palisade" }), 0);
  const { agency: _agency, ...sandbox } = lord;
  assert.equal(hamletTimberKeep(sandbox as GameState), 0);
});

test("§2 answerOutlook runs the answer on a copy: now (the treasury, the minds it moves), later, and who remembers — the state untouched", () => {
  const state = run(lordGame(), 50);
  const outlook = answerOutlook(state, { type: "set_market_dues", permille: 800 })!;
  // DUES-REL (DTR-18): the fee moves no mind now; while it stands 200‰ under the custom the houses warm 2 a season.
  assert.deepEqual(outlook.remembers, []);
  assert.ok(outlook.later.some(entry => entry.key === "stall_dues" && entry.amount === 800));
  assert.ok(outlook.later.some(entry => entry.key === "dues_mind" && entry.perSeason === 2 && entry.amount === 1000));
  assert.equal(traceOf(state).decisions.length, 0, "nothing decided on the state itself");
});

test("§3 a faction past +30 that a decision moved acts small once a year; past ±60 large once in ten years; the act is in the history with the decision behind it", () => {
  let state = run(lordGame(), 50);
  state = gameReducer(state, { type: "set_market_dues", permille: 1200 });
  const decision = traceOf(state).decisions.at(-1)!;
  // The merchants' mind past −30 by that decision (its memory carries the decision's id: the fee as it stood, DUES-REL).
  const factions = state.factions!.factions.map(faction => faction.id !== "merchant_house_1" ? faction
    : { ...faction, relation: -35, memory: [...faction.memory, { recordId: "h-test", tick: state.tick, delta: -35, reason: "dues_held:1200:1000", decisionId: decision.id }] });
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
  // DTR-16: an answer as custom has it moves a faction by a fifth of the table's (at most one), lightly or strictly by the whole;
  // the report sums each policy's moves by faction ("이 방침으로 ○○ 관계 −○").
  assert.deepEqual(homePetitionFactions("stall_dispute", false, true), { merchant_house_1: -1, merchant_house_2: 1 });
  assert.deepEqual(homePetitionFactions("stall_dispute", false, false), HOME_PETITION_KINDS.stall_dispute.refuse.factions);
  assert.ok(report.handled.filter(entry => entry.policy === "customary").every(entry => Object.values(entry.relations).every(delta => Math.abs(delta) <= 1)));
  const summed = new Map<string, number>();
  for (const entry of report.handled) for (const [faction, delta] of Object.entries(entry.relations)) summed.set(`${entry.policy}|${faction}`, (summed.get(`${entry.policy}|${faction}`) ?? 0) + delta);
  assert.deepEqual(report.policyRelations.map(row => [`${row.policy}|${row.faction}`, row.delta]).sort(), [...summed].filter(([, delta]) => delta !== 0).sort());
  assert.ok(report.policyRelations.length > 0);
});

test("§6 in lord mode the heir takes the house the day the lord dies, and the history writes it as a big event (no interregnum to the year's turn)", () => {
  let state = run(lordGame(), 1);
  const year = 1300;
  state = { ...state, persons: { ...state.persons!, people: state.persons!.people.map(person => person.role === "head" && person.householdId === "manor" ? { ...person, birthYear: year - 95 } : person) } };
  const lordId = state.persons!.people.find(person => person.role === "head" && person.householdId === "manor")!.id;
  let record: import("../src/engine/history.types").HistoryRecord | undefined;
  for (let tick = 0; tick < 40_000 && record === undefined; tick += 1) {
    state = advanceTick(state);
    record = state.history?.records.find(entry => entry.template === "house.succession");
  }
  assert.ok(record !== undefined, "the old lord died and was succeeded");
  assert.equal(record!.severity, 3);
  assert.equal(record!.params?.deceasedId, lordId);
  assert.equal(record!.tick % 1000, 1, "on the season's death day, not at the year's turn");
  const head = state.persons!.people.find(person => person.role === "head" && person.householdId === "manor")!;
  assert.equal(head.id, record!.params?.heirId);
});

test("§6 a market charter opens the market to a lord-mode hamlet (the town may build it); elsewhere the era decides", async () => {
  const { isBuildingOpen } = await import("../src/world/placement");
  const hamlet = lordGame();
  assert.equal(isBuildingOpen(hamlet, "market"), false, "no charter yet");
  const chartered = { ...hamlet, politics: { ...hamlet.politics!, rights: [{ id: "market_charter", holder: "merchants" as const, grantedTick: 0, petitionId: "p", stallFeePermille: 750 }] } };
  assert.equal(isBuildingOpen(chartered, "market"), true);
  const { agency: _agency, ...sandbox } = chartered;
  assert.equal(isBuildingOpen(sandbox as GameState, "market"), false, "outside lord mode the era decides");
});

test("§6 the treasury's change by estate and kind, and whether the town's money was settled in the span", async () => {
  const { treasuryBreakdown } = await import("../src/engine/treasuryReads");
  const { settlementIn } = await import("../src/ledger/ledger");
  let state = run(lordGame(), 10);
  const posted = postLedgerEntries(state, [
    { account: "cash", category: "estate_income", amount: 500, sourceRefs: [{ type: "actor", id: "estate:estate-neighbour-3" }, { type: "actor", id: "person:p1" }] },
    { account: "cash", category: "estate_income", amount: 20, sourceRefs: [{ type: "actor", id: "estate:estate-home" }, { type: "claim", id: "estate-petition-1", detail: "merchet" }] },
    { account: "cash", category: "marriage_portion", amount: 240, sourceRefs: [{ type: "actor", id: "negotiation-1" }] },
  ]);
  state = { ...state, ledger: posted.ledger, treasuryCoin: posted.treasuryCoin };
  const breakdown = treasuryBreakdown(state, 0, state.tick + 1);
  const row = (estate: string, kind: string) => breakdown.rows.find(entry => entry.estate === estate && entry.kind === kind);
  assert.equal(row("estate-neighbour-3", "rents_dues")?.income, 500);
  assert.equal(row("estate-home", "petitions")?.income, 20);
  assert.equal(row("lord", "marriage")?.income, 240);
  assert.equal(settlementIn(0, 1000), false, "the town settles at 2,400: the first season has none");
  assert.equal(settlementIn(2000, 3000), true);
});

test("§6 a dearth's preparedness and weak points read now; its arrival and outcome are written with the decisions behind them", async () => {
  const { crisisReview, preparedness } = await import("../src/engine/crisisReads");
  const state = run(lordGame(), 10);
  const now = preparedness(state);
  assert.equal(now.weakPoints.includes("no_granary"), now.granaries === 0);
  assert.equal(now.weakPoints.includes("no_market"), now.markets === 0);
  assert.equal(now.weakPoints.includes("food_under_a_season"), now.foodDays !== null && now.foodDays < 90);
  assert.deepEqual(crisisReview(state).past, []);
});
