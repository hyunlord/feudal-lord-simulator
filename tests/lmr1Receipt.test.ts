/** LM-R1 (receipt): the lord mode's "왜 여기?" receipt and the lord's conditions tab (src/ui/lord). */
import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { createGrowthOpening } from "../scripts/phase21OpeningTranslation";
import { AGENCY_WEEK_TICKS } from "../src/content/townAgencyConfig";
import type { GameState } from "../src/engine/engine.types";
import { history } from "../src/engine/history";
import { advanceTick } from "../src/engine/tick";
import { initialAgency, subsidyRefusal, whyHere } from "../src/engine/townAgency";
import type { ProjectReceipt } from "../src/engine/townAgency.types";
import { postLedgerEntries, treasuryBalance } from "../src/ledger/ledger";
import { DEFAULT_GAME_STATE, gameReducer } from "../src/state/gameStore";
import { chronicleFocus, clearChronicleFocus, openChronicleRecord } from "../src/ui/lord/chronicleFocus";
import { platformServices } from "../src/platform/platform";
import { LordPolicyView } from "../src/ui/lord/LordPolicyPanel";
import { POLICY_COPY } from "../src/ui/lord/policyCopy.ko";
import { DUES_MAX, DUES_MIN, duesStep, policyView, subsidyDraft } from "../src/ui/lord/policyModel";
import { LordWhyHere, ReceiptPanel } from "../src/ui/lord/ReceiptPanel";
import { RECEIPT_COPY } from "../src/ui/lord/receiptCopy.ko";
import { receiptView } from "../src/ui/lord/receiptModel";
import { decisionCompare } from "../src/ui/chronicle/chronicleScreenModel";
import { moneyFull } from "../src/ui/money.ko";

function funded(state: GameState, amount: number): GameState {
  const posted = postLedgerEntries(state, [{ account: "cash", category: "opening_balance", amount: amount - treasuryBalance(state), sourceRefs: [{ type: "scenario", id: "test" }] }]);
  return { ...state, ledger: posted.ledger, treasuryCoin: posted.treasuryCoin };
}

/** A lord-mode town whose lord set all three conditions (recorded decisions), twelve weeks on. */
let built: GameState | null = null;
function lordTown(): GameState {
  if (built !== null) return built;
  let state = funded({ ...(createGrowthOpening(1).state as GameState), agency: initialAgency() }, 1000);
  state = gameReducer(state, { type: "set_estate_policy", policy: "stability" });
  state = gameReducer(state, { type: "set_market_dues", permille: 800 });
  state = gameReducer(state, { type: "set_project_subsidy", kind: "farmstead", amount: 10 });
  while (state.tick < AGENCY_WEEK_TICKS * 12) state = advanceTick(state);
  built = state;
  return state;
}

/** A building or site with a building receipt (one that compared sites). */
function receiptTarget(state: GameState): { readonly id: string; readonly receipt: ProjectReceipt } {
  for (const entry of [...state.buildings, ...state.constructionSites]) {
    const receipt = whyHere(state, entry.id);
    if (receipt !== null && receipt.sites !== undefined) return { id: entry.id, receipt };
  }
  throw new Error("the town built nothing with a receipt");
}

const withReceipt = (state: GameState, id: string, change: (receipt: ProjectReceipt) => ProjectReceipt): GameState => ({
  ...state, agency: { ...state.agency!, receipts: state.agency!.receipts.map(receipt => receipt.id === id ? change(receipt) : receipt) },
});

test("LM-R1 the sandbox and the campaign show no receipt and no lord tab", () => {
  const sandbox = DEFAULT_GAME_STATE;
  const id = sandbox.buildings[0]!.id;
  assert.equal(receiptView(sandbox, id), null);
  assert.equal(renderToStaticMarkup(createElement(LordWhyHere, { state: sandbox, targetId: id })), "");
  assert.equal(policyView(sandbox), null);
  assert.equal(renderToStaticMarkup(createElement(LordPolicyView, { state: sandbox, dispatch: () => undefined })), "");
});

test("LM-R1 a town-built building's receipt: the top reasons signed, the sites against the next best, the chance, the decisions", () => {
  const state = lordTown();
  const { id, receipt } = receiptTarget(state);
  const view = receiptView(state, id);
  assert.ok(view !== null && view.kind === "receipt");
  assert.deepEqual(view.reasons.map(row => [row.name, row.value]), receipt.reasons.map(reason => [reason.name, reason.value]));
  for (const row of view.reasons) {
    assert.equal(row.sign, row.value > 0 ? "plus" : row.value < 0 ? "minus" : "zero");
    assert.equal(row.text, row.value > 0 ? `+${row.value}` : row.value < 0 ? `−${-row.value}` : "0");
    assert.ok(row.share >= 0 && row.share <= 1);
  }
  assert.equal(Math.max(...view.reasons.map(row => row.share)), 1);
  assert.equal(view.runnerUp, receipt.sites!.runnerUp?.score ?? null);
  assert.equal(view.siteCount, receipt.sites!.count);
  if (receipt.sites!.runnerUp !== null) {
    const next = receipt.sites!.runnerUp;
    assert.ok(view.sites.includes(RECEIPT_COPY.nextSite(next.tx, next.ty, next.score, receipt.score - next.score)));
  }
  const chance = receipt.chance!;
  assert.ok(view.chanceKnown);
  assert.equal(view.chance[0], RECEIPT_COPY.projectChance(chance.project.of, chance.project.place, chance.project.permille, RECEIPT_COPY.temperaments[chance.project.temperament]));
  // The decisions are the receipt's own ledger records, in its order, with the ledger's sentence.
  assert.deepEqual(view.decisions.map(row => row.id), receipt.decisionIds);
  for (const row of view.decisions) {
    const record = state.history!.records.find(entry => entry.id === row.id)!;
    assert.ok(row.found && record.kind === "decision");
    assert.equal(row.line, history.summary(record, state));
  }
  assert.ok(receipt.decisionIds.length > 0, "the stability policy moved the receipt's score");
  const markup = renderToStaticMarkup(createElement(ReceiptPanel, { view, onClose: () => undefined }));
  assert.match(markup, /data-frame="receipt"/);
  for (const row of view.reasons) assert.ok(markup.includes(`>${row.text}<`), `${row.name} written as text`);
  for (const decision of receipt.decisionIds) assert.ok(markup.includes(`data-record="${decision}"`));
  assert.equal((markup.match(/lord-receipt-cap/g) ?? []).length, view.reasons.length);
});

test("LM-R1 one candidate site: runnerUp null says so; an old save's receipt without chance says so", () => {
  const state = lordTown();
  const { id, receipt } = receiptTarget(state);
  const single = withReceipt(state, receipt.id, entry => ({ ...entry, sites: { ...entry.sites!, count: 1, runnerUp: null } }));
  const view = receiptView(single, id);
  assert.ok(view !== null && view.kind === "receipt");
  assert.equal(view.runnerUp, null);
  assert.ok(view.sites.includes(RECEIPT_COPY.noRunnerUp));
  const { chance: _chance, sites: _sites, ...rest } = receipt;
  const old = withReceipt(state, receipt.id, () => rest);
  const oldView = receiptView(old, id);
  assert.ok(oldView !== null && oldView.kind === "receipt");
  assert.equal(oldView.chanceKnown, false);
  assert.deepEqual(oldView.chance, [RECEIPT_COPY.noChance]);
  assert.deepEqual(oldView.sites, [RECEIPT_COPY.noSites]);
  assert.match(renderToStaticMarkup(createElement(ReceiptPanel, { view: oldView, onClose: () => undefined })), /data-chance="none"/);
});

test("LM-R1 the receipt's money: a subsidy of 0 and a paid one are both written", () => {
  const state = lordTown();
  const { id, receipt } = receiptTarget(state);
  for (const subsidy of [0, 10]) {
    const view = receiptView(withReceipt(state, receipt.id, entry => ({ ...entry, subsidy })), id);
    assert.ok(view !== null && view.kind === "receipt");
    assert.equal(view.money, RECEIPT_COPY.money(moneyFull(receipt.cost), moneyFull(subsidy), moneyFull(receipt.loan)));
  }
});

test("LM-R1 a building without a receipt explains why instead of an empty frame", () => {
  const state = lordTown();
  const opening = state.buildings.find(building => whyHere(state, building.id) === null && building.kind !== "keep")!;
  const view = receiptView(state, opening.id);
  assert.ok(view !== null && view.kind === "none");
  assert.equal(view.explanation, RECEIPT_COPY.noneTown);
  const markup = renderToStaticMarkup(createElement(ReceiptPanel, { view, onClose: () => undefined }));
  assert.ok(markup.includes(RECEIPT_COPY.noneTown) && markup.includes(RECEIPT_COPY.noneHeading));
  const keep = { ...state, buildings: [...state.buildings, { ...opening, id: "keep-test", kind: "keep" as const }] };
  assert.equal((receiptView(keep, "keep-test") as { explanation?: string }).explanation, RECEIPT_COPY.noneLord);
});

test("LM-R1 the lord tab: a subsidy past a quarter of the treasury is refused with its reason and its button shut", () => {
  const state = lordTown();
  const view = policyView(state);
  assert.ok(view !== null);
  assert.equal(view.options.filter(option => option.chosen).map(option => option.key).join(), "stability");
  assert.equal(view.subsidies.map(row => [row.kind, row.amount]).join(), "farmstead,10");
  const limit = Math.floor(treasuryBalance(state) / 4);
  const refused = subsidyDraft(state, "granary", limit + 10);
  const reason = subsidyRefusal(state, "granary", limit + 10)!;
  assert.ok(refused.refused);
  assert.equal(refused.blocked, POLICY_COPY.refusal(moneyFull(reason.total), moneyFull(reason.limit)));
  const allowed = subsidyDraft(state, "granary", 10);
  assert.equal(allowed.blocked, null);
  assert.equal(subsidyDraft(state, "granary", 0).blocked, POLICY_COPY.zeroAmount);
  const markup = renderToStaticMarkup(createElement(LordPolicyView, { state, dispatch: () => undefined }));
  assert.match(markup, /aria-pressed="true"[^>]*data-policy="stability"|data-policy="stability"[^>]*aria-pressed="true"/);
  assert.ok(markup.includes('data-withdraw="farmstead"'));
  assert.ok(!/<(input|select)\b/.test(markup), "kit controls only");
  assert.equal(duesStep(DUES_MIN, -1), DUES_MIN);
  assert.equal(duesStep(DUES_MAX, 1), DUES_MAX);
  assert.equal(duesStep(800, 1), 850);
});

test("LM-R1 the engine refuses what the tab refuses, and records what it sets (the same commands)", () => {
  const state = lordTown();
  const limit = Math.floor(treasuryBalance(state) / 4);
  const refused = gameReducer(state, { type: "set_project_subsidy", kind: "granary", amount: limit + 10 });
  assert.equal(refused.agency!.subsidies.some(subsidy => subsidy.kind === "granary"), false);
  assert.equal(subsidyDraft(state, "granary", limit + 10).refused, true);
  const set = gameReducer(state, { type: "set_project_subsidy", kind: "granary", amount: 10 });
  assert.ok(set.agency!.subsidies.some(subsidy => subsidy.kind === "granary" && subsidy.amount === 10));
});

test("LM-R1 a decision ribbon leaves its record and asks for the chronicle; the chronicle clears it", () => {
  const asked: string[] = [];
  const stop = platformServices().input.subscribe(intent => { if (intent.kind === "panel") asked.push(intent.panel); return "handled"; });
  openChronicleRecord("h-000002", 120);
  stop();
  assert.deepEqual(asked, ["chronicle"]);
  assert.deepEqual(chronicleFocus(), { recordId: "h-000002", tick: 120 });
  clearChronicleFocus();
  assert.equal(chronicleFocus(), null);
});

test("LM-R1 the chronicle names the lord's conditions in the lord tab's words, not the engine's keys", () => {
  const state = lordTown();
  const shown = (kind: string) => {
    const record = (state.history?.records ?? []).find(entry => entry.decision !== undefined && entry.params?.decisionKind === kind);
    assert.ok(record !== undefined, kind);
    const view = decisionCompare(state, record)!;
    return [view.chosen, ...view.alternatives];
  };
  assert.deepEqual(shown("estate_policy"), ["안정", "성장", "세입", "방어"]);
  assert.deepEqual(shown("market_dues"), [POLICY_COPY.duesNow(800), POLICY_COPY.duesNow(1000)]);
  assert.deepEqual(shown("project_subsidy"), [POLICY_COPY.choiceSubsidy("헛간", moneyFull(10)), POLICY_COPY.choiceSubsidyNone("헛간")]);
});
