// DEC-CARD A4 (Astra's lord-mode play: "시장이 커져도 비슷한 세율 카드가 반복된다"): a recurring card says what came of
// the lord's last answer of the same kind — the rate, the stalls, the dues, what the merchants started since.
import { moneyFull, moneyFullDelta } from "../../money.ko";

const percent = (permille: number): string => `${Math.round(permille / 10)}%`;

export const SINCE_LAST_COPY = {
  heading: "지난번 같은 일 이후",
  regionLabel: "지난번 같은 일에 한 답과 그 뒤 달라진 것",
  /** The last answer: when, and what (the card's answer, or the lord's condition set on the lord tab). */
  answered: (date: string, what: string) => `${date}: ${what}`,
  onTab: (what: string) => `영주 탭에서 ${what}`,
  held: "답을 미루고 그대로 둠",
  dues: {
    rate: (then: number, now: number) => then === now ? `좌판세: 그때 평소의 ${percent(then)}로 정했고 지금도 같습니다` : `좌판세: 그때 평소의 ${percent(then)}로 정함 · 지금 평소의 ${percent(now)}`,
    rateNow: (now: number) => `좌판세: 지금 평소의 ${percent(now)}`,
    stalls: (then: number, now: number) => `좌판: 그때 ${then}칸 → 지금 ${now}칸`,
    income: (then: number, now: number) => `좌판세 한 번 정산: 그때 ${moneyFull(then)} → 지금 ${moneyFull(now)}`,
    noSettlementSince: "그 뒤 좌판세 정산이 아직 없습니다(기간이 끝날 때 정산합니다)",
    folded: "그때의 좌판세 정산은 장부에서 접혀 비교할 수 없습니다",
  },
  policy: { now: (name: string) => `방침: 지금 '${name}'` },
  subsidy: { now: (lines: string) => `걸린 장려금: ${lines}`, none: "걸린 장려금: 없음" },
  /** The town's projects started since, whose score this condition entered (the receipts' named reasons). */
  started: (reason: string, names: string) => `그 뒤 '${reason}'이 점수에 든 마을 사업: ${names}`,
  startedNone: (reason: string) => `그 뒤 '${reason}'이 점수에 든 마을 사업은 없습니다`,
  count: (name: string, count: number) => `${name} ${count}곳`,
  /** The engine's own forecast and actual of a decision on the lord tab (two seasons on). */
  actual: (predicted: number, actual: number) => `두 계절 뒤 금고: 예상 ${moneyFull(predicted)} · 실제 ${moneyFull(actual)} (${moneyFullDelta(actual - predicted)})`,
  actualDue: (date: string) => `두 계절 뒤 금고의 실제는 ${date}에 적힙니다`,
} as const;
