import type { ResourceType } from "../content/resourceConfig";
import { LORD_HOUSE_NAMES_KO } from "../content/historyCopy.ko";
import { A_TRIPLE_PRIME_ROAD_COPY } from "./aTriplePrimeRoadCopy";
import { BUILDING_OPERATION_COPY } from "./buildingOperationCopy.ko";
import { CONSTRUCTION_DEADLOCK_COPY } from "./constructionDeadlockCopy.ko";
import { HOUSEHOLD_LABOUR_COPY } from "./householdLabourCopy.ko";

const finalOf = (word: string) => { const last = word.charCodeAt(word.length - 1); return last >= 0xac00 && last <= 0xd7a3 ? (last - 0xac00) % 28 : 0; };
/** 을 / 를 and 과 / 와 after a building name (곡창을 · 창고를). */
const object = (word: string) => `${word}${finalOf(word) !== 0 ? "을" : "를"}`;
const withWord = (word: string) => `${word}${finalOf(word) !== 0 ? "과" : "와"}`;

/** Left inspector copy: name, state line, "왜?" and "조치". */
export const INSPECTOR_COPY = {
  regionLabel: "선택한 건물",
  close: "닫기",
  closeGlyph: "×",
  whyHeading: "왜?",
  actionHeading: "조치",
  noCause: "막힌 원인이 없습니다",
  noAction: "지금 할 일이 없습니다",
  /** `오두막 · 주민 4명 · 생활 L0 유지 중`. */
  houseState: (name: string, residents: number, status: string) => `${name} · 주민 ${residents}명 · ${status}`,
  houseSteady: (level: number) => `생활 L${level} 유지 중`,
  houseBlocked: (level: number) => `L${level} 승급 막힘`,
  houseRisk: (level: number) => `생활 L${level} 유지 위험`,
  /** `일꾼 2/3 · 멈춤`. */
  facilityState: (workers: number, required: number, status: string) => `일꾼 ${workers}/${required} · ${status}`,
  /** UI-10 (F5-A LG-1): the keep, the lord's seat, after the charter — the family gone to its country manor. */
  manorLeft: (house: string, year: number) => `${LORD_HOUSE_NAMES_KO[house] ?? house} 가문이 ${year}년 영주관을 비우고 시골 장원으로 떠났습니다`,
  facilityRunning: "운영 중",
  facilityStopped: "멈춤",
  /** Same wording as the construction-site card (`목책 구간 부지`). */
  siteName: (name: string) => `${name} 부지`,
  siteWorking: (ticks: number, required: number, builders: number) => `공사 중 · ${ticks}/${required}틱 · 일꾼 ${builders}명`,
  /** "조치" lines, keyed by the blocking cause. */
  action: {
    resume: `'${BUILDING_OPERATION_COPY.resume}' 버튼으로 다시 가동하세요`,
    // UX-0b: the audit could not act on "재정을 채워 …": say where money comes from and when the debt is paid.
    payUpkeep: "집이 늘어 지대가 오르거나 다른 시설을 멈추면, 다음 장부 마감에 밀린 유지비를 내고 다시 돌아갑니다",
    /** Household services (water, market, church), per diagnosis kind. */
    service: {
      water: { missing: "이 집 가까이에 우물을 지으세요", outside: "범위 안에 우물을 하나 더 지으세요",
        capacity: "우물을 하나 더 지어 담당 필지를 늘리세요", unreachable: "우물까지 도로를 이어 주세요" },
      market: { missing: "시장을 지으세요", outside: "범위 안에 시장을 하나 더 지으세요",
        capacity: "시장을 하나 더 지어 담당 필지를 늘리세요", unreachable: "시장과 이 집을 도로로 이어 주세요" },
      church: { missing: "교회를 지으세요", outside: "범위 안에 교회를 하나 더 지으세요",
        capacity: "교회를 하나 더 지어 담당 필지를 늘리세요", unreachable: "교회와 이 집을 도로로 이어 주세요" },
    },
    moreHands: "주택을 늘려 일손을 확보하거나 다른 작업장을 멈추세요",
    assignableHands: HOUSEHOLD_LABOUR_COPY.assignableWorkersRoad,
    buildGranary: "곡창을 지으세요",
    fillGranary: "방앗간과 밀밭을 확인하세요 — 곡창에 빵이 들어와야 합니다",
    connectGranary: "곡창과 이 집을 도로로 이어 주세요",
    granaryNear: "이 집 가까이에 곡창을 지으세요",
    awaitDelivery: "배급꾼가 올 때까지 기다리세요",
    wall: "성벽을 완성해 이 집을 감싸세요",
    connectRoad: "도로를 이어 이 건물을 길에 붙이세요",
    produceInput: { wheat: "밀밭·헛간을 늘려 밀을 확보하세요", logs: "벌목소를 늘려 통나무를 확보하세요",
      stone_raw: "채석장을 늘려 원석을 확보하세요" } as Partial<Record<ResourceType, string>>,
    connectSupply: "공급처와 이 건물을 도로로 이어 주세요",
    awaitHaul: "운반꾼이 오는 중입니다 — 잠시 기다리세요",
    moreStorage: "창고나 곡창을 더 짓거나 도로로 이어 주세요",
    siteRoadOne: A_TRIPLE_PRIME_ROAD_COPY.oneTileInstruction,
    siteRoadMany: A_TRIPLE_PRIME_ROAD_COPY.multipleTileInstruction,
    siteRoad: "창고와 공사장을 도로로 이어 주세요",
    siteWall: "성문을 두거나 성벽 안쪽으로 길을 이어 주세요",
    siteMaterial: "창고에 자재가 들어오도록 생산 시설을 확인하세요",
    siteWorkers: "주택을 늘리거나 다른 공사를 줄여 일꾼을 확보하세요",
    siteReserve: "비축분이 풀릴 때까지 기다리거나 공사 우선으로 바꾸세요",
    siteDeadlock: CONSTRUCTION_DEADLOCK_COPY.action,
    /**
     * UI-AUDIT-1: stock piled here that cannot leave (the HUD's stuck-goods chip, same reason); `store` is the good's
     * store (곡창, 창고). LM-R1: the engine's reasons; `no_receiver` is its `receiver_full` with no such store at all.
     */
    stuck: {
      no_road: (store: string) => `${withWord(store)} 이 건물을 도로로 이어 주세요`,
      no_receiver: (store: string) => `${object(store)} 지으세요`,
      receiver_full: (store: string) => `${object(store)} 하나 더 지으세요`,
      no_carrier: (store: string) => `이 건물 가까이에 ${object(store)} 지어 수레 길을 줄이세요`,
    },
    /** Wheat also leaves by a mill's own cart (AF-9). */
    stuckWheatMill: "방앗간을 가까이 지으면 방앗간 수레가 밀을 가져갑니다",
  },
  /** UI-AUDIT-1: the pile as the "왜?" line (`밀 932 묶임 — 운반꾼 부족 · 수확 버려짐`). */
  stuckLine: (good: string, amount: number, reason: string) => `${good} ${amount.toLocaleString("ko-KR")} 묶임 — ${reason}`,
} as const;
