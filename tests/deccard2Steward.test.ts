/**
 * DEC-CARD-2 (the user's order 2026-10-08), dc2-steward: the steward's season report "청지기가 처리한 일" in the season
 * card (from `stewardReport` over the closed season), each matter's drill-in and its way to the kind's policy; the lord
 * screen's standing policies (per kind, 관습대로 / 가볍게 / 엄하게 / 영주에게 from `standingPolicies`, each the engine's
 * `set_standing_policy`, all secondary); the old switch `recurring` as "모든 장원 청원을 영주에게"; the precedent path
 * gone. Lord mode only: the campaign and the sandbox show none of it.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { LORD_SLICE_SCENARIO_ID } from "../src/content/lordSliceConfig";
import { HOME_PETITION_KINDS, PETITION_KINDS } from "../src/content/stewardshipConfig";
import { standingPolicies, stewardReport } from "../src/engine/decisionReads";
import type { GameState } from "../src/engine/engine.types";
import { stewardshipOf } from "../src/engine/stewardship";
import { advanceTick } from "../src/engine/tick";
import { gameReducer } from "../src/state/gameStore";
import { newGameState } from "../src/state/newGame";
import { SeasonLedgerCard } from "../src/ui/hud/SeasonLedgerCard";
import * as lordCards from "../src/ui/lordCardsModel";
import { lordBeats } from "../src/ui/lordStoryBeats";
import { LORD_NAV } from "../src/ui/lord/screen/LordScreen";
import { StandingPolicyPanel } from "../src/ui/lord/steward/StandingPolicyPanel";
import { standingPolicyScreen } from "../src/ui/lord/steward/standingPolicyModel";
import { seasonStewardView } from "../src/ui/lord/steward/seasonStewardModel";
import { STEWARD_COPY } from "../src/ui/lord/steward/stewardCopy.ko";
import { seasonLedgerCardModel } from "../src/ui/seasonLedgerCard";

const SEASON = 1_000;
const noop = () => undefined;

/** Lord slice seed 1 as the engine plays it alone, the heriot set lightly: two closed seasons the steward worked in. */
const { customary, lenient } = (() => {
  let state = newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed: 1 })!;
  state = gameReducer(state, { type: "set_standing_policy", kind: "heriot", setting: "lenient" });
  let customary: GameState | null = null;
  while (state.tick < 7_002) {
    state = advanceTick(state);
    if (state.tick === 5_002) customary = state;
  }
  return { customary: customary!, lenient: state };
})();
const campaign = newGameState({ scenarioId: "core:campaign_market_town" })!;
const sandbox = newGameState({ scenarioId: "core:sandbox" })!;
const closedStart = (state: GameState) => state.seasons!.history.at(-1)!.startTick;

test("the season card's steward section is the engine's stewardReport over the closed season", () => {
  for (const state of [customary, lenient]) {
    const start = closedStart(state);
    const report = stewardReport(state, start, start + SEASON);
    const view = seasonLedgerCardModel(state)!.steward!;
    assert.deepEqual(view, seasonStewardView(state, start));
    assert.equal(view.items.length, report.handled.length + report.events.length);
    assert.ok(view.items.length > 0, "the steward handled something in the season");
    assert.equal(view.relations.length, report.policyRelations.length);
    for (const [index, entry] of report.handled.entries()) {
      const item = view.items[index]!;
      assert.equal(item.kind, entry.kind);
      assert.ok(item.summary.includes(entry.granted ? STEWARD_COPY.granted : STEWARD_COPY.refused));
      if (entry.treasury !== null) assert.equal(item.results[0], STEWARD_COPY.itemTreasury(entry.treasury), "the treasury is the engine's");
      else assert.deepEqual(item.results, [STEWARD_COPY.offMapResult], "an off-map row says where its money is");
    }
  }
  // DTR-16: the custom moves a faction by a fifth, the light setting by the table (the report's per-policy sums).
  assert.match(seasonStewardView(customary, closedStart(customary))!.relations[0]!, /^관습대로 답해 .+ 관계 [+−]1$/);
  assert.match(seasonStewardView(lenient, closedStart(lenient))!.relations[0]!, /^가볍게 답해 .+ 관계 \+5$/);
});

test("each handled matter opens a drill-in with the way to its kind's policy (only when the card has the way)", () => {
  const model = seasonLedgerCardModel(lenient)!;
  const props = { model, onResume: noop, onHint: noop, auto: false, onAutoChange: noop };
  const withWay = renderToStaticMarkup(createElement(SeasonLedgerCard, { ...props, onPolicy: noop }));
  assert.ok(withWay.includes(STEWARD_COPY.heading));
  assert.match(withWay, /<details class="season-steward-item ui-disclosure"><summary class="season-steward-summary ui-btn ui-btn--surface/);
  assert.match(withWay, new RegExp(`data-steward-policy="${model.steward!.items[0]!.kind}"`));
  assert.equal((withWay.match(/ui-btn--primary/g) ?? []).length, 1, "the card keeps its one primary (계속)");
  assert.doesNotMatch(renderToStaticMarkup(createElement(SeasonLedgerCard, props)), /data-steward-policy=/);
});

test("the standing-policy screen: every kind by family, the four settings with what each does, each the engine's command", () => {
  const view = standingPolicyScreen(lenient)!;
  const engine = standingPolicies(lenient);
  assert.deepEqual(view.families.map(family => family.family), ["manor", "estate", "event"]);
  assert.equal(view.families[0]!.kinds.length, Object.keys(HOME_PETITION_KINDS).length);
  assert.equal(view.families[1]!.kinds.length, Object.keys(PETITION_KINDS).length);
  assert.equal(view.families.flatMap(family => family.kinds).length, engine.length);
  const heriot = view.families[0]!.kinds.find(row => row.kind === "heriot")!;
  assert.deepEqual(heriot.options.map(option => option.label), ["관습대로", "가볍게", "엄하게", "영주에게"]);
  assert.deepEqual(heriot.options.filter(option => option.current).map(option => option.setting), ["lenient"]);
  // What each does is the engine's answer: the sign of the treasury and of each faction's move.
  const answers = engine.find(entry => entry.kind === "heriot")!.answers;
  for (const option of heriot.options) {
    if (option.setting === "lord") { assert.deepEqual(option.does, [STEWARD_COPY.toLord]); continue; }
    const answer = answers[option.setting];
    const sign = answer.treasury === null ? null : answer.treasury > 0 ? STEWARD_COPY.treasuryIn : answer.treasury < 0 ? STEWARD_COPY.treasuryOut : STEWARD_COPY.treasuryNone;
    if (sign !== null) assert.ok(option.does.includes(sign), option.setting);
    const moved = Object.values(answer.factions).filter(delta => delta !== 0);
    assert.equal(option.does.filter(line => line.endsWith("관계 오름") || line.endsWith("관계 내림")).length, moved.length, option.setting);
    assert.ok(!option.does.some(line => /\d/.test(line)), "signs, no numbers");
  }
  // Each setting is the engine's command, and the engine keeps it.
  for (const option of heriot.options) {
    const after = gameReducer(lenient, option.command);
    assert.equal(standingPolicies(after).find(entry => entry.kind === "heriot")!.setting, option.setting);
  }
  const sender = view.families[2]!.kinds[0]!;
  assert.match(sender.kind, /^sender:/);
  assert.equal(sender.options.find(option => option.setting === "strict")!.does[0], STEWARD_COPY.eventStrict);
});

test("the screen's buttons: equal settings all secondary, the one in force pressed; opened on a kind (the drill-in's way)", () => {
  const html = renderToStaticMarkup(createElement(StandingPolicyPanel, { state: lenient, dispatch: noop, focus: "heriot", onOpen: noop, onPerson: undefined }));
  const sets = html.match(/<button[^>]*class="lord-standing-set ui-btn ui-btn--secondary[^"]*"[^>]*>/g) ?? [];
  assert.equal(sets.length, 4, "the opened kind's four settings");
  assert.equal(sets.filter(button => button.includes('aria-pressed="true"')).length, 1);
  assert.doesNotMatch(html, /ui-btn--primary/);
  assert.match(html, /data-standing-detail="heriot"/);
  assert.match(html, /data-kind="heriot"[^]*aria-expanded="true"/);
  assert.doesNotMatch(html, /\stitle="/);
  const closed = renderToStaticMarkup(createElement(StandingPolicyPanel, { state: lenient, dispatch: noop, focus: null, onOpen: noop, onPerson: undefined }));
  assert.doesNotMatch(closed, /data-standing-detail=/, "nothing open until a kind is pressed");
});

test("모든 장원 청원을 영주에게 is the engine's rules.recurring; the precedent path is gone", () => {
  const view = standingPolicyScreen(lenient)!;
  assert.equal(view.allToLord, false);
  const on = gameReducer(lenient, view.allToLordCommand);
  assert.equal(stewardshipOf(on).rules.recurring, true);
  assert.equal(standingPolicyScreen(on)!.allToLord, true);
  assert.equal(stewardshipOf(gameReducer(on, standingPolicyScreen(on)!.allToLordCommand)).rules.recurring, false);
  assert.equal("precedentView" in lordCards, false);
  for (const state of [customary, lenient]) assert.ok(!lordBeats(state).some(beat => beat.id.startsWith("home-precedent:")));
});

test("lord mode only: no steward section, no policy screen in the campaign or the sandbox", () => {
  for (const state of [campaign, sandbox]) {
    assert.equal(seasonStewardView(state, 0), null);
    assert.equal(standingPolicyScreen(state), null);
    const petitions = LORD_NAV.find(item => item.id === "petitions")!;
    assert.equal(petitions.gate(state), STEWARD_COPY.closed);
  }
  assert.equal(LORD_NAV.find(item => item.id === "petitions")!.gate(lenient), null);
});
