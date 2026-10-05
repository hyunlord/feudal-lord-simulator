import type { GameState } from "../engine/engine.types";
import { lordMode } from "../engine/townAgency";
import type { StoryBeat } from "./eventStory";
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

/** The manor house (the lord's seat, where his court sits), else the keep: where [위치로] looks. */
function seatTile(state: GameState) {
  const seat = state.buildings.find(building => building.kind === "manor_house") ?? state.buildings.find(building => building.kind === "keep");
  return seat === undefined ? null : { tx: seat.tx, ty: seat.ty };
}

/** The town's requests' chip pictures: the market town's proclamation and the palisade's (Wave 16); timber has none. */
const REQUEST_ART: Readonly<Record<LordRequestView["kind"], StoryIllustration | null>> = {
  proclaim_era: "event_market_town", set_wall_construction_priority: "event_palisade", order_timber: null,
};
export const requestArt = (kind: LordRequestView["kind"]): StoryIllustration | null => REQUEST_ART[kind];

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
  // EVENT-ART: the season's ledger moments (Wave 40), one beat per history record.
  beats.push(...lordMomentBeats(state, seatTile(state)));
  return beats;
}
