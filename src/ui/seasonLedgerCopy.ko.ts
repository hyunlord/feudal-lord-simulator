import { SCENARIO_COPY } from "../content/scenario/scenarioCopy.ko";
import type { NextObjectiveHint } from "../engine/season.types";
import { pence } from "./hud/hudCopy.ko";
import type { SeasonSceneId } from "./seasonLedgerScenes";

// UI-3 season ledger card (FP-1): one closed season on the Wave 8 scroll. Signed numbers, no arrows or symbols.
const signed = (value: number): string => value > 0 ? `+${value}` : value < 0 ? `−${-value}` : "0";

export const SEASON_LEDGER_COPY = {
  label: "계절 결산",
  title: (year: number, season: 0 | 1 | 2 | 3) => `${year}년 ${SCENARIO_COPY.seasons[season]} 결산`,
  signed,
  money: (income: number, expense: number) => `수입 ${pence(signed(income))} · 지출 ${pence(signed(-expense))} · 남음 ${pence(signed(income - expense))}`,
  pence,
  population: (delta: number) => `인구 ${signed(delta)}`,
  versus: (delta: number) => `(전 계절 ${signed(delta)})`,
  stock: (name: string, delta: number) => `${name} ${signed(delta)}`,
  stockNames: { bread: "빵", wheat: "밀", timber: "목재", stone: "석재" },
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
    event_rumour: (name: string) => `${name} 소문이 돕니다`,
    event_sign: (name: string) => `${name} 조짐이 보입니다`,
    event_arrived: (name: string) => `${name}이 닥쳤습니다`,
    event_recovered: (name: string) => `${name}에서 회복했습니다`,
  },
  eventNames: { fire: "불", dearth: "흉년", great_famine: "대기근" },
  quiet: "큰 일 없이 지나간 계절입니다",
  hints: {
    food_reserve: "다음: 식량 비축 — 곡창을 채우세요",
    harvest_reserve: "다음: 다음 수확까지 — 경작지를 늘리세요",
    resettle: "다음: 빈집에 한 계절 먹을 식량을",
    dearth_reserve: "다음: 흉년 전에 비축을",
    fire_break: "다음: 마른 여름 — 우물과 초가 사이 틈을",
    rebuild: "다음: 불탄 집을 다시 세우세요",
  } satisfies Record<Exclude<NextObjectiveHint, null>, string>,
  resume: "계속",
  autoOn: "계절마다 결산 띄우기: 켬",
  autoOff: "계절마다 결산 띄우기: 끔",
} as const;
