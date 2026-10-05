import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { HOME_ESTATE_ID } from "../src/content/estateConfig";
import { LORD_SLICE_SCENARIO_ID, SANDBOX_SCENARIO_ID } from "../src/content/scenario/coreScenarios";
import type { GameState } from "../src/engine/engine.types";
import { estatePortfolio, estatesOf, LORD } from "../src/engine/estates";
import { advanceStewardship, attention, oversightViews, pendingAudits, stewardshipOf } from "../src/engine/stewardship";
import { advanceTick } from "../src/engine/tick";
import { gameReducer } from "../src/state/gameStore";
import { newGameState } from "../src/state/newGame";
import { PORTFOLIO_ART_IDS } from "../src/ui/lord/estates/estatesArt";
import { estateCards, estateCardView, estatePicture, holderLabel } from "../src/ui/lord/estates/estatesModel";
import { attentionView, portfolioView, RULE_FIRST, rulesCommand } from "../src/ui/lord/estates/oversightModel";
import { PortfolioPanel, portfolioGate } from "../src/ui/lord/estates/PortfolioPanel";

// LM-R2 (estates area): the portfolio's view models on real lord-mode states — the card (estatesOf / estatePortfolio),
// its picture from the Estate's own fields, the overlay only on an estate taken into possession, the oversight and its
// commands, the attention, the audit, the season summaries; and the panel's markup (kit only, lord mode only).
// LMR2_STATES=<dir> (scripts/lmr2States.ts, DGX ~/fls-lmr2-states) adds the lord2 states; without it the held estate is
// built in-process (the marriage's inheritance: the third neighbour's title and possession to the lord, then the next
// season's oversight by the engine's own advanceStewardship).

const NEIGHBOUR_3 = "estate-neighbour-3";
let sliceCache: GameState | null = null;
function slice(): GameState {
  if (sliceCache !== null) return sliceCache;
  let state = newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID })!;
  for (let tick = 0; tick < 300; tick += 1) state = advanceTick(state);
  sliceCache = state;
  return state;
}
/** The third neighbour's estate inherited (as marriage.ts estateTo does), then the season that gives it its oversight. */
function inherited(): GameState {
  const state = slice();
  const estates = estatesOf(state);
  const held = { ...state, estates: { ...estates, estates: estates.estates.map(estate => estate.id !== NEIGHBOUR_3 ? estate : {
    ...estate, titleHolder: LORD, possessor: LORD, pieces: estate.pieces.map(piece => ({ ...piece, titleHolder: LORD, possessor: LORD, possessedSince: state.tick })) }) } };
  return advanceStewardship({ ...held, tick: 1000 });
}
const dir = process.env.LMR2_STATES;
const lord2 = (name: string): GameState | null => dir === undefined || !existsSync(join(dir, `${name}.json`)) ? null
  : JSON.parse(readFileSync(join(dir, `${name}.json`), "utf8")) as GameState;
const markup = (state: GameState, focus: string | null = null) =>
  renderToStaticMarkup(createElement(PortfolioPanel, { state, dispatch: () => undefined, focus, onOpen: () => undefined, onPerson: undefined }));

test("each card is its estate's portfolio entry: title, possession, pieces and worth as estatePortfolio has them", () => {
  const state = slice();
  const cards = estateCards(state);
  const portfolio = estatePortfolio(state);
  assert.deepEqual(cards.map(card => card.estateId), portfolio.map(estate => estate.id));
  assert.equal(cards[0]!.estateId, HOME_ESTATE_ID);
  for (const estate of portfolio) {
    const card = estateCardView(state, estate.id)!;
    assert.equal(card.possessorId, estate.possessor);
    assert.equal(card.titleHolderId, estate.titleHolder);
    assert.equal(card.annualValue, estate.annualValue);
    assert.deepEqual(card.pieces.map(piece => [piece.id, piece.titleHolderId, piece.possessorId, piece.yearValue, piece.claims]),
      estate.pieces.map(piece => [piece.id, piece.titleHolder, piece.possessor, piece.yearValue, piece.claims.length]));
    assert.equal(card.claims, estate.claims.length + estate.pieces.reduce((sum, piece) => sum + piece.claims.length, 0));
  }
  assert.equal(estateCardView(state, "estate-nowhere"), null);
  assert.equal(holderLabel(state, "crown"), "국왕");
});

test("the picture comes from the estate's kind, value, burdens and pieces — never from a portrait", () => {
  const state = slice();
  const byId = new Map(estateCards(state).map(card => [card.estateId, card]));
  assert.equal(byId.get(HOME_ESTATE_ID)!.picture, "ordinary");
  assert.equal(byId.get("estate-neighbour-1")!.picture, "wealthy", "40 marks, no debt");
  assert.equal(byId.get("estate-neighbour-2")!.picture, "riverside_mill", "the mill estate");
  assert.equal(byId.get(NEIGHBOUR_3)!.picture, "poor", "debts past a year's worth");
  const n1 = estatePortfolio(state).find(estate => estate.id === "estate-neighbour-1")!;
  assert.equal(estatePicture({ ...n1, pieces: n1.pieces.map((piece, index) => index === 0 ? { ...piece, possessor: "crown" } : piece) }), "declining",
    "a piece of its own title held by another");
  assert.equal(estatePicture({ ...n1, annualValue: 2000 }), "hunting");
  assert.equal(estatePicture({ ...n1, annualValue: 2000, pieces: n1.pieces.filter(piece => piece.kind !== "hunting") }), "ordinary");
  // Faces change nothing.
  const faced = { ...state, estates: { ...estatesOf(state), people: estatesOf(state).people.map(person => ({ ...person, portraitIdentity: "I101" })) } };
  assert.deepEqual(estateCards(faced).map(card => card.picture), estateCards(state).map(card => card.picture));
});

test("the overlay sits only on an off-map estate the lord took into possession", () => {
  assert.deepEqual(estateCards(slice()).filter(card => card.overlay), []);
  const state = inherited();
  const cards = estateCards(state);
  assert.deepEqual(cards.filter(card => card.overlay).map(card => card.estateId), [NEIGHBOUR_3]);
  assert.equal(cards.find(card => card.home)!.overlay, false, "the home estate is the lord's but not taken into possession");
  const n3 = cards.find(card => card.estateId === NEIGHBOUR_3)!;
  assert.equal(n3.standing, "direct");
  assert.equal(n3.oversight, "direct");
  assert.equal(n3.houseLordId, null, "the lord's own estate draws no other house's lord");
  for (const name of ["inherited", "audit-pending", "attention-overloaded", "promises", "neighbour-suit"]) {
    const real = lord2(name);
    if (real !== null) assert.deepEqual(estateCards(real).filter(card => card.overlay).map(card => card.estateId), [NEIGHBOUR_3], name);
  }
});

test("oversight: the keeper, the candidates and the engine's commands; only merchant and peasant wear a trait icon", () => {
  const state = inherited();
  const view = portfolioView(state);
  const panel = view.oversight.get(NEIGHBOUR_3)!;
  assert.equal(panel.mode, "direct");
  assert.equal(panel.office, "receiver");
  assert.equal(panel.candidates.length, 3);
  assert.equal(panel.candidates.filter(row => row.serving).length, 1);
  assert.equal(panel.keeper?.personId, oversightViews(state)[0]!.oversight.stewardId);
  for (const row of panel.candidates) assert.equal(row.trait, row.disposition === "merchant" ? "merchant_friendly" : row.disposition === "peasant" ? "peasant_friendly" : null);
  const delegate = panel.modes.find(entry => entry.mode === "steward")!.command!;
  const after = gameReducer(state, delegate);
  assert.equal(oversightViews(after)[0]!.oversight.mode, "steward");
  assert.equal(estateCardView(after, NEIGHBOUR_3)!.standing, "delegated");
  assert.equal(portfolioView(after).oversight.get(NEIGHBOUR_3)!.office, "steward");
  const other = panel.candidates.find(row => !row.serving)!;
  const swapped = gameReducer(after, portfolioView(after).oversight.get(NEIGHBOUR_3)!.candidates.find(row => row.personId === other.personId)!.appoint!);
  assert.equal(oversightViews(swapped)[0]!.oversight.stewardId, other.personId);
  const visit = gameReducer(state, panel.auditModes.find(entry => entry.mode === "visit")!.command!);
  assert.equal(oversightViews(visit)[0]!.oversight.auditMode, "visit");
  assert.equal(panel.auditModes.find(entry => entry.chosen)!.command, null, "the chosen mode sends nothing");
});

test("the exceptions: each switch is set_exception_rules with every other field kept", () => {
  const state = inherited();
  assert.equal(portfolioView(slice()).rules, null, "no stewardship, no exceptions");
  const on = gameReducer(state, rulesCommand(state, { amountAtLeast: RULE_FIRST }));
  assert.equal(stewardshipOf(on).rules.amountAtLeast, RULE_FIRST);
  const rights = gameReducer(on, rulesCommand(on, { rights: true }));
  assert.deepEqual({ ...stewardshipOf(rights).rules }, { ...stewardshipOf(on).rules, rights: true });
  assert.equal(portfolioView(rights).rules!.canLess, true);
});

test("attention: the engine's load, capacity and reasons; overloaded says so", () => {
  const state = inherited();
  const now = attention(state);
  const view = attentionView(state);
  assert.deepEqual([view.load, view.capacity, view.overloaded], [now.load, now.capacity, now.overloaded]);
  assert.deepEqual(view.reasons.map(reason => reason.name), now.reasons.map(reason => reason.name));
  const real = lord2("attention-overloaded");
  if (real === null) { console.log("LMR2_STATES unset: the overloaded and pending-audit cases use the lord2 states only"); return; }
  const over = attentionView(real);
  assert.equal(over.overloaded, true);
  assert.notEqual(over.warning, null);
  assert.match(markup(real, NEIGHBOUR_3), /data-overloaded="true"/);
});

test("a pending audit shows its facts; the season summary shows what the lord sees, not what was kept back", () => {
  const real = lord2("audit-pending");
  if (real === null) return;
  const audit = pendingAudits(real)[0]!;
  const panel = portfolioView(real).oversight.get(audit.estateId)!;
  assert.equal(panel.pending?.auditId, audit.id);
  assert.equal(panel.pending?.mode, audit.mode);
  assert.equal(portfolioView(real).totals.audit, "감사 대기");
  const html = markup(real, audit.estateId);
  assert.match(html, new RegExp(`data-pending-audit="${audit.id}"`));
  const summaries = stewardshipOf(real).summaries.filter(entry => entry.estateId === audit.estateId);
  assert.equal(panel.summaries.length, Math.min(8, summaries.length));
  assert.ok(summaries.some(entry => entry.kept > 0), "the season kept something back");
  for (const row of panel.summaries) assert.ok(!Object.values(row).some(value => typeof value === "string" && /빼돌|오류/.test(value)), "no kept or error amount in a row");
});

test("the panel: kit only, a deep link's estate selected, lord mode only", () => {
  const state = inherited();
  assert.equal(portfolioGate(state), null);
  const sandbox = newGameState({ scenarioId: SANDBOX_SCENARIO_ID })!;
  assert.equal(sandbox.agency, undefined);
  assert.notEqual(portfolioGate(sandbox), null, "shut outside lord mode");
  const html = markup(state, NEIGHBOUR_3);
  assert.match(html, new RegExp(`data-lord-estates="${NEIGHBOUR_3}"`));
  assert.match(html, new RegExp(`data-estate="${NEIGHBOUR_3}"[^>]*aria-pressed="true"`));
  assert.match(html, /data-oversight="direct"/);
  assert.match(markup(state), new RegExp(`data-lord-estates="${HOME_ESTATE_ID}"`));
  for (const forbidden of [/ title="/, /<select/, /<input/, /ui-btn--primary/]) assert.doesNotMatch(html, forbidden);
  assert.ok(PORTFOLIO_ART_IDS.every(id => id.startsWith("lord.estates.")));
});
