import { LEDGER_CATEGORY_LABELS } from "../ledger/ledgerCopy.ko";
import { moneyWords, moneyWordsFullDelta, moneyWordsJosa } from "../ledger/moneyWords.ko";
import { BUILDING_COPY } from "./buildingCatalog.ko";
import { BALANCE } from "./balanceConfig";
/**
 * F0-C2 history ledger sentences (spec docs/design/history-ledger.md HL-1): one template per record kind. A record
 * saves only the template id and its parameters; `historySummary` rebuilds the sentence from here.
 */
import { buildingHistoryName } from "./buildingCatalog.ko";
import { factionDisplayName, factionReasonLine } from "./factionCopy.ko";
import { PETITION_CHOICES } from "./petitionChoices.ko";
import { REGISTRY_TERM_WORDS, registryChoiceLedger, registryTitle } from "./registry/registryCopy.ko";
import { GENTRY_NAMES_KO } from "./gentryNames";
import { SURNAMES_KO } from "./personNames.ko";

type P = Readonly<Record<string, number | string>>;
const n = (params: P, key: string): number => Number(params[key] ?? 0);
const s = (params: P, key: string): string => String(params[key] ?? "");

/** LM-E4: an off-map estate by its house's name, an estate petition's subject, an exception's rule. */
const estateWord = (house: string) => `${SURNAMES_KO[house] ?? house} 영지`;
const ESTATE_PETITION_KO: Readonly<Record<string, string>> = { rent_relief: "소작인의 지대 감면 청원", market_dues: "상인의 장세 인하 청원", repair: "제방·헛간 수리 청원",
  common_dispute: "공유지 다툼", charter_request: "상인의 특허 청원", marriage_licence: "소작인 딸의 혼인 허가",
  // FIX-14 (SW-11): the home estate's petitions.
  boundary_dispute: "이웃 영지와의 경계 다툼", mill_suit: "방앗간 강제를 풀어 달라는 청원", heriot: "과부의 사망 부과금(헤리엇, 가장 좋은 짐승) 감면 청원",
  merchet: "딸을 장원 밖으로 시집보내는 혼인 부담금(머쳇) 청원", ale_fines: "에일 검정 벌금을 덜어 달라는 청원", road_bridge: "길과 다리 수리를 나눠 맡아 달라는 청원",
  stall_dispute: "두 상인 가문의 좌판 다툼", wardship: "미성년 상속자의 후견을 친족에게 달라는 청원", common_pasture: "공유지 방목 한도를 정해 달라는 청원",
  newcomer: "이주민의 정착 청원", pannage: "영주의 숲에 돼지를 놓게 해 달라는 청원", chancel_repair: "교회 성단 수리를 맡아 달라는 주교의 청원" };
const MANOR_ANSWER_KO: Readonly<Record<string, readonly [string, string]>> = {
  boundary_dispute: ["우리 소작인 편을 들었다", "이웃 영지 편을 들었다"], stall_dispute: ["첫째 상인 가문 편을 들었다", "둘째 상인 가문 편을 들었다"],
  common_pasture: ["방목 한도를 정했다", "한도를 두지 않았다"], wardship: ["후견을 친족에게 주었다", "후견을 영주가 쥐었다"],
};
const manorAnswerWord = (kind: string, granted: boolean) => MANOR_ANSWER_KO[kind]?.[granted ? 0 : 1] ?? (granted ? "들어주었다" : "물리쳤다");
const estatePetitionWord = (kind: string) => ESTATE_PETITION_KO[kind] ?? kind;
const EXCEPTION_RULE_KO: Readonly<Record<string, string>> = { amount: "정한 금액 이상", rights: "권리 변경", marriage: "혼인" };

/** FIX-12 (item 2): who the groom of a marriage contract is to the lord. */
export const GROOM_RELATION_KO: Readonly<Record<string, string>> = {
  son: "아들", widowed_lord: "홀아비 영주", brother: "영주의 동생", nephew: "영주의 조카", cousin: "영주의 사촌",
};

/** FIX-12 (item 4): the word a sentence uses for a person no reader can name (the record keeps only the id). */
export const PERSON_NAME_FALLBACK: Readonly<Record<string, string>> = {
  lord: "영주", guardian: "후견인", candidate: "", heir: "후계자", mayor: "", leader: "새 수장", predecessor: "수장", steward: "청지기", deceased: "이웃 가문 사람",
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
  saturation: "포화", famine: "기근과 취약", war: "전쟁 동원", collapse: "역병 뒤의 일손 부족", specialisation: "재편과 전문화",
};

/** Everyday decisions of a season, written as one line per kind (HL-2 ①). */
const BUNDLE: Readonly<Record<string, (params: P) => string>> = {
  build: params => `이번 계절 건물 ${n(params, "count")}곳의 공사를 시작했다`,
  road: params => `이번 계절 길을 ${n(params, "count")}번 고쳤다`,
  zone: params => `이번 계절 구역을 ${n(params, "count")}번 칠하거나 지웠다`,
  house: params => `이번 계절 집을 ${n(params, "count")}번 합치거나 헐었다`,
  cancel: params => `이번 계절 공사 ${n(params, "count")}곳을 거뒀다`,
  operation: params => `이번 계절 시설 가동을 ${n(params, "count")}번 바꿨다`,
  wall_priority: params => `이번 계절 성벽 공사 우선순위를 ${n(params, "count")}번 정했다`,
  lawsuit: params => `이번 계절 소송에 ${n(params, "count")}번 손을 썼다`,
  marriage: params => `이번 계절 혼인 협상·약속에 ${n(params, "count")}번 손을 썼다`,
};

/** PERSON-0: trades a household head takes (PS-4). */
export const HISTORY_OCCUPATIONS: Readonly<Record<string, string>> = {
  miller: "방앗간", sawyer: "제재소", mason: "석공소", chapman: "시장", husbandman: "헛간", woodward: "벌목소", quarrier: "채석장",
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
  guild_charter: "길드 인가 청원", tax_collection: "인두세 징수 방식", cloth_or_grain: "직물 대 곡물", borough_charter: "자치 특허 협상",
  royal_tax: "왕실 보조세 요구", heir_choice: "영주의 후계자", borough_autonomy: "자치 특허의 인장", legacy_choice: "남길 유산 하나",
  guild_dispute: "길드와 상인 사이의 다툼", church_rebuilding: "교구 교회 증축 청원",
};
/** The chapters' petitions, each answer's meaning (`petitionChoices.ko.ts`; the name kept for the screens that read it). */
export const WAR_CHOICES = PETITION_CHOICES;
/** PERSON-1a (LN-4): a birth's line by where the child's name came from. */
const NAME_FROM: Readonly<Record<string, string>> = {
  father: "아이가 태어나 아버지 이름을 받았다", grandfather: "아이가 태어나 할아버지 이름을 받았다",
  mother: "아이가 태어나 어머니 이름을 받았다", grandmother: "아이가 태어나 할머니 이름을 받았다",
  godparent: "아이가 태어나 대부모의 이름을 받았다", common: "아이가 태어났다",
};

const DEATH_CAUSES: Readonly<Record<string, string>> = {
  age: "세상을 떠났다", captivity: "유폐 중에 죽었다", famine: "굶주림 끝에 죽었다", famine_year: "기근 해에 병들어 죽었다", fire: "불에 목숨을 잃었다", plague: "역병으로 죽었다",
};

/** LM-E1: the estate's policies, the town's actors, a project's name. */
const ESTATE_POLICY_KO: Readonly<Record<string, string>> = { growth: "성장", revenue: "세입", stability: "안정", defence: "방어" };
// LM-E3: the negotiation's words — the tiers and the terms.
/** LM-R2-E ③: shared with the screens (one word for one thing, the ledger and the screen alike). */
export const TIER_KO: Readonly<Record<string, string>> = { impossible: "불가능", unlikely: "불리", close: "박빙", likely: "유력", almost_certain: "거의 확실" };
/** LM-R2-E ③: shared with the screens (one word for one thing, the ledger and the screen alike). */
export const TERM_KO: Readonly<Record<string, string>> = { cash: "계약금", pension: "연금", right_piece: "권리 조각", political_support: "정치적 지원",
  debt_assumption: "채무 인수", consent: "혼인 동의", inheritance_non_infringement: "상속 기대권 불침해", residence: "배우자 거주", land_use: "토지 사용수익",
  wardship: "후견 합의", jointure: "과부산", debt_after_inheritance: "상속 뒤 빚 갚기" };
// LM-E2: the estates' words — holders, pieces, a claim's basis, a suit's stages.
/** LM-R2-E ③: shared with the screens (one word for one thing, the ledger and the screen alike). */
export const HOLDER_KO: Readonly<Record<string, string>> = { lord: "영주", overlord: "상위 영주", crown: "국왕", merchants: "상인들", townsfolk: "주민들",
  neighbour_1: "첫째 이웃 영주", neighbour_2: "둘째 이웃 영주", bishop: "주교" };
const holderWord = (holder: string) => HOLDER_KO[holder] ?? (holder.startsWith("person:") ? "옛 가문의 친족" : holder.startsWith("estate:") ? "이웃 영주" : holder);
/** LM-R2-E ③: shared with the screens (one word for one thing, the ledger and the screen alike). */
export const PIECE_KO: Readonly<Record<string, string>> = { land_rent: "토지 지대", manor_court: "장원 법정", mill: "방앗간 사용료", market: "시장 좌판세",
  tolls: "통행세", fishery: "어업권", advowson: "성직자 추천권", hunting: "사냥권" };
const pieceWord = (piece: string, estate: string) => piece === "" ? (estate === "" ? "영지" : "영지 전체") : PIECE_KO[piece.slice(piece.lastIndexOf(":") + 1)] ?? piece;
/** LM-R2-E ③: shared with the screens (one word for one thing, the ledger and the screen alike). */
export const CLAIM_BASIS_KO: Readonly<Record<string, string>> = { inheritance: "상속", marriage: "혼인", purchase_deed: "매입 문서", grant: "하사", old_possession: "오래된 점유" };
const basisWord = (basis: string) => CLAIM_BASIS_KO[basis] ?? basis;
const ESTATE_ROLE_KO: Readonly<Record<string, string>> = { head: "이웃 영주", steward: "청지기", kin: "이웃 가문" };
/** LM-R2-E ③: shared with the screens (one word for one thing, the ledger and the screen alike). */
export const SUIT_STAGE_KO: Readonly<Record<string, string>> = { filed: "제기", evidence: "증거", patronage: "후원", hearing: "심리", judged: "판결", enforcing: "점유 집행" };
const ACTOR_KO: Readonly<Record<string, string>> = { households: "가구들", merchants: "상인 가문", guild: "길드", community: "공동체", church: "교회" };
const buildingWord = (kind: string) => BUILDING_COPY[kind as keyof typeof BUILDING_COPY]?.name ?? kind;
/** A season, for "○철 늦게" (the calendar's words, not ticks). */
const SEASON_TICKS_FOR_WORDS = BALANCE.TICKS_PER_YEAR / 4;
const projectWord = (what: string) => what === "road" ? "길" : what.startsWith("zone:") ? "구역" : what === "rebuild_house" ? "집 재건"
  : what === "demolish_house" ? "집 헐기" : what === "farmstead_crop" ? "작물 바꾸기" : buildingWord(what);

/** COPY-1e (CA-050): a petition left unanswered, one sentence for every era's. */
const unansweredLine = (params: P) => `${PETITION_SUBJECTS[s(params, "defId")] ?? s(params, "defId")}에 답하지 않았다`;

/** DEC-TRACE §6: the heir's tie to the lord he succeeded. */
const KIN_WORDS: Readonly<Record<string, string>> = { son: "아들", daughter: "딸", sibling: "형제", spouse: "배우자", kin: "친족" };

/** DEC-TRACE §1: what a card's command decided (the lord's answer in lord mode). */
const CARD_COMMAND: Readonly<Record<string, string>> = {
  answer_registry_offer: "사건에 답했다", answer_estate_petition: "영지 청원에 답했다", file_suit: "소송을 걸었다", add_suit_evidence: "소송에 증거를 냈다",
  seek_suit_patron: "소송 후원자를 찾았다", enforce_possession: "판결대로 점유를 집행하려 했다", propose_marriage: "혼인을 청했다", answer_counter: "혼인 역제안에 답했다",
  keep_promise: "약속을 지켰다", answer_will_change: "유언 변경에 답했다", set_estate_oversight: "영지 감독을 정했다", set_exception_rules: "청지기 예외를 정했다",
  set_standing_policy: "청지기의 상시 방침을 정했다", set_audit_mode: "감사 방식을 정했다", answer_audit: "감사 결과에 답했다", order_timber: "목재 주문을 정했다",
  add_defence_evidence: "걸려 온 소송에 증거를 냈다", seek_defence_patron: "걸려 온 소송에 후원자를 찾았다", settle_suit: "소송을 합의로 끝냈다",
  hold_possession: "판결에 맞서 점유를 지키려 사람을 들였다", guard_possession: "땅을 지킬 사람을 들였다", appease_neighbour: "이웃 가문에 선물을 보내 달랬다",
};
/** DEC-TRACE §1: the standing policies' words. */
const STANDING_WORDS: Readonly<Record<string, string>> = { customary: "관습대로", lenient: "가볍게", strict: "엄하게", lord: "영주에게" };
/** DEC-TRACE §2: what followed, in a line (the screens put "○○년 당신의 결정 때문에" before it). */
const CONSEQUENCE_WORDS: Readonly<Record<string, (params: P) => string>> = {
  households_left: params => `${n(params, "households")}가구가 떠났다`,
  households_arrived: params => `${n(params, "households")}가구가 들어왔다`,
  // DEC-CARD-2 (render): the stage in words, as the ledger's own suit line says it (it showed the engine's id).
  suit_turned: params => s(params, "stage") === "closed" ? "소송이 끝났다" : `소송이 ${SUIT_STAGE_KO[s(params, "stage")] ?? s(params, "stage")} 단계로 넘어갔다`,
  marriage_turned: () => "혼인이 한 걸음 나아갔다",
  promise_made: () => "약속이 맺어졌다",
  promise_kept: () => "약속이 지켜졌다",
  promise_broken: () => "약속이 깨졌다",
  project_started: params => `${buildingWord(s(params, "what"))} 사업이 시작되었다`,
  goods_delivered: params => `목재 ${n(params, "brought")}단이 들어왔다`,
  audit: () => "영지 감사가 열렸다",
  estate_mood: () => "영지 사람들의 마음이 달라졌다",
  crisis_outcome: params => n(params, "avoided") === 1
    ? `흉년이 지나갔다 — 굶어 죽거나 떠난 집 없음(${CRISIS_REASONS[s(params, "reason")] ?? s(params, "reason")})`
    : `흉년이 지나갔다 — 굶주림으로 ${n(params, "deaths")}명이 죽고 ${n(params, "departures")}가구가 떠났다`,
  right_income: params => `얻은 권리에서 첫 수입 ${moneyWords(n(params, "income"))}${josa(moneyWords(n(params, "income")), "이", "가")} 들어왔다`,
  community_built: params => {
    const builder = ACTOR_KO[s(params, "builder")] ?? s(params, "builder");
    const seasons = Math.max(1, Math.round(n(params, "delay") / SEASON_TICKS_FOR_WORDS));
    const late = seasons < 4 ? `${seasons}철` : seasons % 4 === 0 ? `${seasons / 4}년` : `${Math.floor(seasons / 4)}년 ${seasons % 4}철`;
    const treasury = n(params, "treasury");
    return `${builder}${josa(builder, "이", "가")} 거절해 공동체가 대신 지었다 — ${buildingWord(s(params, "what"))}, ${late} 늦게, `
      + (treasury > 0 ? `금고 ${moneyWords(treasury)}` : `공동체 웃돈 ${moneyWords(n(params, "premium"))}`);
  },
  // SUIT-THREAD (DTR-20): a judgment's possession, its first rent.
  suit_rent: params => `${n(params, "year")}년 ${n(params, "concord") === 1 ? "합의로 지킨" : "판결로 점유한"} 땅에서 ${n(params, "concord") === 1 ? "" : "첫 "}지대 ${moneyWords(n(params, "income"))}${josa(moneyWords(n(params, "income")), "이", "가")} 들어왔다`,
  payment_flow: params => {
    const line = LEDGER_CATEGORY_LABELS[s(params, "category") as keyof typeof LEDGER_CATEGORY_LABELS] ?? s(params, "category");
    const out = n(params, "expense") > n(params, "income");
    const money = moneyWords(Math.abs(n(params, "income") - n(params, "expense")));
    return `그 뒤 첫 ${line} ${money}${josa(money, "이", "가")} ${out ? "나갔다" : "들어왔다"}`;
  },
};
/** DEC-TRACE §6: why a dearth did no harm, and the weak points a town met it with. */
const CRISIS_REASONS: Readonly<Record<string, string>> = { stores: "곡식을 쌓아 둔 덕", relief: "영주의 구휼 덕", weak: "흉년이 약했다", damage: "" };
/** The weak points' words (PLAY-2: shared with the screens — one word for one thing). */
export const WEAK_POINTS: Readonly<Record<string, string>> = { no_granary: "곡창 없음", food_under_a_season: "식량이 한 철도 안 됨", households_short: "이미 굶는 집", no_market: "곡식을 살 장터 없음" };

/** GB-4: why the town gave a site up (its old records say `no_route`). */
const ABANDON_WORDS: Readonly<Record<string, string>> = { road: "길이 닿지 않았다", no_route: "길이 닿지 않았다", material: "자재가 오지 않았다", work: "일할 사람이 없었다" };

/** DEC-TRACE §3: a faction's act. */
const FACTION_ACT_WORDS: Readonly<Record<string, string>> = {
  merchant_invest: "좌판과 거래에 돈을 더 들였다", merchant_settle: "상인 가구들이 들어왔다", merchant_withdraw: "좌판에서 돈을 거두었다", merchant_leave: "상인 가구들이 떠났다",
  commons_settle: "새 가구가 들어왔다", commons_flock: "여러 가구가 몰려왔다", commons_leave: "한 가구가 떠났다", commons_exodus: "여러 가구가 떠났다",
  town_fund: "공공사업 기금을 모았다", town_works: "공공사업에 큰돈을 모았다", town_withhold: "영주에게 낼 돈을 미루었다", town_boycott: "공사와 일감을 거부했다",
  church_gift: "영주에게 선물을 보냈다", church_endow: "교회 사업에 큰 기부를 모았다", church_demand: "수선비를 요구했다", church_penance: "속죄금을 요구했다",
  overlord_favour: "영주의 청구를 거들었다", overlord_confirm: "영주의 권리를 확인해 주었다", overlord_aid: "원조금을 요구했다", overlord_fine: "벌금을 물렸다",
  crown_favour: "영주의 청구를 거들었다", crown_confirm: "영주의 권리를 확인해 주었다", crown_aid: "원조금을 요구했다", crown_fine: "벌금을 물렸다",
  neighbour_support: "영주의 청구를 거들었다", neighbour_alliance: "영주와 손을 잡았다", neighbour_claim: "영주의 땅에 청구를 냈다", neighbour_suit: "영주를 상대로 소송을 걸었다",
};

export const HISTORY_TEMPLATES: Readonly<Record<string, (params: P) => string>> = {
  "house.succession": params => `${n(params, "died") === 1 ? `영주 ${s(params, "deceased")}${josa(s(params, "deceased"), "이", "가")} ${n(params, "deadAge")}살에 죽고, ` : ""}${KIN_WORDS[s(params, "kin")] ?? "친족"} ${s(params, "heir")}(${n(params, "heirAge")}살)이 가문을 이었다`,
  // Astra lordplay2 ④: the weather is no decision's doing — under a decision that prepared for it, the line says what that
  // decision had left ready when it came (`prepared`), not that it brought it.
  "crisis.arrived": params => `${n(params, "prepared") === 1 ? "흉년이 닥쳤을 때 이 결정이 남긴 대비" : "흉년이 닥쳤다 — 그때 대비"}: 쌓인 식량 ${n(params, "foodDays") < 0 ? "알 수 없음" : `${n(params, "foodDays")}일분`}, 곡창 ${n(params, "granaries")}채${s(params, "weakPoints") === "" ? "" : `; 약점: ${s(params, "weakPoints").split(",").map(point => WEAK_POINTS[point] ?? point).join(", ")}`}`,
  "decision.card": params => CARD_COMMAND[s(params, "command")] ?? "영주가 결정했다",
  "decision.steward": params => `청지기가 ${STANDING_WORDS[s(params, "policy")] ?? STANDING_WORDS.customary} 처리했다`,
  "decision.lapsed": () => "답하지 않은 채 기한이 지났다",
  consequence: params => CONSEQUENCE_WORDS[s(params, "key")]?.(params) ?? s(params, "key"),
  // DTR-23: the neighbours' large grudge is first a forcible entry forewarned (its detail names the threat).
  "faction.act": params => `${factionDisplayName(s(params, "faction"), s(params, "name"))}: ${s(params, "threat") !== "" ? "영주가 쥔 땅에 힘으로 들어오려 사람을 모았다" : FACTION_ACT_WORDS[s(params, "act")] ?? s(params, "act")}`,
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
  // COPY-1e (CA-007): the 1351 Statute of Labourers (the 1349 Ordinance is 노동자 조례); proclaimed, not read by the king.
  "plague.ordinance": params => n(params, "fine") > 0 ? `노동자법이 공포되었다 — 임금을 올린 영주에게 벌금 ${moneyWords(n(params, "fine"))}` : "노동자법이 공포되었다",
  "plague.resettlement": () => "빈집에 새 가족이 들기 시작했다",
  "plague.second": () => "두 번째 역병이 왔다",
  "plague.second_ended": params => `두 번째 역병이 물러갔다 — ${n(params, "dead")}명이 죽었다`,
  "plague.unanswered": params => unansweredLine(params),
  // F4-A (RG-1…RG-10): the reorganisation.
  "reorg.wage_competition": () => "이웃 장원이 더 높은 임금으로 일꾼을 부른다",
  "reorg.textile_street": () => "직조공 집이 늘어 직물 거리가 생겼다",
  "reorg.alehouse_boom": () => "에일집마다 사람이 붐빈다",
  "reorg.petitions_surge": () => "상인과 직인 무리의 청원이 쏟아진다",
  "reorg.guild_founded": () => "직인 길드가 섰다",
  "reorg.weavers_left": params => `직조공 ${n(params, "households")}가구가 길드가 있는 도시로 떠났다`,
  "reorg.overlord_warning": params => `상위 영주가 도시의 성장을 경계했다 — 도시의 힘 ${n(params, "influence")}`,
  "reorg.poll_tax": params => `인두세를 걷었다 — 영주의 몫 ${moneyWords(n(params, "amount"))}`,
  "reorg.rebellion_rumour": params => s(params, "outcome") === "chased" ? "농민 반란의 소문 — 사람들이 세금 징수원을 쫓아내고 장원 법정 기록을 태웠다" : "농민 반란의 소문이 돌았지만 도시는 조용했다",
  "reorg.autonomy_request": () => "도시가 자치 특허를 요구하는 문서를 올렸다",
  "reorg.charter": params => s(params, "charter") === "partial" ? "자치 특허를 맺었다 — 시장과 통행세 일부가 도시로 넘어갔다" : "자치 특허를 내주지 않았다",
  "reorg.unanswered": params => unansweredLine(params),
  // F5-A (LG-1…LG-8): chapter 5, autonomy and legacy.
  "legacy.mayor_demand": params => s(params, "candidate") === "" ? "상인 엘리트가 도시가 제 시장을 뽑게 해 달라고 요구했다"
    : `상인 엘리트가 도시가 제 시장을 뽑게 해 달라고 요구했다 — 후보 ${s(params, "candidate")}`,
  "legacy.royal_tax_envoy": () => "국왕의 과세 사절이 왔다 — 15분의 1·10분의 1세",
  "legacy.succession": params => { const lord = s(params, "lord"); const age = n(params, "age"); return `${age >= 50 ? "늙은 영주" : "영주"} ${lord}(${age}세)${josa(lord, "이", "가")} 후계자를 정해야 한다 — 후보 ${n(params, "candidates")}명`; },
  // FIX-11: wardship of a minor lord.
  "lord.wardship_begun": params => { const lord = s(params, "lord"); const guardian = s(params, "guardian"); return guardian === "" ? `${lord}${josa(lord, "이", "가")} 미성년 영주다 — 상위 영주가 후견한다` : `${lord}${josa(lord, "이", "가")} 미성년 영주다 — 후견인 ${guardian}`; },
  "lord.wardship_ended": params => { const lord = s(params, "lord"); return `${lord}${josa(lord, "이", "가")} 성년이 되어 후견이 끝났다`; },
  "legacy.heir_seated": params => { const heir = s(params, "heir"); return `${heir}${josa(heir, "이", "가")} 가문을 이었다 — ${s(params, "relation")}`; },
  "legacy.royal_subsidy": params => `국왕에게 보조세를 냈다 — ${moneyWords(n(params, "amount"))}`,
  "legacy.city_seal": () => "도시가 제 인장을 새겼다",
  "legacy.charter_sealed": params => s(params, "mayor") === "" ? "자치 특허에 도시 인장이 찍혔다" : `자치 특허에 도시 인장이 찍혔다 — 첫 시장 ${s(params, "mayor")}`,
  "legacy.charter_refused": params => `영주가 자치 특허를 거절했다 — 도시의 반발 ${n(params, "backlash")}`,
  "legacy.family_departed": params => `${houseName(s(params, "house"))} 가문이 영주관을 떠나 시골 장원으로 갔다`,
  "legacy.family_stayed": params => `${houseName(s(params, "house"))} 가문이 영주관에 남았다`,
  "legacy.legacy_record": params => s(params, "legacy") === "" ? "유산 기록을 봉인했다 — 남긴 것 없이" : `유산 기록을 봉인했다 — ${s(params, "legacy")}`,
  "legacy.last_market": params => `마지막 장날 — ${s(params, "ending")}`,
  // FIX-9 (LG-13): the interlude 1384–1400.
  "legacy.staple": () => "칼레의 양모 지정 무역 제도가 잠시 중단되었다 — 직물 값이 오른다(게임 효과)",
  "legacy.guild_dispute": () => "길드와 상인이 직물을 파는 권리를 두고 다툰다",
  "legacy.market_fire": params => `장터에 불이 났다 — 수리에 ${moneyWords(n(params, "cost"))}`,
  "legacy.church_rebuilding": () => "교구가 낡은 교회의 증축을 청했다",
  "legacy.nave_rebuilt": () => "교회의 새 회중석이 섰다",
  "legacy.deposition": () => "리처드 2세가 폐위되고 헨리 4세가 즉위했다",
  "legacy.unanswered": params => unansweredLine(params),
  "war.beacon": () => "해안의 봉화가 올랐다",
  "war.raid": params => `해안 습격이 닥쳤다 — 불탄 집 ${n(params, "burntHouses")}, 빼앗긴 물자 ${n(params, "looted")}, 빼앗긴 돈 ${moneyWords(n(params, "coin"))}`,
  "war.conscripts_left": params => `징집된 남자 ${n(params, "men")}명이 떠났다`,
  "war.conscripts_returned": params => n(params, "lost") === 0 ? `징집된 남자 ${n(params, "men")}명이 모두 돌아왔다` : `징집된 남자들이 돌아왔다 — ${n(params, "lost")}명은 돌아오지 못했다`,
  "war.favour_lost": () => "왕실의 신임을 잃었다",
  "war.licence": () => "왕실 조달 면허를 받았다",
  "war.unanswered": params => unansweredLine(params),
  // FACTION-0 (FX-4): a faction's relation moved.
  // FIX-12 (item 3, QA-036): the names are drawn from the ids when the record is read (item 4).
  "faction.leader_succeeded": params => { const before = s(params, "predecessor"), next = s(params, "leader");
    return `${factionDisplayName(s(params, "faction"), s(params, "name"))}의 ${before}${josa(before, "이", "가")} 세상을 떠나 ${next}${josa(next, "이", "가")} 무리를 이끈다`; },
  "petition.representative_replaced": params => { const before = s(params, "predecessor"), next = s(params, "leader");
    return `${PETITION_SUBJECTS[s(params, "defId")] ?? s(params, "defId")}의 대표 ${before}${josa(before, "이", "가")} ${s(params, "gone") === "left" ? "마을을" : "세상을"} 떠나 ${next}${josa(next, "이", "가")} 대신 나섰다`; },
  // LM-E4 (SW-2…SW-7): the off-map estates' oversight; the steward is named from his id when read.
  // FIX-13 (ES-11): the people off the map die by the table; a dead steward's place goes to the most loyal candidate.
  "estate.person_died": params => `${s(params, "deceased")}(${ESTATE_ROLE_KO[s(params, "role")] ?? s(params, "role")})${josa(s(params, "deceased"), "이", "가")} ${n(params, "age")}세로 세상을 떠났다`,
  "stewardship.steward_died": params => `${estateWord(s(params, "house"))}의 청지기 ${s(params, "deceased")}${josa(s(params, "deceased"), "이", "가")} 죽어 ${s(params, "steward")}${josa(s(params, "steward"), "이", "가")} 뒤를 잇는다`,
  "stewardship.began": params => `${estateWord(s(params, "house"))}${josa(estateWord(s(params, "house")), "이", "가")} 영주의 손에 들어왔다 — 영주가 직접 보고, ${s(params, "steward")}${josa(s(params, "steward"), "이", "가")} 장부를 맡는다`,
  "stewardship.oversight": params => s(params, "mode") === "steward" ? `${estateWord(s(params, "house"))}${josa(estateWord(s(params, "house")), "을", "를")} 청지기 ${s(params, "steward")}에게 맡겼다`
    : `${estateWord(s(params, "house"))}${josa(estateWord(s(params, "house")), "을", "를")} 영주가 직접 본다 — 장부는 ${s(params, "steward")}`,
  "stewardship.audit_mode": params => `${estateWord(s(params, "house"))}의 미카엘마스 감사: ${s(params, "mode") === "visit" ? "영주가 직접 찾아간다" : "장부로 받는다"}`,
  "stewardship.rules": params => { const parts = [...(n(params, "amount") >= 0 ? [`${moneyWords(n(params, "amount"))} 이상`] : []), ...(n(params, "rights") === 1 ? ["권리 변경"] : []), ...(n(params, "marriage") === 1 ? ["혼인"] : [])];
    // FIX-14 (SW-12): with recurring kinds brought up again (no precedent).
    const again = n(params, "recurring") === 1 ? " — 선례가 있어도 다시 올린다" : "";
    return parts.length === 0 ? `예외를 거뒀다: 청지기가 모두 정한다${again}` : `예외를 정했다: ${parts.join("·")}${josa(parts.at(-1)!, "은", "는")} 영주에게${again}`; },
  "stewardship.season": params => `${estateWord(s(params, "house"))}의 한 철 — 장부상 수입 ${moneyWords(n(params, "reported"))}${n(params, "overloaded") === 1 ? " (영주의 눈이 닿지 못함)" : ""}`,
  // FIX-14 (SW-11, SW-12): the home estate's petitions to the lord himself, and the steward's precedent.
  "manor.petition": params => `장원에서 ${estatePetitionWord(s(params, "kind"))}${josa(estatePetitionWord(s(params, "kind")), "이", "가")} 영주에게 왔다${n(params, "amount") > 0 ? ` — ${moneyWords(n(params, "amount"))}` : ""}`,
  "registry.offered": params => `${registryTitle(s(params, "entry"))}`,
  "registry.answered": params => `${registryTitle(s(params, "entry"))}: ${registryChoiceLedger(s(params, "entry"), s(params, "choice"))}`,
  "registry.lapsed": params => `${registryTitle(s(params, "entry"))}: 답하지 않아 기한이 지났다`,
  "registry.invalid": params => `${registryTitle(s(params, "entry"))}: 사정이 바뀌어 없던 일이 되었다`,
  "registry.term_began": params => { const kind = REGISTRY_TERM_WORDS[s(params, "kind")] ?? s(params, "kind"); return `${REGISTRY_TERM_WORDS[s(params, "what")] ?? s(params, "what")} ${kind}${josa(kind, "이", "가")} ${n(params, "years")}년 동안 이어진다`; },
  "registry.term_ended": params => { const kind = REGISTRY_TERM_WORDS[s(params, "kind")] ?? s(params, "kind"); return `${REGISTRY_TERM_WORDS[s(params, "what")] ?? s(params, "what")} ${kind}${josa(kind, "이", "가")} 기한이 끝나 그쳤다`; },
  "manor.petition_precedent": params => `청지기가 선례대로 ${estatePetitionWord(s(params, "kind"))}에 답했다: ${manorAnswerWord(s(params, "kind"), n(params, "granted") === 1)}`,
  "manor.petition_steward": params => `청지기가 ${STANDING_WORDS[s(params, "policy")] ?? STANDING_WORDS.customary} ${estatePetitionWord(s(params, "kind"))}에 답했다: ${manorAnswerWord(s(params, "kind"), n(params, "granted") === 1)}`,
  "manor.petition_answered": params => `영주가 ${estatePetitionWord(s(params, "kind"))}에 답했다: ${manorAnswerWord(s(params, "kind"), n(params, "granted") === 1)}`,
  "manor.petition_lapsed": params => `${estatePetitionWord(s(params, "kind"))}에 답하지 않았다 — 기다리다 거둬졌다`,
  "stewardship.precedent": params => `청지기 ${s(params, "steward")}${josa(s(params, "steward"), "이", "가")} 선례대로 ${estatePetitionWord(s(params, "kind"))}${josa(estatePetitionWord(s(params, "kind")), "을", "를")} ${n(params, "granted") === 1 ? "허락했다" : "기각했다"}`,
  "stewardship.steward_decided": params => s(params, "kind") === "common_dispute"
    ? `청지기 ${s(params, "steward")}${josa(s(params, "steward"), "이", "가")} 공유지 다툼에서 ${n(params, "granted") === 1 ? "소작인" : "상인"} 편을 들었다`
    : `청지기 ${s(params, "steward")}${josa(s(params, "steward"), "이", "가")} ${estatePetitionWord(s(params, "kind"))}${josa(estatePetitionWord(s(params, "kind")), "을", "를")} ${n(params, "granted") === 1 ? "허락했다" : "기각했다"}`,
  "stewardship.escalated": params => `청지기 ${s(params, "steward")}${josa(s(params, "steward"), "이", "가")} ${estatePetitionWord(s(params, "kind"))}${josa(estatePetitionWord(s(params, "kind")), "을", "를")} 영주에게 올렸다 — ${EXCEPTION_RULE_KO[s(params, "rule")] ?? s(params, "rule")}`,
  "stewardship.brought": params => `${estateWord(s(params, "house"))}의 ${estatePetitionWord(s(params, "kind"))}${josa(estatePetitionWord(s(params, "kind")), "이", "가")} 영주에게 왔다${n(params, "late") === 1 ? " — 한 철 늦게 닿는다" : ""}`,
  "stewardship.lord_decided": params => s(params, "kind") === "common_dispute"
    ? `영주가 ${estateWord(s(params, "house"))}의 공유지 다툼에서 ${n(params, "granted") === 1 ? "소작인" : "상인"} 편을 들었다`
    : `영주가 ${estateWord(s(params, "house"))}의 ${estatePetitionWord(s(params, "kind"))}${josa(estatePetitionWord(s(params, "kind")), "을", "를")} ${n(params, "granted") === 1 ? "허락했다" : "기각했다"}`,
  "stewardship.lapsed": params => `${estateWord(s(params, "house"))}의 ${estatePetitionWord(s(params, "kind"))}에 답하지 않았다 — 기다리다 거둬졌다`,
  "stewardship.audit_clean": params => `미카엘마스 감사(${s(params, "mode") === "visit" ? "방문" : "장부"}): ${estateWord(s(params, "house"))}의 장부가 맞았다`,
  "stewardship.audit_found": params => `미카엘마스 감사(${s(params, "mode") === "visit" ? "방문" : "장부"}): 청지기 ${s(params, "steward")}의 장부에서 ${moneyWords(n(params, "kept") + n(params, "errors"))}${josa(moneyWords(n(params, "kept") + n(params, "errors")), "이", "가")} 비었다 — 빼돌림 ${moneyWords(n(params, "kept"))}, 잘못 ${moneyWords(n(params, "errors"))}`,
  "stewardship.audit_answered": params => s(params, "choice") === "punished" ? (n(params, "recovered") > 0
    ? `영주가 청지기 ${s(params, "steward")}${josa(s(params, "steward"), "을", "를")} 벌하고 ${moneyWords(n(params, "recovered"))}${josa(moneyWords(n(params, "recovered")), "을", "를")} 되찾았다`
    : `영주가 청지기 ${s(params, "steward")}${josa(s(params, "steward"), "을", "를")} 장부의 잘못으로 벌했다`)
    : s(params, "choice") === "replaced" ? `영주가 청지기 ${s(params, "steward")}${josa(s(params, "steward"), "을", "를")} 갈았다` : `영주가 청지기 ${s(params, "steward")}의 장부를 묵인했다`,
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
  "marriage.contracted": params => { const groom = GROOM_RELATION_KO[s(params, "relation")] ?? GROOM_RELATION_KO.son!;
    return `혼인 계약 — ${groom}${josa(groom, "과", "와")} 이웃 영주의 맏딸`; },
  "marriage.bride_arrived": () => "신부가 영주관에 들어왔다",
  "marriage.child_born": () => "부부의 첫아이가 태어났다",
  "marriage.brother_in_law_born": () => "이웃 영주가 다시 장가들어 아들을 얻었다 — 상속 기대가 줄었다",
  "marriage.father_ill": () => "이웃 영주가 병들었다",
  "marriage.will_change": () => "이웃 영주가 유언을 고치려 한다",
  "marriage.will_dropped": () => "이웃 영주가 유언을 고치지 않기로 했다",
  "marriage.father_died": () => "이웃 영주가 죽었다",
  "marriage.inherited": () => "아내를 통해 이웃 영지를 물려받았다 — 이제 우리 영지다",
  "marriage.lost": () => "이웃 영지는 그의 아들에게 갔다",
  // FIX-13 (NG-5b): what was not cash.
  // COPY-1e (CA-013): the lord's promise is void, not the neighbour's debt.
  "marriage.deferred_void": params => `상속이 무산되어 이웃의 빚 ${moneyWords(n(params, "amount"))}을 떠맡기로 한 약속이 해제되었다`,
  "marriage.jointure_settled": params => `남편을 먼저 보낸 아내가 과부산으로 ${pieceWord(s(params, "piece"), "")}${josa(pieceWord(s(params, "piece"), ""), "을", "를")} 평생 갖는다`,
  "marriage.contested": () => "새 유언대로 조카가 영지를 차지했다 — 소송으로 다툴 수 있다",
  // LM-E2 (ES-5…ES-7): claims, suits, titles and possessions.
  "estate.claim_raised": params => `${holderWord(s(params, "claimant"))}${josa(holderWord(s(params, "claimant")), "이", "가")} ${pieceWord(s(params, "piece"), s(params, "estate"))}에 ${basisWord(s(params, "basis"))}${josa(basisWord(s(params, "basis")), "을", "를")} 근거로 청구를 냈다`,
  "estate.suit_filed": params => `${holderWord(s(params, "plaintiff"))}${josa(holderWord(s(params, "plaintiff")), "이", "가")} ${holderWord(s(params, "defendant"))}${josa(holderWord(s(params, "defendant")), "을", "를")} 상대로 ${pieceWord(s(params, "piece"), "")} 소송을 냈다`,
  "estate.suit_stage": params => `소송이 ${SUIT_STAGE_KO[s(params, "stage")] ?? s(params, "stage")} 단계로 넘어갔다`,
  "estate.suit_patron": params => `${holderWord(s(params, "patron"))}${josa(holderWord(s(params, "patron")), "이", "가")} 소송의 후원자가 되었다`,
  // Astra lordplay2 ②: who won and who lost — the lord's own suit, or a house's against him (older records: the lord's).
  "estate.suit_judged": params => {
    const piece = pieceWord(s(params, "piece"), "");
    const plaintiff = s(params, "plaintiff");
    if (plaintiff === "" || plaintiff === "lord") return s(params, "verdict") === "plaintiff" ? `판결이 났다: 영주가 이겼다 — ${piece}의 권원이 영주에게 넘어왔다(점유는 따로)` : "판결이 났다: 영주가 졌다";
    const house = holderWord(plaintiff);
    return s(params, "verdict") === "plaintiff" ? `판결이 났다: ${house}${josa(house, "이", "가")} 이겼다 — 영주가 ${piece}의 권원을 잃었다(점유는 따로)`
      : `판결이 났다: ${house}${josa(house, "이", "가")} 졌다 — 영주가 ${piece}${josa(piece, "을", "를")} 지켰다`;
  },
  "estate.possession_enforced": params => {
    const piece = pieceWord(s(params, "piece"), "");
    const plaintiff = s(params, "plaintiff");
    const nth = `(${n(params, "attempt")}번째)`;
    if (plaintiff === "" || plaintiff === "lord") return n(params, "succeeded") === 1 ? `판결대로 영주가 ${piece}의 점유를 넘겨받았다${nth}` : `점유자가 버텼다: 영주의 ${piece} 점유 집행이 막혔다${nth}`;
    const house = holderWord(plaintiff);
    return n(params, "succeeded") === 1 ? `${house}${josa(house, "이", "가")} 판결대로 영주에게서 ${piece}의 점유를 가져갔다 — 영주가 잃었다${nth}`
      : `영주가 버텼다: ${house}의 ${piece} 점유 집행을 막았다${nth}`;
  },
  // DTR-23: a final concord, the lord's hold, a forcible entry forewarned and how it ended.
  "estate.suit_settled": params => {
    const piece = pieceWord(s(params, "piece"), "");
    const house = holderWord(s(params, "plaintiff"));
    return s(params, "terms") === "pay" ? `합의로 끝났다: 영주가 ${house}에게 ${moneyWords(n(params, "amount"))}${josa(moneyWords(n(params, "amount")), "을", "를")} 주고 ${piece}${josa(piece, "을", "를")} 지켰다`
      : `합의로 끝났다: 영주가 ${piece}${josa(piece, "을", "를")} ${house}에게 내주었다`;
  },
  "estate.possession_held": params => `영주가 사람을 들여 ${holderWord(s(params, "plaintiff"))}에게 맞서 ${pieceWord(s(params, "piece"), "")} 점유를 지킨다 — 버티는 힘 ${n(params, "hold")}`,
  "estate.entry_threatened": params => {
    const house = holderWord(s(params, "house"));
    return `${house}${josa(house, "이", "가")} 사람을 모은다: 다음 철에 ${pieceWord(s(params, "piece"), "")}에 힘으로 들어오려 한다 — 지킬 사람을 들이거나 선물로 달랠 수 있다`;
  },
  "estate.entry_repelled": params => `${holderWord(s(params, "house"))}의 사람들이 왔으나 지키던 사람들에 막혀 ${pieceWord(s(params, "piece"), "")}에 들지 못했다`,
  "estate.entry_called_off": params => {
    const house = holderWord(s(params, "house"));
    return `${house}${josa(house, "이", "가")} 선물을 받고 사람들을 물렸다`;
  },
  "estate.entry_forced": params => {
    const house = holderWord(s(params, "house"));
    return `${house}${josa(house, "이", "가")} 힘으로 ${pieceWord(s(params, "piece"), "")}에 들어왔다 — 영주가 점유를 잃었다. 점유 침탈 소송을 낼 수 있다`;
  },
  "estate.title_changed": params => `${pieceWord(s(params, "piece"), s(params, "estate"))}의 권원이 ${holderWord(s(params, "from"))}에게서 ${holderWord(s(params, "to"))}에게 넘어갔다`,
  "estate.possession_changed": params => `${pieceWord(s(params, "piece"), s(params, "estate"))}의 점유가 ${holderWord(s(params, "from"))}에게서 ${holderWord(s(params, "to"))}에게 넘어갔다`,
  // LM-E1b (TA-6 ②): a subsidy refused — the subsidies together would pass a quarter of the treasury.
  "agency.subsidy_refused": params => `${buildingWord(s(params, "kind"))} 장려금 ${moneyWords(n(params, "amount"))}${moneyWordsJosa(moneyWords(n(params, "amount")), "은", "는")} 걸지 못했다: 장려금 합계 ${moneyWords(n(params, "total"))}${moneyWordsJosa(moneyWords(n(params, "total")), "이", "가")} 금고의 4분의 1(${moneyWords(n(params, "limit"))})을 넘는다`,
  // FIX-14 (FX13-5): the town buys the timber its market charter waits on.
  // GB-4: the town gave a site up — its cause, not a shortage (P-C3).
  "agency.site_abandoned": params => `도시가 ${projectWord(s(params, "what"))} 공사를 접었다 — ${n(params, "years")}년 동안 ${ABANDON_WORDS[s(params, "reason")] ?? ABANDON_WORDS.road}`,
  "agency.timber_ordered": params => `도시가 시장 칙허에 모자란 목재 ${n(params, "amount")}을 상인에게 주문했다`,
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
  // COPY-1e (CA-006): the treasury's change in money words (£ s d), the people counted.
  "ledger.season": params => `계절 결산 — 인구 ${n(params, "population")}명(${n(params, "popDelta") >= 0 ? "+" : ""}${n(params, "popDelta")}명), 금고 ${moneyWordsFullDelta(n(params, "net"))}`, // COPY-1r CA-006: a confirmed sum, in full
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
  "person.water": () => "가구에 우물물이 공급되었다",
  "person.water_lost": () => "가구의 우물물 공급이 끊겼다",
  "person.born": params => NAME_FROM[s(params, "nameFrom")] ?? "아이가 태어났다",
  "person.married": () => "혼인해 가구를 이루었다",
  "person.arrived": () => "친척이 와서 함께 살게 되었다",
  "person.came_of_age": () => "어른이 되어 일을 거들기 시작했다",
  "person.occupation": params => `${HISTORY_OCCUPATIONS[s(params, "occupation")] ?? s(params, "occupation")} 일을 맡았다`,
  "person.reeve": () => "마을 사람들 가운데서 마을 대표로 뽑혔다",
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
