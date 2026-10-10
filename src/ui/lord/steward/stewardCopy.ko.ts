// DEC-CARD-2 (the user's order 2026-10-08): the steward's season report "청지기가 처리한 일" in the season card and the
// lord screen's standing policies — per kind of small matter, 관습대로 / 가볍게 / 엄하게 / 영주에게 (the engine's
// `stewardship.standing`). Glossary (docs/design/glossary.md): 청지기, 장원; the steward's lines "~합니다", the lord's
// buttons "~한다". Every engine key is worded here; the numbers are the engine's.
import type { DecisionWeight, StandingSetting } from "../../../content/stewardPolicyConfig";
import { moneyFullDelta } from "../../money.ko";

type Escalation = "amount" | "rights" | "marriage" | "direct";

export const STEWARD_COPY = {
  /** The four settings, as the screen's buttons and the report's lines name them ("precedent": a save before v52). */
  settings: { customary: "관습대로", lenient: "가볍게", strict: "엄하게", lord: "영주에게" } satisfies Record<StandingSetting, string>,
  precedent: "선례대로",
  families: { manor: "장원 청원", estate: "영지 청원과 감사 방침", event: "세력이 보내는 작은 일" } as const,
  familyLines: {
    manor: "본영 장원의 소작인과 마을이 올리는 청원입니다.",
    estate: "다른 영지의 청지기가 받는 청원입니다. 영주의 예외 규칙(큰 돈·권리·혼인)에 맞으면 방침과 상관없이 영주에게 옵니다.",
    event: "보낸 세력별로 정합니다. 무게가 있는 일(권리·땅·혼인·큰 돈…)은 방침과 상관없이 영주에게 옵니다.",
  } as const,
  /** Event kinds are `sender:<faction>`: the faction's matters. */
  auditTitle: (name: string) => `${name}의 감사 오류`,
  auditActive: "오류를 눈감아 줌",
  auditRevoked: "눈감아 주기를 거둠",
  auditWithdraw: "눈감아 주기를 거둔다",
  auditNext: "다음 감사부터 다시 영주의 결정으로 올립니다",
  auditCost: (amount: number) => `철마다 눈감아 준 오류로 수입 ${moneyFullDelta(-amount)}까지 줄어듭니다`,
  auditLoss: (estate: string, amount: number) => `${estate} · 눈감아 준 오류로 이번 철 수입 ${moneyFullDelta(-amount)}`,
  auditReport: (estate: string, amount: number) => `${estate} 감사 · 상시 방침대로 오류 ${moneyFullDelta(amount)}를 보고했습니다`,
  auditHandled: "감사 보고",
  auditSteward: "청지기",
  sender: (name: string) => `${name}의 일`,

  // --- the season card section ----------------------------------------------------------------------------------------
  heading: "청지기가 처리한 일",
  sectionLabel: "청지기가 이번 철에 처리한 일",
  none: "이번 철에 청지기가 처리한 일은 없습니다.",
  handledCount: (count: number, byPolicy: readonly string[]) => `청지기가 ${count}건을 처리했습니다 · ${byPolicy.join(" · ")}`,
  policyCount: (policy: string, count: number) => `${policy} ${count}건`,
  money: (amount: number) => amount === 0 ? "이 일들로 금고는 변하지 않았습니다" : `이 일들로 금고 ${moneyFullDelta(amount)}`,
  policyRelation: (policy: string, faction: string, delta: number) => `${policy} 답해 ${faction} 관계 ${delta > 0 ? "+" : "−"}${Math.abs(delta)}`,
  broughtHeading: "영주에게 올린 일",
  brought: (title: string, why: string) => `${title} — ${why}`,
  why: {
    amount: "돈이 커서", rights: "권리가 걸려서", marriage: "혼인이 걸려서", direct: "영주가 직접 맡은 종류라서",
  } satisfies Record<Escalation, string>,
  weights: {
    rights: "권리", land: "땅", marriage: "혼인", inheritance: "상속", wardship: "후견", large_sum: "큰 돈", years_promise: "여러 해 약속",
    faction_rupture: "세력과의 결렬", crisis: "위기",
  } satisfies Record<DecisionWeight, string>,
  weighed: (weights: readonly string[]) => `${weights.join("·")} 때문에`,
  lapsed: (count: number) => `영주가 답하지 않아 기한이 지난 일 ${count}건(물리친 것으로 칩니다)`,
  /** One handled matter's row (its drill-in's summary) and the drill-in. */
  item: (title: string, policy: string, answer: string) => `${title} · ${policy} · ${answer}`,
  granted: "들어줌", refused: "물리침",
  whatHeading: "무슨 일",
  policyHeading: "쓴 방침",
  resultHeading: "결과",
  itemWhere: (date: string, estate: string) => `${date} · ${estate}`,
  itemPolicy: (policy: string, answer: string) => `${policy}: ${answer}`,
  itemTreasury: (amount: number) => amount === 0 ? "금고 변화 없음" : `금고 ${moneyFullDelta(amount)}`,
  itemRelations: (moves: readonly string[]) => moves.length === 0 ? "세력 관계 변화 없음" : `관계 ${moves.join(" · ")}`,
  relationMove: (name: string, delta: number) => `${name} ${delta > 0 ? "+" : "−"}${Math.abs(delta)}`,
  /** An off-map estate's answer moves its tenants' and merchants' goodwill and its yield, summed in its season summary. */
  offMapResult: "지도 밖 영지의 돈과 호감 변화는 그 영지의 철 요약에 합쳐 적힙니다(영주 집무 · 영지).",
  eventAnswer: (label: string) => `고른 답: ${label}`,
  eventNoAnswer: "청지기가 답을 고르지 않았습니다",
  eventResult: "이 일의 돈과 관계 변화는 연대기에 적힙니다.",
  toPolicy: "이 종류의 방침을 정한다",

  // --- the standing-policy screen -------------------------------------------------------------------------------------
  screenTitle: "상시 방침",
  screenIntro: "작은 일은 처음부터 청지기가 이 방침대로 답합니다. '영주에게'로 둔 종류만 영주의 카드로 옵니다. 돈이 큰 청원은 방침과 상관없이 영주에게 옵니다. 지속 세율 변경은 영주에게 옵니다. 시장 좌판세처럼 계속 걷는 세율을 바꾸는 답이 있는 일은 청지기가 답하지 않습니다.",
  closed: "영주 모드에서만 정할 수 있습니다",
  kindRow: (setting: string, handled: number) => handled === 0 ? `지금: ${setting}` : `지금: ${setting} · 올해 청지기가 ${handled}건`,
  choose: (title: string, setting: string) => `${title}: ${setting}`,
  /** What a setting does (the engine's `standingPolicies().answers`): the answer, the treasury's sign, the factions' signs. */
  grants: "들어준다", refuses: "물리친다",
  answerLine: (answer: string) => `청지기의 답: ${answer}`,
  estateCustom: "각 영지 청지기가 제 성향대로 답합니다",
  eventCustom: "관계와 금고를 가장 덜 움직이는 답을 고릅니다",
  eventLenient: (faction: string) => `${faction}의 마음을 가장 얻는 답을 고릅니다`,
  eventStrict: "금고가 가장 덜 나가는 답을 고릅니다",
  treasuryIn: "금고에 돈이 들어옴", treasuryOut: "금고에서 돈이 나감", treasuryNone: "금고 변화 없음",
  rises: (name: string) => `${name} 관계 오름`,
  falls: (name: string) => `${name} 관계 내림`,
  customaryShare: "관습대로 하면 아무도 크게 놀라지 않습니다(관계 변화가 작습니다)",
  toLord: "청지기가 답하지 않고 영주에게 올립니다",
  noneThisYear: "올해 청지기가 처리한 일이 없습니다",
  handledThisYear: (count: number) => `올해 청지기가 ${count}건 처리`,
  last: (date: string, answer: string | null) => answer === null ? `마지막: ${date}` : `마지막: ${date}, ${answer}`,
  /** The old switch (`rules.recurring`): every home petition comes to the lord, whatever the settings. */
  allToLord: "모든 장원 청원을 영주에게",
  allToLordOn: "켜 두면 장원 청원은 방침과 상관없이 모두 영주의 카드로 옵니다.",
  /** The dispute's other side (the table's `party`, a neighbour house drawn per petition). */
  party: "다툼 상대 이웃 가문",
} as const;
