import type { ResourceType } from "../../content/resourceConfig";

/** A sum of money in pennies: "120d" (the coin icon goes beside it where there is room). */
export const pence = (value: number | string): string => `${value}d`;

// UX-3 HUD shell copy (status pill, action dock, ledger drawer, crisis icons, pause menu).
export const HUD_COPY = {
  pill: "마을 상태",
  population: (count: number) => `인구 ${count}`,
  foodDays: (days: number) => `식량 ${days}일`,
  foodNone: "식량 —",
  /** Money is pennies (judgement 2026-09-26): the coin icon, the number and "d". */
  money: (coin: number) => pence(coin),
  pillOpensLedger: "자원 장부 열기",
  populationOpens: "인구 기록 열기",
  dock: "행동",
  build: "건설",
  ledger: "장부",
  steward: "청지기",
  undo: "되돌리기",
  layerLocked: (label: string, reason: string) => `${label} · ${reason}`,
  ledgerTitle: "자원 장부",
  ledgerTabs: { stock: "자원", alerts: "알림", view: "보기", map: "지도" },
  ledgerTotal: "합계",
  ledgerLasts: "버팀",
  ledgerStore: (name: string, index: number) => `${name} ${index}`,
  ledgerEmpty: "보관 중인 자원이 없습니다",
  ledgerNoAlerts: "알릴 일이 없습니다",
  ledgerTreasury: "금고",
  crisis: "위기",
  pauseTitle: "일시정지",
  pauseResume: "계속",
  close: "닫기",
  closeMark: "×",
  /** A crisis icon names its warning and cause (no hover tooltip). */
  crisisLabel: (inspect: string, cause: string) => `${inspect} · ${cause}`,
  stewardQuiet: "청지기가 전할 말이 없습니다",
} as const;

export const RESOURCE_NAMES = { wheat: "밀", bread: "빵", logs: "원목", timber: "목재", stone_raw: "원석", stone: "석재", coin: "돈" } as const satisfies Record<ResourceType, string>;
