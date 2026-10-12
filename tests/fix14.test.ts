/**
 * FIX-14 (spec docs/design/stewardship.md SW-11·SW-12, decisions FX14-*): the home estate's petitions of 1300–1320, the
 * steward's precedent, the charter's timber the town buys itself (FX13-5's (가)), the slice's factions met.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { createGrowthOpening } from "../scripts/phase21OpeningTranslation";
import { BALANCE } from "../src/content/balanceConfig";
import { HOME_ESTATE_ID } from "../src/content/estateConfig";
import { LORD_SLICE_FACTIONS, LORD_SLICE_SCENARIO_ID } from "../src/content/lordSliceConfig";
import { HOME_PETITION_KINDS, PETITION_ANSWER_TICKS, PETITION_KINDS } from "../src/content/stewardshipConfig";
import { autoplayEraAction } from "../src/engine/autoplayEra";
import { MARKET_CADENCE_TICKS } from "../src/engine/marketSettlement";
import { advanceTimberTrade, botTimberOrderFor, orderTimber, timberTradePoint } from "../src/engine/timberTrade";
import type { GameState } from "../src/engine/engine.types";
import { estatesOf, LORD } from "../src/engine/estates";
import { historySummary } from "../src/engine/history";
import { lordSliceFactionsMet } from "../src/engine/lordSlice";
import { MARRIAGE_ESTATE_ID } from "../src/engine/marriage";
import { lordEstatePetitions, stewardshipOf } from "../src/engine/stewardship";
import type { EstatePetition, EstatePetitionKind, HomePetitionKind } from "../src/engine/stewardship.types";
import { advanceTick } from "../src/engine/tick";
import { initialAgency } from "../src/engine/townAgency";
import { treasuryBalance } from "../src/ledger/ledger";
import { decodeSave } from "../src/save/saveCodec";
import { gameReducer } from "../src/state/gameStore";
import { newGameState } from "../src/state/newGame";

const YEAR = BALANCE.TICKS_PER_YEAR;
const advance = (state: GameState, ticks: number) => { let next = state; for (let tick = 0; tick < ticks; tick += 1) next = advanceTick(next); return next; };
const homes = (state: GameState) => stewardshipOf(state).petitions.filter(petition => petition.estateId === HOME_ESTATE_ID);

test("SW-11 a home petition the lord keeps comes to him, the twelve kinds in cycles; an answer moves the treasury by its table and the factions through the ledger", () => {
  // DEC-TRACE §1 (GP-7): the home petitions are the steward's by default; here the lord keeps every kind ("bring it to me").
  let state = newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed: 1 })!;
  for (const kind of Object.keys(HOME_PETITION_KINDS)) state = gameReducer(state, { type: "set_standing_policy", kind, setting: "lord" });
  const answered: { readonly petition: EstatePetition; readonly before: number; readonly after: number }[] = [];
  let left: EstatePetition | undefined;
  for (let tick = 0; tick < 3 * YEAR; tick += 1) {
    for (const petition of lordEstatePetitions(state).filter(entry => entry.estateId === HOME_ESTATE_ID)) {
      if (left === undefined) { left = petition; continue; }
      if (petition.id === left.id) continue;
      const grant = answered.length % 2 === 0;
      const before = treasuryBalance(state);
      state = gameReducer(state, { type: "answer_estate_petition", petitionId: petition.id, grant });
      answered.push({ petition, before, after: treasuryBalance(state) });
    }
    state = advanceTick(state);
  }
  const all = homes(state);
  for (const year of [1, 2]) assert.ok(all.some(petition => Math.floor(petition.tick / YEAR) === year), `a home petition in ${1300 + year}`);
  // No kind again within its cycle of twelve; each amount within its kind's range; the right and marriage flags from the table.
  const first = all.slice(0, 12).map(petition => petition.kind);
  assert.equal(new Set(first).size, first.length, `${first}`);
  for (const petition of all) {
    const def = HOME_PETITION_KINDS[petition.kind as HomePetitionKind];
    assert.ok(petition.amount >= def.amount[0] && petition.amount <= def.amount[1] && petition.escalated === "direct", petition.kind);
    assert.equal(petition.rights, def.rights === true);
    assert.equal(petition.party === undefined, def.party !== true);
  }
  // The treasury by the table.
  assert.ok(answered.length >= 3);
  for (const { petition, before, after } of answered) {
    const status = stewardshipOf(state).petitions.find(entry => entry.id === petition.id)!.status;
    const income = HOME_PETITION_KINDS[petition.kind as HomePetitionKind][status === "granted" ? "grant" : "refuse"].income;
    assert.equal(after - before, income * petition.amount, petition.kind);
  }
  // The petition left unanswered lapsed after its season.
  assert.equal(stewardshipOf(state).petitions.find(entry => entry.id === left!.id)!.status, "lapsed");
  const lines = (state.history?.records ?? []).filter(record => record.template.startsWith("manor."));
  assert.ok(lines.some(record => record.template === "manor.petition_lapsed"));
  assert.ok(lines.every(record => !/[a-z_]{6,}/.test(historySummary(record, state))), "the kinds in words");
  // The factions remember the answers (their relation lines in the ledger).
  const moved = (state.history?.records ?? []).filter(record => record.template === "faction.relation" && String(record.params?.reason).startsWith("manor_petition:"));
  assert.ok(moved.length >= answered.length, `${moved.length} lines for ${answered.length} answers`);
  // The slice's factions: the five introduced, then those the lord has dealt with.
  const met = lordSliceFactionsMet(state);
  assert.deepEqual(met.slice(0, 5), [...LORD_SLICE_FACTIONS]);
  assert.ok(met.length > 5 && met.slice(5).every(id => state.factions!.factions.find(faction => faction.id === id)!.memory.length > 0), `${met}`);
});

test("SW-11 no home petitions outside lord mode (the sandbox and the campaign are unchanged)", () => {
  let state = createGrowthOpening(1).state as GameState;
  state = advance(state, YEAR + 10);
  assert.equal(homes(state).length, 0);
});

/** A lord-mode town holding the third neighbour's estate, its oversight begun. */
function held(): GameState {
  let state: GameState = { ...(createGrowthOpening(1).state as GameState), agency: initialAgency() };
  while (state.persons === undefined) state = advanceTick(state);
  state = advance(state, 3_990);
  const estates = estatesOf(state);
  state = { ...state, estates: { ...estates, estates: estates.estates.map(estate => estate.id === MARRIAGE_ESTATE_ID ? { ...estate, titleHolder: LORD, possessor: LORD } : estate) } };
  while (stewardshipOf(state).oversight.length === 0) state = advanceTick(state);
  return state;
}

test("SW-12 (DEC-TRACE §1, GP-7) a delegated estate's steward answers by the lord's standing policy, never by precedent; the exceptions and \"bring it to me\" bring it up", () => {
  let state = held();
  const stewardship = stewardshipOf(state);
  const oversight = stewardship.oversight[0]!;
  const candidate = stewardship.stewards.find(entry => entry.estateId === oversight.estateId && entry.personId !== oversight.stewardId)!;
  state = gameReducer(state, { type: "set_estate_oversight", estateId: oversight.estateId, mode: "steward", stewardId: candidate.personId });
  // The lord has answered every kind there before (refused): LM9-3's precedent is gone, the steward follows the policy.
  const prior = (Object.keys(PETITION_KINDS) as EstatePetitionKind[]).map((kind, index): EstatePetition => ({ id: `prior-${index}`, estateId: oversight.estateId, kind,
    group: PETITION_KINDS[kind].group, amount: 1, rights: false, marriage: false, tick: state.tick - 10, deadline: state.tick, status: "refused", decidedBy: "lord", escalated: "amount" }));
  state = { ...state, stewardship: { ...stewardshipOf(state), petitions: [...stewardshipOf(state).petitions, ...prior] } };
  for (const kind of Object.keys(PETITION_KINDS)) state = gameReducer(state, { type: "set_standing_policy", kind, setting: "lenient" });
  const from = state.tick;
  state = advance(state, 1_000);
  const followed = stewardshipOf(state).petitions.find(entry => entry.estateId === oversight.estateId && entry.tick > from)!;
  if (followed.decidedBy === "steward") assert.deepEqual([followed.status, followed.policy, followed.precedent], ["granted", "lenient", undefined]);
  else assert.equal(followed.escalated, "amount", "only a large sum goes past the steward");
  // The exceptions bring it up again.
  state = gameReducer(state, { type: "set_exception_rules", rules: { amountAtLeast: 0, rights: true, marriage: true } });
  const again = state.tick;
  state = advance(state, 1_000);
  const brought = stewardshipOf(state).petitions.find(entry => entry.estateId === oversight.estateId && entry.tick > again)!;
  assert.deepEqual([brought.status, brought.precedent, brought.escalated !== undefined], ["open", undefined, true]);
  assert.ok(PETITION_ANSWER_TICKS > 0);
});

test("FX13-5 (가) the charter waiting on timber the town cannot store: the era step orders the shortfall (FIX-10's rule); a hamlet has no market yet, so the traders cart it to its storehouse (TT-5); not while its sawmills work (the sandbox; lord mode orders a slow town's too, GB-8)", () => {
  const saved = decodeSave(new Uint8Array(readFileSync("fixtures/saves/v45/population-176.save.json"))).envelope.state as GameState;
  assert.equal(saved.era, "hamlet");
  assert.ok(!saved.buildings.some(building => building.kind === "market"), "no market before the charter");
  const idle: GameState = { ...saved, constructionSites: [], treasuryCoin: 5_000,
    timberProductionWindow: { startTick: saved.tick - 2_400, throughTick: saved.tick, produced: 0, productionTicks: [] } };
  const build = () => ({ kind: "none" as const });
  const action = autoplayEraAction(idle, build);
  assert.ok(action.kind === "order_timber" && action.amount > 0, JSON.stringify(action));
  // GB-8 (GROW-BLOCK) is lord mode's: the sandbox orders nothing while its sawmills work, slow or not.
  const working = { ...idle, timberProductionWindow: { ...idle.timberProductionWindow!, produced: 1_000 } };
  assert.equal(autoplayEraAction(working, build).kind, "none");
  const slow = { ...idle, timberProductionWindow: { ...idle.timberProductionWindow!, produced: 12 } };
  assert.equal(autoplayEraAction(slow, build).kind, "none", "the sandbox orders only when its sawmills stopped (GROW-BLOCK-2a ⑤)");
  const lord = newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed: 1 })!;
  assert.equal(autoplayEraAction({ ...slow, agency: lord.agency! }, build).kind, "order_timber", "a lord-mode town orders a slow charter's timber (GB-8)");
  // The sandbox bot's own orders still need a market (TT-4b unchanged).
  assert.equal(botTimberOrderFor(idle, 250), null);
  // Delivered on the market cadence at the hamlet's storehouse, into the treasury's timber.
  assert.equal(timberTradePoint(idle)?.kind, "storehouse");
  let ordered = orderTimber({ ...idle, tick: Math.ceil(idle.tick / MARKET_CADENCE_TICKS) * MARKET_CADENCE_TICKS - 1 }, action.kind === "order_timber" ? action.amount : 0);
  ordered = { ...ordered, tick: ordered.tick + 1 };
  const delivered = advanceTimberTrade(ordered);
  assert.ok(delivered.treasuryTimber > ordered.treasuryTimber, `${ordered.treasuryTimber} → ${delivered.treasuryTimber}`);
});
