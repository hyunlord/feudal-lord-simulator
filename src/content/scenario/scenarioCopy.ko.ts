import type { StageId } from "./types";

/** Player-facing scenario, stage, era and calendar text (Korean). */
export const SCENARIO_COPY = {
  scenarios: {
    campaign_market_town: "시장도시 목표",
    sandbox: "샌드박스",
  },
  modeButtons: {
    campaign_market_town: "목표형으로 시작",
    sandbox: "샌드박스로 시작",
  },
  modePrompt: "새 게임 방식을 고르세요",
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
    collapse: "인구 붕괴와 노동 반전",
    specialisation: "재편과 전문화",
  },
  seasons: ["봄", "여름", "가을", "겨울"] as const,
  calendarLabel: (year: number, season: string) => `${year}년 ${season}`,
  eraLabel: (name: string) => `시대: ${name}`,
  objectives: {
    selfSufficient: { title: "자립 마을", description: "인구 20명과 입주 가구 90%의 물·빵 공급을 600틱 연속 유지하세요." },
    palisade: { title: "목책 마을", description: "인구 60명, 목책 시대 선포와 성벽 전체 완공이 필요합니다." },
    prosperity: { title: "번영하는 시장도시", description: "인구 140명, 입주한 L4 주거 4필지와 90% 물·빵 공급을 1,200틱 유지하세요. 석벽은 선택입니다." },
  },
  sandboxGoal: "샌드박스 · 승리와 실패 없이 자유롭게 건설합니다",
  stoneWallBonus: "보너스: 석벽 완공",
  stoneWallClosed: "이 시나리오에서는 석벽 프로젝트가 없습니다",
} as const;
