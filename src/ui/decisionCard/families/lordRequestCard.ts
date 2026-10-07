import type { GameState } from "../../../engine/engine.types";
import { LORD_CARDS_COPY } from "../../lordCardsCopy.ko";
import { lordRequestView } from "../../lordCardsModel";
import { requestArt } from "../../lordStoryBeats";
import { perState } from "../../perState";
import type { DecisionCardView } from "../decisionCardTypes";
import { afterAnswer } from "../remembers";
import { lordOutcome } from "./lordOutcome";
import { LORD_REQUEST_CARD_COPY as COPY, LORD_REQUEST_STAKE } from "./lordRequestCopy.ko";

// DEC-CARD, the town's request (TA-7, lord mode): the request's own words as the situation, its kind's stake, and the
// one answer — granting it — from the engine: the command the request names run on the state (lordOutcome: what it
// opens now, the actual a big decision will have written). No hold is shown: waiting costs nothing (P-D2), so it is the
// card's [나중에 정한다]. Once per state (`perState`): the chip reads `lordRequestView`, this only the card that is up.

export const lordRequestCard = perState((state: GameState): DecisionCardView | null => {
  const request = lordRequestView(state);
  if (request === null || request.command === null) return null;
  const after = afterAnswer(state, request.command);
  const outcome = after === null ? null : lordOutcome(state, after);
  return {
    family: "lord_request", subjectId: request.key, title: request.title, court: request.court,
    from: request.more === "" ? LORD_CARDS_COPY.requestFrom : `${LORD_CARDS_COPY.requestFrom} · ${request.more}`,
    situation: request.demand, stake: LORD_REQUEST_STAKE[request.kind], deadline: COPY.deadline, illustration: requestArt(request.kind),
    choices: [{ id: "grant", label: request.grant, now: outcome?.now ?? [], later: outcome?.later ?? [], remembers: outcome?.remembers ?? [],
      refusal: after === null ? COPY.refused : null }],
  };
});
