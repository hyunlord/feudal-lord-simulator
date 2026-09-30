/**
 * UI-10 (spec docs/design/chapter-five-legacy.md LG-7, LG-8, LG-9): the words of the campaign's end — the legacy
 * verdict and its ending, the chronicle book and its text export. The engine's own words (the axes, the legacies, the
 * endings' titles and sentences, the chapters' titles, the book's headings) come from src/content/legacyCopy.ko.ts.
 */
const signed = (value: number) => value > 0 ? `+${value}` : `${value}`;

export const LEGACY_SCREEN_COPY = {
  /** The chapter-5 page's button (in place of "to chapter 6"). */
  toVerdict: "유산 판정으로",
  verdictTitle: "유산 판정 — 1450년 마지막 장날",
  provisional: "아직 캠페인이 끝나지 않았다. 지금의 점수로 본 결말이다.",
  axesHeading: "세 갈래의 점수",
  axesLabel: "도시·가문·교회 점수",
  score: (value: number) => `${value}점`,
  scoreLabel: (name: string, value: number) => `${name} ${value}점 (100점 만점)`,
  lead: "가장 높음",
  leadLine: (name: string) => `가장 높은 축: ${name}`,
  chosenLine: (word: string) => word === "" ? "고른 유산: 없음" : `고른 유산: ${word}`,
  part: (label: string, value: number) => `${label} ${signed(value)}`,
  endingHeading: "결말",
  quotesHeading: "원장에 적힌 기록",
  noQuotes: "인용할 기록이 없다",
  openBook: "연대기 책 펼치기",
  keepPlaying: "계속 (샌드박스)",
  exportText: "글로 내보내기",
  exported: (fileName: string) => `${fileName}로 저장했다`,
  exportFailed: "글을 저장하지 못했다",
  fileName: (house: string, year: number) => `연대기-${house.replace(/[\\/:*?"<>|\s]+/g, "_")}-${year}.txt`,
  /** The ending's emblem (the axis that led: the town's arms, the lord's house's, the bishop's). */
  emblemLabel: (name: string) => `${name}의 문장`,
  /** The scores' parts (legacyScores(state).parts). */
  parts: {
    town: { people: "인구", houses: "4단계 집", cloth: "5장에 판 직물", rights: "도시가 쥔 권리", autonomy: "자치 특허", legacy: "고른 유산" },
    family: { house: "가문 연속", generations: "계보의 세대", heir: "후계자", stayed: "영주관에 남음", relations: "상위 영주·국왕 관계", treasury: "금고", legacy: "고른 유산" },
    church: { church: "교회", chapels: "예배당", bishop: "주교 관계", priest: "역병 때 수도원 사제", relief: "대기근 구휼", rebuilt: "회중석 증축", legacy: "고른 유산" },
  } as Readonly<Record<string, Readonly<Record<string, string>>>>,
  /** A petition's decision in the ledger's words (historyCopy's `decision.petition_response`), for the heir's answer
   *  when the heir seated was a distant kinsman (the ledger's line names the nephew). */
  answered: (subject: string, answer: string) => `${subject}에 답했다: ${answer}`,
  /** Where the ending opens again (the chronicle screen's header). */
  openEnding: "결말 다시 보기",
  /** The chronicle book (LG-9). */
  book: {
    title: "연대기 책",
    open: "연대기 책",
    close: "닫기",
    closeLabel: "연대기 책 닫기",
    prev: "앞 장",
    next: "다음 장",
    prevLabel: "앞 장으로 넘기기",
    nextLabel: "다음 장으로 넘기기",
    pageOf: (page: number, total: number) => `${page} / ${total}쪽`,
    pagesLabel: "책의 쪽",
    finished: "캠페인이 끝났다 — 온전한 연대기",
    soFar: (year: number) => `${year}년까지 — 지금까지의 연대기`,
    contents: "차례",
    years: (from: number, to: number) => `${from}–${to}년`,
    writing: "아직 쓰는 중인 장",
    eventsHeading: "사건",
    decisionsHeading: "결정",
    noEvents: "적힌 사건이 없다",
    noDecisions: "적힌 결정이 없다",
    year: (year: number) => `${year}년`,
    chosen: (label: string) => `고른 답: ${label}`,
    alternatives: (labels: readonly string[]) => labels.length === 0 ? "" : `다른 길: ${labels.join(", ")}`,
    houseYears: (since: number, until: number | null) => until === null ? `${since}년부터` : `${since}–${until}년`,
    life: (birth: number, death: number | null, left: number | null) =>
      death !== null ? `${birth}–${death}` : left !== null ? `${birth}– (${left}년 떠남)` : `${birth}–`,
    parents: (names: readonly string[]) => names.length === 0 ? "" : `부모: ${names.join(", ")}`,
    head: "가장",
    generation: (value: number) => `${value}대`,
    noPeople: "영주관 사람의 기록이 없다",
    relation: (value: number) => `지금 관계 ${signed(value)}`,
    noEntries: "이 도시와 얽힌 기록이 없다",
    noLegacy: "아직 5장의 유산 판정 전이다",
    endingLabel: (id: string) => `결말 ${id}`,
  },
} as const;
