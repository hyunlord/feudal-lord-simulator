import type { ZoneKind } from "../../zones/zone.types";

// UX-3R2 zone toolbar (UX3R 5절): the left bar while the zone layer is open, and the paintable-land legend.
export const ZONE_TOOLBAR_COPY = {
  label: "구역 도구",
  kindsLabel: "구역 종류",
  toolsLabel: "칠하기 도구",
  pickKind: "칠할 구역 종류를 고르세요",
  lockedKind: (label: string, reason: string) => `${label} · ${reason}`,
  brush: "붓",
  polygon: "다각형",
  eraser: "지우개",
  undo: "되돌리기",
  redo: "다시",
  size: (tiles: number) => `크기 ${tiles}`,
  sizeLabel: (tiles: number) => `붓 크기 ${tiles}칸 — 누르면 바뀜`,
  undoLabel: "마지막 획 되돌리기 (Z)",
  redoLabel: "되돌린 획 다시 칠하기 (Shift+Z)",
  eraserHint: "칠한 구역을 지웁니다 · 우클릭도 지우기",
  legendLabel: "칠할 수 있는 땅",
  /** What the three grades mean for the armed kind (the overlay's colours + the barred hatch). */
  legend: {
    arable: { good: "헛간이 닿는 땅", fair: "헛간·길 멂 — 안 가꿈", barred: "물·성벽 안" },
    burgage: { good: "길가 — 집터 나뉨", fair: "길에서 멂", barred: "물" },
    other: { good: "칠할 수 있음", fair: "", barred: "물" },
  },
} as const;

export function zoneLegend(kind: ZoneKind) {
  return kind === "arable" ? ZONE_TOOLBAR_COPY.legend.arable : kind === "burgage" ? ZONE_TOOLBAR_COPY.legend.burgage : ZONE_TOOLBAR_COPY.legend.other;
}
