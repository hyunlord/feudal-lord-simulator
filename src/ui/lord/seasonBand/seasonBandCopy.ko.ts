import { moneyShort } from "../../money.ko";

// LS1-2 (lord-screen-v1.md): the season-turn band's words — what changed in the town in the season that closed, in words
// and numbers (no arrows or signs but the number's own, UI3-1), at most five, in the design's order.
export const SEASON_BAND_COPY = {
  region: "이번 철의 마을",
  /** The band's name: the season it sums up and that a press opens its card. */
  label: (year: number, season: string) => `${year}년 ${season}에 마을이 바뀐 것 — 누르면 그 철의 결산 카드`,
  population: (delta: number) => `인구 ${signed(delta)}`,
  built: (houses: number, buildings: number) => [houses > 0 ? `새 집 ${houses}` : null, buildings > 0 ? `새 건물 ${buildings}` : null].filter(part => part !== null).join(" · "),
  levels: (count: number) => `집 단계 오름 ${count}`,
  fields: (delta: number) => `밭 ${signed(delta)}`,
  money: (pennies: number) => `금고 ${pennies > 0 ? "+" : ""}${moneyShort(pennies)}`,
  deaths: (count: number) => `사망 ${count}`,
  /** v1.1 b: a heavy season's deaths with their main cause (the engine's `person.died` cause). */
  deathsWithCause: (count: number, cause: string) => `사망 ${count} — ${cause}`,
  causes: { fire: "불", plague: "역병", famine: "굶주림", famine_year: "기근 해의 병", captivity: "유폐", age: "노환" },
  steward: (count: number) => `청지기가 작은 일 ${count}건 처리`,
  quiet: "조용한 철 — 마을은 그대로입니다",
} as const;

function signed(value: number): string {
  return value > 0 ? `+${value}` : `−${-value}`;
}
