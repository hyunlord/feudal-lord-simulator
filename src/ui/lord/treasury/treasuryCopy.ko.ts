// DEC-CARD A5 (Astra's lord-mode play: "파운드가 쌓이는데 결산은 수입 0d였다"): the stock tab's treasury, broken down by
// estate — rent, taxes and dues, contracts, spending — from the ledger's own entries.
import { moneyFullDelta } from "../../money.ko";

export const TREASURY_COPY = {
  heading: "영지별 금고 출납",
  regionLabel: "영지별 금고 출납: 지대, 세금, 계약, 지출",
  window: (from: string, to: string) => `최근 기간 ${from} ~ ${to} · 장부 그대로`,
  net: (amount: number) => `금고 증감 ${moneyFullDelta(amount)}`,
  groups: { rent: "지대·영지 수입", taxes: "세금·사용료", contracts: "계약·약속", other: "그 밖의 수입", spending: "지출" },
  group: (name: string, amount: number) => `${name} ${moneyFullDelta(amount)}`,
  part: (category: string, amount: number) => `${category} ${moneyFullDelta(amount)}`,
  none: "최근 기간에 금고를 드나든 돈이 없습니다",
  /** How an entry is read to an estate (the ledger names an estate on its own lines; the town's are the home's). */
  homeNote: "영지가 적히지 않은 장부 줄(도시의 지대·좌판세·유지비…)은 본영의 것으로 셉니다",
} as const;
