import type { GameState } from "../engine/engine.types";
import { buildingFootprint } from "../geometry/buildingFootprint";
import { lordMode } from "../engine/townAgency";
import type { StoryBeat } from "./eventStory";
import { DECISION_CARDS_COPY } from "./lord/decisions/decisionCardsCopy.ko";
import { auditDecisionHead, marriageDecisionHead, offMapPetitionHead } from "./lord/decisions/decisionCardsModel";
import { LORD_CARDS_COPY } from "./lordCardsCopy.ko";
import { homePetitionView, lordRequestView, precedentView, type LordRequestView } from "./lordCardsModel";
import { lordMomentBeats } from "./lordMomentBeats";
import { REGISTRY_CARD_COPY } from "./registryCardCopy.ko";
import { registryHeadline } from "./registryCardModel";
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

export function lordBeats(state: GameState): readonly StoryBeat[] {
  if (!lordMode(state)) return [];
  const beats: StoryBeat[] = [];
  const home = homePetitionView(state);
  if (home !== null) {
    beats.push({ id: `home-petition:${home.petitionId}`, kind: "home_petition", illustration: home.art, tile: seatTile(state), decision: "estate_petition",
      title: home.title, line: home.demand, facts: [home.waits], advice: home.precedent ?? LORD_CARDS_COPY.precedentHint });
  }
  const precedent = precedentView(state);
  if (precedent !== null) {
    beats.push({ id: `home-precedent:${precedent.key}`, kind: "home_precedent", illustration: precedent.art, tile: seatTile(state), decision: "precedent",
      title: LORD_CARDS_COPY.precedentTitle, line: LORD_CARDS_COPY.precedentLine, facts: precedent.items, advice: LORD_CARDS_COPY.precedentHint });
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
  // LM-R2: the lord's decision cards. The will's chip wears the will's Wave 40 moment and stands for it (one chip).
  const marriage = marriageDecisionHead(state);
  if (marriage !== null) {
    beats.push({ id: `marriage-decision:${marriage.kind}:${marriage.claimId}`, kind: "lord_decision",
      illustration: marriage.kind === "will_change" ? WILL_MOMENT : null, tile: null, decision: "marriage_decision",
      title: marriage.title, line: marriage.line, facts: marriage.kind === "contested" ? [marriage.suit] : [], advice: marriage.kind === "contested" ? DECISION_CARDS_COPY.contestOpen : DECISION_CARDS_COPY.willAdvice });
  }
  const audit = auditDecisionHead(state);
  if (audit !== null) {
    beats.push({ id: `audit:${audit.auditId}`, kind: "lord_decision", illustration: null, tile: null, decision: "audit_decision",
      title: audit.title, line: audit.line, facts: [audit.kicker, audit.waits], advice: DECISION_CARDS_COPY.auditAdvice });
  }
  const offMap = offMapPetitionHead(state);
  if (offMap !== null) {
    beats.push({ id: `estate-petition:${offMap.petitionId}`, kind: "lord_decision", illustration: null, tile: null, decision: "estate_petition_offmap",
      title: offMap.title, line: offMap.line, facts: offMap.why === "" ? [offMap.waits] : [offMap.waits, offMap.why], advice: DECISION_CARDS_COPY.petitionAdvice });
  }
  // EVENT-ART: the season's ledger moments (Wave 40), one beat per history record.
  const moments = lordMomentBeats(state, seatTile(state));
  beats.push(...(marriage?.kind === "will_change" ? moments.filter(beat => beat.illustration !== WILL_MOMENT) : moments));
  return beats;
}
