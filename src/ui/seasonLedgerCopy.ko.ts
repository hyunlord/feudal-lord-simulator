import { SCENARIO_COPY } from "../content/scenario/scenarioCopy.ko";
import type { NextObjectiveHint } from "../engine/season.types";
import { manCount, moneyDelta } from "./money.ko";
import type { SeasonSceneId } from "./seasonLedgerScenes";

// UI-3 season ledger card (FP-1): one closed season on the Wave 8 scroll. Signed numbers, no arrows or symbols.
// INSTALL-3b: a change of nothing reads "±0", so it is never taken for a count ("인구 0" read as an empty town).
const signed = (value: number): string => value > 0 ? `+${value}` : value < 0 ? `−${-value}` : "±0";

/** UIAUDIT-R15-D1: a scene box's count (about four characters fit beside its icon): over 9,999 in 만 — "+20만". A number
 * form like money.ko.ts's, outside the copy object (the dev server's pseudo-long copy lengthens words, not figures). */
export const sceneBoxCount = (value: number): string => value > 0 ? `+${manCount(value)}` : value < 0 ? `−${manCount(value)}` : "±0";

export const SEASON_LEDGER_COPY = {
  label: "계절 결산",
  title: (year: number, season: 0 | 1 | 2 | 3) => `${year}년 ${SCENARIO_COPY.seasons[season]} 결산`,
  signed,
  money: (income: number, expense: number) => `수입 ${moneyDelta(income)} · 지출 ${moneyDelta(-expense)} · 남음 ${moneyDelta(income - expense)}`,
  /** UI-AUDIT-1: a change of money with its sign, in English money ("+£1 3s", "−7d"). */
  moneyDelta,

  /** INSTALL-3b: the head count at the season's close, then its change (and the season before's, when there is one). */
  population: (count: number, delta: number, before: number | null) =>
    before === null ? `인구 ${count}명 (이번 계절 ${signed(delta)})` : `인구 ${count}명 (이번 계절 ${signed(delta)} · 지난 계절 ${signed(before)})`,
  stock: (name: string, delta: number) => `${name} ${signed(delta)}`,
  /** INSTALL-3: the ale chain's goods held in the town as the card opens (not the season's change). */
  heldNow: (items: readonly string[]) => `지금 영지에: ${items.join(" · ")}`,
  heldNowLabel: "지금 영지에",
  held: (name: string, amount: number) => `${name} ${amount}`,
  // UI-4b: the Wave 19 scene names (records/metadata-scenes-*.json), shown under the title and read for each icon.
  scene: {
    population_up: "인구 늘음", population_down: "인구 줄음", household_arrival: "가구 입주", household_departure: "가구 이탈",
    house_hungry: "굶은 집", house_fed: "다시 먹음", bread_shortage: "빵 부족", bread_reserve: "비축 충분",
    timber_shortage: "목재 부족", stone_shortage: "석재 부족", complete_house: "주택 완공", complete_facility: "시설 완공",
    complete_defense: "방어 완공", complete_public: "공공 완공", construction_blocked: "공사 막힘", fire: "화재",
    poor_harvest: "흉년", great_famine: "대기근", petition: "청원", charter: "특허",
    market_busy: "장날 성황", market_quiet: "장날 한산", winter_survived: "겨울 넘김", hungry_gap: "보릿고개",
  } satisfies Record<SeasonSceneId, string>,
  scenesLine: (names: readonly string[]) => `이 계절의 장면: ${names.join(" · ")}`,
  percent: (value: string) => `${value}%`,
  households: (count: number) => `${count}가구`,
  houses: (count: number) => `${count}채`,
  events: {
    households_leaving: (count: number) => `떠날 채비를 한 가구 ${count}`,
    households_abandoned: (count: number) => `비워진 집 ${count}`,
    households_resettled: (count: number) => `다시 든 가구 ${count}`,
    era_entered: (name: string, forced: boolean) => forced ? `${name} 시대가 준비 없이 왔습니다` : `${name} 시대에 들어섰습니다`,
    first_winter_warning: "다음 수확까지 비축이 모자랍니다",
    /** FIX-4 E7: people lost to hunger this season (the engine's `residents_starved`). */
    residents_starved: (people: number) => `굶주려 ${people}명이 줄었습니다`,
    event_rumour: (name: string) => `${name} 소문이 돕니다`,
    event_sign: (name: string) => `${name} 조짐이 보입니다`,
    event_arrived: (name: string) => `${name}이 닥쳤습니다`,
    event_recovered: (name: string) => `${name}에서 회복했습니다`,
  },
  eventNames: { fire: "불", dearth: "흉년", great_famine: "대기근" },
  quiet: "큰 일 없이 지나간 계절입니다",
  /** UX-0b: the season's own loss when no event names it (starvation is not an engine event). */
  populationFell: (people: number) => `사람이 ${people}명 줄었습니다`,
  /** FIX-4 E11: a food hint says with what (the engine's `foodNeeds`). */
  needs: {
    arableCells: (cells: number) => `경작지 ${cells}칸`,
    farmstead: "헛간",
    mill: "방앗간",
    line: (parts: readonly string[]) => `다음: 식량 — ${parts.join("·")}이 필요합니다`,
    harvest: "다음: 식량 — 밭·헛간·방앗간은 모자라지 않습니다. 수확까지 버티세요",
  },
  hints: {
    food_reserve: "다음: 식량 비축 — 곡창을 채우세요",
    harvest_reserve: "다음: 다음 수확까지 — 경작지를 늘리세요",
    resettle: "다음: 빈집에 한 계절 먹을 식량을",
    dearth_reserve: "다음: 흉년 전에 비축을",
    fire_break: "다음: 마른 여름 — 우물과 초가 사이 틈을",
    rebuild: "다음: 불탄 집을 다시 세우세요",
    resettled_food: "다음: 재정착민의 식량이 떨어지기 전에",
  } satisfies Record<Exclude<NextObjectiveHint, null>, string>,
  resume: "계속",
  autoOn: "계절마다 결산 띄우기: 켬",
  autoOff: "계절마다 결산 띄우기: 끔",
} as const;
