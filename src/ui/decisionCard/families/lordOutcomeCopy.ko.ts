import type { TermKind } from "../../../engine/diplomacy.types";
import type { ClaimBasis, Evidence, RightPieceKind } from "../../../engine/estates.types";
import type { RegistryTerm } from "../../../engine/registry.types";
import { moneyJosa, moneyShort } from "../../money.ko";

// DEC-CARD, the lord-mode cards (the town's request, the registry offer, the will, the audit, the off-map petition, the
// counter): what an answer changes that the engine's outlook does not word (outlookCopy.ko.ts has its later keys), said in
// sentences from the state the engine leaves after it (lordOutcome.ts). Words
// follow docs/design/glossary.md: the card's lines "~합니다", the chronicle's own sentences quoted as they are ("~했다").

/** The particle after a Korean word: the first form after a final consonant (받침), the second after a vowel. */
const josa = (word: string, withFinal: string, without: string) => {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  return code >= 0 && code <= 11171 && code % 28 !== 0 ? withFinal : without;
};
const subject = (word: string) => `${word}${josa(word, "이", "가")}`;
const object = (word: string) => `${word}${josa(word, "을", "를")}`;
const withWord = (word: string) => `${word}${josa(word, "과", "와")}`;
const sumSubject = (pennies: number) => { const printed = moneyShort(pennies); return `${printed}${moneyJosa(printed, "이", "가")}`; };
const signed = (delta: number) => `${delta > 0 ? "+" : ""}${delta}`;
/** 로/으로 after a number read aloud (일·이·사·오·칠·팔·구 take 로; 삼·육·영·십·백·천 take 으로). */
const toNumber = (value: number) => {
  const whole = Math.abs(Math.trunc(value));
  return `${value}${whole % 10 === 0 || whole % 10 === 3 || whole % 10 === 6 ? "으로" : "로"}`;
};

/** The engine's enums in the lord screens' words (the ledger screen's own; its area is not imported from here). */
export const LORD_OUTCOME_WORDS = {
  terms: {
    cash: "계약금", pension: "연금", right_piece: "권리 조각", political_support: "정치적 지원", debt_assumption: "채무 인수",
    consent: "혼인 동의", inheritance_non_infringement: "상속 기대권 불침해", residence: "배우자 거주", land_use: "토지 사용수익",
    wardship: "후견 합의", jointure: "과부산", debt_after_inheritance: "상속 뒤 빚 갚기",
  } satisfies Record<TermKind, string>,
  basis: { inheritance: "상속", marriage: "혼인", purchase_deed: "매입 문서", grant: "하사", old_possession: "오래된 점유" } satisfies Record<ClaimBasis, string>,
  pieces: {
    land_rent: "토지 지대", manor_court: "장원 법정", mill: "방앗간 사용료", market: "시장 좌판세", tolls: "통행세", fishery: "어업권",
    advowson: "성직자 추천권", hunting: "사냥권",
  } satisfies Record<RightPieceKind, string>,
  evidence: { charter: "특허장", deed: "양도 증서", court_roll: "법정 기록", witnesses: "증인", possession_years: "점유 햇수" } satisfies Record<Evidence["kind"], string>,
  termKinds: { remission: "감면", installments: "분할 납부" } satisfies Record<RegistryTerm["kind"], string>,
  termWhat: { market_dues: "시장 부담", rent: "지대" } as Readonly<Record<string, string>>,
  holders: { lord: "영주", merchants: "상인들", townsfolk: "주민들" } as Readonly<Record<string, string>>,
  estateName: (house: string) => `${house} 영지`,
  homeEstate: "본 영지",
  houseOf: (name: string) => `${name} 가문`,
  oldKin: "옛 가문의 친족",
  estatePiece: (estate: string, piece: string) => `${estate} · ${piece}`,
} as const;

export const LORD_OUTCOME_COPY = {
  date: (year: number, season: string) => `${year}년 ${season}`,
  /** A claim or suit on a whole estate ("드 헤로넬 영지 전체"). */
  whole: (estate: string) => `${estate} 전체`,
  // now
  treasuryIn: (pennies: number) => `금고에 ${sumSubject(pennies)} 들어옵니다.`,
  treasuryOut: (pennies: number) => `금고에서 ${sumSubject(pennies)} 나갑니다.`,
  treasurySame: "금고는 그대로입니다.",
  claimNew: (who: string, what: string, basis: string, strength: number) => `${subject(who)} ${what}에 ${object(basis)} 근거로 청구를 냅니다(힘 ${strength}).`,
  claimStronger: (who: string, from: number, to: number) => `${who}의 청구가 힘 ${from}에서 ${toNumber(to)} 강해집니다.`,
  claimWeaker: (who: string, from: number, to: number) => `${who}의 청구가 힘 ${from}에서 ${toNumber(to)} 약해집니다.`,
  evidence: (kinds: string) => `소송에 증거를 냅니다: ${kinds}.`,
  suitNew: (plaintiff: string, defendant: string, what: string) => `${subject(plaintiff)} ${object(defendant)} 상대로 ${what} 소송을 겁니다.`,
  patron: (who: string) => `${subject(who)} 소송의 후원자가 됩니다.`,
  promiseBroken: (who: string, term: string) => `${subject(who)} "${term}" 약속을 어긴 것이 됩니다.`,
  promiseKept: (term: string) => `"${term}" 약속을 지킵니다.`,
  stewardOut: (name: string) => `청지기 ${subject(name)} 물러납니다.`,
  stewardStays: (name: string) => `청지기 ${subject(name)} 그대로 장부를 맡습니다.`,
  loyalty: (name: string, delta: number) => `청지기 ${name}의 충성이 ${Math.abs(delta)} ${delta > 0 ? "오릅니다" : "떨어집니다"}.`,
  valueDrop: (estate: string) => `${estate}의 한 해 가치가 떨어집니다.`,
  policy: (name: string) => `영지 방침을 "${name}"에 둡니다.`,
  wallFirst: "성벽 공사가 일손과 자재를 먼저 받습니다.",
  wallNotFirst: "성벽 공사가 다른 공사와 같은 차례로 돌아갑니다.",
  sites: (count: number) => `새 공사 ${count}곳이 열립니다.`,
  offerSent: (tier: string) => `이웃 가문에 혼담을 보냅니다. 지금 조건이면 상대의 마음은 "${tier}"입니다.`,
  /** A line the chronicle itself will write for the answer (its own sentence, quoted). */
  record: (sentence: string) => `연대기: ${sentence}`,
  // later
  offerAnswer: "상대의 답은 혼담이 닿는 즉시 옵니다. 혼인 화면에서 봅니다.",
  promiseByLord: (term: string, date: string) => `약속 장부에 오릅니다: ${term}, ${date}까지 지켜야 합니다.`,
  promisesByLord: (term: string, count: number, first: string, last: string) => `약속 장부에 오릅니다: ${term} ${count}번, ${first}부터 ${last}까지.`,
  promiseToLord: (who: string, term: string, date: string) => `${subject(who)} 약속합니다: ${term}, ${date}까지.`,
  // who remembers a promise the answer makes
  holdsWord: "영주의 약속을 받아 둡니다",
  witnesses: "약속의 증인으로 지켜봅니다",
  gaveWord: "영주에게 약속했습니다",
  stake: (who: string, relation: number, witnesses: string | null) =>
    `어기면 ${withWord(who)}의 관계가 ${relation} 나빠집니다.${witnesses === null ? "" : ` 증인(${witnesses})도 기억합니다.`}`,
  term: (what: string, kind: string, perYear: string, years: number) => `${what} ${kind}: 해마다 ${perYear}, ${years}년 동안 이어집니다.`,
  actual: (date: string, metrics: string) => `${date}에 이 결정의 실제가 연대기에 적힙니다. 지금은 ${metrics}입니다.`,
  metricNow: (name: string, value: string) => `${name} ${value}`,
  metrics: { population: "인구", treasury: "금고", lots: "필지", merchantGauge: "상인 게이지", l4: "도시 대가옥" } as Readonly<Record<string, string>>,
  // who remembers
  goodwillOf: (estate: string, group: string) => `${estate}의 ${group}`,
  groups: { tenants: "소작인", merchants: "상인" } as const,
  goodwill: (delta: number) => `${delta > 0 ? "반깁니다" : "서운해합니다"} (호감 ${signed(delta)})`,
  house: (delta: number) => `${delta > 0 ? "가까워집니다" : "멀어집니다"} (관계 ${signed(delta)})`,
} as const;
