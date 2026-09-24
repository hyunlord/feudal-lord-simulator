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
  rolledUp: "오래된 기간은 분류별 합계로 접혀 있어 출처가 없습니다",
  noIncomeNoMarket: "수입원 없음 · 시장이 창고의 남는 물자를 팔 때 들어옵니다",
  noIncomeWithMarket: "시장 판매 0 · 남는 물자와 시장 일손을 확인하세요",
  noSpending: "지출 · 없음",
  highlightHint: "누르면 지도에서 출처 건물을 표시합니다",
  sourceAt: (kind: string, tx: number, ty: number) => `${kind} (${tx}, ${ty})`,
  goneSource: (kind: string) => `${kind} (지금은 없음)`,
  signed: (amount: number) => `${amount > 0 ? "+" : ""}${amount}`,
  sourceLine: (label: string, count: number, amount: number) => `${label} · ${count}건 ${amount > 0 ? "+" : ""}${amount}`,
  entryLine: (tick: number, category: string, amount: number) => `${tick}틱 · ${category} ${amount > 0 ? "+" : ""}${amount}`,
  eraIncome: (markets: number, amount: number) => `시장 ${markets}개 · 수입원(장부, 최근 2,400틱) 시장 판매 +${amount}`,
  eraNoIncome: (markets: number) => `시장 ${markets}개 · 최근 수입 0 · 남는 물자 판매 대기`,
  eraNoMarket: "시장 0개 · 수입원 없음 · 시장이 창고의 남는 물자를 팔 때 들어옵니다",
} as const;
