/**
 * FACTION-0 (spec docs/design/factions.md FX-*): the factions' Korean copy — their kinds, the world's events, their own
 * affairs and what moved their relation. Proper nouns (earldoms, houses, sees, kings) stay as the period wrote them.
 */
import { GENTRY_NAMES_KO } from "./gentryNames";
import { SURNAMES_KO } from "./personNames.ko";

export const FACTION_KIND_NAMES: Readonly<Record<string, string>> = {
  overlord: "상위 영주", crown: "국왕과 왕실", neighbour: "이웃 영주", church: "주교", merchant_house: "상인 가문", town: "도시 공동체", commons: "농민 공동체",
};

/** A faction's Korean name from its id and its (proper-noun) name (FIX-5: the invented names' Korean readings). */
export function factionDisplayName(id: string, name: string): string {
  const read = GENTRY_NAMES_KO[name] ?? name;
  if (id === "overlord") return `${read} 백작`;
  if (id === "crown") return "국왕과 왕실";
  if (id === "neighbour_1" || id === "neighbour_2") return `${read} 가문(이웃 영주)`;
  if (id === "bishop") return `${read} 주교`;
  // NAME-1: a merchant house is named for its family, read in Korean as its people are (FIX-6 `SURNAMES_KO`).
  if (id === "merchant_house_1" || id === "merchant_house_2") return `${SURNAMES_KO[name] ?? name} 상인 가문`;
  return FACTION_KIND_NAMES[name] ?? name;
}

export const FACTION_SHORT_NAMES: Readonly<Record<string, string>> = {
  overlord: "상위 영주", crown: "왕실", neighbour_1: "이웃 영주", neighbour_2: "이웃 영주", bishop: "주교", merchant_house_1: "첫째 상인 가문",
  merchant_house_2: "둘째 상인 가문", town: "도시 공동체", commons: "농민 공동체",
};

export const WORLD_EVENT_LINES: Readonly<Record<string, string>> = {
  edward_ii: "에드워드 2세가 즉위했다", bannockburn: "배넉번에서 스코틀랜드에 졌다", great_famine: "대기근이 온 나라를 덮었다",
  boroughbridge: "버러브리지에서 반란 영주들이 꺾였다", edward_iii: "에드워드 2세가 폐위되고 에드워드 3세가 즉위했다",
  hundred_years_war: "프랑스와 전쟁이 시작되었다", sluys: "슬라위스 바다에서 이겼다", crecy: "크레시에서 이겼다",
  black_death: "흑사병이 왔다", statute_of_labourers: "노동자 법령이 나왔다", poitiers: "푸아티에에서 프랑스 왕을 사로잡았다",
  second_pestilence: "역병이 다시 돌았다", richard_ii: "리처드 2세가 즉위했다", peasants_revolt: "농민 반란이 일어났다",
  henry_iv: "리처드 2세가 폐위되고 헨리 4세가 즉위했다", henry_v: "헨리 5세가 즉위했다", agincourt: "아쟁쿠르에서 이겼다",
  henry_vi: "갓난 헨리 6세가 즉위했다", cade_rebellion: "잭 케이드의 반란이 일어났다",
};

export const FACTION_AFFAIR_LINES: Readonly<Record<string, string>> = {
  tournament: "마상 시합을 열었다", summons: "가신들을 불러 모았다", marriage: "혼인으로 다른 가문과 이어졌다", feud: "이웃과 다툼이 붙었다",
  new_hall: "새 저택을 지었다", lawsuit: "왕의 법정에 소송을 걸었다", visitation: "교구를 순시했다", new_abbot: "새 수도원장을 세웠다",
  relic: "성유물을 들여왔다", synod: "교구 회의를 열었다",
};

export const FACTION_LEADER_LINES: Readonly<Record<string, string>> = {
  succeeded: "수장이 죽고 후계자가 뒤를 이었다", chosen: "새 수장이 섰다",
};

const PETITION_NAMES: Readonly<Record<string, string>> = {
  market_charter: "시장권 청원", restore_right: "권리 복원 청원", wool_payment: "양모 공납 칙령", levy_response: "징집 명령",
  war_funding: "전쟁 보조세 요구", refugee_admission: "피란민의 청원", wall_or_market: "석벽과 시장 사이의 선택",
  // UI-8: the four plague petitions (F3-A PL-5…PL-8).
  vacant_priest: "빈 사제 자리", wages: "일꾼들의 임금 요구", land_redistribution: "빈 필지의 주인",
  cash_rent: "부역을 돈으로 바꾸자는 청원",
  // F4-A: the four reorganisation petitions (RG-5…RG-9).
  guild_charter: "길드 결성 요구", tax_collection: "인두세를 걷는 방식", cloth_or_grain: "직물과 곡물 사이의 선택", borough_charter: "자치 특허 요구서",
};
const ANSWERS: Readonly<Record<string, string>> = { accept: "수락", accept_with_price: "가격을 붙여 수락", refuse: "거절", expired: "답하지 않음" };

/** FX-4: what moved a faction's relation, by reason (`petition:<defId>:<answer>` reads its answer). */
export function factionReasonLine(reason: string): string {
  const [kind, a, b] = reason.split(":");
  if (kind === "petition") return `${PETITION_NAMES[a ?? ""] ?? a}에 ${ANSWERS[b ?? ""] ?? b}`;
  if (kind === "famine") return `대기근에 ${a === "relief" ? "구휼" : a === "price_control" ? "가격 통제" : a === "laissez_faire" ? "방관" : "투기"}`;
  if (kind === "decline") return a === "arrears" ? "유지비 미납으로 쇠퇴" : a === "depopulated" ? "사람이 떠나 쇠퇴" : a === "empty" ? "도시가 비어 쇠퇴" : "빈 필지가 늘어 쇠퇴";
  if (kind === "restored") return "권리를 되삼";
  if (kind === "house_change") return "영주 가문이 바뀜";
  if (kind === "raid") return a === "held" ? "습격에 성벽이 버팀" : "습격에 성벽이 뚫림";
  if (kind === "reorg") return a === "wage_competition" ? "더 높은 임금으로 가구를 데려감" : a === "overlord_warning" ? "도시가 커지는 것을 경계함"
    : b === "chased" ? "징수원을 쫓아낸 소동" : "반란 소문이 조용히 지나감";
  return reason;
}
