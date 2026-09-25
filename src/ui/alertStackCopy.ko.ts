import { MONEY_LABEL, MONEY_RULE_COPY } from "../content/moneyCopy.ko";
import type { ResourceType } from "../content/resourceConfig";
import { BUILDING_OPERATION_COPY } from "./buildingOperationCopy.ko";
import { CONSTRUCTION_DEADLOCK_COPY } from "./constructionDeadlockCopy.ko";
import { STORAGE_OVERFLOW_COPY } from "./storageOverflowCopy.ko";

/** Warning stack copy (right-side alert rows under the goal cards). */
export const ALERT_STACK_COPY = {
  regionLabel: "경고",
  /** ▲ immediate (production or level stops), ◆ caution (growth waits). */
  shape: { immediate: "▲", caution: "◆" },
  severityLabel: { immediate: "즉시", caution: "주의" },
  inspect: "보기",
  inspectLabel: (title: string) => `${title} — 첫 건물 보기`,
  /** `방앗간 2`. */
  count: (name: string, count: number) => `${name} ${count}`,
  houseName: "주택",
  mixedName: "건물",
  siteName: "공사",
  resource: {
    wheat: "밀", bread: "빵", logs: "통나무", timber: "목재", stone_raw: "원석", stone: "석재", coin: MONEY_LABEL,
  } satisfies Record<ResourceType, string>,
  /** Facility titles by production state (`buildingCauseSnapshot` blocker reason). */
  facility: {
    inputMissing: (resource: string) => `${resource} 공급 없음`,
    outputFull: (resource: string) => `${resource} 쌓임`,
    noRoad: "도로 연결 없음",
    understaffed: "일꾼 부족",
    paused: BUILDING_OPERATION_COPY.shortLabel,
    upkeepUnpaid: MONEY_RULE_COPY.upkeepUnpaid,
    storageOverflow: STORAGE_OVERFLOW_COPY.shortLabel,
  },
  /** House titles by the housing requirement that blocks the next (or current) level. */
  house: {
    water: "물 부족",
    bread: "빵 부족",
    granary: "곡창이 멉니다",
    market: "시장 이용 불가",
    church: "교회 이용 불가",
    protected: "성벽 보호 없음",
    production: "주택 문제",
  },
  /** Construction-site titles and cause lines by `constructionAccessModel` cause. */
  site: {
    road_disconnected: { title: "공사장 도로 미연결", cause: "공사장까지 길이 이어지지 않았습니다" },
    no_route: { title: "자재 경로 없음", cause: "창고에서 공사장까지 길이 없습니다" },
    wall_blocked: { title: "성벽이 경로 차단", cause: "성벽이 자재 운반 길을 막고 있습니다" },
    no_material: { title: "공사 자재 없음", cause: "창고에 필요한 자재가 없습니다" },
    no_workers: { title: "공사 일꾼 없음", cause: "공사에 나갈 일꾼이 없습니다" },
    reserve_held: { title: "비축분 유지 중", cause: "비축분을 남기느라 자재를 보내지 않습니다" },
    reserve_deadlock: { title: CONSTRUCTION_DEADLOCK_COPY.shortLabel, cause: CONSTRUCTION_DEADLOCK_COPY.site },
  },
} as const;
