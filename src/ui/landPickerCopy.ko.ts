// LAND-UI (LU-D7): the new-game screen's land picker (the prompt and each land's name and line are SCENARIO_COPY's).
// NAT-4: the map number is a field (1–999,999) with a draw-again button; a number that cannot start says why.
export const LAND_PICKER_COPY = {
  seedLabel: "지도 번호",
  /** The field's accessible name (the visible label is seedLabel beside it). */
  seedField: "지도 번호 (1~999,999)",
  random: "무작위",
  /** Shown under the number, and the mode buttons are off, while the number cannot start a game. */
  problems: {
    range: "지도 번호는 1부터 999,999까지의 수입니다.",
    unbuildable: "이 번호의 지도에는 마을을 세울 자리가 없습니다. 다른 번호를 고르세요.",
  },
} as const;
