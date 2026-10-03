// LM-R1 (TA-6, lord-mode §2 정책·투자): the lord's conditions in the ledger drawer — the estate policy, the project
// subsidies and the market dues.
import type { EstatePolicy } from "../../engine/townAgency.types";

const percent = (permille: number): string => `${Math.round(permille / 10)}%`;

export const POLICY_COPY = {
  tab: "영주",
  tabLabel: "영주의 조건: 영지 방침, 사업 장려금, 시장 부담",
  regionLabel: "영주의 조건",
  intro: "건물은 마을이 짓습니다. 영주는 조건을 정하고, 마을은 그 조건에 따라 무엇을 어디에 지을지 고릅니다.",
  policyHeading: "영지 방침",
  policies: { growth: "성장", revenue: "세입", stability: "안정", defence: "방어" } satisfies Record<EstatePolicy, string>,
  policyNow: (name: string) => `지금 방침: ${name}`,
  policyChoose: (name: string) => `영지 방침 정하기: ${name}`,
  /** A policy's weights: what it favours and what it holds back, in points added to a project's score. */
  weight: (name: string, points: number) => `${name} ${points > 0 ? "+" : "−"}${Math.abs(points)}`,
  projects: { road: "길", zone: "구역 입주", fill_plot: "빈 필지 채우기" } as Readonly<Record<string, string>>,
  subsidyHeading: "사업 장려금",
  subsidyRule: (limit: string, treasury: string) => `장려금은 모두 합쳐 금고의 4분의 1까지: 지금 금고 ${treasury}, 한도 ${limit}`,
  subsidyOffered: (total: string) => `걸린 장려금 합계 ${total}`,
  subsidyNone: "걸린 장려금 없음",
  subsidyRow: (name: string, amount: string) => `${name} · 한 건 착수에 ${amount}`,
  subsidyWithdraw: "거두기",
  subsidyWithdrawLabel: (name: string) => `${name} 장려금 거두기`,
  subsidyKind: "장려할 사업",
  subsidyAmount: (amount: string) => `한 건에 ${amount}`,
  subsidyLess: "10d 줄이기",
  subsidyMore: "10d 늘리기",
  subsidyPoints: (points: number) => `점수 +${points}(10d마다 4점, 최대 60점)`,
  subsidySet: "장려금 걸기",
  subsidyReplace: "장려금 바꾸기",
  /** TA-6 ②: why a subsidy is refused (the subsidies, with it, would pass a quarter of the treasury). */
  refusal: (total: string, limit: string) => `걸 수 없음: 장려금 합계 ${total} — 한도(금고의 4분의 1) ${limit} 초과`,
  lastRefusal: (name: string, amount: string, total: string, limit: string) =>
    `지난번 거절: ${name} 장려금 ${amount} — 합계 ${total}, 한도(금고의 4분의 1) ${limit} 초과`,
  zeroAmount: "금액을 정하면 걸 수 있음",
  duesHeading: "시장 부담(좌판세)",
  duesNow: (permille: number) => `좌판세 평소의 ${percent(permille)}`,
  duesLord: (permille: number) => `영주의 좌판세 수입 평소의 ${percent(permille)}`,
  duesMerchants: (permille: number) => `상인 가문이 좌판에서 남기는 몫 평소의 ${percent(2000 - permille)}`,
  duesPoints: (points: number) => `상인 가문 사업 점수 ${points > 0 ? "+" : points < 0 ? "−" : ""}${Math.abs(points)}`,
  duesLower: "5%p 낮추기",
  duesRaise: "5%p 높이기",
  duesRange: "평소의 25%에서 200%까지",
  /** The chronicle's decision record: what a lord's condition was set to, and what it replaced. */
  choiceSubsidy: (name: string, amount: string) => `${name} 장려금 ${amount}`,
  choiceSubsidyNone: (name: string) => `${name} 장려금 없음`,
} as const;
