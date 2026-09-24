import type { ZoneKind } from "../zones/zone.types";

// Player-facing copy for the zone brush (C1b). Zone kind names and cause labels stay in src/zones/zoneCopy.ko.ts.

export const ZONE_BRUSH_COPY = {
  category: "구역",
  eraser: "지우개",
  cardHint: {
    burgage: "도로를 따라 칠하면 집터(필지)가 나뉩니다",
    arable: "밀밭을 지을 땅 · 성벽 안은 안 됩니다",
    pasture: "가축을 풀 땅",
    orchard: "과수를 심을 땅",
  } as const satisfies Partial<Record<ZoneKind, string>>,
  eraserHint: "칠한 구역을 지웁니다",
  polygonToggle: "다각형",
  polygonToggleHint: "클릭으로 꼭짓점, 더블클릭으로 닫기 (Shift)",
  radius: (tiles: number) => `붓 ${tiles}칸`,
  radiusHint: "[ ] 키 또는 버튼으로 붓 크기 1~3칸 · 휠은 확대",
  status: (label: string) => `드래그하여 ${label} 구역을 칠하세요 · [ ] 붓 크기 · 휠 확대 · Shift 다각형 · Z 되돌리기 · Esc 취소`,
  eraserStatus: "드래그하여 구역을 지우세요 · Z 되돌리기 · Esc 취소",
  polygonStatus: (label: string, points: number) => `${label} 다각형 꼭짓점 ${points}개 · 더블클릭으로 닫기 · Esc 취소`,
  undone: "마지막 획을 되돌렸습니다",
  nothingToUndo: "되돌릴 획이 없습니다",
  rejected: "성내 경작지 금지 — 성벽 안에는 경작지를 칠할 수 없습니다",
  painted: (label: string, cells: number) => `${label} 구역 ${cells}칸을 칠했습니다`,
  erased: (cells: number) => `구역 ${cells}칸을 지웠습니다`,
  nothingToErase: "지울 구역이 없습니다",
  outsideBurgage: "필지 구역 밖입니다 — 필지 구역 안에 지으세요",
  outsideArable: "경작지 구역 밖입니다 — 경작지 구역 안에 지으세요",
  outsideZone: "구역 밖입니다",
  arableInsideWall: "성내 경작지 금지 — 밀밭은 성벽 밖 경작지에 지으세요",
  noRoadAccessCells: (cells: number) => `도로 접근 없는 칸 ${cells} — 밀밭을 지으려면 도로가 닿아야 합니다`,
} as const;
