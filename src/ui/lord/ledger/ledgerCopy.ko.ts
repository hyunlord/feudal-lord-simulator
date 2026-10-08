// LM-R2 (ledger area): the lord screen's promises and suits — the promise ledger (NG-6), the registry's timed terms
// (ER-7) and the suit track (ES-7, ER-21). The words for the engine's enums (terms, holders, pieces, a claim's basis, a
// suit's stages) are this screen's own short copy, keyed by the engine enum; they switch to the engine's tables
// (historyCopy.ko.ts TERM_KO, HOLDER_KO, PIECE_KO, CLAIM_BASIS_KO, SUIT_STAGE_KO) once those are exported
// (docs/requests/engine-lmr2-seen-and-reads.md).
import type { TermKind } from "../../../engine/diplomacy.types";
import type { ClaimBasis, Evidence, RightPieceKind, SuitStage } from "../../../engine/estates.types";
import type { SuitRefusal } from "../../../engine/estateSuits";
import type { RegistryTerm } from "../../../engine/registry.types";

/** The ledger's four promise states (`due`: open, its deadline within a season). */
export type PromiseState = "open" | "due" | "kept" | "broken";

const josa = (word: string, withFinal: string, without: string) => { const code = word.charCodeAt(word.length - 1) - 0xac00; return code >= 0 && code <= 11171 && code % 28 !== 0 ? withFinal : without; };

/**
 * SUIT-THREAD (the user, 2026-10-09; the engine's `suitHearing`: `verdictNow`, `reachable`): the hearing judged now and
 * whether the claim's side can still pass the defence with all it may yet add. The claim side's words when the lord sues;
 * when he is sued, the plaintiff's (a house), and what the defence row lets him do.
 */
const VERDICT_NOW = { plaintiff: "지금 판결하면 청구 쪽이 이깁니다", defendant: "지금 판결하면 방어 쪽이 이깁니다" } as const;
const REACHABLE = { true: "남은 증거와 후원을 다 더하면 넘을 수 있습니다", false: "남은 증거와 후원을 다 더해도 넘기 어렵습니다" } as const;
const REACHABLE_AGAINST = { true: "원고가 남은 증거와 후원을 다 더하면 넘을 수 있습니다", false: "원고가 남은 증거와 후원을 다 더해도 넘기 어렵습니다" } as const;
type Verdict = keyof typeof VERDICT_NOW;
const judged = (verdict: Verdict, tail: string) => `${VERDICT_NOW[verdict]} · ${tail}`;

export const LORD_LEDGER_COPY = {
  closed: "영주 모드에서만 열립니다",
  regionLabel: "약속과 소송",
  promisesHeading: "약속 장부",
  openPage: "지킬 약속",
  pastPage: "지난 약속",
  noOpen: "기한이 남은 약속이 없습니다.",
  noPast: "지키거나 어긴 약속이 아직 없습니다.",
  noPromises: "아직 맺은 약속이 없습니다. 혼인 계약이 맺어지면 그 약속이 여기에 적힙니다.",
  treasury: (amount: string) => `금고 ${amount}`,
  states: { open: "진행 중", due: "기한 임박", kept: "지킴", broken: "어김" } satisfies Record<PromiseState, string>,
  terms: {
    cash: "계약금", pension: "연금", right_piece: "권리 조각", political_support: "정치적 지원", debt_assumption: "채무 인수",
    consent: "혼인 동의", inheritance_non_infringement: "상속 기대권 불침해", residence: "배우자 거주", land_use: "토지 사용수익",
    wardship: "후견 합의", jointure: "과부산", debt_after_inheritance: "상속 뒤 빚 갚기",
  } satisfies Record<TermKind, string>,
  byLord: (to: string) => `영주가 지킬 약속 · 받는 쪽 ${to}`,
  toLord: (from: string) => `영주가 받을 약속 · 지킬 쪽 ${from}`,
  deadline: (date: string, when: string) => `기한 ${date} · ${when}`,
  dueToday: "오늘 마감",
  settled: (state: string, date: string) => `${state} · ${date}`,
  witnesses: (names: string) => `증인 ${names}`,
  stake: (trust: number, relation: number) => `어기면 신뢰 −${trust} · 관계 −${relation}`,
  debtShare: (index: number, count: number) => `빚 나눠 갚기 ${index}/${count}번째 몫`,
  keep: "약속 지키기",
  keepLabel: (term: string) => `약속 지키기: ${term}`,
  keepShut: "지금은 할 수 없습니다",
  theirs: "상대의 약속입니다",
  termsHeading: "기한이 있는 조건",
  noTerms: "기한이 걸린 감면이나 분할 납부가 없습니다.",
  termKinds: { remission: "감면", installments: "분할 납부" } satisfies Record<RegistryTerm["kind"], string>,
  termWhat: { market_dues: "시장 부담", rent: "지대" } as Readonly<Record<string, string>>,
  termRemission: (permille: number) => `${Math.round(permille / 10)}%로`,
  termPerYear: (money: string) => `해마다 ${money}`,
  termYears: (settled: number, years: number) => `${years}년 중 ${settled}년 지남`,
  termLeft: (date: string, left: string) => `끝 ${date} · ${left} 남음`,
  termEnded: (date: string) => `끝남 · ${date}`,
  termRunning: "진행 중",
  suitsHeading: "소송",
  claimsHeading: "청구할 수 있는 권리",
  noClaims: "아직 소송으로 가져갈 청구가 없습니다.",
  noSuits: "진행 중이거나 끝난 소송이 없습니다.",
  claimLine: (basis: string, strength: number) => `근거 ${basis} · 힘 ${strength}`,
  /** The button with the treasury the filing takes (`suitFilingOutlook.cost`, said even when the filing is refused). */
  fileSuitCost: (money: string) => `소송 걸기 · ${money}`,
  fileSuitCostLabel: (what: string, money: string) => `소송 걸기: ${what} · 비용 ${money}`,
  /** DTR-23: a claim of fresh dispossession (`claim.novel`) and its suit's track (filed, then the hearing). */
  novelLine: "점유 침탈 소송 · 접수 다음 철에 바로 심리로 갑니다",
  /** The hearing the filing would open (`suitFilingOutlook.hearing`). */
  hearingIfFiled: (hearing: string) => `지금 걸면 심리에서 ${hearing}`,
  refusals: {
    no_claim: "청구가 없습니다", not_open: "이미 다룬 청구입니다", own_title: "이미 권원을 가진 쪽입니다", treasury: "금고가 모자랍니다",
  } satisfies Record<SuitRefusal, string>,
  against: (name: string) => `상대 ${name}`,
  byNeighbour: (name: string) => `원고 ${name}`,
  stages: {
    filed: "제기", evidence: "증거", patronage: "후원", hearing: "심리", judged: "판결", enforcing: "점유 집행", closed: "끝남",
  } satisfies Record<SuitStage, string>,
  stageSince: (stage: string, date: string) => `${stage} 단계 · ${date}부터`,
  track: "소송 진행",
  costs: (money: string) => `쓴 비용 ${money}`,
  evidenceHeading: "증거",
  evidence: { charter: "특허장", deed: "양도 증서", court_roll: "법정 기록", witnesses: "증인", possession_years: "점유 햇수" } satisfies Record<Evidence["kind"], string>,
  evidenceGiven: (weight: number) => `냄 · 무게 ${weight}`,
  /** suitActions / suitDefenceActions: a kind's cost to the treasury and its weight in the hearing. */
  evidenceNote: (money: string | null, weight: number) => money === null ? `무게 ${weight}` : `${money} · 무게 ${weight}`,
  evidenceBring: "내기",
  evidenceLabel: (kind: string, note: string) => `증거 내기: ${kind} · ${note}`,
  patronHeading: "후원자",
  patronChosen: (name: string, support: number) => `${name} · 지지 ${support}`,
  patronNone: "후원해 줄 세력이 없습니다",
  patronRelation: (relation: number) => `관계 ${relation}`,
  patronSeek: "후원 청하기",
  patronLabel: (name: string) => `후원 청하기: ${name}`,
  hearingHeading: "심리",
  /** The lord's claim or suit: the two sides, the verdict now and whether his side can still pass (the user's words). */
  hearing: (plaintiff: number, defence: number, verdict: Verdict, reachable: boolean) =>
    `청구 쪽 ${plaintiff} · 방어 쪽 ${defence}. ${verdict === "plaintiff" ? VERDICT_NOW.plaintiff : judged(verdict, REACHABLE[`${reachable}`])}`,
  /** A house's suit against the lord: its side's reach, or (the house ahead) what his defence row can still do. */
  hearingAgainst: (plaintiff: number, defence: number, verdict: Verdict, reachable: boolean, defenceOpen: boolean) =>
    `청구 쪽(원고) ${plaintiff} · 방어 쪽(영주) ${defence}. ${verdict === "plaintiff"
      ? judged(verdict, defenceOpen ? "증거와 후원으로 방어 쪽을 올리거나 합의할 수 있습니다" : "합의로 끝낼 수 있습니다")
      : judged(verdict, REACHABLE_AGAINST[`${reachable}`])}`,
  verdict: { plaintiff: "판결: 원고가 이겼습니다", defendant: "판결: 원고가 졌습니다" } as const,
  /** Astra lordplay2 ② (the engine's records name both sides): a house's suit against the lord, judged. */
  verdictAgainst: {
    plaintiff: (house: string) => `판결: ${house}${josa(house, "이", "가")} 이겼습니다 — 영주가 권원을 잃었습니다(점유는 따로)`,
    defendant: (house: string) => `판결: ${house}${josa(house, "이", "가")} 졌습니다 — 영주가 지켰습니다`,
  } as const,
  /** DTR-23: a suit ended by a final concord (the engine's sentence when its record is found, with the date). */
  concordEnded: { pay: "합의로 끝났습니다: 영주가 돈을 주고 지켰습니다", yield: "합의로 끝났습니다: 영주가 땅을 내주었습니다" } as const,
  dated: (line: string, date: string) => `${line} · ${date}`,
  /** suitActions.stageCosts: what each stage still ahead takes from the treasury (enforcing: each attempt). */
  stageCosts: (parts: string) => `앞으로 들 비용: ${parts}`,
  stageCost: (stage: string, money: string) => `${stage} ${money}`,
  stageCostEach: (stage: string, money: string) => `${stage} 시도마다 ${money}`,
  enforceHeading: "점유 집행",
  hold: (hold: number) => `점유자가 버티는 힘 ${hold}`,
  patronForce: (support: number) => `후원자의 지지 ${support}`,
  attempts: (count: number) => `집행 ${count}번`,
  enforced: "점유를 넘겨받았습니다",
  /** Astra lordplay2 ②: in a house's suit against the lord the house took it. */
  enforcedBy: (house: string) => `${house}${josa(house, "이", "가")} 점유를 가져갔습니다`,
  enforce: "점유 집행하기",
  enforceLabel: (what: string) => `점유 집행하기: ${what}`,
  neighbourHeading: "영주를 상대로 한 소송",
  noNeighbour: "영주를 상대로 걸린 소송이 없습니다.",
  wholeEstate: "영지 전체",
  pieces: {
    land_rent: "토지 지대", manor_court: "장원 법정", mill: "방앗간 사용료", market: "시장 좌판세", tolls: "통행세", fishery: "어업권",
    advowson: "성직자 추천권", hunting: "사냥권",
  } satisfies Record<RightPieceKind, string>,
  basis: { inheritance: "상속", marriage: "혼인", purchase_deed: "매입 문서", grant: "하사", old_possession: "오래된 점유" } satisfies Record<ClaimBasis, string>,
  estateName: (house: string) => `${house} 영지`,
  homeEstate: "본 영지",
  estatePiece: (estate: string, piece: string) => `${estate} · ${piece}`,
  holders: { lord: "영주", merchants: "상인들", townsfolk: "주민들" } as Readonly<Record<string, string>>,
  houseOf: (name: string) => `${name} 가문`,
  oldKin: "옛 가문의 친족",
  pair: (first: string, second: string) => `${first} · ${second}`,
  date: (year: number, season: string, day: number) => `${year}년 ${season} ${day}일`,
} as const;
