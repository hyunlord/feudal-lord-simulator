import { RESOURCE_NAMES } from "./hud/hudCopy.ko";

// UX-3R2 site inspector first line: "목재 4 대기 — 가장 가까운 창고 12칸, 운반꾼 0".
export const CONSTRUCTION_BLOCKER_COPY = {
  line: (resource: string, missing: number, source: string, carters: number) => `${resource} ${missing} 대기 — ${source}, 운반꾼 ${carters}`,
  nearest: (store: string, tiles: number) => `가장 가까운 ${store} ${tiles}칸`,
  treasury: "영주 창고의 목재",
  none: "쌓아 둔 곳 없음",
  resource: (resource: keyof typeof RESOURCE_NAMES) => RESOURCE_NAMES[resource],
} as const;
