// PLAY-2 (Astra's second lord-mode play, friction 10): the goal drawer's palisade guidance in lord mode — the town finds the
// wall's line and asks its lord to proclaim (TA-11, TA-7); the lord answers its request, and moves the conditions with his
// levers (lordAdvice). Drawing the line himself is said as the exception it is: when the town found no line.

export const LORD_WALL_COPY = {
  asked: "마을이 목책 둘레를 잡아 시장도시 선포를 청했습니다. 마을의 청 칩에서 들어주면 마을이 그 둘레로 짓습니다",
  waiting: (label: string, current: number, target: number) =>
    `목책 둘레는 마을이 잡아 영주에게 청합니다. 선포 조건이 차면 청이 옵니다 — 아직 ${label} ${current}/${target}`,
  searching: "선포 조건이 찼습니다. 마을이 목책 둘레를 잡아 청할 차례입니다",
  notFound: "마을이 지금의 집과 길로는 목책 둘레를 찾지 못했습니다",
  /** Why the lord draws it himself: only when the town found no line (its reason when the recommendation gives one). */
  drawWhy: (reason: string | null) => reason === null ? "이때만 영주가 직접 긋습니다: 목책 긋기" : `이때만 영주가 직접 긋습니다: 목책 긋기 (${reason})`,
} as const;
