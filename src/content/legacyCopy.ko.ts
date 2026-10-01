/**
 * F5-A chapter 5's words (spec docs/design/chapter-five-legacy.md LG-3, LG-7, LG-9): the heirs' relations, the three
 * legacies, the six endings' sentences, the chapters' titles and the chronicle book's export lines.
 */
import { moneyWords } from "../ledger/moneyWords.ko";
import { GENTRY_NAMES_KO } from "./gentryNames";

type P = Readonly<Record<string, number | string>>;
const n = (params: P, key: string): number => Number(params[key] ?? 0);
const s = (params: P, key: string): string => String(params[key] ?? "");
const house = (params: P) => GENTRY_NAMES_KO[s(params, "house")] ?? s(params, "house");
/** The particle after a word: the first form after a final consonant (받침), the second after a vowel. */
function josa(word: string, withFinal: string, withoutFinal: string): string {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  return code >= 0 && code <= 11171 && code % 28 !== 0 ? withFinal : withoutFinal;
}
const subject = (word: string) => `${word}${josa(word, "이", "가")}`;

/** LG-3: the heir's relation to the old lord. */
export const HEIR_RELATION_COPY: Readonly<Record<string, string>> = {
  son: "맏아들", daughter: "딸", husband: "딸의 남편", nephew: "조카", kinsman: "먼 친척",
};
/** LG-3: the heir's kind (the card's answer). */
export const HEIR_KIND_COPY: Readonly<Record<string, string>> = {
  eldest_son: "맏아들", daughter_husband: "딸의 남편", nephew: "조카",
};

/** LG-5 / LG-7: the three legacies (the axes). */
export const LEGACY_AXIS_COPY: Readonly<Record<string, { readonly name: string; readonly legacy: string }>> = {
  town: { name: "도시", legacy: "길드홀과 시청" },
  family: { name: "가문", legacy: "영주관·문장·혈통 기록" },
  church: { name: "교회", legacy: "교회 증축과 기도처" },
};

/** LG-7: the six endings — a title and a sentence quoting the ledger (the years, the names). */
export const LEGACY_ENDING_COPY: Readonly<Record<string, { readonly title: string; readonly sentence: (params: P) => string }>> = {
  free_borough: {
    title: "스스로 다스리는 도시",
    sentence: params => n(params, "charterYear") > 0
      ? `${n(params, "charterYear")}년 자치 특허에 도시 인장이 찍혔고, ${subject(s(params, "mayor") === "" ? "도시가 뽑은 시장" : s(params, "mayor"))} 첫 시장이 되었다. 1450년 마지막 장날, 도시는 제 법정과 제 인장으로 스스로를 다스렸고, 길드홀에 그 이름을 새겼다.`
      : `특허는 끝내 찍히지 않았지만 도시는 가문보다 커졌다. 1450년 마지막 장날, 길드홀과 시청이 도시의 이름을 남겼다.`,
  },
  house_remembered: {
    title: "이름이 남은 가문",
    sentence: params => `도시는 가문보다 커졌지만, ${house(params)} 가문은 ${s(params, "heir") === "" ? "그 혈통" : `${s(params, "heir")}에게 이어진 혈통`}을 기록에 남겼다. 1450년 마지막 장날, 사람들은 영주관의 문장을 보고 ${n(params, "since")}년부터의 가문을 기억했다.`,
  },
  merchants_chantry: {
    title: "상인들의 기도처",
    sentence: params => `상인과 직인의 도시가 된 이곳에서 영주는 교회에 ${s(params, "legacy") === "church" ? "기도처를 세웠다" : "아무것도 남기지 않았다"}. 1450년 마지막 장날, 장터의 종은 ${house(params)} 가문의 이름으로 울렸다.`,
  },
  house_seat: {
    title: "가문의 도시",
    sentence: params => `${house(params)} 가문은 ${n(params, "generations")}대에 걸쳐 영주관을 지켰고, ${subject(s(params, "heir") === "" ? "후계자" : s(params, "heir"))} 그 문장을 이었다. 1450년 마지막 장날, 도시는 여전히 가문의 도시였다.`,
  },
  lords_town: {
    title: "영주의 도시",
    sentence: params => `특허 없이 가문이 다스린 도시였다. ${house(params)} 가문은 영주관에 남았고, 1450년 마지막 장날 장터의 세는 여전히 영주의 금고로 갔다.`,
  },
  pilgrim_town: {
    title: "기도의 도시",
    sentence: params => `종탑과 기도처가 도시의 얼굴이 되었다. 1450년 마지막 장날, 순례자들은 ${house(params)} 가문이 세운 제단 앞에 섰다.`,
  },
};

/** LG-9: the five chapters' titles. */
export const CHAPTER_TITLES: Readonly<Record<number, string>> = {
  1: "촌락에서 시장도시로", 2: "전쟁의 그늘", 3: "흑사병", 4: "재편", 5: "자치와 유산",
};

/** LG-9: a chapter's one-line summary from its page's numbers. */
export function chapterSummaryLine(params: P): string {
  return `${n(params, "fromYear")}–${n(params, "toYear")}년 · 인구 ${n(params, "populationStart")}에서 ${n(params, "populationEnd")}로 · 금고 ${moneyWords(n(params, "treasury"))}`;
}

/** LG-9: the chronicle book's export text (Korean), line by line. */
export const CHRONICLE_TEXT = {
  title: (params: P) => `${house(params)} 가문과 도시의 연대기, ${n(params, "fromYear")}–${n(params, "toYear")}`,
  chapter: (params: P) => `제${n(params, "chapter")}장 ${CHAPTER_TITLES[n(params, "chapter")] ?? ""}`,
  event: (params: P) => `· ${n(params, "year")}년 ${s(params, "text")}`,
  decision: (params: P) => `· ${n(params, "year")}년 결정: ${s(params, "text")}`,
  family: "가문 계보",
  houseLine: (params: P) => `${house(params)} 가문 ${n(params, "since")}년${n(params, "until") > 0 ? `–${n(params, "until")}년` : "부터"}`,
  headLine: (params: P) => `· ${s(params, "name")} (${n(params, "birthYear")}${n(params, "deathYear") > 0 ? `–${n(params, "deathYear")}` : ""}) ${n(params, "generation")}대`,
  factions: "세력 연대",
  factionLine: (params: P) => `${s(params, "name")} — 지금 관계 ${n(params, "relation")}`,
  legacy: "유산",
  scores: (params: P) => `도시 ${n(params, "town")} · 가문 ${n(params, "family")} · 교회 ${n(params, "church")}`,
  ending: (params: P) => `결말: ${s(params, "title")}`,
} as const;
