import { LEGACY_BALANCE } from "../content/legacyConfig";
import { SCENARIO_COPY } from "../content/scenario/scenarioCopy.ko";
import { HISTORY_CHOICE_LABELS, LORD_HOUSE_NAMES_KO } from "../content/historyCopy.ko";
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
    // COPY-1r CA-007: the 1351 Statute (노동자법), not the 1349 ordinance (노동자 조례); no claim that the king read it.
    ordinance: { title: "노동자법 공포", line: "1351년 노동자법이 공포되었습니다. 게임에서는 임금을 올린 영주에게 벌금이 부과됩니다",
      advice: "임금을 올렸다면 노동자법 벌금이 금고에서 나갑니다" },
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
      advice: "길드·직물 대 곡물·인두세·자치 특허, 네 결정이 차례로 옵니다" },
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
  // UI-10 (F5-A LG-1…LG-8): chapter 5's eight steps, the lord's names quoted from the ledger's records.
  legacy: {
    /** LG-1: the merchant elite asks that the town choose its mayor. */
    mayorDemand: { title: "시장을 뽑게 해 달라는 요구", line: "유력 상인들이 도시의 시장 선출권을 요구합니다", // COPY-1r CA-032
      advice: "요구는 자치 특허로 이어집니다. 특허에 인장을 찍으면 이 후보가 첫 시장이 됩니다",
      candidate: (name: string) => `시장 후보 — ${name}` },
    /** LG-4: the Crown's envoy and the tenth and fifteenth. */
    royalTax: { title: "국왕의 과세 사절", line: "국왕의 과세 사절이 15분의 1·10분의 1세를 걷으러 왔습니다",
      advice: "감면을 청원했다면, 나중에 자치 특허를 내줄 때 국왕의 확인금을 냅니다",
      paid: (amount: string) => `국왕에게 낸 돈 ${amount}`, petitioned: "내지 않고 감면을 청원했습니다" },
    /** LG-3: the old lord names his heir. */
    // LM-R1 (FIX-11 handoff, glossary "영주의 후계자"): the title whatever the lord's age; "늙은" only from the engine's old age.
    succession: { title: "영주의 후계자", line: "영주의 뒤를 이을 사람을 정해야 합니다",
      advice: "고른 후계자가 영주관의 가장이 되고, 상위 영주에게 상속세를 냅니다",
      lord: (name: string, age: number) => `${age >= LEGACY_BALANCE.lordOldAge ? "늙은 영주" : "영주"} — ${name} (${age}세)`, candidates: (n: number) => `후보 ${n}명`,
      heir: (name: string, relation: string) => `후계자 — ${name} (${relation})` },
    /** LG-1: the town makes its own seal. */
    citySeal: { title: "도시의 인장", line: "도시가 제 인장을 새겼습니다. 이제 특허에 찍을 인장이 있습니다",
      advice: "두 계절 뒤에 자치 특허에 인장을 찍을지 묻습니다" },
    /** LG-2: the charter sealed or refused. */
    charter: { title: "자치 특허의 인장", sealed: "자치 특허에 도시 인장이 찍혔습니다. 도시가 제 시장과 법정을 가집니다",
      refused: "영주가 자치 특허를 거절했습니다. 가문이 계속 도시를 다스립니다",
      advice: "특허를 내주면 가문은 영주관을 떠나고, 거절하면 도시의 반발이 남습니다",
      mayor: (name: string) => `첫 시장 — ${name}`, backlash: (n: number) => `도시의 반발 ${n}` },
    /** LG-1: the family leaves the manor for its country seat, or stays. */
    departure: {
      departedTitle: "가문이 영주관을 떠나다", departed: (house: string) => `${LORD_HOUSE_NAMES_KO[house] ?? house} 가문이 영주관을 비우고 시골 장원으로 옮겼습니다`,
      departedAdvice: "영주관은 비었습니다. 도시는 이제 시장과 도시 법정이 다스립니다",
      stayedTitle: "가문이 영주관에 남다", stayed: (house: string) => `${LORD_HOUSE_NAMES_KO[house] ?? house} 가문이 영주관에 남아 도시를 다스립니다`,
      stayedAdvice: "영주관에 남으면 가문의 유산 점수가 오릅니다. 도시의 반발은 그대로입니다" },
    /** LG-5: the legacy's record sealed. */
    legacyRecord: { title: "유산의 기록", line: "영주가 남길 것 하나를 정하고 그 기록을 봉인했습니다",
      advice: "1450년 여름 마지막 장날에 도시·가문·교회 세 축으로 유산을 판정합니다",
      chosen: (legacy: string) => `남긴 것 — ${legacy}`, none: "남긴 것 없음" },
    /** LG-8: the last market day of 1450, the campaign's end. */
    lastMarket: { title: "1450년 마지막 장날", line: "마지막 장날입니다. 도시와 가문이 남긴 것을 판정합니다",
      advice: "연대기 책에서 다섯 장의 기록을 볼 수 있습니다", ending: (title: string) => `결말 — ${title}` },
    /** Chip advice for a chapter-5 petition (the Crown, the overlord, the town, the craftsmen, the parish). */
    demand: { advice: "한 계절 안에 답하지 않으면 영주의 침묵이 답합니다. 5장의 선택은 1450년 유산 판정에 남습니다" },
  },
  // UI-10 (FIX-9 LG-13): the 1384–1400 interlude, by the calendar.
  interlude: {
    // COPY-1r CA-008: in 1391–1392 the Calais Staple was suspended for a while (not moved); the effect is the game's.
    staple: { title: "칼레 양모 무역 제도 중단", line: "칼레의 지정 무역 제도(Staple)가 잠시 중단되었습니다. 게임 효과: 직물이 더 비싸게 팔립니다",
      advice: "여덟 계절 동안 직물이 더 비싸게 팔립니다. 직조공 집을 멈추지 마십시오", fact: "직물 값 1.1배 · 여덟 계절" },
    guildDispute: { title: "길드와 상인의 다툼", line: "길드와 상인이 직물을 파는 권리를 두고 다툽니다",
      advice: "어느 편을 들든 한쪽 세력이 등을 돌립니다" },
    marketFire: { title: "장터 화재", line: "장터에 불이 났습니다. 도시가 장터를 고칩니다",
      advice: "수리비는 금고에서 이미 나갔습니다", repair: (amount: string) => `수리 ${amount}` },
    churchRebuilding: { title: "교회 증축 청원", line: "교구가 낡은 교회를 넓혀 새 회중석을 짓자고 청합니다",
      advice: "증축하면 교회의 유산 점수와 주교의 관계가 오릅니다", rebuilt: "새 회중석이 섰습니다", deferred: "증축을 미뤘습니다" },
    deposition: { title: "리처드 2세 폐위", line: "리처드 2세가 폐위되고 헨리 4세가 즉위했습니다. 새 왕의 치세가 시작됩니다",
      advice: "새 왕 아래에서 왕실과의 관계가 처음 값 쪽으로 절반 돌아갑니다" },
  },
  /** UI-10: the steward's one line when chapter 5's next step or the interlude's next event comes within a season. */
  stewardLegacy: {
    soon: (what: string) => `다음 계절에 ${what} — 금고를 살펴 두십시오`,
  },
  /** UI-9: the steward's one line when the reorganisation is the nearest coming event. */
  stewardReorg: {
    wageCompetition: "임금 경쟁이 시작되었습니다. 일손이 빠져나가고 있습니다",
    petitionsSurge: "청원 물결이 시작됩니다. 길드·직물 대 곡물·인두세·자치 특허를 차례로 결정합니다",
    rebellion: "1381년 소요가 가까워집니다. 반란 압력을 낮추십시오",
  },
} as const;
