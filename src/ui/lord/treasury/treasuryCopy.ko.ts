// DEC-CARD A5 (Astra's lord-mode play: "파운드가 쌓이는데 결산은 수입 0d였다") → DEC-CARD-2: the stock tab's treasury,
// broken down by estate and by the engine's kinds (`treasuryBreakdown`).
import type { TreasuryKind } from "../../../engine/treasuryReads";
import { moneyFull, moneyFullDelta } from "../../money.ko";

export const TREASURY_COPY = {
  toleranceLoss: (date: string, amount: number) => `${date} · 눈감아 준 오류로 수입 ${moneyFullDelta(amount)}(위 합계에 포함)`,
  heading: "영지별 금고 출납",
  regionLabel: "영지별 금고 출납: 지대, 청원, 계약, 지출",
  window: (from: string, to: string) => `최근 기간 ${from} ~ ${to} · 장부 그대로`,
  net: (amount: number) => `금고 증감 ${moneyFullDelta(amount)}`,
  /** The engine's kinds (`TreasuryKind`). */
  kinds: {
    rents_dues: "지대·세금·사용료", petitions: "청원", contracts: "계약·약속", marriage: "혼인", inheritance: "상속", factions: "세력",
    crown_war: "왕실·전쟁", trade: "거래", building: "건설", spending: "지출", other: "그 밖",
  } satisfies Record<TreasuryKind, string>,
  group: (name: string, amount: number) => `${name} ${moneyFullDelta(amount)}`,
  came: (amount: number) => `들어옴 ${moneyFull(amount)}`,
  went: (amount: number) => `나감 ${moneyFull(amount)}`,
  /** The lines that name no estate, building or right (a marriage portion, a faction's gift, the crown's levy…). */
  lordRow: "영주 자신의 일",
  /** Whether the town's money was settled in the window (it settles every 2,400 ticks). */
  settled: "이 기간에 도시 정산이 있었습니다",
  unsettled: "이 기간에는 아직 도시 정산이 없었습니다",
  /** What the ledger keeps only as roll-ups (older lines folded, no sources to read an estate from). */
  unattributed: (amount: number) => `영지를 알 수 없는 묶인 장부 ${moneyFullDelta(amount)}(오래된 줄은 합계로만 남습니다)`,
  none: "최근 기간에 금고를 드나든 돈이 없습니다",
  /** How a line is read to an estate (the engine's rule: its estate, else the town's buildings and rights, else the lord's). */
  homeNote: "영지가 적힌 줄은 그 영지의 것, 도시의 건물과 권리에서 난 줄은 본영의 것, 나머지는 영주 자신의 일로 셉니다",
} as const;
