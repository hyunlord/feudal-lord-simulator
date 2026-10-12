import { moneyDelta, moneyShort } from "../money.ko";

// RECEIPTS (user 2026-10-10, "결과가 티가 안 난다"): the answer's receipt — the card turned over once the lord answers,
// every number the answer changed at once, read off the state before and after it (answerReceiptModel.ts). Each row is what
// changed and by how much ("금고 −4s 8d (10d → −3s 10d)", "아트레인 상인 가문 관계 −4 (27 → 23)", "감사 방식 장부 감사 →
// 현지 방문"). Words follow docs/design/glossary.md and the ledger screens' own words for the same things.

/** A whole number's move with its sign, the card's minus (−). */
export const signed = (delta: number) => `${delta > 0 ? "+" : delta < 0 ? "−" : "±"}${Math.abs(delta)}`;
/** The particle after a Korean word: the first form after a final consonant (받침), the second after a vowel; a name's
 * closing gloss does not count ("드 코르벨 가문(이웃 영주)와"). */
const josa = (word: string, withFinal: string, without: string) => {
  const bare = word.replace(/\([^()]*\)$/, "");
  const code = bare.charCodeAt(bare.length - 1) - 0xac00;
  return code >= 0 && code <= 11171 && code % 28 !== 0 ? withFinal : without;
};
/** A standing number as the card prints it (its minus is the card's −). */
const num = (value: number) => `${value < 0 ? "−" : ""}${Math.abs(value)}`;
const arrow = (from: string, to: string) => `${from} → ${to}`;

export const ANSWER_RECEIPT_COPY = {
  /** The receipt's first line over the decision's title, and the answer given. */
  kicker: "답이 내려졌습니다",
  answered: (label: string) => `영주의 답: ${label}`,
  heading: "바로 바뀐 것",
  /** An answer that moved no number at once (its later is below). */
  none: "지금 바로 숫자가 바뀐 것은 없습니다.",
  laterHeading: "앞으로",
  close: "확인",
  /** Assistive tech: the rows' list. */
  listLabel: (title: string) => `${title}: 바로 바뀐 것`,
  // what changed
  treasury: "금고",
  relation: (who: string) => `${who} 관계`,
  goodwill: (estate: string, group: string) => `${estate}의 ${group} 호감`,
  groups: { tenants: "소작인", merchants: "상인" } as const,
  management: (estate: string) => `${estate} 관리`,
  steward: (estate: string) => `${estate} 청지기`,
  auditMode: (estate: string) => `${estate} 감사 방식`,
  loyalty: (name: string) => `청지기 ${name}의 충성`,
  stewardOf: (name: string) => `청지기 ${name}`,
  stewardStatus: { candidate: "후보", serving: "맡음", dismissed: "물러남", dead: "죽음" } as const,
  rules: "청지기가 영주에게 올리는 일",
  rulesAmount: (amount: string | null) => amount === null ? "금액으로는 올리지 않음" : `${amount} 넘는 일`,
  rulesOn: (what: string, on: boolean) => `${what} ${on ? "올림" : "올리지 않음"}`,
  rulesWhat: { rights: "권리가 바뀌는 일", marriage: "혼인에 관한 일", recurring: "답한 적 있는 일" } as const,
  policy: "영지 방침",
  dues: "좌판세",
  duesAgreed: (who: string) => `${who}${josa(who, "과", "와")} 합의한 좌판세`,
  duesValue: (percent: number) => `평소의 ${percent}%`,
  subsidy: (building: string) => `${building} 장려금`,
  timber: "목재 주문",
  timberValue: (bundles: number) => `${bundles}단`,
  wall: "성벽 공사",
  wallValue: { priority: "일손과 자재를 먼저 받음", balanced: "다른 공사와 같은 차례" } as Readonly<Record<string, string>>,
  sites: "새 공사",
  sitesValue: (count: number) => `${count}곳 열림`,
  claim: (who: string, what: string) => `${who}의 청구(${what})`,
  claimNew: (basis: string, strength: number) => `새로 냄: ${basis} 근거, 힘 ${strength}`,
  strength: (delta: number, from: number, to: number) => `힘 ${signed(delta)} (${num(from)} → ${num(to)})`,
  claimStatus: { open: "열림", suing: "소송 중", won: "이김", lost: "짐", lapsed: "사라짐" } as Readonly<Record<string, string>>,
  evidence: (kinds: string) => `증거 더함: ${kinds}`,
  evidenceItem: (kind: string, weight: number) => `${kind}(무게 ${weight})`,
  suit: (plaintiff: string, defendant: string, what: string) => `${plaintiff} 대 ${defendant} 소송(${what})`,
  suitNew: "소장을 냄",
  suitStage: (from: string, to: string) => `단계 ${arrow(from, to)}`,
  suitCosts: (delta: number, from: number, to: number) => `들인 비용 ${moneyDelta(delta)} (${moneyShort(from)} → ${moneyShort(to)})`,
  suitPatron: (who: string) => `후원자 ${who}`,
  enforcement: (count: number) => `집행 ${count}번째`,
  possession: (what: string) => `${what} 점유`,
  value: (estate: string) => `${estate}의 한 해 가치`,
  scope: (what: string) => `${what}의 몫`,
  scopeValue: (percent: number) => `한 해 가치의 ${percent}%`,
  promise: (term: string) => `약속(${term})`,
  promiseStatus: { open: "약속 장부에 오름", kept: "지킴", broken: "어김" } as Readonly<Record<string, string>>,
  promiseNew: (from: string, to: string, date: string) => `약속 장부에 오름: ${from} → ${to}, ${date}까지`,
  term: (what: string, kind: string) => `${what} ${kind}`,
  termValue: (perYear: string, years: number) => `해마다 ${perYear}, ${years}년`,
  offer: (house: string) => `${house}에 혼담`,
  offerValue: (tier: string) => `보냄 — 상대의 마음 "${tier}"`,
  offerAnswer: (house: string) => `${house}의 답`,
  era: "도시의 시대",
  // how much
  money: (delta: number, from: number, to: number) => `${moneyDelta(delta)} (${moneyShort(from)} → ${moneyShort(to)})`,
  points: (delta: number, from: number, to: number) => `${signed(delta)} (${num(from)} → ${num(to)})`,
  change: arrow,
  none_: "없음",
} as const;
