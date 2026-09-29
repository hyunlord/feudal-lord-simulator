import { SCENARIO_COPY } from "../content/scenario/scenarioCopy.ko";
import { HISTORY_CHOICE_LABELS } from "../content/historyCopy.ko";
import type { GameState } from "../engine/engine.types";
import { calendarArrivalLabel } from "./calendarArrival";
import { stateCalendar } from "../engine/scenarioState";

// UI-4 event cards (the story beats, eventStory.ts): title, one line, facts, and the steward's advice. Times are
// calendar arrival points, never ticks.
export const EVENT_STORY_COPY = {
  chipLabel: (title: string) => `${title} — 카드 열기`,
  lookAt: "위치로",
  advice: "조언",
  close: "닫기",
  decide: "결정하기",
  region: "사건",
  /** The steward's one line on a forecast (rumour = heard of it, sign = seen it coming). */
  steward: {
    fire: (sign: boolean) => sign ? "마른 여름이 옵니다. 초가 사이에 빈 칸과 우물을 두십시오" : "올여름이 마를 거라는 말이 돕니다",
    dearth: (sign: boolean) => sign ? "밭이 젖을 조짐입니다. 곡창을 채워 두십시오" : "비 많은 여름이 온다는 소문이 있습니다",
    famine: (sign: boolean) => sign ? "큰 기근의 조짐이 보입니다. 곡창·필지·시장을 갖추십시오" : "먼 곳에서 기근 소문이 들려옵니다",
  },
  arrival: (year: number, season: number) => `${year}년 ${SCENARIO_COPY.seasons[season as 0 | 1 | 2 | 3]}에 올 듯`,
  fire: {
    title: "불이 났습니다",
    line: "초가 지붕에 불이 붙었습니다. 맞닿은 집으로 번질 수 있습니다",
    burning: (houses: number) => `타는 집 ${houses}채`,
    doused: (houses: number) => `우물 물로 끄는 집 ${houses}채`,
    noWell: "가까운 우물이 없어 저절로 꺼질 때까지 탑니다",
    advice: "우물을 집 가까이에, 초가 사이에 빈 칸을 두면 불이 멈춥니다",
  },
  fireAftermath: {
    title: "불탄 자리",
    line: "불이 꺼졌습니다. 집을 잃은 가구가 다시 짓기를 기다립니다",
    burnt: (houses: number) => `불탄 집 ${houses}채`,
    rebuilding: (sites: number) => `다시 짓는 공사장 ${sites}곳`,
    advice: "불탄 집을 눌러 다시 짓기를 시작하세요",
  },
  fireWarning: {
    title: "마른 여름의 불씨",
    line: "마른 여름이 옵니다. 초가가 붙어 있으면 불이 번지기 쉽습니다",
    advice: "우물과 초가 사이 틈을 만들어 두세요",
  },
  wetSummer: {
    title: "젖은 여름",
    line: "비가 그치지 않습니다. 밭이 물에 잠기고 이삭이 쓰러집니다",
    fact: "올해 수확이 줄어듭니다",
    advice: "곡창에 남은 밀과 빵을 아끼고, 다음 해를 위해 밭을 늘리세요",
  },
  badHarvest: {
    title: "흉년",
    line: "수확이 모자랍니다. 빵과 밀 값이 오릅니다",
    lost: (wheat: number) => `잃은 수확 밀 ${wheat}`,
    advice: "곡창을 채워 두면 흉년을 넘깁니다",
  },
  famineOmen: {
    title: "대기근의 조짐",
    line: "여름마다 비가 잦고 값이 오릅니다. 큰 기근이 올 듯합니다",
    advice: "곡창·필지·시장을 갖춰 두면 대기근을 버틸 준비가 됩니다",
  },
  famine: {
    title: "대기근",
    lineOpen: "수확이 반으로 줄고 값이 세 배가 되었습니다. 영주의 대응을 기다립니다",
    lineAnswered: (choice: string) => `영주의 대응 — ${HISTORY_CHOICE_LABELS[choice] ?? choice}`,
    until: (endTick: number, state: Pick<GameState, "tick" | "scenarioId">) => `끝날 때: ${calendarArrivalLabel(state.tick, endTick, stateCalendar({ ...state, tick: 0 }).year)}`,
    advice: "가난한 가구가 빵을 살 수 없게 됩니다 — 구휼은 금고를, 방관은 사람을 잃습니다",
  },
  firstWinter: {
    title: "첫 겨울",
    line: "밭이 쉬고 식구들은 한 계절 치 빵을 더 먹습니다",
    advice: "곡창에 빵이 한 계절 이상 있어야 봄까지 버팁니다",
  },
  petition: {
    title: "상인들의 청원",
    line: "상인 무리가 마을 예배당 앞에 모였습니다. 시장권을 청합니다",
    advice: "수락하면 상인 게이지가 오르고, 가격을 붙이면 금고가 채워집니다",
  },
  charter: {
    title: "시장권",
    line: "상인들이 장을 열 권리를 얻었습니다. 권리 목록에 한 줄이 늘었습니다",
    advice: "장날에 사람들이 모입니다",
  },
  marketTown: {
    title: "시장도시",
    line: "목책을 두르고 시장도시를 선포했습니다",
    advice: "목책을 다 두르면 마을이 지켜집니다",
  },
  palisade: {
    title: "목책을 두르다",
    line: "마을을 두르는 목책이 섰습니다",
    advice: "성문 쪽 길을 넓혀 두세요",
  },
  // UI-6 (F2-A WR-1…WR-8): the war of 1337 — the messenger, the demands, the beacon, the raid, the men away, the wall.
  war: {
    messenger: { title: "국왕의 전령", line: "왕의 전령이 말을 달려 왔습니다. 전쟁이 시작되었고, 왕실이 계절마다 요구를 보낼 것입니다",
      advice: "금고를 채워 두고, 해안이라면 성벽을 닫아 두십시오" },
    demand: { advice: "한 계절 안에 답하지 않으면 거절로 칩니다. 왕실을 거절하면 신임을 잃습니다" },
    beacon: { title: "봉화가 올랐다", line: "해안의 봉화대에 불이 올랐습니다. 다음 계절에 습격선이 올 것입니다",
      advice: "성벽의 틈을 메우고, 창고와 금고를 성 안에 두십시오" },
    raid: { title: "해안 습격", line: "습격선이 부두에 닿았습니다. 성 밖의 집과 창고가 불타고 약탈당합니다",
      advice: "불탄 집은 다시 지을 수 있습니다" },
    raidAfter: { title: "습격이 지나간 뒤", line: "연기가 걷히자 잃은 것이 드러났습니다", advice: "불탄 집을 다시 짓고, 성벽을 돌로 바꾸면 다음엔 덜 잃습니다" },
    away: { title: "일손이 빈 공방", line: "징집된 사람들이 떠나 공방과 밭에 일손이 비었습니다", advice: "두 계절 뒤에 돌아옵니다. 다섯에 하나는 돌아오지 못합니다" },
    wall: { title: "석벽 인가", line: "석벽을 쌓기로 했습니다. 돌이 오면 목책을 하나씩 돌로 바꿉니다", advice: "채석장과 석공소를 갖추십시오" },
    losses: (burnt: number, looted: number, coin: string, defence: number) =>
      `불탄 집 ${burnt}채 · 빼앗긴 물자 ${looted} · 빼앗긴 돈 ${coin} · 성벽 방어 ${defence} %`,
    awayCount: (men: number) => `떠나 있는 사람 ${men}명`,
    raidBy: (year: number, season: string) => `${year}년 ${season}에 습격`,
  },
  stewardWar: {
    messenger: "전쟁입니다. 왕의 요구가 계절마다 올 것입니다",
    beacon: "봉화가 올랐습니다. 다음 계절에 습격이 옵니다 — 성벽을 닫으십시오",
    raidAhead: (year: number) => `해안 습격이 ${year}년 여름쯤 올 것입니다. 성벽을 돌로 닫아 두십시오`,
  },
  // UI-8 (F3-A PL-1…PL-10): the Black Death of 1348 — nine beats and their steward line.
  plague: {
    /** PL-1: the harbour fever rumour — while plagueStage === "rumour". */
    rumour: { title: "항구 열병 소문", line: "항구에서 열병이 돈다는 소문이 들어왔습니다. 아직 도시 밖 이야기입니다",
      advice: "곡창과 금고를 채워 두십시오. 사제 공석이 생기면 곧 결정이 필요합니다" },
    /** PL-2: the pestilence arrives — while plagueStage === "arrival". */
    arrival: { title: "역병이 들어왔습니다", line: "역병이 도시에 들어왔습니다. 계절마다 사람이 죽고 집이 빕니다",
      advice: "임금과 사제 자리 결정을 서두르십시오. 빈 필지는 이후 다시 채울 수 있습니다",
      dead: (n: number) => `지금까지 사망 ${n}명` },
    /** PL-6: priest's seat is empty — while curacyVacant. */
    priestDeath: { title: "사제가 죽었습니다", line: "사제가 역병으로 죽었습니다. 교회와 예배당이 비어 아무도 섬기지 않습니다",
      advice: "빈 사제 자리 청원에 답해 교회를 다시 여십시오" },
    /** PL-2: first deaths — during arrival, dead > 0. */
    newGraves: { title: "새 무덤", line: "교회 묘지에 새 무덤이 늘었습니다. 역병이 이웃을 빼앗아 갑니다",
      advice: "역병은 한 계절 안에 멈추지 않습니다. 남은 일꾼으로 시설을 유지하십시오",
      dead: (n: number) => `사망 ${n}명` },
    /** PL-3: first vacant houses — while vacant houses exist during arrival. */
    emptyStreets: { title: "빈 거리", line: "사람이 죽거나 달아나 거리가 비었습니다. 빈 집이 늘어납니다",
      advice: "빈 필지는 역병이 물러가면 재정착으로 채울 수 있습니다",
      houses: (n: number) => `빈 집 ${n}채` },
    /** PL-3: arrival ends, fields lie empty — within 2 seasons of first.endTick. */
    abandonedFields: { title: "버려진 밭", line: "역병이 물러갔습니다. 일꾼이 줄어 밭이 버려지고 수확이 모자랍니다",
      advice: "빈 필지 재분배 청원에 답해 재정착을 시작하십시오" },
    /** PL-5: the Statute of Labourers is read — within 1 season of ordinanceTick. */
    ordinance: { title: "노동자 조례 낭독", line: "국왕이 1351년 노동자 조례를 낭독했습니다. 임금을 올린 영주는 벌금을 냅니다",
      advice: "임금을 올렸다면 조례 벌금이 금고에서 나갑니다" },
    /** PL-7: resettlement has begun — while resettled > 0 and endedTick undefined. */
    resettlement: { title: "재정착", line: "빈 집에 새 가족이 들기 시작했습니다. 빈 필지가 서서히 채워집니다",
      advice: "화폐 지대 청원에 답해 지대 수입을 안정시키십시오" },
    /** PL-9: the second pestilence — while plague.second is active (endTick undefined). */
    second: { title: "두 번째 역병", line: "1361년, 역병이 다시 왔습니다. 이번에는 아이와 젊은이들이 많이 죽습니다",
      advice: "두 계절이면 끝납니다. 금고와 식량을 지켜 내십시오",
      dead: (n: number) => `이번 역병 사망 ${n}명` },
    /** Chip advice for a plague petition (non-crown petitioners: labourers, parish, townsfolk). */
    demand: { advice: "한 계절 안에 답하지 않으면 거절로 칩니다. 역병 뒤의 선택은 3장 끝까지 남습니다" },
  },
  /** UI-8: the steward's one line when the plague is the nearest coming event. */
  stewardPlague: {
    rumour: "항구 열병 소문이 돕니다. 역병이 올 수 있습니다 — 금고와 곡창을 채워 두십시오",
    arrival: "역병이 도시에 들어왔습니다. 임금·사제 자리 청원에 곧 답해야 합니다",
    second: "두 번째 역병이 왔습니다. 두 계절이면 물러갑니다",
  },
  // UI-9 (F4-A RG-1…RG-9): chapter 4's reorganisation — seven informational beats and their steward lines.
  reorg: {
    /** RG-2: households leaving for higher wages in neighbouring towns. */
    wageCompetition: { title: "임금 경쟁", line: "역병 뒤 일손이 귀합니다. 이웃 장원이 더 높은 임금으로 가난한 가구를 부릅니다",
      advice: "떠난 집은 비고, 새 가구가 다시 채웁니다. 한 해 동안 이어집니다",
      leavers: (n: number) => `떠난 가구 ${n}` },
    /** RG-1: the weavers' houses gather into a textile quarter. */
    textileStreet: { title: "직물 거리", line: "직조공 집이 모여 직물 거리가 생겼습니다. 도시가 직물로 부유해집니다",
      advice: "4장부터 직물이 영지의 가장 큰 수입이 됩니다" },
    /** RG-1: alehouses multiply as survivors celebrate. */
    alehouseBoom: { title: "에일집 성황", line: "에일집마다 사람이 붐빕니다. 장인과 상인이 모여 도시의 일을 이야기합니다",
      advice: "직물 거리와 에일집이 모두 서면 청원이 잇달아 옵니다" },
    /** RG-1: the surge of petitions begins. */
    petitionsSurge: { title: "청원 물결", line: "도시 공동체의 힘이 커졌습니다. 청원이 잇달아 밀려옵니다",
      advice: "조합·인두세·자치 특허 청원에 차례로 답해야 합니다" },
    /** RG-4: the overlord warns the lord about the town's growing power. */
    overlordWarning: { title: "백작의 경고", line: "상위 영주(백작)가 도시 공동체의 힘이 지나치게 커졌다고 경고합니다",
      advice: "경고 뒤에 자치 특허를 내주면 백작이 더 크게 돌아섭니다" },
    /** RG-6: the poll tax is collected. */
    pollTax: { title: "인두세 징수", line: "국왕의 인두세를 걷습니다. 위탁하면 도시 공동체가 걷고, 직접 징수면 영주의 징수원이 걷습니다",
      advice: "인두세 방식이 반란 압력을 좌우합니다",
      collected: (amount: string) => `걷힌 세금 ${amount}` },
    /** RG-8: the 1381 rumour — collectors chased or a quiet passing. */
    rebellion: { title: "1381년 농민 반란 소문", line: "농민 반란의 소문이 도시에 닿았습니다",
      advice: "반란 압력이 50 이상이면 사람들이 징수원을 쫓아냅니다. 다치는 사람은 없습니다",
      chased: "사람들이 세금 징수원을 쫓아내고 장원 법정 기록을 태웠습니다 — 이번 인두세와 다음 기간 지대가 들지 않습니다",
      quiet: "소문은 조용히 지나갔습니다" },
    /** Chip advice for a reorganisation petition (craftsmen, merchants, townsfolk — not the Crown). */
    demand: { advice: "한 계절 안에 답하지 않으면 거절로 칩니다. 재편 시대의 선택은 4장 끝까지 남습니다" },
  },
  /** UI-9: the steward's one line when the reorganisation is the nearest coming event. */
  stewardReorg: {
    wageCompetition: "임금 경쟁이 시작되었습니다. 일손이 빠져나가고 있습니다",
    petitionsSurge: "청원 물결이 시작됩니다. 조합·인두세·자치 특허를 차례로 결정해야 합니다",
    rebellion: "1381년 소요가 가까워집니다. 반란 압력을 낮추십시오",
  },
} as const;
