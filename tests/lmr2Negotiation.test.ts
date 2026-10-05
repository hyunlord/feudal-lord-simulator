import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { LORD_SLICE_SCENARIO_ID, SANDBOX_SCENARIO_ID, DEFAULT_SCENARIO_ID } from "../src/content/scenario/coreScenarios";
import type { GameState } from "../src/engine/engine.types";
import { marriageGrooms } from "../src/engine/marriage";
import { counterOffer, debtInstalmentCap, debtInstalmentYears, diplomacyOf, evaluateOffer, jointurePiece, materialCeiling } from "../src/engine/negotiation";
import { gameReducer } from "../src/state/gameStore";
import { newGameState } from "../src/state/newGame";
import { NEGOTIATION_COPY as COPY } from "../src/ui/lord/negotiation/negotiationCopy.ko";
import { SCALE_CELL } from "../src/ui/lord/negotiation/negotiationArt";
import { NegotiationPanel } from "../src/ui/lord/negotiation/NegotiationPanel";
import {
  chooseGroom, clauseEditors, counterRows, draftTerms, draftView, EMPTY_DRAFT, negotiationGateReason, negotiationScreen, stepAmount, STEPS,
  timelineView, toggleClause, type Draft,
} from "../src/ui/lord/negotiation/negotiationModel";

// LM-R2 (negotiation area): the 혼인 screen's view model against the engine's read models — the draft's live preview is the
// engine's own evaluateOffer / materialCeiling / marriageRefusal of the very terms the offer sends; the counter marks only
// counter.changes; the timeline reads the MarriagePlan. LMR2_STATES=<dir> also walks the lord2 states (scripts/lmr2States.ts).

const C = "estate:estate-neighbour-3";
const slice = (): GameState => newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID })!;
const withConsent = (state: GameState, draft: Draft) => [...draftTerms(state, draft), { kind: "consent" as const, giver: "counterpart" as const }];
const on = (...kinds: Parameters<typeof toggleClause>[1][]) => kinds.reduce((draft, kind) => toggleClause(draft, kind), EMPTY_DRAFT);

function lord2(name: string): GameState | null {
  const dir = process.env.LMR2_STATES;
  const file = dir === undefined ? "" : join(dir, `${name}.json`);
  return dir === undefined || !existsSync(file) ? null : JSON.parse(readFileSync(file, "utf8")) as GameState;
}

test("the menu item: open in lord mode with a groom and a bride, shut with the game's reason outside lord mode", () => {
  assert.equal(negotiationGateReason(slice()), null);
  for (const scenarioId of [SANDBOX_SCENARIO_ID, DEFAULT_SCENARIO_ID]) assert.equal(negotiationGateReason(newGameState({ scenarioId })!), COPY.gate.lordOnly, scenarioId);
});

test("the empty draft: no terms (the engine's refusal), the consent row alone, the engine's acceptance of consent alone", () => {
  const state = slice();
  const view = draftView(state, EMPTY_DRAFT);
  assert.equal(view.phase, "draft");
  assert.equal(view.refusal, "no_terms");
  assert.equal(view.refusalText, COPY.refusals.no_terms);
  assert.deepEqual(view.rows.map(row => row.kind), ["consent"]);
  const engine = evaluateOffer(state, "lord", C, withConsent(state, EMPTY_DRAFT));
  assert.equal(view.preview.tier, engine.tier);
  assert.equal(view.preview.score, engine.score);
  assert.deepEqual(view.preview.reasons.map(reason => [reason.name, reason.value]), engine.top.map(reason => [reason.name, reason.value]));
  assert.equal(view.ceiling, materialCeiling(state, "lord", C, withConsent(state, EMPTY_DRAFT)));
  assert.deepEqual(view.grooms.map(groom => groom.id), marriageGrooms(state).map(entry => entry.person.id));
  assert.equal(view.grooms.filter(groom => groom.chosen).length, 1);
  assert.ok(view.bride !== null);
  assert.equal(view.last, null);
  assert.equal(view.seal, "empty");
  assert.ok(!/de [A-Z]|Fitz/.test(view.houses), `the houses in Korean: ${view.houses}`);
});

test("every edit's preview is the engine's: impossible, close and likely by clauses alone", () => {
  const state = slice();
  const drafts: Record<string, Draft> = {
    impossible: on("inheritance_non_infringement", "residence"),
    close: on("political_support"),
    likely: stepAmount(stepAmount(EMPTY_DRAFT, "debt_after_inheritance", STEPS.debt_after_inheritance[0]), "debt_after_inheritance", STEPS.debt_after_inheritance[0]),
    redLine: on("wardship"),
  };
  const tiers = Object.fromEntries(Object.entries(drafts).map(([name, draft]) => {
    const view = draftView(state, draft);
    assert.equal(view.preview.tier, evaluateOffer(state, "lord", C, withConsent(state, draft)).tier, name);
    assert.equal(view.refusal, null, name);
    return [name, view.preview.tier];
  }));
  assert.deepEqual(tiers, { impossible: "impossible", close: "close", likely: "likely", redLine: "impossible" });
  const redLine = draftView(state, drafts.redLine!);
  assert.ok(redLine.preview.reasons.some(reason => reason.name === "red_line" && reason.sign === "minus"));
  assert.ok(redLine.ceilingBelow, "a red line holds the score under the line whatever money is added");
  // The scale shows a cell per tier, all five different.
  assert.equal(new Set(Object.values(SCALE_CELL)).size, 5);
});

test("the jointure rides on the engine's piece; a debt is taken on only as the instalment cap carries it", () => {
  const state = slice();
  const jointure = draftTerms(state, on("jointure")).find(term => term.kind === "jointure");
  assert.equal(jointure?.pieceId, jointurePiece(state));
  const debt = clauseEditors(state, EMPTY_DRAFT).find(editor => editor.kind === "debt_assumption")!;
  const carried = debtInstalmentYears(state, STEPS.debt_assumption[0]) !== null;
  assert.equal(debt.steps!.find(step => step.delta === STEPS.debt_assumption[0])!.enabled, carried);
  if (debtInstalmentCap(state) <= 0) assert.equal(debt.note, COPY.instalmentNone);
  // Walk a later state (a year paid in): every debt the editor lets through has the engine's instalment years.
  const lord = lord2("contested");
  if (lord !== null) {
    let draft = EMPTY_DRAFT;
    for (let press = 0; press < 40; press += 1) {
      const step = clauseEditors(lord, draft).find(editor => editor.kind === "debt_assumption")!.steps!.find(entry => entry.delta === STEPS.debt_assumption[1])!;
      if (!step.enabled) break;
      draft = stepAmount(draft, "debt_assumption", step.delta);
    }
    const term = draftTerms(lord, draft).find(entry => entry.kind === "debt_assumption");
    if (term !== undefined) assert.equal(term.years, debtInstalmentYears(lord, term.amount!));
  }
});

test("sent: the answer shows at once — a red line draws a counter with the changed and the rejected rows marked", () => {
  const state = slice();
  const draft = chooseGroom(on("wardship"), marriageGrooms(state)[0]!.person.id);
  const sent = gameReducer(state, { type: "propose_marriage", terms: draftView(state, draft).terms, groomId: draftView(state, draft).groomId! });
  const negotiation = diplomacyOf(sent).negotiations.at(-1)!;
  assert.equal(negotiation.status, "countered");
  const view = negotiationScreen(sent, EMPTY_DRAFT);
  assert.equal(view.phase, "countered");
  if (view.phase !== "countered") return;
  assert.equal(view.last.text, COPY.answers.countered);
  const marks = Object.fromEntries(view.rows.map(row => [row.kind, row.mark]));
  assert.equal(marks.wardship, "rejected");
  for (const change of negotiation.counter!.changes) assert.equal(marks[change.kind], change.change === "removed" ? "rejected" : "changed", change.kind);
  assert.equal(view.rows.filter(row => row.mark !== "same").length, negotiation.counter!.changes.length, "only counter.changes are marked");
  assert.equal(view.preview.tier, negotiation.counter!.acceptance.tier);
  assert.ok(view.canAccept && view.canRefuse);
  // Refused: back to a draft, with the answer above it and the seal broken.
  const refused = negotiationScreen(gameReducer(sent, { type: "answer_counter", negotiationId: negotiation.id, accept: false }), EMPTY_DRAFT);
  assert.equal(refused.phase, "draft");
  if (refused.phase === "draft") { assert.equal(refused.last?.status, "withdrawn"); assert.equal(refused.seal, "broken"); assert.equal(refused.refusal, "no_terms"); }
  // Accepted: the contract, its terms the counter's, the seal stamped.
  const accepted = negotiationScreen(gameReducer(sent, { type: "answer_counter", negotiationId: negotiation.id, accept: true }), EMPTY_DRAFT);
  assert.equal(accepted.phase, "contract");
  if (accepted.phase === "contract") {
    assert.equal(accepted.stage, "contracted");
    assert.equal(accepted.seal, "stamped");
    assert.deepEqual(accepted.rows.map(row => row.kind), negotiation.counter!.terms.map(term => term.kind));
    assert.equal(accepted.last?.status, "accepted");
  }
});

test("the counter rows follow termChanges exactly (raised shows from → to)", () => {
  const state = slice();
  const offered = withConsent(state, stepAmount(EMPTY_DRAFT, "debt_after_inheritance", STEPS.debt_after_inheritance[0]));
  const counter = counterOffer(state, "lord", C, offered, "negotiation-1");
  assert.ok(counter !== null);
  const rows = counterRows({ id: "n", proposer: "lord", counterpart: C, purpose: "marriage", groomId: "g", brideId: "b", terms: offered,
    acceptance: evaluateOffer(state, "lord", C, offered), status: "countered", counter: counter!, tick: 0, deadline: 1000 });
  for (const change of counter!.changes) {
    const row = rows.find(entry => entry.kind === change.kind)!;
    assert.equal(row.mark, change.change === "removed" ? "rejected" : "changed");
    if (change.change === "raised") assert.ok(row.change?.includes("→"), row.change ?? "");
  }
});

test("lord2 states: the counter waiting, the contract, the will change due, the contest linked to its suit, the inheritance", { skip: process.env.LMR2_STATES === undefined ? "LMR2_STATES unset (scripts/lmr2States.ts states on the DGX: ~/fls-lmr2-states)" : false }, () => {
  const countered = lord2("offer-countered")!;
  const counter = negotiationScreen(countered, EMPTY_DRAFT);
  assert.equal(counter.phase, "countered");
  if (counter.phase === "countered") {
    const negotiation = diplomacyOf(countered).negotiations.find(entry => entry.status === "countered")!;
    assert.equal(counter.rows.filter(row => row.mark !== "same").length, negotiation.counter!.changes.length);
  }
  const contracted = negotiationScreen(lord2("marriage-contracted")!, EMPTY_DRAFT);
  assert.equal(contracted.phase === "contract" && contracted.stage, "contracted");
  const will = negotiationScreen(lord2("will-change")!, EMPTY_DRAFT);
  assert.ok(will.phase === "contract" && will.due === "will_change" && will.dueText === COPY.willDue);
  const contestedState = lord2("contested")!;
  const contested = negotiationScreen(contestedState, EMPTY_DRAFT);
  assert.ok(contested.phase === "contract" && contested.due === "contested");
  if (contested.phase === "contract") {
    const plan = diplomacyOf(contestedState).marriage!;
    const suit = contestedState.estates!.suits.find(entry => entry.claimId === plan.claimId && entry.plaintiff === "lord");
    assert.equal(contested.suitFocus, suit?.id ?? plan.claimId);
    assert.ok(contested.details.some(line => line.startsWith("경쟁자")), "the rival is named");
    assert.ok(contested.details.some(line => line.startsWith("유언 변경에 한 답")));
  }
  for (const name of ["inherited", "promises"]) {
    const state = lord2(name)!;
    const view = timelineView(state, diplomacyOf(state).marriage!);
    assert.equal(view.stage, "inherited", name);
    assert.ok(view.details.some(line => line.startsWith("상속 뒤 빚 갚기")), name);
    assert.ok(view.events.some(event => event.key === "father_died"), name);
  }
});

test("the panel: each phase drawn with kit buttons — one primary on the draft, the counter's answers both secondary", () => {
  const render = (state: GameState) => renderToStaticMarkup(createElement(NegotiationPanel, { state, dispatch: () => undefined, focus: null, onOpen: () => undefined, onPerson: undefined }));
  const state = slice();
  const draft = render(state);
  assert.match(draft, /data-neg-phase="draft"/);
  assert.equal(draft.match(/ui-btn--primary/g)?.length ?? 0, 1);
  assert.match(draft, /class="[^"]*lord-neg-send[^"]*"[^>]*disabled=""/, "no terms: the offer is shut");
  assert.ok(draft.includes(COPY.refusals.no_terms));
  assert.ok(!/<(input|select|textarea)\b/.test(draft));
  assert.match(draft, /class="lord-neg-divider"/);
  const sent = gameReducer(state, { type: "propose_marriage", terms: draftTerms(state, on("wardship")) });
  const counter = render(sent);
  assert.match(counter, /data-neg-phase="countered"/);
  assert.equal(counter.match(/ui-btn--primary/g)?.length ?? 0, 0, "equal choices are both secondary");
  assert.match(counter, /data-answer-counter="accept"/);
  assert.match(counter, /data-answer-counter="refuse"/);
  assert.match(counter, /data-mark="rejected"/);
  assert.match(counter, /data-mark="changed"/);
  const contested = lord2("contested");
  if (contested !== null) assert.match(render(contested), /data-open-suit="/);
});

test("source guard: kit Buttons only, one primary, no native input, no title attribute, no hex colour", () => {
  const files = readdirSync("src/ui/lord/negotiation").map(name => `src/ui/lord/negotiation/${name}`);
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    assert.ok(!/<(input|select|button|textarea)\b/.test(text), `${file}: native control`);
    assert.ok(!/\btitle=/.test(text), `${file}: title attribute`);
    assert.ok(!/onClick=/.test(text), `${file}: a click handler off the kit`);
  }
  const panel = readFileSync("src/ui/lord/negotiation/NegotiationPanel.tsx", "utf8");
  assert.equal(panel.match(/variant="primary"/g)?.length ?? 0, 1, "one primary button (the offer)");
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(readFileSync("src/styles/lordNegotiation.css", "utf8")), "hex colours live in palette.ts");
});
