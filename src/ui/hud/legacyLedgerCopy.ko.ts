import { pence } from "./hudCopy.ko";

// UI-10 (F5-A LG-2…LG-5, LG-13): the chapter 5 ledger section in the LedgerDrawer stock tab — the Crown's tax and the
// charter's confirmation, the succession's relief, the legacy's endowment, the charter fee, the nave and the fee farm;
// visible once chapter 5 begins (state.legacy).
export const LEGACY_LEDGER_COPY = {
  heading: "5장 자치와 유산 장부",
  category: "분류",
  thisSeason: "이번 기간",
  lastSeason: "지난 기간",
  chapterTotal: "5장 합계",
  amount: (value: number) => pence(value),
} as const;
