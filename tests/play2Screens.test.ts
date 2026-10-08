/**
 * PLAY-2 (Astra's second lord-mode play, 2026-10-08), the screen's part: the file-suit button's cost and the hearing's two
 * sides from the filing tried on the state; the famine's card after the answer (the bottleneck left, the lord's next
 * lever); the year card's way to the chronicle on that year; a card answer's chronicle line naming the event and the
 * answer. The fast seal's mark showing 10x: tests/nat4Cards.test.ts and tests/courtConsoleContracts.test.ts.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { HOME_ESTATE_ID } from "../src/content/estateConfig";
import { LORD_SLICE_SCENARIO_ID } from "../src/content/lordSliceConfig";
import { V4_COPY } from "../src/content/registry/v4Copy.generated";
import { preparedness } from "../src/engine/crisisReads";
import type { GameState } from "../src/engine/engine.types";
import { estatesOf, LORD } from "../src/engine/estates";
import { suitHearing } from "../src/engine/estateSuits";
import type { HistoryRecord } from "../src/engine/history.types";
import { treasuryBalance, postLedgerEntries } from "../src/ledger/ledger";
import { gameReducer } from "../src/state/gameStore";
import { newGameState } from "../src/state/newGame";
import { ChronicleScreen } from "../src/ui/chronicle/ChronicleScreen";
import { DEFAULT_CHRONICLE_FILTER, recordCard } from "../src/ui/chronicle/chronicleScreenModel";
import { chronicleRecordCard } from "../src/ui/chronicle/decisionThreadModel";
import { storyBeats } from "../src/ui/eventStory";
import { famineAfterFacts } from "../src/ui/lord/advice/famineAfter";
import { FAMINE_AFTER_COPY } from "../src/ui/lord/advice/famineAfterCopy.ko";
import { lordLevers } from "../src/ui/lord/advice/lordAdvice";
import { chronicleFilterFocus, clearChronicleFocus, focusChronicleYears } from "../src/ui/lord/chronicleFocus";
import { claimOutlook } from "../src/ui/lord/ledger/claimOutlook";
import { LORD_LEDGER_COPY } from "../src/ui/lord/ledger/ledgerCopy.ko";
import { ledgerView } from "../src/ui/lord/ledger/ledgerModel";
import { HOME_PETITION_COPY } from "../src/ui/lordCardsCopy.ko";
import { moneyShort } from "../src/ui/money.ko";

const LATIN = /[A-Za-z]{2,}/;
const lord = newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed: 3 })!;
const withTreasury = (state: GameState, coin: number): GameState => {
  const posted = postLedgerEntries(state, [{ account: "cash", category: "opening_balance", amount: coin - treasuryBalance(state), sourceRefs: [{ type: "scenario", id: "test" }] }]);
  return { ...state, ledger: posted.ledger, treasuryCoin: posted.treasuryCoin };
};

test("PLAY-2 소송 걸기: the button says the treasury the filing takes, and the hearing's two sides for the suit filed now — the game's own command tried on the state", () => {
  const claim = estatesOf(lord).claims.find(entry => entry.claimant === LORD && entry.status === "open")!;
  const after = gameReducer(lord, { type: "file_suit", claimId: claim.id });
  assert.notEqual(after, lord, "the claim can be filed at the start");
  const suit = estatesOf(after).suits.find(entry => entry.claimId === claim.id)!;
  const outlook = claimOutlook(lord, claim.id)!;
  assert.equal(outlook.cost, treasuryBalance(lord) - treasuryBalance(after));
  assert.ok(outlook.cost > 0);
  assert.deepEqual(outlook.sides, suitHearing(after, suit.id));
  const row = ledgerView(lord, null)!.claims.find(entry => entry.id === claim.id)!;
  assert.equal(row.cost, moneyShort(outlook.cost));
  assert.equal(row.hearing, LORD_LEDGER_COPY.hearingIfFiled(outlook.sides!.plaintiff, outlook.sides!.defence));
  assert.doesNotMatch(row.hearing!, /이깁|집니다|유리|불리/, "who would win is not worded (the engine gives no verdict now)");
  assert.equal(LORD_LEDGER_COPY.fileSuitCost(row.cost!), `소송 걸기 · ${row.cost}`);
  // The treasury short: the engine refuses, and the screen says the refusal, no cost it was not given.
  const poor = withTreasury(lord, 0);
  assert.equal(claimOutlook(poor, claim.id), null);
  const shut = ledgerView(poor, null)!.claims.find(entry => entry.id === claim.id)!;
  assert.deepEqual([shut.refusal, shut.cost, shut.hearing], [LORD_LEDGER_COPY.refusals.treasury, null, null]);
});

const losses = { burntHouses: 0, departures: 0, harvestLost: 0 };
const famine = (state: GameState, answered: boolean): GameState => ({ ...state, tick: 9_400, events: { records: [{ id: "great_famine@67", defId: "great_famine", kind: "dearth",
  season: 67, arrivalTick: 9_000, losses, ...(answered ? { response: { choice: "relief" as const, tick: 9_100 } } : {}) }], burning: [] } } as GameState);

test("PLAY-2 기근 대응 뒤: once answered, the famine's card says the bottleneck left (the engine's preparedness) and, in lord mode, the lord's next lever", () => {
  const open = storyBeats(famine(lord, false)).find(beat => beat.kind === "famine")!;
  assert.equal(open.facts.length, 1, "before the answer: only until when");
  const state = famine(lord, true);
  const now = preparedness(state);
  assert.deepEqual(now.weakPoints, ["no_market"], "the slice's start: a granary, no market");
  const beat = storyBeats(state).find(entry => entry.kind === "famine")!;
  const [left, next] = famineAfterFacts(state);
  assert.deepEqual(beat.facts.slice(1), [left, next]);
  assert.equal(left, FAMINE_AFTER_COPY.left(FAMINE_AFTER_COPY.points.no_market()));
  assert.equal(next, FAMINE_AFTER_COPY.next(lordLevers(state, { kind: "building", building: "market" })[0]!));
  assert.match(beat.advice, /시장/, "the [조언] is the lord's advice on the market");
  // No granary: that comes first (the engine's order), with the granary's lever.
  const bare = { ...state, buildings: state.buildings.filter(building => building.kind !== "granary") };
  assert.ok(famineAfterFacts(bare)[0]!.startsWith(FAMINE_AFTER_COPY.left(FAMINE_AFTER_COPY.points.no_granary())), famineAfterFacts(bare)[0]);
  assert.equal(famineAfterFacts(bare)[1], FAMINE_AFTER_COPY.next(lordLevers(bare, { kind: "building", building: "granary" })[0]!));
  for (const line of beat.facts) assert.doesNotMatch(line, LATIN);
  // Nothing left: what the engine checked, with its numbers; no lever.
  const stocked = { ...state, buildings: [...state.buildings, { ...state.buildings.find(building => building.kind === "granary")!, id: "test-market", kind: "market" }] } as GameState;
  const checked = preparedness(stocked);
  assert.deepEqual(checked.weakPoints, [], "a market added: nothing left");
  assert.deepEqual(famineAfterFacts(stocked), [FAMINE_AFTER_COPY.none(checked.granaries, checked.markets, checked.foodDays)]);
  // Outside lord mode the bottleneck alone (the sandbox's lord builds; its advice stays).
  const { agency: _agency, ...sandbox } = state;
  assert.deepEqual(famineAfterFacts(sandbox as GameState), [left]);
});

test("PLAY-2 연말 카드 → 연대기: the year card's request opens the chronicle filtered to that year, once", () => {
  focusChronicleYears(1300, 1300);
  assert.deepEqual(chronicleFilterFocus(DEFAULT_CHRONICLE_FILTER), { ...DEFAULT_CHRONICLE_FILTER, fromYear: 1300, toYear: 1300 });
  const markup = renderToStaticMarkup(createElement(ChronicleScreen, { state: lord, onClose: () => undefined, onLookAt: () => undefined }));
  assert.match(markup, /data-from-year="1300" data-to-year="1300"/);
  clearChronicleFocus();
  assert.equal(chronicleFilterFocus(DEFAULT_CHRONICLE_FILTER), DEFAULT_CHRONICLE_FILTER, "the request is spent");
});

test("PLAY-2 연대기 목록 제목: a card answer's line names the event and the answer chosen, the steward's the petition and his answer", () => {
  const entryId = "ck_evt_001";
  const petition = { id: "home-p1", estateId: HOME_ESTATE_ID, kind: "boundary_dispute", status: "decided", decidedBy: "steward" };
  const state = { ...lord, registry: { ...lord.registry, occurrences: [{ id: "occ-1", entryId }] },
    stewardship: { ...lord.stewardship, petitions: [petition] } } as unknown as GameState;
  const card: HistoryRecord = { id: "h-card", tick: 100, kind: "decision", template: "decision.card", severity: 1, subject: "town",
    params: { decisionKind: "registry", command: "answer_registry_offer", subjectId: "occ-1", chosen: "a" }, decision: { chosen: "a", alternatives: ["b"], predicted: {} } } as unknown as HistoryRecord;
  const item = (record: HistoryRecord) => ({ key: record.id, tick: record.tick, record, bundle: null });
  assert.equal(recordCard(state, item(card)).sentence, "사건에 답했다", "the ledger's sentence names only the command");
  assert.equal(chronicleRecordCard(state, item(card)).sentence, `${V4_COPY[entryId]!.title}: ${V4_COPY[entryId]!.choices.a!.label}`);
  const steward: HistoryRecord = { id: "h-steward", tick: 200, kind: "decision", template: "decision.steward", severity: 1, subject: "town",
    params: { decisionKind: "manor_petition", subjectId: "home-p1", chosen: "granted", policy: "customary" }, decision: { chosen: "granted", alternatives: ["refused"], predicted: {} } } as unknown as HistoryRecord;
  const line = chronicleRecordCard(state, item(steward)).sentence;
  assert.ok(line.startsWith(`장원 청원 '${HOME_PETITION_COPY.boundary_dispute.title}' — 청지기가`), line);
  assert.ok(line.endsWith("(들어줌)"), line);
  // Any other record keeps its card.
  const other = { ...card, id: "h-other", template: "decision.market_dues", params: { chosen: 500 } } as unknown as HistoryRecord;
  assert.deepEqual(chronicleRecordCard(state, item(other)), recordCard(state, item(other)));
});
