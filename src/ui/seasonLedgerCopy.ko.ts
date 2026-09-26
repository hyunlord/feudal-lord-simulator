import { SCENARIO_COPY } from "../content/scenario/scenarioCopy.ko";
import type { NextObjectiveHint } from "../engine/season.types";

// UI-3 season ledger card (FP-1): one closed season on the Wave 8 scroll. Signed numbers, no arrows or symbols.
const signed = (value: number): string => value > 0 ? `+${value}` : value < 0 ? `−${-value}` : "0";

export const SEASON_LEDGER_COPY = {
  label: "계절 결산",
  title: (year: number, season: 0 | 1 | 2 | 3) => `${year}년 ${SCENARIO_COPY.seasons[season]} 결산`,
  signed,
  money: (income: number, expense: number) => `수입 ${signed(income)} · 지출 ${signed(-expense)} · 남음 ${signed(income - expense)}`,
  population: (delta: number) => `인구 ${signed(delta)}`,
  versus: (delta: number) => `(전 계절 ${signed(delta)})`,
  stock: (name: string, delta: number) => `${name} ${signed(delta)}`,
  stockNames: { bread: "빵", wheat: "밀", timber: "목재", stone: "석재" },
  scene: { population: "인구", bread: "빵", wheat: "밀", timber: "목재", stone: "석재", coin: "돈" },
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
