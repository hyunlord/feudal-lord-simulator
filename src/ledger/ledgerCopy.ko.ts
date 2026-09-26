import { MONEY_LABEL } from "../content/moneyCopy.ko";
import type { LedgerAccount, LedgerCategory } from "./ledger.types";

export const LEDGER_ACCOUNT_LABELS = {
  cash: "현금",
  restricted: "목적 기금",
  arrears: "미납 의무",
  in_kind: "현물 의무",
} as const satisfies Record<LedgerAccount, string>;

export const LEDGER_CATEGORY_LABELS = {
  opening_balance: "이월 잔액",
  market_sale: "시장 판매",
  construction: "건설비",
  upkeep: "유지비",
  toll: "통행세",
  stall_fee: "좌판세",
  rent: "지대",
  mill_toll: "제분료",
  demesne_sale: "직영 판매",
  project: "공사 재원",
  famine_relief: "구휼",
  famine_sale: "기근 곡물 판매",
  charter_fee: "특허 대가",
} as const satisfies Record<LedgerCategory, string>;

export const LEDGER_WINDOW_LABELS = {
  recent: "최근 2,400틱",
  previous: "지난 기간",
  all: "전체",
} as const;

export const LEDGER_COPY = {
  panelAria: "재정 장부",
  heading: "재정 장부",
  money: MONEY_LABEL,
  cellSecondary: `${MONEY_LABEL} · 장부 보기`,
  bySource: "출처별",
  byCategory: "분류별",
  entries: "항목",
  noEntries: "이 기간에는 항목이 없습니다",
  emptyAccount: "아직 쓰는 규칙이 없습니다",
  noArrears: "미납 없음 · 유지비를 못 내면 여기에 쌓이고 그 시설은 멈춥니다",
  rolledUp: "오래된 기간은 분류별 합계로 접혀 있어 출처가 없습니다",
  noIncome: "이번 기간 항목 없음 · 지대·좌판세·제분료·통행세와 유지비는 2,400틱마다 마감 때 정산합니다",
  highlightHint: "누르면 지도에서 출처 건물을 표시합니다",
  sourceAt: (kind: string, tx: number, ty: number) => `${kind} (${tx}, ${ty})`,
  goneSource: (kind: string) => `${kind} (지금은 없음)`,
  goneBuilding: "건물",
  signed: (amount: number) => `${amount > 0 ? "+" : ""}${amount}`,
  sourceLine: (label: string, count: number, amount: number) => `${label} · ${count}건 ${amount > 0 ? "+" : ""}${amount}`,
  entryLine: (tick: number, category: string, amount: number) => `${tick}틱 · ${category} ${amount > 0 ? "+" : ""}${amount}`,
  eraIncome: (lines: string) => `수입원(장부, 최근 2,400틱) ${lines}`,
  eraIncomeLine: (category: string, amount: number) => `${category} +${amount}`,
  eraIncomeSeparator: " · ",
  eraNoIncome: "수입원(장부, 최근 2,400틱) 없음 · 기간 마감 때 지대·좌판세·제분료·통행세가 들어옵니다",
} as const;
