import { SCENARIO_COPY } from "../../content/scenario/scenarioCopy.ko";
import { pence } from "../hud/hudCopy.ko";

// CHRON-1 chronicle screen copy (the records' own sentences are src/content/historyCopy.ko.ts).
const METRIC_NAMES: Readonly<Record<string, string>> = { population: "인구", treasury: "금고", merchantGauge: "상인 게이지", lots: "필지", l4: "도시 대가옥" };
const DECISION_KIND_NAMES: Readonly<Record<string, string>> = {
  famine_response: "대기근 대응", petition_response: "상인 청원", market_town: "시장도시 선포", stone_town: "석벽 선포", rebuild: "재건",
  wall_expand: "목책 넓히기",
};
const BUNDLE_NAMES: Readonly<Record<string, string>> = {
  build: "공사", road: "길", zone: "구역", house: "집 합치기·헐기", cancel: "공사 거둠", operation: "가동 바꿈", wall_priority: "성벽 우선",
};
const ROLES: Readonly<Record<string, string>> = { head: "가구주", spouse: "배우자", child: "자녀", kin: "친척", steward: "청지기" };
/** PERSON-0 trades (PS-4) as what the person is called. */
export const OCCUPATION_TITLES: Readonly<Record<string, string>> = {
  miller: "방앗간지기", sawyer: "톱장이", mason: "석공", chapman: "행상", husbandman: "농부", woodward: "산지기", quarrier: "채석공",
  granger: "곡창지기", storekeeper: "창고지기", steward: "청지기", lord: "영주", lady: "귀부인",
};
/** What a household member is to the person the biography is about (their role → the member's role). */
const RELATIVES: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  head: { spouse: "배우자", child: "자녀", kin: "친척" },
  spouse: { head: "배우자", child: "자녀", kin: "친척" },
  child: { head: "부모", spouse: "부모", child: "형제자매", kin: "친척" },
  kin: { head: "가구주", spouse: "가구주의 배우자", child: "가구주의 자녀", kin: "친척" },
};
const relative = (me: string, them: string) => RELATIVES[me]?.[them] ?? ROLES[them] ?? them;
/** UI-7: with the young stages (a baby, a toddler: PERSON-1a LN-6). */
const PORTRAIT_STAGES: Readonly<Record<string, string>> = { pool: "", baby: "아기", infant: "아기", toddler: "유아", child: "아이", young: "청년", mature: "장년", old: "노년" };
const signed = (value: number) => value > 0 ? `+${value}` : value < 0 ? `−${-value}` : "0";

export const CHRONICLE_SCREEN_COPY = {
  title: "연대기",
  ledgerTab: "연대기",
  ledgerTabLabel: "연대기 열기 — 시간이 멈춥니다 (C)",
  close: "닫기",
  closeLabel: "연대기 닫기",
  now: (date: string) => `지금 ${date}`,
  date: (year: number, season: 0 | 1 | 2 | 3) => `${year}년 ${SCENARIO_COPY.seasons[season]}`,
  seasonShort: (season: 0 | 1 | 2 | 3) => SCENARIO_COPY.seasons[season],
  eraLabel: (year: number, era: string) => `${year} ${era}`,
  /** UI-KIT-1b: under the label of an era not entered yet (its nominal year). */
  eraAhead: "아직 오지 않음",
  chapter: (chapter: number) => `제${chapter}장`,
  // Timeline.
  timelineLabel: "연대 띠 — 누른 때의 기록으로 갑니다",
  seasonsLabel: "계절 띠 — 누른 계절의 기록으로 갑니다",
  zoomIn: "계절 보기",
  zoomOut: "연대 보기",
  earlier: "앞 계절들",
  later: "뒤 계절들",
  seasonCell: (date: string, count: number) => count === 0 ? `${date} · 기록 없음` : `${date} · 기록 ${count}건`,
  legendLabel: "띠의 표식",
  markerLegend: { decision: "결정", era: "시대", event: "사건", milestone: "이정표", person: "인물" },
  // Filters.
  filtersLabel: "기록 거르기",
  kinds: { decision: "결정", event: "사건", era: "시대", milestone: "이정표", person: "인물", ledger: "결산", faction: "관계" },
  kindToggle: (kind: string, on: boolean) => on ? `${kind} 기록 숨기기` : `${kind} 기록 보이기`,
  severityLabel: "중요도",
  severities: ["모든 기록", "이정표·큰 결정 이상", "사건 이상", "시대만"] as const,
  fromLabel: "부터",
  toLabel: "까지",
  firstYear: "처음",
  lastYear: "지금",
  personLabel: "인물",
  anyPerson: "모든 인물",
  personOption: (name: string, count: number) => `${name} (${count})`,
  count: (count: number) => `기록 ${count}건`,
  empty: "고른 조건에 맞는 기록이 없습니다",
  // Record cards.
  personLine: (name: string, sentence: string) => `${name} — ${sentence}`,
  householdLine: (name: string, sentence: string) => `${name}의 집 — ${sentence}`,
  bundleTitle: "이번 계절의 손길",
  bundleLine: (parts: readonly { readonly kind: string; readonly count: number }[]) =>
    parts.map(part => `${BUNDLE_NAMES[part.kind] ?? part.kind} ${part.count}번`).join(" · "),
  seasonNumbers: (income: number, expense: number) => `수입 ${pence(income)} · 지출 ${pence(expense)}`,
  rollupNumbers: (parts: readonly { readonly key: string; readonly count: number }[], population: number | null, popDelta: number | null) =>
    [...(population === null ? [] : [`인구 ${population}(${signed(popDelta ?? 0)})`]),
      ...parts.map(part => `${BUNDLE_NAMES[part.key] ?? (part.key === "person" ? "사람들의 일" : part.key)} ${part.count}`)].join(" · "),
  rollupNote: "여덟 계절이 지난 일상 기록은 계절마다 한 줄로 접힙니다",
  outcome: (predicted: string, actual: string | null) => actual === null ? `예측 ${predicted}` : `예측 ${predicted} / 실제 ${actual}`,
  metrics: (values: Readonly<Record<string, number>>) => Object.entries(values).map(([key, value]) => `${METRIC_NAMES[key] ?? key} ${key === "treasury" ? pence(value) : value}`).join(" · "),
  lookAt: "위치로",
  lookAtLabel: (date: string) => `${date}의 자리로 지금 지도를 옮깁니다`,
  thenMap: "그때 지도",
  thenMapLabel: (date: string) => `${date}의 지도 보기`,
  person: "인물",
  personLabelFor: (name: string) => `${name}의 전기 보기`,
  selectLabel: (date: string, sentence: string) => `${date} — ${sentence}`,
  // Detail pane: the map then.
  mapHeading: (date: string) => `그때 지도 · ${date}`,
  mapNowHeading: (date: string) => `지금 · ${date}`,
  mapCompare: "지금과 나란히",
  mapCompareLabel: "그때 지도와 지금 지도를 나란히 보기",
  mapNone: "이 무렵의 지도는 남아 있지 않습니다",
  mapLegendItems: ["풀밭", "숲", "물", "바위", "길", "집", "시설", "공사", "주거 구역", "경작지", "불탄 집", "성벽", "빈 집"] as const,
  mapThumb: (size: number) => `${size}칸 축소판`,
  pickHint: "기록 카드를 누르면 그때 지도와 결정의 앞뒤가 여기 나옵니다",
  // Decision record.
  decisionRecord: "결정 기록",
  decisionHeading: (date: string, kind: string) => `${date} · ${DECISION_KIND_NAMES[kind] ?? kind}`,
  chosenHeading: "고른 길",
  alternativesHeading: "다른 길",
  compareHeading: "예측과 실제",
  noAlternatives: "다른 길이 없었습니다",
  predictedValue: (key: string, value: number) => `${METRIC_NAMES[key] ?? key} ${key === "treasury" ? pence(value) : value}`,
  actualValue: (key: string, value: number) => `${key === "treasury" ? pence(value) : value}`,
  actualPending: (date: string) => `실제는 ${date}에 적힙니다`,
  deltaUp: (difference: string) => `예측보다 ${difference} 많음`,
  deltaDown: (difference: string) => `예측보다 ${difference} 적음`,
  deltaSame: "예측대로",
  difference: (key: string, value: number) => key === "treasury" ? pence(value) : `${value}`,
  // Biography.
  back: "연대기로",
  biographyTitle: (name: string) => `${name}의 전기`,
  born: (year: number) => `${year}년 태어남`,
  life: (born: number, end: number | null, age: number, died: boolean, left: boolean) =>
    died ? `${born}–${end}년 · ${age}살에 세상을 떠남` : left ? `${born}년생 · ${end}년에 마을을 떠남 (${age}살)` : `${born}년생 · ${age}살`,
  role: (role: string, occupation: string) => occupation === "" ? (ROLES[role] ?? role) : `${ROLES[role] ?? role} · ${occupation}`,
  household: (name: string | null) => name === null ? "영주의 집안" : `${name}의 집`,
  roleHousehold: (role: string, household: string | null) => household === null ? role : `${role} · ${household}`,
  noHousehold: "가구 없음",
  portraitMatch: (identity: string, stage: string, exact: boolean) =>
    `초상 ${identity}${PORTRAIT_STAGES[stage] === "" || PORTRAIT_STAGES[stage] === undefined ? "" : ` ${PORTRAIT_STAGES[stage]}`} · ${exact ? "성별·나이대·계층 일치" : "가장 가까운 그림"}`,
  lifeHeading: "생애",
  lifeEmpty: "아직 남긴 기록이 없습니다",
  relationsHeading: "관계",
  relation: (me: string, them: string, name: string) => `${relative(me, them)} ${name}`,
  survivors: "남은 식구",
  employment: (office: string) => `맡은 일: ${office}`,
  manager: (building: string) => `${building} 관리`,
  reeve: "마을 대표(reeve)",
  petitioner: (names: readonly string[]) => names.length === 0 ? "청원에 이름을 올림" : `청원 동료: ${names.join(", ")}`,
  noRelations: "함께 사는 식구가 없습니다",
  recordsHeading: "함께 남긴 기록",
  recordsEmpty: "함께 남긴 큰 기록이 없습니다",
  companion: (me: string, them: string) => relative(me, them),
  crestLabel: "집안 문장",
  // UI-6 faction tab (CHRON-2 first pass): the nine factions, a faction's page and the world beyond.
  factionTitle: (name: string) => `${name} 연대기`,
  viewsLabel: "연대기 보기",
  recordsTab: "기록",
  factionsTab: "세력",
  factionsLabel: "주변 세력 아홉",
  factionRowLabel: (name: string, leader: string, relation: string, demands: number) =>
    demands === 0 ? `${name} — 수장 ${leader}, 관계 ${relation}. 세력 연대기 열기` : `${name} — 수장 ${leader}, 관계 ${relation}, 요구 ${demands}건. 세력 연대기 열기`,
  noLeader: "수장 없음",
  leaderLine: (role: string, age: number | null) => age === null ? role : `${role} · ${age}살`,
  relationText: (band: string, value: number) => `${band} ${signed(value)}`,
  relationScaleLabel: (text: string) => `관계 척도: 적대 −100부터 우호 +100까지 가운데 ${text}`,
  relationEnds: ["적대", "우호"] as const,
  demandsCount: (count: number) => count === 0 ? "요구 없음" : `요구 ${count}건`,
  promisesCount: (count: number) => count === 0 ? "약속 없음" : `약속 ${count}건`,
  memoryCount: (count: number) => `기억 ${count}건`,
  noFactions: "아직 주변 세력이 모이지 않았습니다 — 첫날이 지나면 나타납니다",
  worldHeading: "바깥 세상",
  worldLabel: "바깥 세상의 연표 — 올해까지",
  worldLine: (year: number, line: string) => `${year} ${line}`,
  worldEmpty: "아직 기록할 바깥 소식이 없습니다",
  backToFactions: "세력 목록으로",
  backToFaction: "세력 연대기로",
  backToFactionLabel: (name: string) => `${name} 연대기로 돌아가기`,
  demandsHeading: "요구",
  promisesHeading: "약속",
  memoryHeading: "우리와의 일",
  timelineHeading: "그들의 연표",
  demandsEmpty: "지금 기다리는 요구가 없습니다",
  promisesEmpty: "맺은 약속이 없습니다",
  memoryEmpty: "아직 우리와 얽힌 기록이 없습니다",
  timelineEmpty: "아직 남긴 일이 없습니다",
  demand: (name: string, date: string) => `${name} · ${date}부터`,
  promiseRight: (date: string) => `시장권 · ${date}에 줌`,
  promiseLoan: (count: number) => count > 1 ? `전쟁 차입금을 갚는 중 (${count}건)` : "전쟁 차입금을 갚는 중",
  promiseInstalment: (count: number) => count > 1 ? `양모 공납을 나눠 내는 중 (${count}건)` : "양모 공납을 나눠 내는 중",
  timelineYear: (year: number) => `${year}년`,
  timelineLeader: (line: string, name: string) => `${line} — ${name}`,
  recordLinkLabel: (date: string, sentence: string) => `${date} — ${sentence}. 연대기에서 보기`,
  faction: "세력",
  factionLabelFor: (name: string) => `${name} 연대기 보기`,
  factionFilter: (name: string) => `${name}의 기록만`,
  factionFilterClear: (name: string) => `${name}의 기록만 보는 거르기 풀기`,
} as const;

/** UI-6: the relation scale's bands (−100…100, FX-4). */
export const RELATION_BANDS: readonly { readonly from: number; readonly label: string }[] = [
  { from: 50, label: "우호" }, { from: 15, label: "호의" }, { from: -14, label: "무심" }, { from: -49, label: "냉담" }, { from: -100, label: "적대" },
];

/** UI-6: what a faction's leader is (by the engine's occupation; the town's leaders by their faction). */
export const LEADER_ROLES: Readonly<Record<string, string>> = {
  earl: "백작", king: "국왕", lord: "영주", bishop: "주교", merchant_house: "가문의 수장", town: "도시의 대표", commons: "농민의 대표", reeve: "촌장(reeve)",
};

/** UI-6: the kings' names in Korean (the kings stay as history had them, FIX-5). */
/** UI-6: the petitions a faction waits on (FX-3 `demands`). */
export const DEMAND_NAMES: Readonly<Record<string, string>> = {
  market_charter: "시장권 청원", restore_right: "권리 복원 청원", wool_payment: "양모 공납 칙령", levy_response: "징집 명령",
  war_funding: "전쟁 보조세 요구", refugee_admission: "피란민의 청원", wall_or_market: "석벽과 시장 사이의 선택",
};
