import { HOME_PETITION_COPY } from "../lordCardsCopy.ko";
import type { HomePetitionKind } from "../../engine/stewardship.types";
import { factionReasonLine } from "../../content/factionCopy.ko";

// DEC-CARD (result side): "after choosing, I know what changed" — the words of the actual's chip, the year's card
// ("올해 당신의 결정이 바꾼 것") and the house card (Astra A3: a death, a succession, an inheritance before the petitions).
// Words follow docs/design/glossary.md; the ledger's own sentences ("~했다") are quoted as the ledger writes them.

const josa = (word: string, withFinal: string, without: string) => {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  return code >= 0 && code <= 11171 && code % 28 !== 0 ? withFinal : without;
};

/** A big decision's subject, by the engine's decision kind (a petition's by its own subject words). */
export const DECISION_SUBJECTS: Readonly<Record<string, string>> = {
  famine_response: "대기근 대응", petition_response: "청원에 한 답", market_town: "시장도시 선포", stone_town: "석벽 선포",
  rebuild: "불탄 집 다시 짓기", wall_expand: "목책 넓히기", drainage: "배수 공사", estate_policy: "영지 방침",
  project_subsidy: "장려금", market_dues: "시장 부담",
};

/** The home estate's petition answers as the faction records name them (`manor_petition:<kind>:<status>`). */
const MANOR_STATUS: Readonly<Record<string, string>> = { granted: "들어줌", refused: "기각함", lapsed: "답하지 않아 기각으로 침" };

/** DEC-CARD-2: who decided, in the thread's words (only the lord's own answer is "당신의 결정"). */
const BY_WORDS: Readonly<Record<"lord" | "steward" | "lapsed", string>> = { lord: "당신의 결정", steward: "청지기의 처리", lapsed: "답하지 않은 일" };

/** The faction reasons that name an answer the lord gave (P-C2: only those say "이 결정 때문에"). */
const ANSWER_PREFIXES: ReadonlySet<string> = new Set(["petition", "famine", "manor_petition", "registry", "steward_punished"]);
/** An answer's reason that is the lord's silence (an expired political petition, a lapsed home petition). */
const SILENT_STATUSES: ReadonlySet<string> = new Set(["expired", "lapsed"]);

export const RESULTS_COPY = {
  actual: {
    title: "결정의 실제가 적혔습니다",
    /** "<해> <철>의 <답>: 예상 … / 실제 …". */
    line: (date: string, subject: string, answer: string, predicted: string, actual: string) =>
      `${date}의 ${subject}(${answer}): 예상 ${predicted} / 실제 ${actual}`,
    advice: "연대기의 결정 기록에서 예상과 실제를 나란히 볼 수 있습니다. 실제는 결정 두 철 뒤의 마을에서 읽은 값입니다.",
    /** One metric against its forecast ("금고: 예측보다 £1 많음"). */
    fact: (metric: string, delta: string) => `${metric}: ${delta}`,
  },
  /** DEC-CARD-2: "○○년 당신의 결정 때문에" — what followed a decision (the engine's thread, `traceInRange`). Only the
   * lord's own answer says "당신의 결정"; the steward's answer and a silence say what they were (P-C2). */
  trace: {
    title: (year: number, by: "lord" | "steward" | "lapsed") => `${year}년 ${BY_WORDS[by]} 때문에`,
    /** The chip's title: which decision ("1300년 당신의 결정 때문에: 시장 부담"), so two of one year read apart. */
    chipTitle: (year: number, by: "lord" | "steward" | "lapsed", subject: string) => `${year}년 ${BY_WORDS[by]} 때문에: ${subject}`,
    /** The record's line after the decision behind it ("1300년 당신의 결정 때문에 — …"); `part`: one cause among others. */
    because: (year: number, by: "lord" | "steward" | "lapsed", part: boolean) => part ? `${year}년 ${BY_WORDS[by]}도 한몫해` : `${year}년 ${BY_WORDS[by]} 때문에`,
    prefixed: (because: string, sentence: string) => `${because} — ${sentence}`,
    part: (sentence: string) => `${sentence} (여러 까닭 가운데 하나)`,
    /** What the decision was about and its answer ("장원 청원 '공동 목초지': 들어준다"). */
    about: (subject: string, answer: string | null) => answer === null || answer === "" ? subject : `${subject}: ${answer}`,
    /** The steward's answer or a silence: the subject and the engine's own sentence ("… — 청지기가 관습대로 처리했다 (들어줌)"). */
    aboutBy: (subject: string, sentence: string, answer: string | null) => `${subject} — ${sentence}${answer === null ? "" : ` (${answer})`}`,
    dated: (date: string, line: string) => `${date} — ${line}`,
    manor: (title: string) => `장원 청원 '${title}'`,
    estate: (title: string) => `영지 청원 '${title}'`,
    answers: { granted: "들어준다", refused: "물리친다", lapsed: "답하지 않았다" } as Readonly<Record<string, string>>,
    stewardAnswers: { granted: "들어줌", refused: "물리침" } as Readonly<Record<string, string>>,
    feeling: (faction: string, feels: string) => `${faction}: ${feels}`,
    advice: "연대기에서 그 결정과, 그 뒤에 일어난 일을 모두 볼 수 있습니다. 여러 까닭 가운데 하나였던 일은 그렇게 적혀 있습니다.",
    openLabel: (title: string) => `${title} — 연대기에서 그 결정 보기`,
  },
  year: {
    title: (year: number) => `${year}년 — 올해 당신의 결정이 바꾼 것`,
    /** DEC-CARD-2 (lord mode, the engine's yearReview). */
    house: "가문의 일",
    lordDecisions: "영주가 정한 일",
    stewardDecisions: "청지기가 처리한 일",
    threads: "결정 뒤에 일어난 일",
    community: "공동체가 대신 지은 것",
    stewardMinds: "청지기의 처리 때문에 — 세력의 마음",
    decisions: "큰 결정과 그 결과",
    answers: "영주가 답한 일",
    relations: "세력의 마음",
    receipts: "결정이 고른 까닭 중 하나였던 공사",
    town: "올해 마을",
    noDecision: "올해는 영주가 내린 큰 결정이 없었습니다.",
    nothing: "올해는 달라진 것이 없었습니다.",
    outcome: (predicted: string, actual: string) => `예상 ${predicted} / 실제 ${actual}`,
    dated: (date: string, sentence: string) => `${date} — ${sentence}`,
    times: (line: string, count: number) => count > 1 ? `${line} (${count}건)` : line,
    more: (count: number) => `그 밖에 ${count}건 더 — 연대기에 모두 있습니다`,
    receipt: (decision: string, count: number, first: string) =>
      count > 1 ? `${decision} — 공사 ${count}건(${first} 외)` : `${decision} — ${first}`,
    population: (delta: number) => delta === 0 ? "인구는 한 해 동안 그대로였습니다." : `인구가 한 해 동안 ${Math.abs(delta)}명 ${delta > 0 ? "늘었습니다" : "줄었습니다"}.`,
    money: (income: string, expense: string) => `한 해 금고의 수입 ${income} · 지출 ${expense}`,
    continue: "계속",
    chronicle: "연대기에서 보기",
  },
  house: {
    from: "가문의 일",
    titles: {
      house_changed: "영주 가문이 바뀌었습니다",
      lord_died: "영주가 세상을 떠났습니다",
      heir_seated: "후계자가 가문을 이었습니다",
      inherited: "영지를 물려받았습니다",
      wardship_begun: "어린 영주의 후견이 시작되었습니다",
      wardship_ended: "어린 영주의 후견이 끝났습니다",
    },
    happened: "무슨 일인가",
    heir: "이제 가문을 이끄는 이",
    rights: "바뀐 권리와 영지",
    promises: "따라온 약속",
    next: "다음에 할 일",
    lordNow: (name: string, age: number) => `${name}(${age}세)`,
    guardian: (name: string) => `후견인 ${name}`,
    guardianOverlord: "상위 영주가 후견합니다",
    noLord: "장원을 이끌 사람이 아직 정해지지 않았습니다.",
    noRights: "이 일로 장부에 적힌 권리·영지의 변화는 없습니다.",
    toEstate: "영지 화면에서 보기",
    toPerson: (name: string) => `${name}의 인물 카드 보기`,
    continue: "계속",
    openLabel: "가문의 일 보기",
    advice: "가문의 일은 다른 청원보다 먼저 옵니다. 카드에서 누가 가문을 잇는지, 무엇이 바뀌었는지 볼 수 있습니다.",
  },
} as const;

/** The reason prefixes in words (the year card's relation groups). */
const PREFIX_NAMES: Readonly<Record<string, string>> = {
  petition: "청원", famine: "대기근", manor_petition: "장원 청원", registry: "등록부의 일", steward_punished: "청지기 감사",
  promise_broken: "어긴 약속", decline: "쇠퇴", restored: "권리 복원", house_change: "가문 교체", raid: "습격", reorg: "도시의 변화", legacy: "나라의 일",
};

/** A relation group's heading by its reason's prefix: only an answer the lord gave says "이 결정 때문에" (P-C2); his
 * silence, a broken promise and every other cause say what they are. */
export function relationHeading(prefix: string, silent: boolean): string {
  const name = PREFIX_NAMES[prefix] ?? "그 밖의 일";
  if (ANSWER_PREFIXES.has(prefix)) return silent ? `답하지 않아서 — ${name}` : `이 결정 때문에 — ${name}`;
  return prefix === "promise_broken" ? `약속을 어겨서 — ${name}` : `다른 까닭으로 — ${name}`;
}

/** A relation line: what moved them and how they take it. */
export const relationLine = (reason: string, faction: string, feels: string) => `${reason} — ${faction}: ${feels}`;

/** Whether the reason names an answer the lord gave (not his silence) — P-C2. */
export function reasonNamesAnswer(reason: string): boolean {
  const [prefix, , status] = reason.split(":");
  return ANSWER_PREFIXES.has(prefix ?? "") && !SILENT_STATUSES.has(status ?? "");
}

/** Whether the reason is the lord's silence on an answer the engine waited for. */
export function reasonIsSilence(reason: string): boolean {
  const [prefix, , status] = reason.split(":");
  return ANSWER_PREFIXES.has(prefix ?? "") && SILENT_STATUSES.has(status ?? "");
}

/** What moved a faction, in words (the home petitions' and the registry's reasons the faction copy has no words for). */
export function reasonWords(reason: string): string {
  const [prefix, a, b] = reason.split(":");
  if (prefix === "manor_petition") {
    const title = HOME_PETITION_COPY[a as HomePetitionKind]?.title ?? a ?? "";
    return `장원 청원 '${title}'${josa(title, "을", "를")} ${MANOR_STATUS[b ?? ""] ?? b}`;
  }
  if (prefix === "registry") return "등록부의 일에 영주가 고른 답";
  return factionReasonLine(reason);
}
