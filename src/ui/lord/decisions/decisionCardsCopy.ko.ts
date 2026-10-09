import type { EstatePetition, EstatePetitionKind } from "../../../engine/stewardship.types";
import { moneyShort } from "../../money.ko";

// LM-R2 (lord mode) the lord's decision cards: the father's new will (NG-8 `answer_will_change`), the contested
// inheritance (answered by the suit), a Michaelmas audit's finding (SW-6 `answer_audit`) and an off-map estate's
// petition (SW-4 `answer_estate_petition`). Words follow docs/design/glossary.md (청지기, 영지, 소작인); the lord's
// answers are his act ("~한다"); each answer's lines are the engine's own (the command run on the state, lordOutcome.ts).

/** The particle after a Korean word: the first form after a final consonant (받침), the second after a vowel. */
const josa = (word: string, withFinal: string, without: string) => { const code = word.charCodeAt(word.length - 1) - 0xac00; return code >= 0 && code <= 11171 && code % 28 !== 0 ? withFinal : without; };

type OffMapKindCopy = Readonly<{ title: string; grant: string; refuse: string }>;

export const OFFMAP_PETITION_COPY: Readonly<Record<EstatePetitionKind, OffMapKindCopy>> = {
  rent_relief: { title: "지대 감면", grant: "지대를 깎아 준다", refuse: "지대를 그대로 받는다" },
  market_dues: { title: "장세 인하", grant: "장세를 낮춰 준다", refuse: "장세를 그대로 받는다" },
  repair: { title: "수리 청원", grant: "수리 비용을 댄다", refuse: "수리를 미룬다" },
  common_dispute: { title: "공유지 다툼", grant: "소작인 편을 든다", refuse: "상인 편을 든다" },
  charter_request: { title: "특허 청원", grant: "특허를 내준다", refuse: "특허를 거절한다" },
  marriage_licence: { title: "혼인 허가", grant: "혼인을 허락한다", refuse: "혼인을 막는다" },
};

const GROUP: Readonly<Record<EstatePetition["group"], string>> = { tenants: "소작인", merchants: "상인" };
const ESCALATED: Readonly<Record<NonNullable<EstatePetition["escalated"]>, string>> = {
  amount: "청지기에게 맡긴 금액보다 커서 영주에게 올라왔습니다",
  rights: "권리가 걸린 일이라 영주에게 올라왔습니다",
  marriage: "혼인이 걸린 일이라 영주에게 올라왔습니다",
  direct: "영주가 직접 보는 영지라 영주에게 왔습니다",
};

export const DECISION_CARDS_COPY = {
  /** An estate by its house's reading; one the engine does not name is "이웃 영지". */
  estate: (house: string | null) => house === null ? "이웃 영지" : `${house} 영지`,
  // The father's will (NG-8).
  willTitle: "늙은 영주의 새 유언",
  willLine: (estate: string) => `${estate}의 늙은 영주가 병석에서 유언을 고치려 합니다. 영지를 조카에게 남기는 유언입니다.`,
  willFavour: "호의를 보낸다",
  willSupport: "지원을 약속한다",
  willLetBe: "그대로 둔다",
  refusedTreasury: "금고가 모자랍니다",
  refusedNow: "지금은 할 수 없습니다",
  // The contested inheritance (answered by the suit on the marriage's claim).
  contestTitle: "상속 다툼",
  contestLine: (estate: string, rival: string) => `${rival}${josa(rival, "이", "가")} 유언을 근거로 ${estate}${josa(estate, "을", "를")} 차지했습니다. 소송에서 이겨 점유를 집행하면 영지가 영주에게 옵니다.`,
  contestSuit: (stage: string) => `영주의 소송: ${stage}`,
  contestNoSuit: "아직 소송을 내지 않았습니다",
  /** Astra lordplay2 ③: the suit on the claim ended — its verdict (null: closed without one) and its date. */
  contestEnded: (verdict: string | null, date: string) => `영주의 소송: 끝남${verdict === null ? "" : ` · ${verdict}`} · ${date}`,
  contestVerdict: { plaintiff: "판결: 영주가 이겼습니다", defendant: "판결: 영주가 졌습니다" } as const,
  contestOpen: "소송 보기",
  rivalUnknown: "다른 상속인",
  suitStage: { filed: "제기됨", evidence: "증거 모으는 중", patronage: "후원 구하는 중", hearing: "심리 중", judged: "판결 남", enforcing: "점유 집행 중", closed: "끝남" } as Readonly<Record<string, string>>,
  // A Michaelmas audit (SW-6).
  auditTitle: "미카엘마스 감사",
  auditKicker: (visit: boolean) => visit ? "영주가 직접 찾아간 감사" : "장부로 본 감사",
  auditLine: (estate: string, steward: string, kept: number, errors: number) =>
    `${estate}의 감사에서 청지기 ${steward}의 장부에 드러난 것: ${[kept > 0 ? `빼돌린 돈 ${moneyShort(kept)}` : "", errors > 0 ? `오류 ${moneyShort(errors)}` : ""].filter(part => part !== "").join(" · ")}.`,
  auditAdvice: "한 철 안에 답하지 않으면 눈감아 준 것으로 칩니다.",
  auditPunish: "벌한다", auditReplace: "갈아 치운다", auditTolerate: "눈감아 준다",
  auditNoSuccessor: "뒤를 맡을 사람이 없습니다",
  // An off-map estate's petition (SW-4).
  petitionKicker: (estate: string) => `${estate}의 청원`,
  petitionLine: (estate: string, group: EstatePetition["group"], title: string, amount: number) =>
    `${estate}의 ${GROUP[group]}${josa(GROUP[group], "이", "가")} ${title}${josa(title, "을", "를")} 청합니다. 걸린 돈은 ${moneyShort(amount)}입니다.`,
  petitionWhy: (escalated: EstatePetition["escalated"]) => escalated === undefined ? "" : ESCALATED[escalated],
  petitionAdvice: "답을 기다리는 동안 답하지 않으면 청원은 기각된 것으로 칩니다.",
  waits: (days: number) => `답을 기다림 · ${days}일 남음`,
  close: "닫기",
  // DEC-CARD: the heavy card's situation, stake and deadline for each of these cards (each answer's lines are the
  // engine's, src/ui/decisionCard/families/lordOutcome.ts).
  willFrom: (estate: string) => `혼인 상대 가문 · ${estate}`,
  willSituation: (estate: string) => `${estate}의 늙은 영주가 병석에서 유언을 고치려 합니다. 영지를 조카에게 남기는 유언입니다.`,
  willStake: (estate: string, strength: number) =>
    `${estate} 전체가 걸려 있습니다. 혼인으로 얻은 영주의 상속 청구(힘 ${strength})가 새 유언에 밀릴 수 있습니다.`,
  /** SUIT-THREAD: the engine's deadline (`lordMattersDue` dueTick) as its season; null: the engine names none. */
  willDeadline: (date: string | null) => `${date === null ? "기한 안에" : `${date}까지`} 답해야 합니다. 답하지 않으면 새 유언이 그대로 서고, 그대로 둔 것으로 칩니다.`,
  willLetBeLater: "늙은 영주가 죽으면 조카가 영지를 차지하고, 영주는 소송으로 다투게 됩니다.",
  contestStake: (estate: string, ours: number | null, theirs: number | null) =>
    `${estate} 전체가 걸려 있습니다.${ours === null ? "" : ` 영주의 청구 힘 ${ours}`}${theirs === null ? "" : `${ours === null ? " " : ", "}상대의 청구 힘 ${theirs}`}${ours === null && theirs === null ? "" : "."}`,
  auditStake: (estate: string, steward: string, disposition: string, faction: string | null) =>
    `${estate}의 장부와, 그 영지를 누구에게 맡길지가 걸려 있습니다. 청지기 ${steward}${josa(steward, "은", "는")} ${disposition} 성향${faction === null ? "입니다" : `이고 ${faction} 쪽 사람입니다`}.`,
  auditDeadline: (days: number) => `${days}일 안에 답해야 합니다. 답하지 않으면 눈감아 준 것으로 칩니다.`,
  petitionStake: (estate: string, group: EstatePetition["group"], goodwill: number) =>
    `${estate} ${GROUP[group]}의 마음(지금 호감 ${goodwill})과 영지의 수입이 걸려 있습니다.`,
  petitionDeadline: (days: number) => `${days}일 안에 답해야 합니다. 답하지 않으면 기각한 것으로 칩니다.`,
} as const;
