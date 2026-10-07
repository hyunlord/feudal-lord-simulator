import { HOLD_CLAIM_WEAKEN, HOLD_RELATION_DELTA } from "../content/registry/registryHoldConfig";
import { moneyShort } from "./money.ko";

// EVENT-ART: the registry event card's own words (lord mode; src/ui/hud/RegistryCard.tsx). The entry's title, body,
// sender and answers are the content canon v4's (src/content/registry/v4Copy.generated.ts, LM-E9b); here are the frame's
// lines, "why it came" (identity 8, reasons are visible: what the offer is bound to, the season's draw), why an answer is
// shut, and what a hold costs (ER-19). A binding or a condition with no words yet is said generically — a raw key never
// reaches the card.

/** 이/가, 과/와 after a word (its last syllable's final consonant). */
const final = (word: string) => { const code = word.charCodeAt(word.length - 1) - 0xac00; return code >= 0 && code < 11172 && code % 28 !== 0; };
const subject = (word: string) => `${word}${final(word) ? "이" : "가"}`;
const withWord = (word: string) => `${word}${final(word) ? "과" : "와"}`;

/** What each binding of a v4 entry is, as "why it came" names it (ER-15); null: not said (the same thing again, or the home estate). */
export const BINDING_WORDS: Readonly<Record<string, string | null>> = {
  estate: "걸린 지도 밖 영지", oversight: null, currentSteward: "맡은 청지기", currentPerson: null, suit: "걸린 소송", claim: "걸린 청구",
  audit: "걸린 감사", successor: "뒤를 이을 청지기 후보", groom: "혼담의 신랑", bride: "혼담의 신부", homeEstate: null, home: null,
  jointurePiece: "과부산으로 걸 몫", jointure: "과부산으로 걸 몫", peasantCandidate: "농민 쪽 청지기 후보", merchantCandidate: "상인 쪽 청지기 후보",
  ableCandidate: "솜씨 있는 청지기 후보", loyalCandidate: "충직한 청지기 후보", promise: "걸린 약속", counterpart: "상대 가문",
  negotiation: "걸린 혼담", estatePetition: "걸린 청원", chapterPetition: "걸린 청원", famine: "걸린 기근",
};
/** A right of an estate (a claim's or a jointure's piece). */
export const PIECE_WORDS: Readonly<Record<string, string>> = {
  land_rent: "토지 지대", manor_court: "장원 법정", mill: "방앗간 사용료", market: "시장 좌판세", tolls: "통행세", fishery: "어업권",
  advowson: "성직자 추천권", hunting: "사냥권",
};
export const SUIT_STAGE_WORDS: Readonly<Record<string, string>> = {
  filed: "소장을 낸 단계", evidence: "증거를 모으는 단계", patronage: "후원을 구하는 단계", hearing: "심리 중", judged: "판결이 난 뒤", enforcing: "점유를 집행할 단계", closed: "끝남",
};
export const EVIDENCE_WORDS: Readonly<Record<string, string>> = {
  charter: "특허장", deed: "재산 증서", court_roll: "법정 기록", witnesses: "증인 증언", possession_years: "점유한 햇수",
};

/** Why an answer is shut: the kind the card found (src/ui/registryCardModel.ts `shutReason`). */
export type ShutReason =
  | { readonly kind: "unsupported" | "missing" | "gone" | "already" | "subsidy" | "marriage" | "timber" | "build" | "condition" | "refused" }
  | { readonly kind: "money"; readonly amount: number }
  | { readonly kind: "evidence"; readonly evidence: string };

const SHUT = "지금은 고를 수 없습니다";
const SHUT_WORDS: Readonly<Record<Exclude<ShutReason["kind"], "money" | "evidence">, string>> = {
  unsupported: "이 영지에서는 아직 할 수 없는 일입니다",
  missing: "이 답에 필요한 사람이나 대상이 없습니다",
  gone: "이 일에 걸린 대상이 더는 없습니다",
  already: "이미 그렇게 정해져 있습니다",
  subsidy: "그 공사에는 지금 보조금을 걸 수 없습니다",
  marriage: "지금은 혼담을 낼 수 없습니다",
  timber: "목재를 사 올 곳이 없습니다",
  build: "지금은 그 건물을 세울 자리나 형편이 없습니다",
  condition: "이 답의 조건이 지금 맞지 않습니다",
  refused: "지금 형편으로는 이 일을 해낼 수 없습니다",
};

/** Who sends it: the canon's sender, and the faction it speaks for. */
const senderWords = (sender: string, faction: string | null) => sender === "" ? faction ?? "영지에 온 일" : faction === null || faction === sender ? sender : `${sender}(${faction})`;

export const REGISTRY_CARD_COPY = {
  /** The card's kicker: who sends it — the canon's sender, and the faction it speaks for. */
  from: (sender: string, faction: string | null) => `보낸 쪽 · ${senderWords(sender, faction)}`,
  /** An entry the canon has no words for (one added before its copy). */
  title: "영지에 온 일",
  choice: (index: number) => `${index}번째 답`,
  /** An answer the canon gives no tradeoff line for. */
  noTradeoff: "이 답의 득실은 아직 적혀 있지 않습니다",
  /** How long the offer waits (the engine's deadline: days left, and the season it ends in). */
  waits: (days: number, year: number, season: string) => `답을 기다림 · ${days}일 남음(${year}년 ${season}까지)`,
  whyHeading: "왜 왔나",
  /** ER-3: the entry's conditions held this season (the canon's expressions are not put in words one by one). */
  conditionsHeld: "이번 철 영지의 형편이 이 일의 조건에 맞았습니다",
  /** ER-22: a one-shot entry. */
  oncePerCampaign: "한 판에 한 번만 오는 일입니다",
  /** ER-15: one bound target — what it is, and its name when it has one. */
  bound: (what: string, name: string | null) => name === null ? what : `${what}: ${name}`,
  /** A target the card has no words for yet. */
  boundUnknown: "이 일에 걸린 대상 하나",
  suit: (piece: string, stage: string | null) => stage === null ? piece : `${piece}(${stage})`,
  wholeEstate: "영지 전체",
  drawn: (permille: number) => `이번 철 추첨에 뽑혔습니다(이 일이 올 가능성 ${Math.round(permille / 10)}%)`,
  /** A shut answer, with why. */
  shut: (reason: ShutReason) => `${SHUT}: ${reason.kind === "money" ? `금고에 ${moneyShort(reason.amount)} 이상 있어야 합니다`
    : reason.kind === "evidence" ? `이 청구에 ${subject(EVIDENCE_WORDS[reason.evidence] ?? "그 증거")} 이미 있습니다` : SHUT_WORDS[reason.kind]}`,
  /** ER-19: what holding costs. */
  holdClaim: `보류하면 이 청구의 힘이 ${HOLD_CLAIM_WEAKEN} 줄어듭니다`,
  holdRelation: (faction: string) => `보류하면 ${withWord(faction)}의 관계가 ${-HOLD_RELATION_DELTA} 나빠집니다`,
  holdPromise: "보류해도 약속의 기한은 그대로 다가옵니다(넘기면 어긴 약속이 됩니다)",
  holdNegotiation: "보류해도 혼담의 기한은 그대로 다가옵니다(넘기면 상대가 물러납니다)",
  /** What an unanswered offer does at its deadline (a v4 offer lapses with no answer and no cost). */
  lapse: "답하지 않으면 기한이 지나 그대로 넘어갑니다",
  advice: "답하면 바로 장부에 적힙니다. 나중에 정해도 기한까지 기다립니다",
  /** DEC-CARD: what is at stake — the offer's bound targets ("걸린 청구" → "청구(어업권)"), else the sender. */
  stakeItem: (what: string, name: string | null) => { const word = what.replace(/^걸린 /, ""); return name === null ? word : `${word}: ${name}`; },
  stake: (items: readonly string[]) => `${items.join(" · ")}.`,
  stakeSender: (sender: string, faction: string | null) => `${senderWords(sender, faction)}의 청과, 그쪽과의 사이가 걸려 있습니다.`,
  /** DEC-CARD: until when, and what silence means (a v4 offer lapses with no answer and no cost). */
  deadline: (days: number, year: number, season: string) => `${days}일 안에(${year}년 ${season}까지) 답해야 합니다. 답하지 않으면 기한이 지나 그대로 넘어갑니다.`,
} as const;
