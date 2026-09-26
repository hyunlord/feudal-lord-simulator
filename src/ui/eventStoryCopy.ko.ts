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
} as const;
