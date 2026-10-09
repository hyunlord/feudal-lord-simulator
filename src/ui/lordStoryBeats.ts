import type { GameState } from "../engine/engine.types";
import { buildingFootprint } from "../geometry/buildingFootprint";
import { diplomacyOf } from "../engine/negotiation";
import { lordMode } from "../engine/townAgency";
import { dateWord } from "./decisionCard/answerWords";
import type { StoryBeat } from "./eventStory";
import { DECISION_CARDS_COPY } from "./lord/decisions/decisionCardsCopy.ko";
import { auditDecisionHead, marriageDecisionHead, offMapPetitionHead } from "./lord/decisions/decisionCardsModel";
import { lordMatterBeats } from "./lord/decisions/lordMatterBeats";
import { LORD_MATTERS_COPY } from "./lord/decisions/lordMattersCopy.ko";
import { LORD_MATTER_CHIP, lordMatter } from "./lord/decisions/lordMattersDue";
import { LORD_CARDS_COPY } from "./lordCardsCopy.ko";
import { homePetitionView, lordRequestView, type LordRequestView } from "./lordCardsModel";
import { lordMomentBeats } from "./lordMomentBeats";
import { REGISTRY_CARD_COPY } from "./registryCardCopy.ko";
import { registryHeadline } from "./registryCardModel";
import { houseChangeViews, houseRecordIds } from "./results/houseChange";
import { RESULTS_COPY } from "./results/resultsCopy.ko";
import type { StoryIllustration } from "./storyArt";

// LM-R1 (petitions): the lord's cards as story beats (lord mode only), so each comes the way the political petitions
// do — the world first, then its chip; the chip's [결정하기] opens the card (eventStory `decisionModal`). A home petition
// also opens its card once by itself (useStoryPresentation), as a political petition does. EVENT-ART: a registry offer
// (an event entry) the same way, with its picture on the chip (none when the entry has no picture).

/** The manor house (the lord's seat, where his court sits), else the keep: where [위치로] looks — the middle tile of its
 * footprint (MANOR-1: the manor is 3 × 3, so its top-left tile is one off its middle). */
function seatTile(state: GameState) {
  const seat = state.buildings.find(building => building.kind === "manor_house") ?? state.buildings.find(building => building.kind === "keep");
  if (seat === undefined) return null;
  const size = buildingFootprint(seat);
  return { tx: seat.tx + Math.floor((size.width - 1) / 2), ty: seat.ty + Math.floor((size.height - 1) / 2) };
}

/** The town's requests' chip pictures: the market town's proclamation and the palisade's (Wave 16); timber has none. */
const REQUEST_ART: Readonly<Record<LordRequestView["kind"], StoryIllustration | null>> = {
  proclaim_era: "event_market_town", set_wall_construction_priority: "event_palisade", order_timber: null,
};
export const requestArt = (kind: LordRequestView["kind"]): StoryIllustration | null => REQUEST_ART[kind];

/** The will-change attempt's Wave 40 moment (lordMomentBeats `marriage.will_change`). */
const WILL_MOMENT = "moment_attempted_will_change" as const;

/**
 * DEC-CARD (Astra A3): the season's changes in the lord's house (results/houseChange.ts), one beat each — a death, a new
 * house, an inheritance, a wardship. storyBeats puts them before every petition; the chip opens the house card.
 */
export function houseBeats(state: GameState): readonly StoryBeat[] {
  return houseChangeViews(state).map(view => ({ id: `house:${view.id}`, kind: "house_change", illustration: view.illustration, tile: seatTile(state),
    decision: "house_change", openLabel: RESULTS_COPY.house.openLabel, title: view.title, line: view.happened.join(" "), facts: [view.heir], advice: RESULTS_COPY.house.advice }));
}

/** A suit's filing moment whose suit has its own chip (a suit against the lord, lordMatterBeats). */
function defendedFiling(state: GameState, beat: StoryBeat, chips: ReadonlySet<string>): boolean {
  if (beat.illustration !== "moment_lawsuit_filed") return false;
  const record = state.history?.records.find(entry => entry.id === beat.id.slice("lord-moment:".length));
  return record !== undefined && chips.has(LORD_MATTER_CHIP.suit(String(record.params?.suit ?? "")));
}

export function lordBeats(state: GameState): readonly StoryBeat[] {
  if (!lordMode(state)) return [];
  const beats: StoryBeat[] = [];
  const home = homePetitionView(state);
  if (home !== null) {
    beats.push({ id: `home-petition:${home.petitionId}`, kind: "home_petition", illustration: home.art, tile: seatTile(state), decision: "estate_petition",
      title: home.title, line: home.demand, facts: [home.waits], advice: home.standing });
  }
  const offer = registryHeadline(state);
  if (offer !== null) {
    beats.push({ id: `registry:${offer.occurrenceId}`, kind: "registry_event", illustration: offer.art, tile: seatTile(state), decision: "registry_offer",
      title: offer.title, line: offer.body, facts: [offer.waits], advice: REGISTRY_CARD_COPY.advice });
  }
  const request = lordRequestView(state);
  if (request !== null && request.command !== null) {
    beats.push({ id: `lord-request:${request.key}`, kind: "lord_request", illustration: requestArt(request.kind), tile: seatTile(state),
      decision: "lord_request", title: request.title, line: request.demand, facts: request.more === "" ? [] : [request.more], advice: LORD_CARDS_COPY.requestAdvice });
  }
  // LM-R2: the lord's decision cards. The will's chip wears the will's Wave 40 moment and stands for it (one chip). PLAY-2:
  // these stay among the chips until answered (lordMattersDue, useStoryPresentation). SUIT-THREAD: the will's says the
  // engine's deadline (`lordMattersDue` dueTick, as a season) and opens the lord screen's 혼인 page, where it is answered.
  const marriage = marriageDecisionHead(state);
  if (marriage !== null && marriage.kind === "will_change") {
    const plan = diplomacyOf(state).marriage;
    const due = plan === undefined ? null : lordMatter(state, "will_change", plan.negotiationId)?.dueTick ?? null;
    beats.push({ id: LORD_MATTER_CHIP.marriage(marriage.kind, marriage.claimId), kind: "lord_decision", illustration: WILL_MOMENT, tile: null, decision: null,
      screen: { screen: "marriage", focus: null }, openLabel: LORD_MATTERS_COPY.willOpen, title: marriage.title, line: marriage.line,
      facts: [due === null ? DECISION_CARDS_COPY.willDeadline(null) : LORD_MATTERS_COPY.willDue(dateWord(state, due))], advice: LORD_MATTERS_COPY.willAdvice });
  } else if (marriage !== null) {
    beats.push({ id: LORD_MATTER_CHIP.marriage(marriage.kind, marriage.claimId), kind: "lord_decision", illustration: null, tile: null, decision: "marriage_decision",
      title: marriage.title, line: marriage.line, facts: [marriage.suit], advice: DECISION_CARDS_COPY.contestOpen });
  }
  // SUIT-THREAD: a suit against the lord, an entry forewarned (the engine's matters due); a suit's chip stands for its filing's moment.
  const matters = lordMatterBeats(state);
  beats.push(...matters);
  const audit = auditDecisionHead(state);
  if (audit !== null) {
    beats.push({ id: LORD_MATTER_CHIP.audit(audit.auditId), kind: "lord_decision", illustration: null, tile: null, decision: "audit_decision",
      title: audit.title, line: audit.line, facts: [audit.kicker, audit.waits], advice: DECISION_CARDS_COPY.auditAdvice });
  }
  const offMap = offMapPetitionHead(state);
  if (offMap !== null) {
    beats.push({ id: LORD_MATTER_CHIP.petition(offMap.petitionId), kind: "lord_decision", illustration: null, tile: null, decision: "estate_petition_offmap",
      title: offMap.title, line: offMap.line, facts: offMap.why === "" ? [offMap.waits] : [offMap.waits, offMap.why], advice: DECISION_CARDS_COPY.petitionAdvice });
  }
  // EVENT-ART: the season's ledger moments (Wave 40), one beat per history record. DEC-CARD (A3): a house change's moments
  // (the inheritance, the wardship) are its house card's picture, not chips of their own — one chip stands for the event.
  const folded = houseRecordIds(state);
  const defended = new Set(matters.map(beat => beat.id));
  const moments = lordMomentBeats(state, seatTile(state)).filter(beat => !folded.has(beat.id.slice("lord-moment:".length)) && !defendedFiling(state, beat, defended));
  beats.push(...(marriage?.kind === "will_change" ? moments.filter(beat => beat.illustration !== WILL_MOMENT) : moments));
  return beats;
}
