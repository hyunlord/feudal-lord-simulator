// UI-6 (FAIL-3 FL-9): the campaign's chapters and their goals, as the goal rail and the chapter screens name them.
export const CHAPTER_COPY = {
  titles: { 1: "제1장 · 촌락에서 시장도시로", 2: "제2장 · 전쟁의 그늘" } as Readonly<Record<number, string>>,
  goals: {
    famine_market_town: "시장도시를 선포하고 대기근을 넘긴다",
    prosperity: "번영하는 시장도시를 이룬다",
    wall_or_market: "전쟁을 넘긴 뒤 석벽을 다 쌓거나 장을 넓힌다",
  } as Readonly<Record<string, string>>,
  card: (chapter: number, reached: number, total: number) => `${CHAPTER_COPY.titles[chapter] ?? `제${chapter}장`} · 목표 ${reached}/${total}`,
  reached: (goal: string) => `${goal} — 이룸`,
  cta: "목표 보기",
} as const;
