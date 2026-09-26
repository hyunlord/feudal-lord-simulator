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
const metricLine = (values: Readonly<Record<string, number>>) => Object.entries(values).map(([key, value]) => (METRICS[key] ?? (v => `${key} ${v}`))(value)).join(" · ");

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
  stats: (stats: ChronicleEntry["stats"]) => [
    `인구 처음 ${stats.populationStart} · 끝 ${stats.populationEnd} · 가장 많을 때 ${stats.peakPopulation}`,
    `집 ${stats.houses}채 · 불탄 집 ${stats.burntHouses} · 떠난 가구 ${stats.departures}`,
    `잃은 수확 밀 ${stats.harvestLost} · 금고 ${pence(stats.treasury)}`,
    ...(stats.famine === null ? [] : [`대기근(${stats.famine.year}) 인구 닥칠 때 ${stats.famine.populationAtArrival} · 끝날 때 ${stats.famine.populationAtEnd}`]),
  ],
  nextChapter: "제2장으로",
  keepPlaying: "계속 (샌드박스)",
  chapterTwoTitle: "제2장 — 예고",
  chapterTwoLine: "기근이 지나간 마을에 새 세대가 자랍니다. 다음 장은 아직 준비 중입니다",
  chapterTwoContinue: "이 마을로 계속",
  famineLoadingTitle: "1315 · 대기근",
  famineLoadingLine: "비가 그치지 않는 여름이 이어집니다",
} as const;
