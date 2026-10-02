import type { StageId } from "./types";

/** Player-facing scenario, stage, era and calendar text (Korean). */
export const SCENARIO_COPY = {
  scenarios: {
    campaign_market_town: "시장도시 목표",
    sandbox: "샌드박스",
    // LM-E8 (LS-1): the lord's vertical slice.
    lord_slice: "영주의 스무 해",
  },
  modeButtons: {
    campaign_market_town: "목표형으로 시작",
    sandbox: "샌드박스로 시작",
  },
  modePrompt: "새 게임 방식을 고르세요",
  /** ARCH-1 (MA-6): the lands the start screen offers (render's picker). */
  archetypePrompt: "어떤 땅에서 시작할지 고르세요",
  archetypes: {
    open_field: { name: "강가 시장도시", description: "강 하나와 풀밭. 경작·목축·목재가 고르고, 강어귀라 1337년의 습격이 닿습니다." },
    coastal_port: { name: "해안 항구", description: "모래·자갈 해변과 염습지. 습격과 항구 열병이 가장 셉니다. 나무가 적습니다." },
    chalk_downs: { name: "백악 언덕 목양", description: "짧은 풀과 흰 백악, 마른 돌담. 양은 잘 되고 밭은 덜 됩니다. 물이 귀합니다." },
    forest_edge: { name: "숲 가장자리 개척", description: "낙엽과 쓰러진 나무. 목재가 빨리 나고, 밭은 숲을 베어 얻습니다." },
    fen_drainage: { name: "습지 간척", description: "갈대와 웅덩이. 마른 땅은 가장 기름지지만 젖은 여름엔 물이 찹니다." },
  },
  stages: {
    village: "촌락",
    market_town: "시장도시",
    fortified_town: "요새 도시",
  } satisfies Record<StageId, string>,
  unlockedAfter: (stage: string) => `${stage} 이후`,
  eras: {
    saturation: "포화",
    famine: "기근과 취약",
    war: "전쟁 동원",
    collapse: "역병 뒤의 일손 부족",
    specialisation: "재편과 전문화",
  },
  seasons: ["봄", "여름", "가을", "겨울"] as const,
  calendarLabel: (year: number, season: string) => `${year}년 ${season}`,
  calendarAria: "달력 · 연도와 계절",
  eraLabel: (name: string) => `시대: ${name}`,
  objectives: {
    selfSufficient: { title: "자립 마을", description: "인구 20명과 입주 가구 90%의 물·빵 공급을 600틱 연속 유지하세요." },
    palisade: { title: "목책 마을", description: "인구 60명, 목책 시대 선포와 성벽 전체 완공이 필요합니다." },
    prosperity: { title: "번영하는 시장도시", description: "인구 140명, 입주한 L4 주거 4필지와 90% 물·빵 공급을 1,200틱 유지하세요. 석벽은 선택입니다." },
  },
  sandboxGoal: "샌드박스 · 승리와 실패 없이 자유롭게 건설합니다",
  victoryTitle: (title: string) => `${title} 달성`,
  allGoalsDone: "모든 목표를 달성했습니다. 계속 도시를 확장할 수 있습니다.",
  milestonesDone: (done: number, total: number) => `달성 ${done}/${total}`,
  proclaimAndBuildWall: "도시 발전 조건에서 시대를 선포하고 성벽 공사를 마치세요.",
  stoneReserve: (stone: number) => `석벽 프로젝트에 필요한 석재 ${stone}개는 시장에서 팔지 않고 비축합니다.`,
  stoneWallBonus: "보너스: 석벽 완공",
  stoneWallClosed: "이 시나리오에서는 석벽 프로젝트가 없습니다",
} as const;
