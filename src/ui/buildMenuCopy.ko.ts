import type { PlacementTool } from "../render/renderer";

// UX-1 build cards (research E "건설 card"): one line of what the building does, under its name, beside the cost.
export const BUILD_CARD_PURPOSE = {
  house: "주민이 삽니다",
  well: "반경 6칸 집에 물",
  road: "사람·물자의 통로",
  wheat_farm: "밀을 기릅니다",
  farmstead: "경작지를 갈고 거둡니다",
  mill: "밀을 빵으로",
  logging_camp: "숲에서 통나무",
  sawmill: "통나무를 목재로",
  quarry: "바위에서 원석",
  masonry: "원석을 석재로",
  storehouse: "목재·통나무 보관",
  granary: "밀·빵을 보관합니다",
  market: "남는 물자를 팝니다",
  chapel: "신앙 · 목책 조건",
  church: "주변 집에 신앙",
  keep: "석조 도시의 성채",
} as const satisfies Record<PlacementTool, string>;

export const BUILD_MENU_COPY = {
  categoryGroup: "건설 분류",
  arableCard: "경작지",
  arableCardHint: "길가 땅을 칠합니다",
  lockedBadge: "잠김",
  undo: "되돌리기",
  undoHint: "마지막 공사를 취소합니다",
} as const;
