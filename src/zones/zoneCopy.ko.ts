import type { ZoneKind } from "./zone.types";

/** Player-facing zone copy (Korean). */
export const ZONE_KIND_LABELS = {
  burgage: "필지",
  arable: "경작지",
  pasture: "목초지",
  hay_meadow: "건초지",
  woodland_common: "숲·공유림",
  orchard: "과수원",
} as const satisfies Record<ZoneKind, string>;

/** Cause labels for the zone rules (cause registry rows, spec Z-16). */
export const ZONE_CAUSE_LABELS = {
  outside_zone: "구역 밖",
  zone_mismatch: "구역과 불일치",
  arable_inside_wall: "성내 경작지 금지",
} as const;

export const ZONE_PREDICTION_COPY = {
  insideBurgage: "필지 구역 안 · 배치 가능",
  outsideBurgage: "필지 구역 밖",
  insideArable: "경작지 구역 안 · 배치 가능",
  outsideArable: "경작지 구역 밖",
  arableInsideWall: "성내 경작지 금지",
  paintCells: (kindLabel: string, cells: number) => `${kindLabel} 구역 ${cells}칸`,
  excludedInsideWall: (cells: number) => `성 안 ${cells}칸 제외`,
} as const;

/** Why ZoneFillAgent left a plot empty (spec Z-14). */
export const ZONE_FILL_COPY = {
  no_parcels: "필지 없음 — 필지 구역이 도로에 닿아야 합니다",
  no_anchor: "필지에 집 자리가 없음",
  materials: "자재 부족",
  labour: "일꾼 부족 — 공사할 인력이 없음",
  in_progress_limit: "필지 공사가 이미 10곳 진행 중",
} as const;
