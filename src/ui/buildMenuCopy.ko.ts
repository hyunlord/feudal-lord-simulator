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
  currentTask: "현재 과업",
  toolsLabel: (group: string) => `${group} 도구`,
  pathsHint: "드래그로 길을 연결하세요. 강 양쪽을 직선으로 이으면 목교를 놓습니다.",
  bridgeHint: "다리는 물 한 칸당 목재 4, 최대 8칸입니다. 다리나 접속 길을 누르면 다리 전체를 걷습니다.",
  keepLocked: "성채는 석조 도시에서 건설할 수 있습니다.",
  radius: (radius: number) => `반경 ${radius}칸`,
  capacity: (capacity: number) => `수용 ${capacity}필지`,
  toolDetailToggle: "선택 도구 상세 안내",
  detailsLabel: "건설 안내",
  noToolSelected: "선택 도구 없음 · 건설 카드를 눌러 도구를 선택하세요.",
  shortfall: (resource: string, spendable: number, cost: number) => `${resource} 부족 ${spendable}/${cost}`,
} as const;

// Build menu model (tool groups, tool purposes, requirement and tooltip lines).
export const BUILD_TOOL_GROUP_LABELS = {
  dwelling: "주거",
  production: "생산",
  storage: "저장",
  service: "서비스",
} as const;

export const BUILD_TOOL_PURPOSE = {
  house: "주민을 받아 인구 목표를 늘립니다",
  wheat_farm: "밀을 길러 방앗간에 보냅니다",
  farmstead: "경작지 띠를 갈고 거두어 밀을 곳간에 모읍니다. 경작지 구역 안이나 옆에 짓습니다",
  mill: "밀을 빵으로 바꿔 배급을 돕습니다",
  logging_camp: "숲 가장자리에서 통나무를 냅니다",
  sawmill: "통나무를 목재로 켭니다",
  quarry: "바위 가장자리에서 원석을 캐냅니다",
  masonry: "원석을 석재로 다듬습니다",
  market: "남는 물자를 팔아 재정 수입을 얻습니다",
  church: "주변 집에 신앙 서비스를 제공합니다",
  keep: "석조 도시의 중심 성채를 세웁니다",
  storehouse: "목재와 통나무를 보관합니다",
  granary: "밀과 빵을 보관합니다",
  chapel: "목책마을 선포 조건을 준비합니다",
  well: "주변 집에 물을 공급합니다",
  road: "육지 길은 무료. 양쪽 강둑을 직선으로 이으면 최대 8칸 목교를 놓습니다. 다리·접속 길 철거 시 다리 전체를 걷습니다",
} as const satisfies Record<PlacementTool, string>;

export const BUILD_MENU_MODEL_COPY = {
  requiresRoad: "길 인접 필요",
  requiresForest: "숲 인접 필요",
  requiresRock: "바위 인접 필요",
  noRequirements: "요구 조건 없음",
  roadLabel: "길",
  buildable: (spendable: string) => `건설 가능 · 보유 ${spendable}`,
  notBuildable: (shortfall: string) => `건설 불가 · 부족 ${shortfall}`,
  roadCost: "비용 목재 0",
  cost: (amounts: string) => `비용 ${amounts}`,
  purpose: (purpose: string) => `목적 ${purpose}`,
  requirements: (requirements: string) => `조건 ${requirements}`,
  resourceAmount: (resource: string, amount: number) => `${resource} ${amount}`,
  none: "없음",
} as const;
