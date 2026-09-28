import { pence } from "./hudCopy.ko";

// UI-8 (F3-A PL-5…PL-7): the wage-ledger section in the LedgerDrawer stock tab — visible once chapter 3's plague
// arrives. Shows the four plague money categories (wages, statute_fine, church_fee, entry_fine) with this-season,
// last-season and chapter-3 totals so the lord can track the new labour costs at a glance (a table like the stock one).
export const WAGE_LEDGER_COPY = {
  heading: "임금 장부 (3장)",
  category: "분류",
  thisSeason: "이번 기간",
  lastSeason: "지난 기간",
  chapterTotal: "3장 합계",
  amount: (value: number) => pence(value),
} as const;
