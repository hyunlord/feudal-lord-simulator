/**
 * F0-C2 history ledger sentences (spec docs/design/history-ledger.md HL-1): one template per record kind. A record
 * saves only the template id and its parameters; `historySummary` rebuilds the sentence from here.
 */
type P = Readonly<Record<string, number | string>>;
const n = (params: P, key: string): number => Number(params[key] ?? 0);
const s = (params: P, key: string): string => String(params[key] ?? "");

export const HISTORY_BUILDING_NAMES: Readonly<Record<string, string>> = {
  house: "집", well: "우물", storehouse: "창고", granary: "곡창", chapel: "예배당", wheat_farm: "밀밭", farmstead: "헛간",
  mill: "방앗간", logging_camp: "벌목장", sawmill: "제재소", market: "시장", church: "교회", masonry: "석공장", quarry: "채석장",
};
const building = (kind: string) => HISTORY_BUILDING_NAMES[kind] ?? kind;

/** The particle after a word: the first form after a final consonant (받침), the second after a vowel. */
function josa(word: string, withFinal: string, withoutFinal: string): string {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  return code >= 0 && code <= 11171 && code % 28 !== 0 ? withFinal : withoutFinal;
}

export const HISTORY_CHOICE_LABELS: Readonly<Record<string, string>> = {
  relief: "구휼", price_control: "가격 통제", laissez_faire: "방관", speculation: "투기",
  accept: "수락", refuse: "거절", accept_with_price: "가격을 붙여 수락", expired: "답하지 않음",
  proclaim: "선포", wait: "미룸", rebuild: "다시 짓기", leave: "그대로 둠", expand: "넓힘", keep: "그대로 둠",
};
const choice = (key: string) => HISTORY_CHOICE_LABELS[key] ?? key;

export const HISTORY_EVENT_NAMES: Readonly<Record<string, string>> = {
  first_fire: "첫 화재", fire: "화재", dearth_rehearsal: "첫 흉년", great_famine: "대기근",
};
const eventName = (id: string) => HISTORY_EVENT_NAMES[id] ?? id;

export const HISTORY_ERA_NAMES: Readonly<Record<string, string>> = {
  saturation: "포화", famine: "기근과 취약", war: "전쟁 동원", collapse: "인구 붕괴와 노동 반전", specialisation: "재편과 전문화",
};

/** Everyday decisions of a season, written as one line per kind (HL-2 ①). */
const BUNDLE: Readonly<Record<string, (params: P) => string>> = {
  build: params => `이번 계절 건물 ${n(params, "count")}곳의 공사를 놓았다`,
  road: params => `이번 계절 길을 ${n(params, "count")}번 고쳤다`,
  zone: params => `이번 계절 구역을 ${n(params, "count")}번 칠하거나 지웠다`,
  house: params => `이번 계절 집을 ${n(params, "count")}번 합치거나 헐었다`,
  cancel: params => `이번 계절 공사 ${n(params, "count")}곳을 거뒀다`,
  operation: params => `이번 계절 시설 가동을 ${n(params, "count")}번 바꿨다`,
  wall_priority: params => `이번 계절 성벽 공사 우선을 ${n(params, "count")}번 정했다`,
};

/** PERSON-0: trades a household head takes (PS-4). */
export const HISTORY_OCCUPATIONS: Readonly<Record<string, string>> = {
  miller: "방앗간", sawyer: "제재소", mason: "석공장", chapman: "시장", husbandman: "헛간", woodward: "벌목장", quarrier: "채석장",
  granger: "곡창", storekeeper: "창고",
};
const DEATH_CAUSES: Readonly<Record<string, string>> = {
  age: "세상을 떠났다", famine: "굶주림 끝에 죽었다", fire: "불에 목숨을 잃었다", plague: "역병으로 죽었다",
};

export const HISTORY_TEMPLATES: Readonly<Record<string, (params: P) => string>> = {
  "decision.bundle": params => (BUNDLE[s(params, "decisionKind")] ?? (() => s(params, "decisionKind")))(params),
  "decision.famine_response": params => { const label = choice(s(params, "chosen")); return `대기근에 ${label}${josa(label, "을", "를")} 택했다`; },
  "decision.petition_response": params => { const label = choice(s(params, "chosen")); return `상인의 시장권 청원에 답했다: ${label}`; },
  "decision.market_town": () => "목책을 두르고 시장도시를 선포했다",
  "decision.stone_town": () => "석벽 사업을 선포했다",
  "decision.rebuild": () => "불탄 집을 다시 짓기 시작했다",
  "decision.wall_expand": () => "목책을 넓혀 새로 두르기로 했다",
  "event.rumour": params => `${eventName(s(params, "defId"))}의 소문이 돌았다`,
  "event.sign": params => `${eventName(s(params, "defId"))}의 징후가 보였다`,
  "event.arrived": params => { const name = eventName(s(params, "defId")); return `${name}${josa(name, "이", "가")} 닥쳤다`; },
  "event.recovered": params => `${eventName(s(params, "defId"))}에서 회복했다 — 불탄 집 ${n(params, "burntHouses")}, 떠난 가구 ${n(params, "departures")}, 잃은 밀 ${n(params, "harvestLost")}`,
  "era.entered": params => `${HISTORY_ERA_NAMES[s(params, "eraId")] ?? s(params, "eraId")}의 시대가 왔다${n(params, "forced") === 1 ? "(준비 없이)" : ""}`,
  "milestone.first_building": params => { const name = building(s(params, "building")); return `첫 ${name}${josa(name, "이", "가")} 섰다`; },
  "milestone.market_town": () => "시장도시가 되었다",
  "milestone.stone_town": () => "석벽 도시가 되었다",
  "milestone.first_l4": () => "처음으로 도시 대가옥(L4)이 생겼다",
  "milestone.lots": params => `필지가 ${n(params, "lots")}개가 되었다`,
  "milestone.chapter_end": params => `${n(params, "chapter")}장이 끝났다`,
  "ledger.season": params => `계절 결산 — 인구 ${n(params, "population")}(${n(params, "popDelta") >= 0 ? "+" : ""}${n(params, "popDelta")}), 금고 ${n(params, "net") >= 0 ? "+" : ""}${n(params, "net")}`,
  "ledger.population": params => `인구가 한 계절에 ${n(params, "percent") >= 0 ? "+" : ""}${n(params, "percent")}% 바뀌었다`,
  "ledger.treasury_turn": params => n(params, "net") >= 0 ? "금고가 다시 늘기 시작했다" : "금고가 줄기 시작했다",
  "ledger.l4": params => `도시 대가옥이 ${n(params, "from")}채에서 ${n(params, "to")}채가 되었다`,
  "ledger.departures": params => `한 계절에 ${n(params, "count")}가구가 떠났다`,
  "ledger.rollup": params => `계절 요약 — 일상 기록 ${n(params, "count")}건`,
  "person.move_in": () => "가구가 새 집에 들었다",
  "person.level_up": params => `집이 ${n(params, "level")}등급으로 올랐다`,
  "person.level_down": params => `집이 ${n(params, "level")}등급으로 내려앉았다`,
  "person.leaving": () => "가구가 떠날 준비를 했다",
  "person.left": () => "가구가 떠나 집이 비었다",
  "person.resettled": () => "빈 집에 새 가구가 들었다",
  "person.burnt": () => "가구의 집이 불탔다",
  "person.rebuilt": () => "가구의 집을 다시 지었다",
  "person.emptied": () => "굶주려 가구가 흩어졌다",
  "person.stayed": () => "가구가 떠날 준비를 거두고 남았다",
  "person.hungry": () => "가구가 먹을 것이 모자라기 시작했다",
  "person.fed": () => "가구가 다시 배불리 먹게 되었다",
  "person.water": () => "가구에 우물 물이 닿았다",
  "person.water_lost": () => "가구가 우물 물을 잃었다",
  "person.born": () => "아이가 태어났다",
  "person.married": () => "혼인해 가구를 이루었다",
  "person.arrived": () => "친척이 와서 함께 살게 되었다",
  "person.came_of_age": () => "어른이 되어 일을 거들기 시작했다",
  "person.occupation": params => `${HISTORY_OCCUPATIONS[s(params, "occupation")] ?? s(params, "occupation")} 일을 맡았다`,
  "person.reeve": () => "마을 사람들 가운데서 reeve로 뽑혔다",
  "person.steward": () => "영주의 청지기가 되었다",
  "person.died": params => `${n(params, "age")}살에 ${DEATH_CAUSES[s(params, "cause")] ?? "세상을 떠났다"}`,
  "person.left_town": () => "마을을 떠났다",
  "person.grew": params => `식구가 늘어 ${n(params, "residents")}명이 되었다`,
  "person.shrank": params => `식구가 줄어 ${n(params, "residents")}명이 되었다`,
};
