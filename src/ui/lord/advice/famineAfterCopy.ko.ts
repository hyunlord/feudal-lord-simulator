// PLAY-2 (Astra's second lord-mode play): the famine's card once the lord has answered it — the weak points the town
// still meets the famine with (the engine's `preparedness`) and the next condition the lord can set. SUIT-THREAD: the
// weak points' words are the chronicle's own for a crisis's arrival (the engine's WEAK_POINTS, historyCopy.ko.ts), with
// the engine's numbers beside them.

export const FAMINE_AFTER_COPY = {
  /** The weak points left, joined. */
  left: (points: string) => `남은 병목: ${points}`,
  /** Nothing left: what the engine checked, with its numbers (not "all is well": the famine may still cost people). */
  none: (granaries: number, markets: number, days: number | null) =>
    `남은 병목이 없습니다 — 곡창 ${granaries}곳 · 장터 ${markets}곳${days === null ? "" : ` · 식량 ${days}일치`}`,
  /** The famine's own: the poorest households the price shuts out (the famine card's situation, after the answer). */
  priceShut: (count: number) => `빵 값 때문에 빵을 살 수 없는 집 ${count}곳`,
  /** A weak point's words with the engine's number: the days the stores feed the town, the households already short. */
  withDays: (point: string, days: number) => `${point}(${days}일치)`,
  withCount: (point: string, count: number) => `${point} ${count}곳`,
  joiner: " · ",
  /** The lord's first lever for the first weak point that has one. */
  next: (lever: string) => `다음에 바꿀 조건 — ${lever}`,
} as const;
