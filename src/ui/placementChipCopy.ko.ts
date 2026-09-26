import type { TileMarkReason } from "../render/placementTileMarks";

// UX-3 S-53 / S-55: the placement chip beside the cursor — three short lines at most.
export const PLACEMENT_CHIP_COPY = {
  label: "배치 정보",
  road: "길",
  free: "무료",
  title: (name: string, cost: string) => `${name} · ${cost}`,
  cost: (resource: string, amount: number) => `${resource} ${amount}`,
  costJoin: " · ",
  ledger: (resource: string, cost: number, stock: number) => `${resource} ${cost} / 보유 ${stock} · 배치 후 ${stock - cost}`,
  ledgerShort: (resource: string, cost: number, stock: number) => `${resource} ${cost} / 보유 ${stock} · ${cost - stock} 부족 — 배치 불가`,
  more: (count: number) => ` +${count}`,
  reach: (houses: number) => `집 ${houses}채 도달`,
  /** UI-3 (FP-2 placement ledger): per ledger period, only the parts that are not zero. */
  period: (parts: readonly string[]) => `장부 기간마다 ${parts.join(" · ")}`,
  rent: (value: number) => `지대 +${value}`,
  upkeep: (value: number) => `유지비 −${value}`,
  labour: (adults: number) => `일꾼 ${adults}`,
  reasons: {
    building: (tiles: number) => `건물·공사장 ${tiles}칸 — 비운 땅에`,
    road: (tiles: number) => `길 ${tiles}칸 위 — 길 옆에`,
    water: (tiles: number) => `물 ${tiles}칸 — 뭍에`,
    edge: () => "영지 밖",
    wall: () => "성벽과 1칸 띄우세요",
    needs_road: () => "길에 닿아야 함 — 먼저 길",
    needs_forest: () => "숲 옆이어야 함",
    materials: () => "자재 부족",
    zone: () => "맞는 구역 밖",
    locked: () => "아직 잠김",
  } satisfies Record<TileMarkReason, (tiles: number) => string>,
} as const;
