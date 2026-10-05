// LM-R2 (negotiation area): the lord screen's 혼인 item — the marriage offer and its clauses, the counterpart's answer
// (its counter), and the marriage's progress (docs/design/negotiation.md NG-3…NG-8).
// The tier, term and stage words are this screen's own short copy, keyed by the engine's enums. They are the same words
// as the history's module-private TIER_KO / TERM_KO (src/content/historyCopy.ko.ts); switch to those tables once the
// engine exports them (docs/requests/engine-lmr2-seen-and-reads.md).
import type { AcceptanceReasonName, AcceptanceTier, MarriageStage, Negotiation, TermKind } from "../../../engine/diplomacy.types";
import type { MarriageRefusal } from "../../../engine/marriage";

type Seasons = readonly [string, string, string, string];
/** 과/와, 이/가 … by the word's last syllable (a non-Hangul end takes the vowel form). */
const josa = (word: string, withFinal: string, without: string): string => {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  return code >= 0 && code <= 11171 && code % 28 !== 0 ? withFinal : without;
};

export const NEGOTIATION_COPY = {
  heading: "혼인",
  houses: (ours: string, theirs: string) => `${ours} 가문과 ${theirs} 가문의 혼담`,
  theirHouseFallback: "이웃 영주",
  /** The menu item shut: the reason, read from the game. */
  gate: {
    lordOnly: "영주 모드에서만",
    no_groom: "혼인할 신랑 없음",
    no_bride: "상대 가문에 신부 없음",
  },
  // --- the parties ---------------------------------------------------------------------------------------------------
  groomHeading: "신랑",
  groomChoose: (name: string, relation: string) => `신랑으로 ${name}(${relation}) 고르기`,
  groomLine: (relation: string, age: number) => `${relation} · ${age}세`,
  brideHeading: "신부",
  brideLine: (age: number) => `이웃 영주의 맏딸 · ${age}세`,
  noGroom: "혼인할 나이의 미혼 남자가 집안에 없습니다.",
  noBride: "상대 가문에 혼인할 딸이 없습니다.",
  // --- the clause editor ---------------------------------------------------------------------------------------------
  editorHeading: "조항 고르기",
  editorIntro: "넣을 조항을 고르고 금액을 정하면 아래 계약서와 상대의 생각이 바로 바뀝니다.",
  include: "넣기",
  includeLabel: (term: string) => `${term} 조항 넣기`,
  less: (step: string) => `−${step}`,
  more: (step: string) => `+${step}`,
  lessLabel: (term: string, step: string) => `${term} ${step} 줄이기`,
  moreLabel: (term: string, step: string) => `${term} ${step} 늘리기`,
  yearsLess: "−1년",
  yearsMore: "+1년",
  yearsLessLabel: (term: string) => `${term} 1년 줄이기`,
  yearsMoreLabel: (term: string) => `${term} 1년 늘리기`,
  ourSide: "우리가 주는 것",
  theirSide: "상대가 주는 것",
  always: "언제나 들어감",
  treasuryNow: (amount: string) => `지금 금고 ${amount}`,
  theirDebt: (amount: string) => `상대 가문의 빚 ${amount}`,
  debtLeft: (amount: string) => `아직 넘기지 않은 빚 ${amount}`,
  instalmentCap: (amount: string) => `한 해 분할 상한 ${amount}(지난 1년 영지 수입의 몫)`,
  instalmentNone: "영지가 아직 한 해 수입을 내지 않아 분할로 넘겨받을 수 없습니다.",
  instalmentYears: (years: number) => `${years}년에 나눠 갚음`,
  instalmentTooLong: (years: number) => `더 늘리면 ${years}년 안에 다 갚을 수 없습니다.`,
  deferredNote: "영지를 물려받은 뒤 그 수입으로 해마다 나눠 갚습니다.",
  jointureOn: (piece: string) => `${piece}: 신랑이 먼저 죽으면 신부가 평생 그 수입을 갖습니다`,
  jointureNone: (pieces: string) => `과부산을 걸 만한 조각(${pieces})을 지금 점유하고 있지 않습니다.`,
  pensionLine: (amount: string, years: number) => `해마다 ${amount}, ${years}년`,
  supportNote: (years: number) => `상대 가문을 ${years}년 동안 돕겠다는 약속입니다.`,
  wardshipNote: "상대 가문에게는 넘을 수 없는 선입니다.",
  // --- the treaty and the preview ------------------------------------------------------------------------------------
  draftTitle: "혼인 계약 초안",
  counterTitle: "상대의 역제안",
  contractTitle: "혼인 계약",
  none: "없음",
  emptySide: "아직 넣은 조항이 없습니다.",
  tierHeading: "상대의 생각",
  tierLine: (tier: string) => `상대의 생각: ${tier}`,
  scoreLine: (score: number, line: number) => `점수 ${score} · 받아들이는 선 ${line}`,
  reasonsHeading: "상대가 따지는 것",
  reason: (name: string, value: number) => `${name} ${value > 0 ? "+" : "−"}${Math.abs(value)}`,
  ceilingLine: (ceiling: number) => `돈과 재물로 닿을 수 있는 최고 점수 ${ceiling}`,
  ceilingBelow: "돈으로는 받아들이는 선에 닿지 않습니다. 이대로 보내면 역제안도 오지 않습니다.",
  send: "청혼 보내기",
  sendLabel: "이 조건으로 이웃 영주에게 혼인을 청하기",
  refusals: {
    no_groom: "혼인할 나이의 미혼 남자가 집안에 없습니다.",
    no_bride: "상대 가문에 혼인할 딸이 없습니다.",
    under_way: "이미 혼담이 진행 중입니다.",
    treasury: "계약금이 지금 금고보다 많습니다.",
    no_terms: "조항을 하나 이상 넣으십시오.",
  } satisfies Record<MarriageRefusal, string>,
  /** The last answer, shown at once (an offer is answered as it is sent). */
  answers: {
    accepted: "상대가 혼인을 받아들였습니다. 계약이 맺어졌습니다.",
    countered: "상대가 조건을 고쳐 되물었습니다.",
    rejected: "상대가 혼인을 거절했습니다. 조건을 고쳐 다시 청할 수 있습니다.",
    withdrawn: "고쳐 온 조건을 받지 않아 혼담이 끝났습니다. 다시 청할 수 있습니다.",
  } satisfies Record<Negotiation["status"], string>,
  answerTier: (tier: string) => `보낸 제안에 대한 상대의 생각: ${tier}`,
  // --- the counter ---------------------------------------------------------------------------------------------------
  counterIntro: "바뀐 조항과 빠진 조항만 표시했습니다. 상대는 받아들이면 제 조건을 지킵니다.",
  marks: { same: "그대로", changed: "바뀜", rejected: "빠짐" },
  changeAddedPlain: "새로 요구",
  changeRaised: (from: string, to: string) => `${from} → ${to}`,
  changeRemoved: "상대가 뺐습니다",
  deadline: (days: number) => `답할 기한: ${days}일 남음`,
  deadlinePast: "답할 기한이 지났습니다.",
  accept: "역제안 받아들이기",
  acceptLabel: "상대의 역제안을 받아들여 계약 맺기",
  refuse: "역제안 거두기",
  refuseLabel: "상대의 역제안을 받지 않고 혼담 끝내기",
  cannotNow: "지금은 할 수 없습니다.",
  // --- the marriage's progress ---------------------------------------------------------------------------------------
  timelineHeading: "혼인 진행",
  stageNow: (stage: string) => `지금 단계: ${stage}`,
  contractedOn: (date: string) => `${date} 계약`,
  couple: (groom: string, bride: string) => `${groom}${josa(groom, "과", "와")} ${bride}`,
  stages: {
    contracted: "계약 맺음", bride_arrived: "신부가 옴", child_born: "첫아이", father_ill: "늙은 영주가 병듦",
    will_change: "유언 변경", inherited: "상속", lost: "영지를 잃음", contested: "다툼",
  } satisfies Record<MarriageStage, string>,
  events: {
    contracted: "혼인 계약을 맺었다",
    bride_arrived: "신부가 영주관에 들어왔다",
    child_born: "부부의 첫아이가 태어났다",
    brother_in_law_born: "이웃 영주가 아들을 얻었다 — 상속 기대가 줄었다",
    father_ill: "이웃 영주가 병들었다",
    will_change: "이웃 영주가 유언을 고치려 했다",
    will_dropped: "이웃 영주가 유언을 고치지 않기로 했다",
    father_died: "이웃 영주가 죽었다",
  },
  brotherInLaw: (name: string) => `처남: ${name}`,
  willAnswer: (answer: string) => `유언 변경에 한 답: ${answer}`,
  willAnswers: { favour: "호의를 베풀었다", support_promise: "지원을 약속했다", let_it_be: "그대로 두었다" },
  rival: (name: string) => `경쟁자: ${name} — 새 유언으로 영지를 받았다`,
  rivalFallback: "옛 가문의 친족",
  jointure: (piece: string, settled: boolean) => settled ? `과부산: ${piece} — 신부가 평생 갖게 되었다` : `과부산: ${piece} — 신랑이 먼저 죽으면 신부가 평생 갖는다`,
  deferred: (amount: string, inherited: boolean) => inherited ? `상속 뒤 빚 갚기: ${amount} — 약속 장부에 해마다 나눠 올랐다`
    : `상속 뒤 빚 갚기: ${amount} — 영지를 물려받으면 해마다 나눠 갚는다`,
  outcomes: {
    inherited: "아내를 통해 이웃 영지를 물려받았다. 이제 우리 영지다.",
    lost: "이웃 영지는 그의 아들에게 갔다. 상속 기대는 사라졌다.",
    contested: "새 유언대로 경쟁자가 영지를 차지했다. 소송에서 이기면 영지가 우리 것이 된다.",
  },
  willDue: "유언 변경에 답할 때입니다. 한 계절 안에 답하지 않으면 그대로 둔 것으로 칩니다.",
  contestedDue: "이 다툼에는 따로 내릴 명령이 없습니다. 소송으로 다툽니다.",
  openSuit: "소송 보기",
  openSuitLabel: "약속·소송 화면에서 이 영지의 소송 보기",
  ourHouse: "우리 집안",
  pieces: { "home:fishery": "어업권", "home:manor_court": "장원 법정" } as Readonly<Record<string, string>>,
  date: (year: number, season: string) => `${year}년 ${season}`,
  seasons: ["봄", "여름", "가을", "겨울"] as Seasons,
  tiers: {
    impossible: "불가능", unlikely: "불리", close: "박빙", likely: "유력", almost_certain: "거의 확실",
  } satisfies Record<AcceptanceTier, string>,
  terms: {
    cash: "계약금", pension: "연금", right_piece: "권리 조각", political_support: "정치적 지원", debt_assumption: "채무 인수",
    jointure: "과부산", debt_after_inheritance: "상속 뒤 빚 갚기", consent: "혼인 동의", inheritance_non_infringement: "상속 기대권 불침해",
    residence: "배우자 거주", land_use: "토지 사용수익", wardship: "후견 합의",
  } satisfies Record<TermKind, string>,
  reasons: {
    base: "같은 신분의 혼인", relation: "우리 가문과의 관계", material: "받는 재물", political: "우리 도시의 힘", trust: "지켜 온 약속",
    urgency: "그 집안의 급한 사정", concession: "내주는 것", rank: "강등된 신분", inheritance_risk: "상속녀를 내줌",
    broken_promises: "어긴 약속", red_line: "넘을 수 없는 선",
  } satisfies Record<AcceptanceReasonName, string>,
} as const;
