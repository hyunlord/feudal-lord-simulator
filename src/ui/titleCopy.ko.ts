// UI-3 title screen (the welcome), mode choice and the chapter loading screen.
export const TITLE_COPY = {
  heading: "영지에 오신 것을 환영합니다",
  howTo: "오른쪽 아래 [건설]에서 건물을 고르고, 지도를 눌러 지으세요.",
  camera: "마우스 휠로 확대, 드래그로 이동합니다.",
  dismiss: "(아무 곳이나 클릭하여 시작)",
  chapter: (year: number) => `제1장 · ${year}년 봄`,
  chapterLine: "장이 서는 마을을 세우는 해",
} as const;
