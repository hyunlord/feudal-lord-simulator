/**
 * PLAY-2 §4 (renderer A's request docs/requests/engine-play2-reads.md §4, friction 8; the engine's GROW-BLOCK
 * `lordMattersDue`): a Michaelmas audit's finding and an off-map estate's petition brought to the lord are among the
 * engine's matters due, with their deadlines. The screen takes them from that list only (no additions of its own, no
 * duplicate chips, the same chip ids), says the deadline as a season on their chips (as the will's), and the lord-mode
 * auto-pause stops for them with a line and the way to their card — on a lord-mode town holding an off-map estate under
 * a greedy steward (as tests/stewardship.test.ts), played through its first Michaelmas and two seasons on.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { createGrowthOpening } from "../scripts/phase21OpeningTranslation";
import type { GameState } from "../src/engine/engine.types";
import { estatesOf, LORD } from "../src/engine/estates";
import { lordMattersDue, type LordMatterDue } from "../src/engine/lordDue";
import { MARRIAGE_ESTATE_ID } from "../src/engine/marriage";
import { stewardCandidates, stewardshipOf } from "../src/engine/stewardship";
import { advanceTick } from "../src/engine/tick";
import { initialAgency } from "../src/engine/townAgency";
import { gameReducer } from "../src/state/gameStore";
import { dateWord } from "../src/ui/decisionCard/answerWords";
import { storyBeats } from "../src/ui/eventStory";
import { AutoPauseNotice } from "../src/ui/hud/AutoPauseNotice";
import { AUTO_PAUSE_COPY } from "../src/ui/hud/autoPauseCopy.ko";
import { autoPauseLines } from "../src/ui/hud/autoPauseLines";
import { autoPauseMemory, autoPauseStep, type AutoPauseItem, type AutoPauseMemory } from "../src/ui/hud/autoPauseModel";
import { auditDecisionHead, offMapPetitionHead } from "../src/ui/lord/decisions/decisionCardsModel";
import { LORD_MATTERS_COPY } from "../src/ui/lord/decisions/lordMattersCopy.ko";
import { LORD_MATTER_CHIP, lordMatterChipIds } from "../src/ui/lord/decisions/lordMattersDue";
import { INITIAL_UI_STATE } from "../src/ui/stateMachine/uiStateMachine";

const ESTATE = MARRIAGE_ESTATE_ID;
type Stop = { readonly before: GameState; readonly after: GameState; readonly items: readonly AutoPauseItem[] };

/** The town a year in, holding the third neighbour's estate; a greedy steward, a visit at Michaelmas, rights brought up. */
const played = (() => {
  let state: GameState = { ...(createGrowthOpening(1).state as GameState), agency: initialAgency() };
  while (state.persons === undefined) state = advanceTick(state);
  for (let tick = 0; tick < 3_990; tick += 1) state = advanceTick(state);
  const estates = estatesOf(state);
  state = { ...state, estates: { ...estates, estates: estates.estates.map(estate => estate.id === ESTATE ? { ...estate, titleHolder: LORD, possessor: LORD } : estate) } };
  while (state.stewardship === undefined) state = advanceTick(state);
  const greedy = stewardCandidates(state, ESTATE).find(entry => entry.record.disposition === "greedy")!.record;
  state = gameReducer(state, { type: "set_estate_oversight", estateId: ESTATE, mode: "steward", stewardId: greedy.personId });
  state = gameReducer(state, { type: "set_audit_mode", estateId: ESTATE, mode: "visit" });
  state = gameReducer(state, { type: "set_exception_rules", rules: { amountAtLeast: null, rights: true, marriage: false } });
  let memory: AutoPauseMemory = autoPauseMemory(state);
  const stops: Stop[] = [];
  const states: GameState[] = [];
  const end = state.tick + 4_100;
  while (state.tick < end) {
    const before = state;
    state = advanceTick(state);
    const step = autoPauseStep(memory, state, before);
    memory = step.memory;
    if (step.fresh.length > 0) stops.push({ before, after: state, items: step.fresh });
    if (lordMattersDue(state).length !== lordMattersDue(before).length) states.push(state);
  }
  return { stops, states };
})();

const chipOf = (matter: LordMatterDue) => matter.kind === "audit" ? LORD_MATTER_CHIP.audit(matter.id) : LORD_MATTER_CHIP.petition(matter.id);
const matterStops = (kind: LordMatterDue["kind"]) => played.stops.flatMap(stop => stop.items.flatMap(item => item.kind === "matter" && item.matter.kind === kind ? [{ stop, item }] : []));

test("the audit and the off-map petition come from the engine's list only: the same chip ids, no chip twice, the card's one each", () => {
  const audited = played.states.find(state => lordMattersDue(state).some(matter => matter.kind === "audit"));
  assert.ok(audited !== undefined, "the Michaelmas visit found what the greedy steward kept");
  let both = 0;
  for (const state of played.states) {
    const due = lordMattersDue(state);
    const ids = lordMatterChipIds(state);
    // Every chip id is an engine matter's (nothing of the screen's own), and every audit or off-map petition the engine lists has one.
    assert.deepEqual([...ids].filter(id => id.startsWith("audit:") || id.startsWith("estate-petition:")).sort(),
      due.filter(matter => matter.kind === "audit" || matter.kind === "estate_petition").map(chipOf).sort(), `tick ${state.tick}`);
    const beats = storyBeats(state).map(beat => beat.id);
    assert.equal(new Set(beats).size, beats.length, `no chip twice at tick ${state.tick}`);
    // A card shows the first waiting one of its kind: that one's chip only, and it is the engine's.
    const audit = auditDecisionHead(state); const petition = offMapPetitionHead(state);
    assert.deepEqual(beats.filter(id => id.startsWith("audit:")), audit === null ? [] : [LORD_MATTER_CHIP.audit(audit.auditId)]);
    assert.deepEqual(beats.filter(id => id.startsWith("estate-petition:")), petition === null ? [] : [LORD_MATTER_CHIP.petition(petition.petitionId)]);
    for (const id of beats.filter(entry => entry.startsWith("audit:") || entry.startsWith("estate-petition:"))) assert.ok(ids.has(id), id);
    if (audit !== null && petition !== null) both += 1;
  }
  assert.ok(both > 0, "an audit and a petition waited together");
});

test("their chips say the engine's deadline as a season, as the will's (no days counted)", () => {
  let audits = 0; let petitions = 0;
  for (const state of played.states) {
    for (const matter of lordMattersDue(state)) {
      const beat = storyBeats(state).find(entry => entry.id === chipOf(matter));
      if (beat === undefined || (matter.kind !== "audit" && matter.kind !== "estate_petition")) continue;
      const when = dateWord(state, matter.dueTick!);
      if (matter.kind === "audit") {
        audits += 1;
        assert.equal(matter.dueTick, stewardshipOf(state).audits.find(entry => entry.id === matter.id)!.deadline);
        assert.deepEqual(beat.facts, [auditDecisionHead(state)!.kicker, LORD_MATTERS_COPY.auditDue(when)]);
        assert.equal(beat.decision, "audit_decision");
      } else {
        petitions += 1;
        assert.equal(matter.dueTick, stewardshipOf(state).petitions.find(entry => entry.id === matter.id)!.deadline);
        assert.equal(beat.facts[0], LORD_MATTERS_COPY.petitionDue(when));
        assert.equal(beat.decision, "estate_petition_offmap");
      }
      assert.match(when, /^\d{4}년 /);
      assert.ok(!beat.facts.some(fact => /일 남음/.test(fact)), beat.facts.join(" | "));
    }
  }
  assert.ok(audits > 0 && petitions > 0, `${audits} audit chips, ${petitions} petition chips`);
});

test("the auto-pause stops for a new audit and a new off-map petition: its word, its card's line and deadline, the way to its card", () => {
  const audit = matterStops("audit")[0];
  assert.ok(audit !== undefined, "the audit stopped time");
  const petition = matterStops("estate_petition").find(entry => offMapPetitionHead(entry.stop.after)?.petitionId === entry.item.matter.id);
  assert.ok(petition !== undefined, "an off-map petition the card shows stopped time");
  for (const [{ stop, item }, head, modal, label] of [
    [audit, auditDecisionHead(audit.stop.after)!.line, "audit_decision", AUTO_PAUSE_COPY.links.audit],
    [petition, offMapPetitionHead(petition.stop.after)!.line, "estate_petition_offmap", AUTO_PAUSE_COPY.links.petition],
  ] as const) {
    if (item.kind !== "matter") continue;
    const line = autoPauseLines(stop.after, [item])[0]!;
    assert.equal(line.word, AUTO_PAUSE_COPY.matters[item.matter.kind]);
    assert.equal(line.sentence, AUTO_PAUSE_COPY.matterSentence(head, dateWord(stop.after, item.matter.dueTick!)));
    assert.deepEqual(line.link, { kind: "modal", modal });
    assert.equal(line.linkLabel, label);
    assert.ok(!autoPauseMemory(stop.before).matters.has(item.key), "new in that batch");
    const markup = renderToStaticMarkup(createElement(AutoPauseNotice, { state: stop.after, hold: { season: "s", items: [item], shown: [item], mode: "stopped" },
      paused: true, ui: INITIAL_UI_STATE, onLord: () => {}, onModal: () => {}, onDismiss: () => {} }));
    assert.equal(markup.match(/ui-btn--primary/g)?.length ?? 0, 1);
    assert.ok(markup.includes(label) && markup.includes(line.word));
  }
  // A petition behind the one the card shows: its line, no link (its card would open the other).
  const behind = matterStops("estate_petition").find(entry => offMapPetitionHead(entry.stop.after)?.petitionId !== entry.item.matter.id);
  if (behind !== undefined && behind.item.kind === "matter") {
    const line = autoPauseLines(behind.stop.after, [behind.item])[0]!;
    assert.notEqual(line.sentence, "");
    assert.equal(line.link, null);
  }
});

test("a petition a steward brought for a right stops once, as its rights petition's line (no second line for the matter)", () => {
  const raised = played.stops.find(stop => stop.items.some(item => item.kind === "event" && item.event.template === "stewardship.escalated"));
  assert.ok(raised !== undefined, "the steward brought a right to the lord");
  const petitions = stewardshipOf(raised.after).petitions.filter(petition => petition.escalated === "rights" && petition.tick > raised.before.tick);
  assert.ok(petitions.length > 0);
  for (const petition of petitions) {
    assert.ok(lordMattersDue(raised.after).some(matter => matter.kind === "estate_petition" && matter.id === petition.id), "the engine lists it");
    assert.ok(!raised.items.some(item => item.kind === "matter" && item.matter.id === petition.id), petition.id);
    assert.ok(!played.stops.some(stop => stop.items.some(item => item.kind === "matter" && item.matter.id === petition.id)), "nor later");
  }
  const line = autoPauseLines(raised.after, raised.items.filter(item => item.kind === "event"))[0]!;
  assert.equal(line.word, AUTO_PAUSE_COPY.reasons.rights_petition);
});
