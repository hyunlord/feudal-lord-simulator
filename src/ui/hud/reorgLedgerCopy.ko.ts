import { pence } from "./hudCopy.ko";

// UI-9 (F4-A RG-3, RG-6, RG-9): the chapter 4 ledger section in the LedgerDrawer stock tab — cloth income,
// poll tax and fee farm by category; visible once chapter 4's reorganisation begins (state.reorganisation).
export const REORG_LEDGER_COPY = {
  heading: "4장 재편 장부",
  category: "분류",
  thisSeason: "이번 기간",
  lastSeason: "지난 기간",
  chapterTotal: "4장 합계",
  amount: (value: number) => pence(value),
} as const;
