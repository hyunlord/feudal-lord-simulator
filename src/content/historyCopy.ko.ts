import { moneyWords, moneyWordsJosa } from "../ledger/moneyWords.ko";
import { BUILDING_COPY } from "./buildingCatalog.ko";
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

/** FIX-12 (item 4): the word a sentence uses for a person no reader can name (the record keeps only the id). */
export const PERSON_NAME_FALLBACK: Readonly<Record<string, string>> = {
  lord: "영주", guardian: "후견인", candidate: "", heir: "후계자", mayor: "", leader: "새 수장", predecessor: "수장",
};

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
  lawsuit: params => `이번 계절 소송에 ${n(params, "count")}번 손을 썼다`,
  marriage: params => `이번 계절 혼인 협상·약속에 ${n(params, "count")}번 손을 썼다`,
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
  royal_tax: "국왕의 과세 사절", heir_choice: "늙은 영주의 후계자", borough_autonomy: "자치 특허의 인장", legacy_choice: "남길 유산 하나",
  guild_dispute: "길드와 상인 사이의 다툼", church_rebuilding: "교구 교회 증축 청원",
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
  royal_tax: { accept: "과세를 낸다", refuse: "감면을 청원한다", expired: "답하지 않음" },
  heir_choice: { accept: "맏아들에게 잇게 한다", accept_with_price: "딸의 남편에게 잇게 한다", refuse: "조카에게 잇게 한다", expired: "답하지 않음" },
  borough_autonomy: { accept: "자치 특허에 인장을 찍는다", refuse: "가문이 계속 다스린다", expired: "답하지 않음" },
  legacy_choice: { accept: "도시에 길드홀과 시청을 남긴다", accept_with_price: "가문의 영주관과 문장, 혈통 기록을 남긴다", refuse: "교회를 넓히고 기도처를 세운다", expired: "답하지 않음" },
  guild_dispute: { accept: "길드 편을 든다", refuse: "상인 편을 든다", expired: "답하지 않음" },
  church_rebuilding: { accept: "교회를 넓혀 짓는다", refuse: "증축을 미룬다", expired: "답하지 않음" },
};
/** PERSON-1a (LN-4): a birth's line by where the child's name came from. */
const NAME_FROM: Readonly<Record<string, string>> = {
  father: "아이가 태어나 아버지 이름을 받았다", grandfather: "아이가 태어나 할아버지 이름을 받았다",
  mother: "아이가 태어나 어머니 이름을 받았다", grandmother: "아이가 태어나 할머니 이름을 받았다",
  godparent: "아이가 태어나 대부모의 이름을 받았다", common: "아이가 태어났다",
};

const DEATH_CAUSES: Readonly<Record<string, string>> = {
  age: "세상을 떠났다", captivity: "유폐 중에 죽었다", famine: "굶주림 끝에 죽었다", fire: "불에 목숨을 잃었다", plague: "역병으로 죽었다",
};

/** LM-E1: the estate's policies, the town's actors, a project's name. */
const ESTATE_POLICY_KO: Readonly<Record<string, string>> = { growth: "성장", revenue: "세입", stability: "안정", defence: "방어" };
// LM-E3: the negotiation's words — the tiers and the terms.
const TIER_KO: Readonly<Record<string, string>> = { impossible: "불가능", unlikely: "불리", close: "박빙", likely: "유력", almost_certain: "거의 확실" };
const TERM_KO: Readonly<Record<string, string>> = { cash: "계약금", pension: "연금", right_piece: "권리 조각", political_support: "정치적 지원",
  debt_assumption: "채무 인수", consent: "혼인 동의", inheritance_non_infringement: "상속 기대권 불침해", residence: "배우자 거주", land_use: "토지 사용수익",
  wardship: "후견 합의" };
// LM-E2: the estates' words — holders, pieces, a claim's basis, a suit's stages.
const HOLDER_KO: Readonly<Record<string, string>> = { lord: "영주", overlord: "대영주", crown: "국왕", merchants: "상인들", townsfolk: "주민들",
  neighbour_1: "첫째 이웃 영주", neighbour_2: "둘째 이웃 영주", bishop: "주교" };
const holderWord = (holder: string) => HOLDER_KO[holder] ?? (holder.startsWith("person:") ? "옛 가문의 친족" : holder.startsWith("estate:") ? "이웃 영주" : holder);
const PIECE_KO: Readonly<Record<string, string>> = { land_rent: "토지 지대", manor_court: "장원 법정", mill: "방앗간 사용료", market: "시장 좌판세",
  tolls: "통행세", fishery: "어업권", advowson: "교회 추천권", hunting: "사냥권" };
const pieceWord = (piece: string, estate: string) => piece === "" ? (estate === "" ? "영지" : "영지 전체") : PIECE_KO[piece.slice(piece.lastIndexOf(":") + 1)] ?? piece;
const CLAIM_BASIS_KO: Readonly<Record<string, string>> = { inheritance: "상속", marriage: "혼인", purchase_deed: "매입 문서", grant: "하사", old_possession: "오래된 점유" };
const basisWord = (basis: string) => CLAIM_BASIS_KO[basis] ?? basis;
const SUIT_STAGE_KO: Readonly<Record<string, string>> = { evidence: "증거", patronage: "후원", hearing: "심리", enforcing: "점유 집행" };
const ACTOR_KO: Readonly<Record<string, string>> = { households: "가구들", merchants: "상인 가문", guild: "길드", community: "공동체", church: "교회" };
const buildingWord = (kind: string) => BUILDING_COPY[kind as keyof typeof BUILDING_COPY]?.name ?? kind;
const projectWord = (what: string) => what === "road" ? "길" : what.startsWith("zone:") ? "구역" : what === "rebuild_house" ? "집 재건"
  : what === "demolish_house" ? "집 헐기" : what === "farmstead_crop" ? "작물 바꾸기" : buildingWord(what);

export const HISTORY_TEMPLATES: Readonly<Record<string, (params: P) => string>> = {
  "decision.bundle": params => (BUNDLE[s(params, "decisionKind")] ?? (() => s(params, "decisionKind")))(params),
  "decision.famine_response": params => { const label = choice(s(params, "chosen")); return `대기근에 ${label}${josa(label, "을", "를")} 택했다`; },
  "decision.petition_response": params => {
    const label = choice(s(params, "chosen"));
    const defId = s(params, "defId");
    // Item 8: heir choice — use the candidate's relation word when present (params.relation added by recordDecision)
    const chosenText = defId === "heir_choice" && typeof params["relation"] === "string"
      ? `${params["relation"]}에게 잇게 한다`
      : (WAR_CHOICES[defId]?.[s(params, "chosen")] ?? label);
    return `${PETITION_SUBJECTS[defId] ?? "상인의 시장권 청원"}에 답했다: ${chosenText}`;
  },
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
  "plague.ordinance": params => n(params, "fine") > 0 ? `노동자 조례가 낭독되었다 — 임금을 올린 영주에게 벌금 ${moneyWords(n(params, "fine"))}` : "노동자 조례가 낭독되었다",
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
  "reorg.poll_tax": params => `인두세를 걷었다 — 영주의 몫 ${moneyWords(n(params, "amount"))}`,
  "reorg.rebellion_rumour": params => s(params, "outcome") === "chased" ? "농민 반란의 소문 — 사람들이 세금 징수원을 쫓아내고 장원 법정 기록을 태웠다" : "농민 반란의 소문이 돌았지만 도시는 조용했다",
  "reorg.autonomy_request": () => "도시가 자치 특허를 요구하는 문서를 올렸다",
  "reorg.charter": params => s(params, "charter") === "partial" ? "자치 특허를 맺었다 — 시장과 통행세 일부가 도시로 넘어갔다" : "자치 특허를 내주지 않았다",
  "reorg.unanswered": params => `${PETITION_SUBJECTS[s(params, "defId")] ?? s(params, "defId")}에 답하지 않았다`,
  // F5-A (LG-1…LG-8): chapter 5, autonomy and legacy.
  "legacy.mayor_demand": params => s(params, "candidate") === "" ? "상인 엘리트가 도시가 제 시장을 뽑게 해 달라고 요구했다"
    : `상인 엘리트가 도시가 제 시장을 뽑게 해 달라고 요구했다 — 후보 ${s(params, "candidate")}`,
  "legacy.royal_tax_envoy": () => "국왕의 과세 사절이 왔다 — 15분의 1·10분의 1세",
  "legacy.succession": params => { const lord = s(params, "lord"); const age = n(params, "age"); return `${age >= 50 ? "늙은 영주" : "영주"} ${lord}(${age}세)${josa(lord, "이", "가")} 후계자를 정해야 한다 — 후보 ${n(params, "candidates")}명`; },
  // FIX-11: wardship of a minor lord.
  "lord.wardship_begun": params => { const lord = s(params, "lord"); const guardian = s(params, "guardian"); return guardian === "" ? `${lord}${josa(lord, "이", "가")} 미성년 영주다 — 상위 영주가 후견한다` : `${lord}${josa(lord, "이", "가")} 미성년 영주다 — 후견인 ${guardian}`; },
  "lord.wardship_ended": params => { const lord = s(params, "lord"); return `${lord}${josa(lord, "이", "가")} 성년이 되어 후견이 끝났다`; },
  "legacy.heir_seated": params => { const heir = s(params, "heir"); return `${heir}${josa(heir, "이", "가")} 가문을 이었다 — ${s(params, "relation")}`; },
  "legacy.royal_subsidy": params => `국왕에게 과세를 냈다 — ${moneyWords(n(params, "amount"))}`,
  "legacy.city_seal": () => "도시가 제 인장을 새겼다",
  "legacy.charter_sealed": params => s(params, "mayor") === "" ? "자치 특허에 도시 인장이 찍혔다" : `자치 특허에 도시 인장이 찍혔다 — 첫 시장 ${s(params, "mayor")}`,
  "legacy.charter_refused": params => `영주가 자치 특허를 거절했다 — 도시의 반발 ${n(params, "backlash")}`,
  "legacy.family_departed": params => `${houseName(s(params, "house"))} 가문이 영주관을 떠나 시골 장원으로 갔다`,
  "legacy.family_stayed": params => `${houseName(s(params, "house"))} 가문이 영주관에 남았다`,
  "legacy.legacy_record": params => s(params, "legacy") === "" ? "유산 기록을 봉인했다 — 남긴 것 없이" : `유산 기록을 봉인했다 — ${s(params, "legacy")}`,
  "legacy.last_market": params => `마지막 장날 — ${s(params, "ending")}`,
  // FIX-9 (LG-13): the interlude 1384–1400.
  "legacy.staple": () => "양모 집산지(Staple)가 옮겨지고 양모 수출이 묶였다 — 직물 값이 오른다",
  "legacy.guild_dispute": () => "길드와 상인이 직물을 파는 권리를 두고 다툰다",
  "legacy.market_fire": params => `장터에 불이 났다 — 수리에 ${moneyWords(n(params, "cost"))}`,
  "legacy.church_rebuilding": () => "교구가 낡은 교회의 증축을 청했다",
  "legacy.nave_rebuilt": () => "교회의 새 회중석이 섰다",
  "legacy.deposition": () => "리처드 2세가 폐위되고 헨리 4세가 즉위했다",
  "legacy.unanswered": params => `${PETITION_SUBJECTS[s(params, "defId")] ?? s(params, "defId")}에 답하지 않았다`,
  "war.beacon": () => "해안의 봉화가 올랐다",
  "war.raid": params => `해안 습격이 닥쳤다 — 불탄 집 ${n(params, "burntHouses")}, 빼앗긴 물자 ${n(params, "looted")}, 빼앗긴 돈 ${moneyWords(n(params, "coin"))}`,
  "war.conscripts_left": params => `징집된 남자 ${n(params, "men")}명이 떠났다`,
  "war.conscripts_returned": params => n(params, "lost") === 0 ? `징집된 남자 ${n(params, "men")}명이 모두 돌아왔다` : `징집된 남자들이 돌아왔다 — ${n(params, "lost")}명은 돌아오지 못했다`,
  "war.favour_lost": () => "왕실의 신임을 잃었다",
  "war.licence": () => "왕실 조달 면허를 받았다",
  "war.unanswered": params => `${PETITION_SUBJECTS[s(params, "defId")] ?? s(params, "defId")}에 답하지 않았다`,
  // FACTION-0 (FX-4): a faction's relation moved.
  // FIX-12 (item 3, QA-036): the names are drawn from the ids when the record is read (item 4).
  "faction.leader_succeeded": params => { const before = s(params, "predecessor"), next = s(params, "leader");
    return `${factionDisplayName(s(params, "faction"), s(params, "name"))}의 ${before}${josa(before, "이", "가")} 세상을 떠나 ${next}${josa(next, "이", "가")} 무리를 이끈다`; },
  "petition.representative_replaced": params => { const before = s(params, "predecessor"), next = s(params, "leader");
    return `${PETITION_SUBJECTS[s(params, "defId")] ?? s(params, "defId")}의 대표 ${before}${josa(before, "이", "가")} ${s(params, "gone") === "left" ? "마을을" : "세상을"} 떠나 ${next}${josa(next, "이", "가")} 대신 나섰다`; },
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
  // ARCH-1b (MA-11): the fen's drainage.
  "decision.drainage": () => "습지의 웅덩이를 메우는 배수 공사를 시작했다",
  // LM-E1 (TA-6): the lord's conditions; (TA-5) a project the town started.
  "decision.estate_policy": params => `영지 방침을 정했다: ${ESTATE_POLICY_KO[s(params, "chosen")] ?? s(params, "chosen")}`,
  "decision.project_subsidy": params => n(params, "amount") === 0 ? `${buildingWord(s(params, "kind"))} 장려금을 거두었다`
    : `${buildingWord(s(params, "kind"))}에 장려금 ${moneyWords(n(params, "amount"))}${moneyWordsJosa(moneyWords(n(params, "amount")), "을", "를")} 걸었다`,
  "decision.market_dues": params => `시장 부담을 평소의 ${Math.round(Number(s(params, "chosen")) / 10)}%로 정했다`,
  // LM-E3 (NG-5…NG-8): offers, counters, promises and the marriage's stages.
  "negotiation.offered": params => `이웃 영주에게 혼인을 청했다 — ${TIER_KO[s(params, "tier")] ?? s(params, "tier")}(점수 ${n(params, "score")})`,
  "negotiation.accepted": () => "혼인 계약이 맺어졌다",
  "negotiation.countered": params => `이웃 영주가 조건을 고쳐 되물었다 — ${s(params, "changes").split(",").filter(kind => kind !== "").map(kind => TERM_KO[kind] ?? kind).join("·")}`,
  "negotiation.rejected": () => "이웃 영주가 혼인을 거절했다",
  "negotiation.withdrawn": () => "고쳐 온 조건을 받지 않아 혼담이 끝났다",
  "promise.made": params => `약속을 했다: ${TERM_KO[s(params, "term")] ?? s(params, "term")}${n(params, "amount") > 0 ? ` ${moneyWords(n(params, "amount"))}` : ""}`,
  "promise.kept": params => `${s(params, "promisor") === "lord" ? "영주가" : "이웃 영주가"} 약속을 지켰다: ${TERM_KO[s(params, "term")] ?? s(params, "term")}`,
  "promise.broken": params => `${s(params, "promisor") === "lord" ? "영주가" : "이웃 영주가"} 약속을 어겼다: ${TERM_KO[s(params, "term")] ?? s(params, "term")}`,
  "marriage.contracted": () => "혼인 계약 — 아들과 이웃 영주의 맏딸",
  "marriage.bride_arrived": () => "신부가 영주관에 들어왔다",
  "marriage.child_born": () => "부부의 첫아이가 태어났다",
  "marriage.brother_in_law_born": () => "이웃 영주가 다시 장가들어 아들을 얻었다 — 상속 기대가 줄었다",
  "marriage.father_ill": () => "이웃 영주가 병들었다",
  "marriage.will_change": () => "이웃 영주가 유언을 고치려 한다",
  "marriage.will_dropped": () => "이웃 영주가 유언을 고치지 않기로 했다",
  "marriage.father_died": () => "이웃 영주가 죽었다",
  "marriage.inherited": () => "아내를 통해 이웃 영지를 물려받았다 — 이제 우리 영지다",
  "marriage.lost": () => "이웃 영지는 그의 아들에게 갔다",
  "marriage.contested": () => "새 유언대로 조카가 영지를 차지했다 — 소송으로 다툴 수 있다",
  // LM-E2 (ES-5…ES-7): claims, suits, titles and possessions.
  "estate.claim_raised": params => `${holderWord(s(params, "claimant"))}${josa(holderWord(s(params, "claimant")), "이", "가")} ${pieceWord(s(params, "piece"), s(params, "estate"))}에 ${basisWord(s(params, "basis"))}${josa(basisWord(s(params, "basis")), "을", "를")} 근거로 청구를 냈다`,
  "estate.suit_filed": params => `${holderWord(s(params, "plaintiff"))}${josa(holderWord(s(params, "plaintiff")), "이", "가")} ${holderWord(s(params, "defendant"))}${josa(holderWord(s(params, "defendant")), "을", "를")} 상대로 ${pieceWord(s(params, "piece"), "")} 소송을 냈다`,
  "estate.suit_stage": params => `소송이 ${SUIT_STAGE_KO[s(params, "stage")] ?? s(params, "stage")} 단계로 넘어갔다`,
  "estate.suit_patron": params => `${holderWord(s(params, "patron"))}${josa(holderWord(s(params, "patron")), "이", "가")} 소송의 후원자가 되었다`,
  "estate.suit_judged": params => s(params, "verdict") === "plaintiff" ? `판결이 났다: ${pieceWord(s(params, "piece"), "")}의 권원이 원고에게 넘어갔다(점유는 따로)` : `판결이 났다: 원고가 졌다`,
  "estate.possession_enforced": params => n(params, "succeeded") === 1 ? `판결대로 ${pieceWord(s(params, "piece"), "")}의 점유를 넘겨받았다(${n(params, "attempt")}번째)` : `점유자가 버텼다: ${pieceWord(s(params, "piece"), "")} 점유 집행이 막혔다(${n(params, "attempt")}번째)`,
  "estate.title_changed": params => `${pieceWord(s(params, "piece"), s(params, "estate"))}의 권원이 ${holderWord(s(params, "from"))}에게서 ${holderWord(s(params, "to"))}에게 넘어갔다`,
  "estate.possession_changed": params => `${pieceWord(s(params, "piece"), s(params, "estate"))}의 점유가 ${holderWord(s(params, "from"))}에게서 ${holderWord(s(params, "to"))}에게 넘어갔다`,
  // LM-E1b (TA-6 ②): a subsidy refused — the subsidies together would pass a quarter of the treasury.
  "agency.subsidy_refused": params => `${buildingWord(s(params, "kind"))} 장려금 ${moneyWords(n(params, "amount"))}${moneyWordsJosa(moneyWords(n(params, "amount")), "은", "는")} 걸지 못했다: 장려금 합계 ${moneyWords(n(params, "total"))}${moneyWordsJosa(moneyWords(n(params, "total")), "이", "가")} 금고의 4분의 1(${moneyWords(n(params, "limit"))})을 넘는다`,
  "agency.project_started": params => `${ACTOR_KO[s(params, "actor")] ?? s(params, "actor")}${josa(ACTOR_KO[s(params, "actor")] ?? "", "이", "가")} ${projectWord(s(params, "what"))} 공사를 시작했다`,
  "drainage.done": params => `배수 공사가 끝나 웅덩이 ${n(params, "cells")}칸이 풀밭이 되었다`,
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
