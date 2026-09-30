import { CHAPTER_FIVE, CHAPTER_FOUR, CHAPTER_THREE } from "../content/chapterConfig";
import { SCENARIO_COPY } from "../content/scenario/scenarioCopy.ko";
import type { ChronicleEntry } from "../engine/politics.types";
import { pence } from "./hud/hudCopy.ko";

// UI-4 chronicle page and chapter screens (the ledger's sentences come from src/content/historyCopy.ko.ts).
const DECISION_KINDS: Readonly<Record<string, string>> = {
  famine_response: "대기근 대응", petition_response: "상인 청원", market_town: "시장도시 선포", stone_town: "석벽 선포", rebuild: "재건",
};
const METRICS: Readonly<Record<string, (value: number) => string>> = {
  population: value => `인구 ${value}`, treasury: value => `금고 ${pence(value)}`, merchantGauge: value => `상인 게이지 ${value}`, lots: value => `필지 ${value}`,
};
/** UI-10: a chapter opening's years — " · 1342–1364", " · 1364" when it began at or past its planned end, "" unknown. */
const chapterSpan = (from: number | null, to: number) => from === null ? "" : from >= to ? ` · ${from}` : ` · ${from}–${to}`;
const metricLine = (values: Readonly<Record<string, number>>) => Object.entries(values).map(([key, value]) => (METRICS[key] ?? (v => `${key} ${v}`))(value)).join(" · ");

const WALL_OUTCOME: Readonly<Record<string, string>> = { stone_wall: "석벽 완공", market: "시장을 넓힘", unfinished: "석벽 미완" };
// UI-8 (F3-A PL-10): chapter 3 plague outcomes.
const PLAGUE_OUTCOME: Readonly<Record<string, string>> = { resettled: "재정착 완료", calendar: "세월로 마감" };
// UI-9 (F4-A RG-9/RG-10): chapter 4 charter outcomes.
const CHARTER_OUTCOME: Readonly<Record<string, string>> = { partial: "부분 허용", refused: "거부", calendar: "세월로 마감" };

export const CHRONICLE_COPY = {
  label: "연대기",
  title: (chapter: number, from: number, to: number) => `제${chapter}장 연대기 · ${from}–${to}`,
  date: (year: number, season: 0 | 1 | 2 | 3) => `${year}년 ${SCENARIO_COPY.seasons[season]}`,
  timelineHeading: "이 장에 일어난 일",
  decisionsHeading: "영주의 결정",
  statsHeading: "숫자로 본 장",
  decision: (date: string, kind: string, chosen: string) => `${date} · ${DECISION_KINDS[kind] ?? kind}: ${chosen}`,
  alternatives: (labels: readonly string[]) => labels.length === 0 ? "" : `다른 길: ${labels.join(", ")}`,
  outcome: (predicted: Readonly<Record<string, number>>, actual: Readonly<Record<string, number>> | null) =>
    actual === null ? `예측 ${metricLine(predicted)}` : `예측 ${metricLine(predicted)} / 실제 ${metricLine(actual)}`,
  stats: (stats: ChronicleEntry["stats"], chapter = 1) => [
    `인구 처음 ${stats.populationStart} · 끝 ${stats.populationEnd} · 가장 많을 때 ${stats.peakPopulation}`,
    `집 ${stats.houses}채 · 불탄 집 ${stats.burntHouses} · 떠난 가구 ${stats.departures}`,
    `잃은 수확 밀 ${stats.harvestLost} · 금고 ${pence(stats.treasury)}`,
    ...(stats.famine === null || chapter !== 1 ? [] : [`대기근(${stats.famine.year}) 인구 닥칠 때 ${stats.famine.populationAtArrival} · 끝날 때 ${stats.famine.populationAtEnd}`]),
    // UI-6 (F2-A WR-9): chapter 2's war.
    ...(stats.war === undefined ? [] : [
      stats.war.raidYear === null || stats.war.raidLosses === null ? "해안 습격 없음" : `해안 습격(${stats.war.raidYear}) 불탄 집 ${stats.war.raidLosses.burntHouses} · 빼앗긴 돈 ${pence(stats.war.raidLosses.coin)} · 성벽 방어 ${Math.round((stats.war.defencePermille ?? 0) / 10)} %`,
      `징집 ${stats.war.men}명 · 돌아오지 못한 사람 ${stats.war.lostMen}명 · ${WALL_OUTCOME[stats.war.wall]}`]),
    // UI-8 (F3-A PL-10): chapter 3's plague.
    ...(stats.plague === undefined ? [] : [
      `역병 도래(${stats.plague.arrivalYear}) 당시 인구 ${stats.plague.populationAtArrival}명`,
      `역병 사망 ${stats.plague.dead}명 · 영주 가솔 ${stats.plague.manorDead}명 · 두 번째 역병 ${stats.plague.secondDead}명`,
      `재정착 ${stats.plague.resettled}가구 · 달아난 가구 ${stats.plague.fled}가구 · ${PLAGUE_OUTCOME[stats.plague.outcome] ?? stats.plague.outcome}`,
    ]),
    // UI-9 (F4-A RG-10): chapter 4's reorganisation.
    ...(stats.reorganisation === undefined ? [] : [
      `재편 시작 ${stats.reorganisation.startYear}년 · 임금 이탈 가구 ${stats.reorganisation.wageLeavers}가구 · 직조공 이탈 ${stats.reorganisation.weaverLeavers}가구`,
      `팔린 직물 ${stats.reorganisation.clothSold}필 · 직물 수입 ${pence(stats.reorganisation.clothIncome)} · 길드 ${stats.reorganisation.guild ? "있음" : "없음"}`,
      `인두세 ${pence(stats.reorganisation.pollTax)} · 반란 소문 ${stats.reorganisation.rebellion === "chased" ? "징수원 쫓음" : stats.reorganisation.rebellion === "quiet" ? "조용히 지남" : "없음"} · 특허 ${CHARTER_OUTCOME[stats.reorganisation.charter] ?? stats.reorganisation.charter}`,
      `도시 세력 ${stats.reorganisation.townInfluence} · 상인 세력 ${stats.reorganisation.merchantInfluence}`,
    ]),
  ],
  nextChapter: "제2장으로",
  nextChapterOf: (chapter: number) => `제${chapter + 1}장으로`,
  // UI-6 (FAIL-3 FL-8): chapter 2 is played in the same town; its opening screen (Wave 16 chapter2_intro) lists its goals.
  chapterTwoStartTitle: "제2장 · 전쟁의 그늘 · 1318–1347",
  chapterTwoStartLine: "기근이 지나간 도시에 새 세대가 자랐습니다. 이제 왕의 전쟁이 돈과 사람을 청구합니다",
  chapterTwoGoalsHeading: "이 장의 목표",
  chapterTwoStart: "제2장 시작",
  // PLAGUE-b: a later chapter built in the game opens as chapter 2 does, over its Wave 31 opening painting.
  // UI-10: the opening names the year the chapter began (the engine's record, `chapterStartYear`) to its planned end
  // (QA round 2: chapter 3 opened in 1342 under "1348–1364"); only the start when it is not before the end.
  chapterOpening: {
    3: { title: (from: number | null) => `제3장 · 흑사병의 그늘${chapterSpan(from, CHAPTER_THREE.toYear)}`, line: "항구에서 열병 소문이 올라옵니다. 역병이 지나가면 일손이 모자라고, 남은 이들이 값을 부릅니다", start: "제3장 시작" },
    // UI-9 (F4-A): chapter 4, the reorganisation.
    4: { title: (from: number | null) => `제4장 · 재편${chapterSpan(from, CHAPTER_FOUR.toYear)}`, line: "역병이 지나간 도시가 부유해졌습니다. 이제 도시는 영주에게 권리를 요구합니다", start: "제4장 시작" },
    // UI-9b: chapter 5 (F5-A), autonomy and legacy, over its Wave 31 painting.
    5: { title: (from: number | null) => `제5장 · 자치와 유산${chapterSpan(from, CHAPTER_FIVE.toYear)}`, line: "도시가 제 시장과 인장을 원합니다. 늙은 영주는 무엇을 남길지 정해야 합니다", start: "제5장 시작" },
  } as Readonly<Record<number, { readonly title: (from: number | null) => string; readonly line: string; readonly start: string }>>,
  laterTitle: (chapter: number) => `제${chapter}장 — 예고`,
  laterLine: "다음 장은 아직 준비 중입니다",
  keepPlaying: "계속 (샌드박스)",
  openFull: "전체 연대기 보기",
  chapterTwoTitle: "제2장 — 예고",
  chapterTwoLine: "기근이 지나간 마을에 새 세대가 자랍니다. 다음 장은 아직 준비 중입니다",
  chapterTwoContinue: "이 마을로 계속",
  famineLoadingTitle: "1315 · 대기근",
  famineLoadingLine: "비가 그치지 않는 여름이 이어집니다",
} as const;
