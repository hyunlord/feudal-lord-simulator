/**
 * PLAY-2 §4 (renderer A's request docs/requests/engine-play2-reads.md §4, friction 8; the engine's GROW-BLOCK
 * `lordMattersDue`): a Michaelmas audit's finding and an off-map estate's petition brought to the lord are among the
 * engine's matters due, with their deadlines. The screen takes them from that list only (no additions of its own, no
 * duplicate chips, the same chip ids) and says the deadline as a season on their chips (as the will's); the lord-mode
 * auto-pause does not stop for them as matters due (the user's ruling 2026-10-09: their own events stop it already) — on
 * a lord-mode town holding an off-map estate under
 * a greedy steward (as tests/stewardship.test.ts), played through its first Michaelmas and two seasons on.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

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
import { AUTO_PAUSE_COPY } from "../src/ui/hud/autoPauseCopy.ko";
import { autoPauseLines } from "../src/ui/hud/autoPauseLines";
import { autoPauseMemory, autoPauseStep, type AutoPauseItem, type AutoPauseMemory } from "../src/ui/hud/autoPauseModel";
import { auditDecisionHead, offMapPetitionHead } from "../src/ui/lord/decisions/decisionCardsModel";
import { LORD_MATTERS_COPY } from "../src/ui/lord/decisions/lordMattersCopy.ko";
import { LORD_MATTER_CHIP, lordMatterChipIds } from "../src/ui/lord/decisions/lordMattersDue";

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

/** The adapter as trunk had it before (decision SUIT-D5): the engine's matters, then the audit's and the off-map petition's heads. */
function trunkChipIds(state: GameState): ReadonlySet<string> {
  const ids = new Set([...lordMatterChipIds(state)].filter(id => !id.startsWith("audit:") && !id.startsWith("estate-petition:")));
  for (const matter of lordMattersDue(state)) if (matter.kind === "audit" || matter.kind === "estate_petition") ids.add(chipOf(matter));
  const audit = auditDecisionHead(state); const petition = offMapPetitionHead(state);
  if (audit !== null) ids.add(LORD_MATTER_CHIP.audit(audit.auditId));
  if (petition !== null) ids.add(LORD_MATTER_CHIP.petition(petition.petitionId));
  return ids;
}

/** The lord2 states (scripts/lmr2States.ts on the DGX; LMR2_STATES=<dir>) that hold an audit or an off-map petition. */
function lord2(name: string): GameState | null {
  const dir = process.env.LMR2_STATES;
  const file = dir === undefined ? "" : join(dir, `${name}.json`);
  return dir === undefined || !existsSync(file) ? null : JSON.parse(readFileSync(file, "utf8")) as GameState;
}

test("SUIT-D5 superseded, nothing lost: the chip ids are the old adapter's (the engine's and the cards' heads, deduped), and the deadlines the engine's dueTick", () => {
  const states = [...played.states, ...["audit-pending", "inherited"].flatMap(name => { const state = lord2(name); return state === null ? [] : [state]; })];
  let compared = 0;
  for (const state of states) {
    assert.deepEqual([...lordMatterChipIds(state)].sort(), [...trunkChipIds(state)].sort(), `tick ${state.tick}`);
    for (const beat of storyBeats(state).filter(entry => entry.id.startsWith("audit:") || entry.id.startsWith("estate-petition:"))) {
      const matter = lordMattersDue(state).find(entry => chipOf(entry) === beat.id)!;
      assert.ok(matter.dueTick !== null);
      const due = matter.kind === "audit" ? LORD_MATTERS_COPY.auditDue(dateWord(state, matter.dueTick)) : LORD_MATTERS_COPY.petitionDue(dateWord(state, matter.dueTick));
      assert.ok(beat.facts.includes(due), `${beat.id}: ${beat.facts.join(" | ")}`);
      compared += 1;
    }
  }
  assert.ok(compared > 0, "chips compared");
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

test("the user's ruling: an audit or an off-map petition never stops the auto-pause as a matter due — its own event stops it (a steward's petition for a right)", () => {
  assert.ok(played.states.some(state => lordMattersDue(state).some(matter => matter.kind === "audit")), "an audit waited");
  assert.ok(played.states.some(state => lordMattersDue(state).some(matter => matter.kind === "estate_petition")), "a petition waited");
  for (const stop of played.stops) for (const item of stop.items) assert.ok(item.kind === "event" || (item.matter.kind !== "audit" && item.matter.kind !== "estate_petition"), item.key);
  // The petition a steward brought for a right still stops time, by its own ledger line.
  const raised = played.stops.find(stop => stop.items.some(item => item.kind === "event" && item.event.template === "stewardship.escalated"));
  assert.ok(raised !== undefined, "the steward brought a right to the lord");
  const line = autoPauseLines(raised.after, raised.items.filter(item => item.kind === "event"))[0]!;
  assert.equal(line.word, AUTO_PAUSE_COPY.reasons.rights_petition);
  assert.deepEqual(line.link, { kind: "modal", modal: "estate_petition_offmap" });
  // Their words, should a notice ever name them (the engine's, GROW-BLOCK).
  assert.deepEqual([AUTO_PAUSE_COPY.matters.audit, AUTO_PAUSE_COPY.matters.estate_petition], ["미카엘마스 감사", "영지 청원"]);
});
