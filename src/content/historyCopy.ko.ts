/**
 * F0-C2 history ledger sentences (spec docs/design/history-ledger.md HL-1): one template per record kind. A record
 * saves only the template id and its parameters; `historySummary` rebuilds the sentence from here.
 */
import { buildingHistoryName } from "./buildingCatalog.ko";
import { factionDisplayName, factionReasonLine } from "./factionCopy.ko";
import { GENTRY_NAMES_KO } from "./gentryNames";

type P = Readonly<Record<string, number | string>>;
const n = (params: P, key: string): number => Number(params[key] ?? 0);
const s = (params: P, key: string): string => String(params[key] ?? "");

// BLD-REG: a building's name in the ledger's sentences is its catalog line (`buildingCatalog.ko.ts` `history`).
const building = buildingHistoryName;

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
/** FAIL-3 (FL-3, FL-1, FL-7): the decline's causes, the lord's rights and the houses' names in Korean. */
export const DECLINE_CAUSES: Readonly<Record<string, string>> = { derelict: "빈 필지가 늘어", arrears: "유지비가 밀려", depopulated: "사람이 떠나", empty: "도시가 비어" };
export const LORD_RIGHT_NAMES: Readonly<Record<string, string>> = { market: "시장 좌판세", tolls: "통행세", mill: "방앗간 사용료" };
/** FIX-5: the invented houses' Korean readings (`gentryNames.ts`). */
export const LORD_HOUSE_NAMES_KO: Readonly<Record<string, string>> = GENTRY_NAMES_KO;
const houseName = (name: string) => LORD_HOUSE_NAMES_KO[name] ?? name;
/** F2-A (WR-2…WR-8): what each petition is, and what its three answers mean. */
export const PETITION_SUBJECTS: Readonly<Record<string, string>> = {
  market_charter: "상인의 시장권 청원", restore_right: "권리 복원 청원",
  wool_payment: "양모 공납 칙령", levy_response: "징집 명령", war_funding: "전쟁 보조세 요구", refugee_admission: "피란민의 청원", wall_or_market: "석벽과 시장 사이의 선택",
  vacant_priest: "빈 사제 자리", wages: "일꾼들의 임금 요구", land_redistribution: "빈 필지의 주인", cash_rent: "부역을 돈으로 바꾸자는 청원",
  guild_charter: "직인들의 길드 결성 요구", tax_collection: "인두세를 걷는 방식", cloth_or_grain: "직물과 곡물 사이의 선택", borough_charter: "도시의 자치 특허 요구서",
};
export const WAR_CHOICES: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  wool_payment: { accept: "현물로 낸다", accept_with_price: "현금으로 낸다", refuse: "거절", expired: "답하지 않음" },
  levy_response: { accept: "사람을 보낸다", accept_with_price: "면제금을 낸다", refuse: "거절", expired: "답하지 않음" },
  war_funding: { accept: "상인에게 빌린다", accept_with_price: "세금을 올린다", refuse: "거절", expired: "답하지 않음" },
  refugee_admission: { accept: "모두 받아들인다", accept_with_price: "절반만 받는다", refuse: "돌려보낸다", expired: "답하지 않음" },
  wall_or_market: { accept: "석벽을 쌓는다", accept_with_price: "성벽세로 석벽을 쌓는다", refuse: "시장을 넓힌다", expired: "답하지 않음" },
  vacant_priest: { accept: "수도원에 사제를 청한다", refuse: "평신도 서기를 세운다", expired: "답하지 않음" },
  wages: { accept: "임금을 올린다", refuse: "조례대로 묶는다", expired: "답하지 않음" },
  land_redistribution: { accept: "이웃 가구가 넓혀 쓴다", accept_with_price: "새 이주민을 받는다", expired: "답하지 않음" },
  cash_rent: { accept: "돈으로 바꾼다", refuse: "부역을 지킨다", expired: "답하지 않음" },
  guild_charter: { accept: "길드를 인가한다", refuse: "길드를 거부한다", expired: "답하지 않음" },
  tax_collection: { accept: "도시 공동체에 맡긴다", refuse: "영주의 징수원이 걷는다", expired: "답하지 않음" },
  cloth_or_grain: { accept: "직물에 걸고 쟁기밭을 양에게 준다", refuse: "곡물을 지킨다", expired: "답하지 않음" },
  borough_charter: { accept: "시장과 통행세 일부를 넘긴다", refuse: "특허를 거절한다", expired: "답하지 않음" },
};
/** PERSON-1a (LN-4): a birth's line by where the child's name came from. */
const NAME_FROM: Readonly<Record<string, string>> = {
  father: "아이가 태어나 아버지 이름을 받았다", grandfather: "아이가 태어나 할아버지 이름을 받았다",
  mother: "아이가 태어나 어머니 이름을 받았다", grandmother: "아이가 태어나 할머니 이름을 받았다",
  godparent: "아이가 태어나 대부모의 이름을 받았다", common: "아이가 태어났다",
};

const DEATH_CAUSES: Readonly<Record<string, string>> = {
  age: "세상을 떠났다", famine: "굶주림 끝에 죽었다", fire: "불에 목숨을 잃었다", plague: "역병으로 죽었다",
};

export const HISTORY_TEMPLATES: Readonly<Record<string, (params: P) => string>> = {
  "decision.bundle": params => (BUNDLE[s(params, "decisionKind")] ?? (() => s(params, "decisionKind")))(params),
  "decision.famine_response": params => { const label = choice(s(params, "chosen")); return `대기근에 ${label}${josa(label, "을", "를")} 택했다`; },
  "decision.petition_response": params => { const label = choice(s(params, "chosen")); return `${PETITION_SUBJECTS[s(params, "defId")] ?? "상인의 시장권 청원"}에 답했다: ${WAR_CHOICES[s(params, "defId")]?.[s(params, "chosen")] ?? label}`; },
  // F2-A (WR-1…WR-7): the war of 1337.
  "war.messenger": () => "국왕의 전령이 왔다 — 프랑스와 전쟁이 시작되었다",
  // F3-A (PL-1…PL-10): the Black Death.
  "plague.rumour": () => "항구에서 열병이 돈다는 소문이 들어왔다",
  "plague.arrived": () => "역병이 도시에 들어왔다",
  "plague.priest_died": () => "사제가 역병으로 죽었다 — 교회가 비었다",
  "plague.priest_filled": params => s(params, "by") === "monastery" ? "수도원이 보낸 사제가 왔다" : "평신도 서기가 교회의 기도를 맡았다",
  "plague.new_graves": params => `교회 묘지에 새 무덤이 늘었다 — ${n(params, "dead")}명`,
  "plague.empty_streets": params => `거리가 비었다 — 빈집 ${n(params, "houses")}채`,
  "plague.abandoned_fields": params => `역병이 물러갔다 — ${n(params, "population")}명 가운데 ${n(params, "dead")}명이 죽고, 빈 필지 ${n(params, "houses")}곳, 밭이 버려졌다`,
  "plague.ordinance": params => n(params, "fine") > 0 ? `노동자 조례가 낭독되었다 — 임금을 올린 영주에게 벌금 ${n(params, "fine")}d` : "노동자 조례가 낭독되었다",
  "plague.resettlement": () => "빈집에 새 가족이 들기 시작했다",
  "plague.second": () => "두 번째 역병이 왔다",
  "plague.second_ended": params => `두 번째 역병이 물러갔다 — ${n(params, "dead")}명이 죽었다`,
  "plague.unanswered": params => `${PETITION_SUBJECTS[s(params, "defId")] ?? s(params, "defId")}에 답하지 않았다`,
  // F4-A (RG-1…RG-10): the reorganisation.
  "reorg.wage_competition": () => "이웃 장원이 더 높은 임금으로 일꾼을 부른다",
  "reorg.textile_street": () => "직조공 집이 늘어 직물 거리가 생겼다",
  "reorg.alehouse_boom": () => "에일하우스마다 사람이 붐빈다",
  "reorg.petitions_surge": () => "상인과 직인 무리의 청원이 쏟아진다",
  "reorg.guild_founded": () => "직인 길드가 섰다",
  "reorg.weavers_left": params => `직조공 가구 ${n(params, "households")}곳이 길드가 있는 도시로 떠났다`,
  "reorg.overlord_warning": params => `상위 영주가 커지는 도시를 경고했다 — 도시의 힘 ${n(params, "influence")}`,
  "reorg.poll_tax": params => `인두세를 걷었다 — 영주의 몫 ${n(params, "amount")}d`,
  "reorg.rebellion_rumour": params => s(params, "outcome") === "chased" ? "농민 반란의 소문 — 사람들이 세금 징수원을 쫓아내고 장원 법정 기록을 태웠다" : "농민 반란의 소문이 돌았지만 도시는 조용했다",
  "reorg.autonomy_request": () => "도시가 자치 특허를 요구하는 문서를 올렸다",
  "reorg.charter": params => s(params, "charter") === "partial" ? "자치 특허를 맺었다 — 시장과 통행세 일부가 도시로 넘어갔다" : "자치 특허를 내주지 않았다",
  "reorg.unanswered": params => `${PETITION_SUBJECTS[s(params, "defId")] ?? s(params, "defId")}에 답하지 않았다`,
  "war.beacon": () => "해안의 봉화가 올랐다",
  "war.raid": params => `해안 습격이 닥쳤다 — 불탄 집 ${n(params, "burntHouses")}, 빼앗긴 물자 ${n(params, "looted")}, 빼앗긴 돈 ${n(params, "coin")}d`,
  "war.conscripts_left": params => `징집된 남자 ${n(params, "men")}명이 떠났다`,
  "war.conscripts_returned": params => n(params, "lost") === 0 ? `징집된 남자 ${n(params, "men")}명이 모두 돌아왔다` : `징집된 남자들이 돌아왔다 — ${n(params, "lost")}명은 돌아오지 못했다`,
  "war.favour_lost": () => "왕실의 신임을 잃었다",
  "war.licence": () => "왕실 조달 면허를 받았다",
  "war.unanswered": params => `${PETITION_SUBJECTS[s(params, "defId")] ?? s(params, "defId")}에 답하지 않았다`,
  // FACTION-0 (FX-4): a faction's relation moved.
  "faction.relation": params => `${factionDisplayName(s(params, "faction"), s(params, "name"))}의 마음이 ${n(params, "delta") > 0 ? "누그러졌다" : "돌아섰다"}(${n(params, "delta") > 0 ? "+" : ""}${n(params, "delta")}, 이제 ${n(params, "relation")}) — ${factionReasonLine(s(params, "reason"))}`,
  // FAIL-3 (FL-5…FL-8): the lordship's fall and the chapter's turn.
  "decline.entered": params => `영지가 쇠퇴했다 — ${DECLINE_CAUSES[s(params, "cause")] ?? s(params, "cause")}, ${s(params, "right") === "none" ? "잃은 권리 없이" : `${LORD_RIGHT_NAMES[s(params, "right")] ?? s(params, "right")}${josa(LORD_RIGHT_NAMES[s(params, "right")] ?? "", "을", "를")} ${s(params, "by") === "overlord" ? "상위 영주가 맡았고" : "상인들이 가져갔고"}`} 칭호가 강등되었다`,
  "decline.recovered": params => s(params, "right") === "none" ? "쇠퇴에서 벗어나 칭호를 되찾았다" : `${LORD_RIGHT_NAMES[s(params, "right")] ?? s(params, "right")}${josa(LORD_RIGHT_NAMES[s(params, "right")] ?? "", "을", "를")} 되사 쇠퇴에서 벗어났다`,
  "house.withdrew": params => `${houseName(s(params, "name"))} 가문이 물러났다`,
  "house.arrived": params => `${houseName(s(params, "name"))} 가문이 영지를 맡았다`,
  // FIX-5 (FL-14): the new house resettles the emptied town.
  "house.resettled": params => `${houseName(s(params, "name"))} 가문이 이주민 ${n(params, "settlers")}명을 데려와 빈 도시에 다시 살게 했다`,
  "milestone.chapter_start": params => `${n(params, "chapter")}장이 시작되었다`,
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
  "person.born": params => NAME_FROM[s(params, "nameFrom")] ?? "아이가 태어났다",
  "person.married": () => "혼인해 가구를 이루었다",
  "person.arrived": () => "친척이 와서 함께 살게 되었다",
  "person.came_of_age": () => "어른이 되어 일을 거들기 시작했다",
  "person.occupation": params => `${HISTORY_OCCUPATIONS[s(params, "occupation")] ?? s(params, "occupation")} 일을 맡았다`,
  "person.reeve": () => "마을 사람들 가운데서 reeve로 뽑혔다",
  "person.steward": () => "영주의 청지기가 되었다",
  "person.died": params => `${n(params, "age")}살에 ${DEATH_CAUSES[s(params, "cause")] ?? "세상을 떠났다"}`,
  "person.left_town": () => "마을을 떠났다",
  // PERSON-1a (LN-10): the passing states and the bailiff.
  "person.bailiff": () => "영주의 집행관이 되었다",
  "person.fell_ill": () => "병이 들었다",
  "person.recovered": () => "병에서 나았다",
  "person.injured": () => "일하다 다쳤다",
  "person.healed": () => "상처가 아물었다",
  "person.expecting": () => "아이를 가졌다",
  "person.pilgrimage": () => "순례를 떠났다",
  "person.returned": () => "순례에서 돌아왔다",
  "person.grew": params => `식구가 늘어 ${n(params, "residents")}명이 되었다`,
  "person.shrank": params => `식구가 줄어 ${n(params, "residents")}명이 되었다`,
};
