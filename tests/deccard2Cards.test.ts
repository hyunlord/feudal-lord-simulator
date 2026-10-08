/**
 * DEC-CARD-2 (DC-D7): the cards read each answer from the engine's outlook (`answerOutlook`) — its treasury in 지금, its
 * later keys in 나중에 (each worded), its `remembers` in 기억하는 이 — and the dry run only for what the outlook lacks; the
 * shut answer is the outlook's null; the home petition says its kind's standing policy (DTR-1); chips run nothing.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { factionDisplayName } from "../src/content/factionCopy.ko";
import { LORD_SLICE_SCENARIO_ID } from "../src/content/lordSliceConfig";
import { HOME_PETITION_KINDS } from "../src/content/stewardshipConfig";
import type { GameState } from "../src/engine/engine.types";
import { advanceTick } from "../src/engine/tick";
import { treasuryBalance } from "../src/ledger/ledger";
import { answerOutlook } from "../src/state/decisionOutlook";
import { gameReducer } from "../src/state/gameStore";
import type { GameAction } from "../src/state/gameStore.types";
import { newGameState } from "../src/state/newGame";
import { DecisionCard } from "../src/ui/decisionCard/DecisionCard";
import { DECISION_CARD_COPY } from "../src/ui/decisionCard/decisionCardCopy.ko";
import { homePetitionCard } from "../src/ui/decisionCard/families/homePetitionCard";
import { HOME_PETITION_CARD_COPY } from "../src/ui/decisionCard/families/homePetitionCopy.ko";
import { lordAnswer } from "../src/ui/decisionCard/families/lordOutcome";
import { lordRequestCard } from "../src/ui/decisionCard/families/lordRequestCard";
import { petitionCard } from "../src/ui/decisionCard/families/petitionCard";
import { OUTLOOK_LATER_KEYS, outlookLater, outlookRemembers, outlookTreasury, type AnswerOutlook } from "../src/ui/decisionCard/outlook";
import { OUTLOOK_COPY } from "../src/ui/decisionCard/outlookCopy.ko";
import { afterAnswer, remembersOf } from "../src/ui/decisionCard/remembers";
import { homePetitionView, lordRequestView, openHomePetitions } from "../src/ui/lordCardsModel";
import { moneyShort } from "../src/ui/money.ko";
import { openPetitions } from "../src/engine/politics";
import { petitionStates } from "./helpers/deccardCampaignStates";

/** Lord slice seed 1 at its first home petition, every kind kept by the lord (DEC-TRACE §1: the steward's by default). */
const firstPetition: GameState = (() => {
  let state = newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed: 1 })!;
  for (const kind of Object.keys(HOME_PETITION_KINDS)) state = gameReducer(state, { type: "set_standing_policy", kind, setting: "lord" });
  while (openHomePetitions(state).length === 0) state = advanceTick(state);
  return state;
})();
const withRequest = (request: object) => ({ ...firstPetition, agency: { ...firstPetition.agency!, requests: [request] } }) as GameState;
const factionName = (state: GameState, id: string) => factionDisplayName(id, state.factions!.factions.find(entry => entry.id === id)?.name ?? id);

test("every later key the engine's outlook writes has its words on the card (no raw key on screen)", () => {
  const source = readFileSync("src/state/decisionOutlook.ts", "utf8");
  const keys = new Set(source.split("\n").filter(line => line.includes("later.push(")).flatMap(line => [...line.matchAll(/"([a-z]+(?:_[a-z]+)+)"/g)].map(match => match[1]!)));
  assert.deepEqual([...keys].sort(), [...OUTLOOK_LATER_KEYS].sort());
});

test("the later keys in words: deadlines as dates, the war tax's seasons, the dues in percent, the stage, the factions by name", () => {
  const state = firstPetition;
  const year = (tick: number) => Math.floor(tick / 4_000);
  const outlook: AnswerOutlook = { now: [], remembers: [], later: [
    { key: "promise_due", tick: state.tick + 4_000, amount: 240, actor: "commons" },
    { key: "promise_due", tick: state.tick + 8_000, amount: 240, actor: "commons" },
    { key: "promise_due", tick: state.tick + 2_000, actor: "lord" },
    { key: "war_tax", tick: null, perSeason: 3 },
    { key: "subsidy_paid_when_built", tick: null, amount: 240, actor: "well" },
    { key: "subsidy_withdrawn", tick: null, amount: 0, actor: "well" },
    { key: "suit_stage", tick: null, actor: "hearing" },
    { key: "timber_order", tick: null, amount: 40 },
    { key: "stall_dues", tick: null, amount: 800 },
    { key: "faction_mind", tick: null, actor: "commons" },
    { key: "faction_mind", tick: null, actor: "bishop" },
  ] };
  const lines = outlookLater(state, outlook);
  assert.equal(lines.length, 9, lines.join("\n"));
  const commons = factionName(state, "commons");
  // promise_due by deadline: the lord's word received first, then the two to the commons in one line.
  assert.match(lines[0]!, /^영주가 받은 약속은 1301년 .+까지 지켜져야 합니다\.$/);
  assert.ok(lines[1]!.startsWith(`${commons}에게 한 약속 2건(한 번에 ${moneyShort(240)})`) && lines[1]!.includes(`${1301 + year(4_000)}년`), lines[1]);
  assert.equal(lines[2], OUTLOOK_COPY.warTax(3));
  assert.match(lines[2]!, /3계절/);
  assert.equal(lines[3], OUTLOOK_COPY.subsidy("우물", 240));
  assert.equal(lines[4], OUTLOOK_COPY.subsidyGone("우물"));
  assert.equal(lines[5], "답한 뒤 소송은 심리하는 단계입니다.");
  assert.match(lines[6]!, /목재 40단/);
  assert.match(lines[7]!, /평소의 80%/);
  assert.equal(lines[8], OUTLOOK_COPY.factionMind(`${commons}, ${factionName(state, "bishop")}`));
  for (const line of lines) assert.doesNotMatch(line, /[a-z]+_[a-z]+|undefined|NaN/, line);
  // A family says a key its own way.
  assert.deepEqual(outlookLater(state, { now: [], remembers: [], later: [{ key: "war_tax", tick: null, perSeason: 2 }] }, { war_tax: () => ["own"] }), ["own"]);
});

test("the home petition's card is the engine's outlook: treasury now, the standing line and the later keys, who remembers", () => {
  const card = homePetitionCard(firstPetition)!;
  const petition = openHomePetitions(firstPetition)[0]!;
  for (const choice of card.choices) {
    const outlook = answerOutlook(firstPetition, { type: "answer_estate_petition", petitionId: petition.id, grant: choice.id === "grant" })!;
    const pennies = outlookTreasury(outlook);
    assert.equal(choice.now[0], pennies > 0 ? HOME_PETITION_CARD_COPY.treasuryIn(pennies) : pennies < 0 ? HOME_PETITION_CARD_COPY.treasuryOut(-pennies) : HOME_PETITION_CARD_COPY.treasurySame);
    assert.deepEqual(choice.later, [homePetitionView(firstPetition)!.standing, ...outlookLater(firstPetition, outlook)]);
    assert.deepEqual(choice.remembers, outlookRemembers(firstPetition, outlook));
    // The outlook's relation rows in `now` are its `remembers`: said once, in 기억하는 이.
    const relations = outlook.now.filter(row => row.key === "relation").map(row => [row.actor, row.amount]);
    assert.deepEqual(relations, outlook.remembers.map(entry => [entry.actor, entry.delta]));
    assert.ok(choice.remembers.every(entry => entry.how === DECISION_CARD_COPY.feels(entry.delta)));
  }
  const markup = renderToStaticMarkup(createElement(DecisionCard, { view: card, onChoose: () => undefined, onLater: () => undefined }));
  for (const part of ["무슨 일인가", "걸린 것", "지금", "나중에", "기억하는 이"]) assert.ok(markup.includes(part), part);
  assert.doesNotMatch(markup, /ui-btn--primary/, "equal answers, all secondary (LR1-D2)");
  assert.doesNotMatch(markup, /\stitle="|두 번 이어서/);
});

test("the shut answer is the outlook's null: the proclamation the engine refuses now is shown shut, with nothing else", () => {
  const state = withRequest({ kind: "proclaim_era" });
  const command = lordRequestView(state)!.command!;
  assert.equal(answerOutlook(state, command), null);
  assert.equal(lordAnswer(state, command), null);
  const [grant] = lordRequestCard(state)!.choices;
  assert.deepEqual([grant!.now, grant!.later, grant!.remembers], [[], [], []]);
  assert.notEqual(grant!.refusal, null);
});

test("the town's timber order: the treasury from the outlook now, its order as the outlook's later key", () => {
  const state = withRequest({ kind: "order_timber", amount: 40 });
  const command = lordRequestView(state)!.command!;
  const outlook = answerOutlook(state, command)!;
  assert.deepEqual(outlook.later, [{ key: "timber_order", tick: null, amount: 40 }]);
  const outcome = lordAnswer(state, command)!;
  assert.equal(outcome.treasury, outlookTreasury(outlook));
  assert.equal(outcome.treasury, treasuryBalance(gameReducer(state, command)) - treasuryBalance(state), "the outlook's treasury is the ledger's");
  assert.deepEqual(outcome.later, outlookLater(state, outlook));
  assert.deepEqual(lordRequestCard(state)!.choices[0]!.later, outcome.later);
});

test("outside lord mode the outlook gives only the treasury: the campaign's petition card keeps the dry run's who remembers", () => {
  const state = petitionStates().get("market_charter")!;
  assert.equal(state.agency, undefined, "the campaign");
  const petition = openPetitions(state)[0]!;
  const card = petitionCard(state)!.card;
  let moved = 0;
  for (const choice of card.choices) {
    const command: GameAction = { type: "petition_response", petitionId: petition.id, response: choice.id as never };
    const outlook = answerOutlook(state, command);
    assert.equal(choice.refusal === null, outlook !== null, `${choice.id}: shut exactly when the outlook is null`);
    if (outlook === null) continue;
    assert.deepEqual(outlook.later, [], "no trace outside lord mode");
    assert.deepEqual(outlook.remembers, []);
    assert.ok(outlook.now.every(row => row.key === "treasury"));
    assert.deepEqual(choice.remembers, remembersOf(state, afterAnswer(state, command)), choice.id);
    moved += choice.remembers.length;
  }
  assert.ok(moved > 0, "the dry run's factions are on the card");
});

test("chips run no answer: the story beats and the home petition's chip view read no outlook and no dry run", () => {
  for (const file of ["src/ui/lordStoryBeats.ts", "src/ui/lordCardsModel.ts", "src/ui/eventStory.ts"]) {
    assert.doesNotMatch(readFileSync(file, "utf8"), /answerOutlook|outlookOf|afterAnswer|lordAnswer|gameReducer/, file);
  }
  assert.ok(!("options" in homePetitionView(firstPetition)!), "the copied table moves are gone (P-D4)");
});
