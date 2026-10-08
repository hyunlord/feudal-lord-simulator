// PLAY-2 (Astra's second lord-mode play): the famine's card once the lord has answered it — the weak points the town
// still meets the famine with (the engine's `preparedness`) and the next condition the lord can set. The weak points'
// words are the chronicle's own for a crisis's arrival (historyCopy.ko.ts WEAK_POINTS, not exported yet: the engine
// request in docs/requests/engine-play2-reads.md), with the engine's numbers beside them.
import type { Preparedness } from "../../../engine/crisisReads";

type WeakPoint = Preparedness["weakPoints"][number];

export const FAMINE_AFTER_COPY = {
  /** The weak points left, joined. */
  left: (points: string) => `남은 병목: ${points}`,
  /** Nothing left: what the engine checked, with its numbers (not "all is well": the famine may still cost people). */
  none: (granaries: number, markets: number, days: number | null) =>
    `남은 병목이 없습니다 — 곡창 ${granaries}곳 · 장터 ${markets}곳${days === null ? "" : ` · 식량 ${days}일치`}`,
  /** The famine's own: the poorest households the price shuts out (the famine card's situation, after the answer). */
  priceShut: (count: number) => `빵 값 때문에 빵을 살 수 없는 집 ${count}곳`,
  points: {
    no_granary: () => "곡창 없음",
    food_under_a_season: (days: number | null) => days === null ? "식량이 한 철도 안 됨" : `식량이 한 철도 안 됨(${days}일치)`,
    households_short: (count: number) => `이미 굶는 집 ${count}곳`,
    no_market: () => "곡식을 살 장터 없음",
  } satisfies Record<WeakPoint, (...args: never[]) => string>,
  joiner: " · ",
  /** The lord's first lever for the first weak point that has one. */
  next: (lever: string) => `다음에 바꿀 조건 — ${lever}`,
} as const;
