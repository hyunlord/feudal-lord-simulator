import { pence } from "./hudCopy.ko";

// UI-8 (F3-A PL-5…PL-7): the wage-ledger section in the LedgerDrawer stock tab — visible once chapter 3's plague
// arrives. Shows the four plague money categories (wages, statute_fine, church_fee, entry_fine) with this-season,
// last-season and chapter-3 totals so the lord can track the new labour costs at a glance.
export const WAGE_LEDGER_COPY = {
  heading: "임금 장부 (3장)",
  thisSeason: "이번 기간",
  lastSeason: "지난 기간",
  chapterTotal: "3장 합계",
  row: (label: string, thisSeason: number, lastSeason: number, total: number) =>
    `${label}: 이번 ${pence(thisSeason)} · 지난 ${pence(lastSeason)} · 합계 ${pence(total)}`,
  noActivity: "이번 기간 활동 없음",
} as const;
