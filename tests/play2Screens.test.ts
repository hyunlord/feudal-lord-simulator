/**
 * PLAY-2 (Astra's second lord-mode play, 2026-10-08), the screen's part: the file-suit button's cost and the hearing's two
 * sides from the filing tried on the state; the famine's card after the answer (the bottleneck left, the lord's next
 * lever); the year card's way to the chronicle on that year; a card answer's chronicle line naming the event and the
 * answer. The fast seal's mark showing 10x: tests/nat4Cards.test.ts and tests/courtConsoleContracts.test.ts. Then the
 * lead's three from the report's frictions 10, 9 and 8: the palisade guidance in lord mode, the people a birth or a
 * marriage names (with their biographies), and a house decision's chip kept until answered.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { HOME_ESTATE_ID } from "../src/content/estateConfig";
import { WEAK_POINTS } from "../src/content/historyCopy.ko";
import { LORD_SLICE_SCENARIO_ID } from "../src/content/lordSliceConfig";
import { V4_COPY } from "../src/content/registry/v4Copy.generated";
import { preparedness } from "../src/engine/crisisReads";
import type { GameState } from "../src/engine/engine.types";
import { estatesOf, LORD } from "../src/engine/estates";
import { suitFilingOutlook } from "../src/engine/estateSuits";
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
import { lordLevers, townStatus } from "../src/ui/lord/advice/lordAdvice";
import { chronicleFilterFocus, clearChronicleFocus, focusChronicleYears } from "../src/ui/lord/chronicleFocus";
import { LORD_LEDGER_COPY } from "../src/ui/lord/ledger/ledgerCopy.ko";
import { ledgerView } from "../src/ui/lord/ledger/ledgerModel";
import { HOME_PETITION_COPY } from "../src/ui/lordCardsCopy.ko";
import { moneyShort } from "../src/ui/money.ko";
import { evaluateEraRequirements } from "../src/engine/era";
import { personDisplayName } from "../src/engine/persons";
import { advanceTick } from "../src/engine/tick";
import { FamilyLinks } from "../src/ui/chronicle/FamilyLinks";
import { buildEraConsoleModel } from "../src/ui/EraConsole";
import type { StoryBeat } from "../src/ui/eventStory";
import { storyChips } from "../src/ui/hud/useStoryPresentation";
import { lordWallGuidance } from "../src/ui/lord/advice/lordWall";
import { LORD_WALL_COPY } from "../src/ui/lord/advice/lordWallCopy.ko";
import { DECISION_CARDS_COPY } from "../src/ui/lord/decisions/decisionCardsCopy.ko";
import { familyPeople } from "../src/ui/persons/familyNews";
import { LORD_MATTER_CHIP, lordMatterChipIds } from "../src/ui/lord/decisions/lordMattersDue";

const LATIN = /[A-Za-z]{2,}/;
const lord = newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed: 3 })!;
const withTreasury = (state: GameState, coin: number): GameState => {
  const posted = postLedgerEntries(state, [{ account: "cash", category: "opening_balance", amount: coin - treasuryBalance(state), sourceRefs: [{ type: "scenario", id: "test" }] }]);
  return { ...state, ledger: posted.ledger, treasuryCoin: posted.treasuryCoin };
};

test("PLAY-2 / SUIT-THREAD 소송 걸기: the button says the filing's cost (the engine's suitFilingOutlook, said even when refused) and the hearing it would open — who wins judged now and whether the claim can still pass", () => {
  const claim = estatesOf(lord).claims.find(entry => entry.claimant === LORD && entry.status === "open")!;
  const after = gameReducer(lord, { type: "file_suit", claimId: claim.id });
  assert.notEqual(after, lord, "the claim can be filed at the start");
  const outlook = suitFilingOutlook(lord, claim.id);
  assert.equal(outlook.refusal, null);
  assert.equal(outlook.cost, treasuryBalance(lord) - treasuryBalance(after), "the cost is what the filing takes");
  assert.ok(outlook.cost > 0 && outlook.hearing !== null);
  const row = ledgerView(lord, null)!.claims.find(entry => entry.id === claim.id)!;
  assert.equal(row.cost, moneyShort(outlook.cost));
  const { plaintiff, defence, verdictNow, reachable } = outlook.hearing!;
  assert.equal(row.hearing, LORD_LEDGER_COPY.hearingIfFiled(LORD_LEDGER_COPY.hearing(plaintiff, defence, verdictNow, reachable)));
  // The user's words (2026-10-09): the verdict now, and the claim's reach with all it may yet add.
  assert.equal(LORD_LEDGER_COPY.hearing(45, 80, "defendant", false), "청구 쪽 45 · 방어 쪽 80. 지금 판결하면 방어 쪽이 이깁니다 · 남은 증거와 후원을 다 더해도 넘기 어렵습니다");
  assert.equal(LORD_LEDGER_COPY.hearing(45, 80, "defendant", true), "청구 쪽 45 · 방어 쪽 80. 지금 판결하면 방어 쪽이 이깁니다 · 남은 증거와 후원을 다 더하면 넘을 수 있습니다");
  assert.equal(LORD_LEDGER_COPY.hearing(90, 80, "plaintiff", true), "청구 쪽 90 · 방어 쪽 80. 지금 판결하면 청구 쪽이 이깁니다");
  assert.match(row.hearing!, verdictNow === "plaintiff" ? /청구 쪽이 이깁니다$/ : reachable ? /넘을 수 있습니다$/ : /넘기 어렵습니다$/);
  assert.equal(LORD_LEDGER_COPY.fileSuitCost(row.cost), `소송 걸기 · ${row.cost}`);
  // The treasury short: the engine refuses, and the button still says what the filing would take (DTR-22).
  const poor = withTreasury(lord, 0);
  const refused = suitFilingOutlook(poor, claim.id);
  assert.equal(refused.refusal, "treasury");
  const shut = ledgerView(poor, null)!.claims.find(entry => entry.id === claim.id)!;
  assert.deepEqual([shut.refusal, shut.cost], [LORD_LEDGER_COPY.refusals.treasury, moneyShort(refused.cost)]);
  assert.ok(refused.cost > 0);
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
  const [left, status, next] = famineAfterFacts(state);
  assert.deepEqual(beat.facts.slice(1), [left, status, next]);
  assert.equal(status, townStatus(state, { kind: "building", building: "market" }), "what the town is doing about it (the report's 대기 상태)");
  assert.equal(left, FAMINE_AFTER_COPY.left(WEAK_POINTS.no_market!));
  assert.equal(next, FAMINE_AFTER_COPY.next(lordLevers(state, { kind: "building", building: "market" })[0]!));
  assert.match(beat.advice, /시장/, "the [조언] is the lord's advice on the market");
  // No granary: that comes first (the engine's order), with the granary's lever.
  const bare = { ...state, buildings: state.buildings.filter(building => building.kind !== "granary") };
  assert.ok(famineAfterFacts(bare)[0]!.startsWith(FAMINE_AFTER_COPY.left(WEAK_POINTS.no_granary!)), famineAfterFacts(bare)[0]);
  assert.equal(famineAfterFacts(bare).at(-1), FAMINE_AFTER_COPY.next(lordLevers(bare, { kind: "building", building: "granary" })[0]!));
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

// --- PLAY-2 items 6–8 (the lead's 2026-10-08 additions, from docs/qa/lordplay2-20261008/TOP10_FRICTION.md 10, 9, 8) ---

test("PLAY-2 friction 10: in lord mode the palisade guidance is the town's line and its request, with the lord's lever — drawing it himself only when the town found none", () => {
  const unmet = evaluateEraRequirements(lord).find(requirement => !requirement.met)!;
  const waiting = lordWallGuidance(lord, null)!;
  assert.equal(waiting.line, LORD_WALL_COPY.waiting(unmet.label, unmet.current, unmet.target));
  assert.equal(waiting.next, lordLevers(lord, { kind: "houses" })[0], "the population's lever: the houses' (명령 › 장려 구역)");
  const model = buildEraConsoleModel({ state: lord, draft: null });
  assert.deepEqual([model.proposal.visible, model.proposal.label, model.proposal.failure], [true, waiting.line, waiting.next]);
  assert.doesNotMatch(model.proposal.label, /직접 그어/);
  const asked = { ...lord, agency: { ...lord.agency!, requests: [{ kind: "proclaim_era" }] } } as unknown as GameState;
  assert.deepEqual(lordWallGuidance(asked, null), { line: LORD_WALL_COPY.asked, next: null });
  // Outside lord mode the sandbox's guidance stays.
  const { agency: _agency, ...sandbox } = lord;
  assert.equal(lordWallGuidance(sandbox as GameState, null), null);
});

test("PLAY-2 friction 9: a birth names the child and both parents, each with a biography button; the marriage's first child, its parents named as its record gives them", () => {
  const town = advanceTick(lord);
  const child = town.persons!.people.find(person => person.motherId !== undefined && person.fatherId !== undefined)!;
  const mother = town.persons!.people.find(person => person.id === child.motherId)!;
  const father = town.persons!.people.find(person => person.id === child.fatherId)!;
  const born = { id: "h-born", tick: town.tick, kind: "person", template: "person.born", severity: 0, subject: { type: "person", id: child.id },
    params: { motherId: mother.id, fatherId: father.id, nameFrom: "common" } } as unknown as HistoryRecord;
  const people = familyPeople(town, born);
  assert.deepEqual(people.map(person => [person.role, person.personId, person.biography]), [["child", child.id, true], ["mother", mother.id, true], ["father", father.id, true]]);
  const card = chronicleRecordCard(town, { key: born.id, tick: born.tick, record: born, bundle: null });
  assert.ok(card.sentence.endsWith(`어머니 ${personDisplayName(mother)} · 아버지 ${personDisplayName(father)}`), card.sentence);
  const markup = renderToStaticMarkup(createElement(FamilyLinks, { state: town, record: born, card, onPerson: () => undefined }));
  for (const role of ["child", "mother", "father"]) assert.match(markup, new RegExp(`data-family="${role}"`));
  assert.match(markup, new RegExp(`aria-label="어머니 ${personDisplayName(mother)}의 전기 보기"`));
  // The marriage's first child (PLAY-2 §4): the record names the child and its father beside the bride, so all three are
  // named (the bot's own record: tests/familyNewsRecords.test.ts); an older record names only the bride, and only she is
  // named (no child, no father guessed).
  const firstChild = familyPeople(town, { template: "marriage.child_born", params: { bride: mother.id, child: child.id, father: father.id }, tick: town.tick });
  assert.deepEqual(firstChild.map(person => [person.role, person.personId]), [["child", child.id], ["mother", mother.id], ["father", father.id]]);
  const older = familyPeople(town, { template: "marriage.child_born", params: { bride: mother.id }, tick: town.tick });
  assert.deepEqual(older.map(person => [person.role, person.personId]), [["mother", mother.id]]);
});

test("PLAY-2 friction 8: a house decision with a deadline stays among the chips until answered — not put away, not pushed out, gone once answered", () => {
  const beat = (id: string, kind: string) => ({ id, kind, illustration: null, tile: null, decision: null, title: id, line: "", facts: [], advice: "" }) as unknown as StoryBeat;
  const will = beat("marriage-decision:will_change:c1", "lord_decision");
  const others = ["a", "b", "c", "d"].map(id => beat(id, "fire"));
  const entries = [{ beat: will, firstSeenMs: 0, lastSeenMs: 9_000, dismissed: true }, ...others.map((entry, index) => ({ beat: entry, firstSeenMs: 1_000 + index, lastSeenMs: 9_000, dismissed: false }))];
  const current = new Set([will.id, ...others.map(entry => entry.id)]);
  const due = new Set([will.id]);
  const shown = storyChips(entries, current, 10_000, 500, () => false, due);
  assert.equal(shown[0]!.id, will.id, "first, though its card was closed and four chips came after it");
  assert.equal(shown.length, 3);
  assert.ok(!storyChips(entries, current, 10_000, 500, () => false).some(entry => entry.id === will.id), "not due (the adapter's list): put away as closed");
  current.delete(will.id); due.delete(will.id);
  assert.ok(!storyChips(entries, current, 10_000, 500, () => false, due).some(entry => entry.id === will.id), "answered: gone at once");
  // The chips' ids (lordStoryBeats); SUIT-THREAD: the engine's lordMattersDue (tests/suitRestScreens.test.ts; PLAY-2 §4 the
  // audit and the off-map petition among them, tests/lordMatterDeadlines.test.ts).
  assert.deepEqual([...lordMatterChipIds(lord)], []);
  assert.equal(LORD_MATTER_CHIP.marriage("will_change", "c1"), will.id);
  assert.ok(DECISION_CARDS_COPY.willDeadline(null).length > 0);
});
