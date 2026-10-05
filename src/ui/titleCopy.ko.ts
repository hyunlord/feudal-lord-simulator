// UI-3 title screen (the welcome), mode choice and the chapter loading screen.
export const TITLE_COPY = {
  heading: "영지에 오신 것을 환영합니다",
  // LR1-D7 (user 2026-10-05): the welcome says nothing a mode would contradict; building is the sandbox's, said after it.
  howTo: "땅을 고르고, 어떻게 다스릴지 고르세요.",
  camera: "마우스 휠로 확대, 드래그로 이동합니다.",
  /** After the sandbox starts (the build guidance the welcome no longer gives). */
  sandboxHint: "오른쪽 아래 [건설]에서 건물을 고르고, 지도를 눌러 지으세요.",
  /** After lord mode starts: the slice's goal (LORD_SLICE_GOAL_YEARS), which the welcome's two lines leave out. */
  lordGoal: (min: number, max: number) => `${min}~${max}년 뒤, 이 도시가 내 결정의 결과인지 봅니다.`,
  chapter: (year: number) => `제1장 · ${year}년 봄`,
  chapterLine: "장이 서는 마을을 세우는 해",
} as const;
