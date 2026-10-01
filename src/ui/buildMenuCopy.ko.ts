import { buildingCopy } from "../content/buildingCatalog.ko";
import type { PlacementTool } from "../render/renderer";

// UX-1 build cards (research E "건설 card"): one line of what the building does, under its name, beside the cost —
// the building's line in the catalog (BLD-REG), the road's here.
export const buildCardPurpose = (tool: PlacementTool): string => tool === "road" ? ROAD_TOOL_COPY.card : buildingCopy(tool).card;

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
  /** FD-1 (LAND-UI): the road card's cost — land free, a bridge's timber a water cell, a ford's a ford cell. */
  roadCost: (bridgeTimber: number, fordTimber: number) => `육지 무료 · 다리 목재 ${bridgeTimber}/칸 · 여울 목재 ${fordTimber}/칸`,
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

/** The road's words (it is a tool, not a building kind). */
export const ROAD_TOOL_COPY = {
  card: "사람·물자의 통로",
  purpose: "육지 길은 무료. 양쪽 강둑을 직선으로 이으면 최대 8칸 목교를 놓습니다. 다리·접속 길 철거 시 다리 전체를 걷습니다",
} as const;

/** The tool's purpose (the build menu model): the building's line in the catalog (BLD-REG), the road's here. */
export const buildToolPurpose = (tool: PlacementTool): string => tool === "road" ? ROAD_TOOL_COPY.purpose : buildingCopy(tool).purpose;

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
