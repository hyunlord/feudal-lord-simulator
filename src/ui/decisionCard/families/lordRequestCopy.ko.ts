import type { LordRequest } from "../../../engine/townAgency.types";

// DEC-CARD, the town's request (TA-7, lord mode): what is at stake in each kind (the situation is the request's own
// words, LORD_CARDS_COPY.request), and what waiting means. Words follow docs/design/glossary.md.

export const LORD_REQUEST_STAKE: Readonly<Record<LordRequest["kind"], string>> = {
  proclaim_era: "도시가 목책을 두른 시장도시로 올라서는 일이 걸려 있습니다. 선포하면 목책 공사가 시작되고, 그 공사에 도시의 일손과 자재가 듭니다.",
  set_wall_construction_priority: "성벽을 얼마나 빨리 두르는지, 그리고 그동안 다른 공사가 일손과 자재를 기다리는 일이 걸려 있습니다.",
  order_timber: "도시가 지을 것에 쓸 목재가 걸려 있습니다.",
};

export const LORD_REQUEST_CARD_COPY = {
  /** A request has no deadline (TA-7): it waits until the lord grants it or the town no longer needs it. */
  deadline: "기한은 없습니다. 미뤄도 요청은 그대로 남습니다.",
  refused: "지금은 들어줄 수 없습니다.",
} as const;
