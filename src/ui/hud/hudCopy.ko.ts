import { moneyFull, moneyPence, moneyShort } from "../money.ko";

// UX-3 HUD shell copy (status pill, action dock, ledger drawer, crisis icons, pause menu).
export const HUD_COPY = {
  pill: "마을 상태",
  population: (count: number) => `인구 ${count}`,
  foodDays: (days: number) => `식량 ${days}일`,
  foodNone: "식량 —",
  /** UI-AUDIT-1: the engine's pennies in English money, short ("£160 3s"); a press opens the ledger's exact treasury. */
  money: (coin: number) => moneyShort(coin),
  pillOpensLedger: "자원 장부 열기",
  populationOpens: "인구 기록 열기",
  dock: "행동",
  build: "건설",
  ledger: "장부",
  steward: "청지기",
  undo: "되돌리기",
  layerLocked: (label: string, reason: string) => `${label} · ${reason}`,
  ledgerTitle: "자원 장부",
  ledgerTabs: { stock: "자원", alerts: "알림", rights: "권리", view: "보기", map: "지도" },
  ledgerTotal: "합계",
  ledgerLasts: "버팀",
  ledgerWeek: "이번 주",
  ledgerWeekValue: (delta: number | null) => delta === null ? "—" : delta > 0 ? `+${delta}` : delta < 0 ? `−${-delta}` : "0",
  ledgerDays: (days: number) => `${days}일`,
  ledgerNoLasts: "—",
  /** A row button lights the buildings holding that resource on the map. */
  ledgerRowLabel: (resource: string) => `${resource} — 보관한 곳을 지도에서 밝히고 아래에 적기`,
  ledgerStore: (name: string, index: number) => `${name} ${index}`,
  // NAT-2 (QA-006): the stores in one column (how many hold the good); a lit row lists them with their amounts.
  ledgerHeldIn: "보관",
  ledgerHeldCount: (stores: number) => stores === 0 ? "—" : `${stores}곳`,
  // UI-10: "보관 N곳" unfolds the row to each store's amount, and folds it again (its state is aria-expanded's).
  ledgerHeldToggle: (resource: string, stores: number) => `${resource} 보관 ${stores}곳 — 곳마다 양 펼치고 접기`,
  ledgerStoresOf: (resource: string) => `${resource} 보관처`,
  ledgerStoreAmount: (store: string, amount: number) => `${store} · ${amount}`,
  ledgerEmpty: "보관 중인 자원이 없습니다",
  ledgerNoAlerts: "알릴 일이 없습니다",
  ledgerTreasury: "금고",
  /** UI-AUDIT-1: the treasury the coin cell's press opens, to the penny, with the engine's penny count beside it. */
  ledgerTreasuryLine: (coin: number) => `금고 ${moneyFull(coin)}${moneyFull(coin) === moneyPence(coin) ? "" : ` · ${moneyPence(coin)}`}`,
  crisis: "위기",
  pauseTitle: "일시 정지",
  pauseResume: "계속",
  close: "닫기",
  closeMark: "×",
  /** A crisis icon names its warning and cause (no hover tooltip). */
  crisisLabel: (inspect: string, cause: string) => `${inspect} · ${cause}`,
  stewardQuiet: "청지기가 전할 말이 없습니다",
} as const;

