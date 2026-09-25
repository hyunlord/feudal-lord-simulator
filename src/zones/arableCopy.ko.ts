import type { ArableStage } from "./arable.types";

/** Player-facing copy for arable fields and farmsteads (Korean, spec AF-10…AF-11). */
export const ARABLE_STAGE_LABELS = {
  fallow: "휴경",
  ploughed: "갈이",
  sown: "파종",
  growing: "자람",
  ripe: "여묾",
  harvested: "수확 끝",
} as const satisfies Record<ArableStage, string>;

/** AF-11 cause rows (the cause registry keeps its ids; these are the detail labels). */
export const ARABLE_CAUSE_LABELS = {
  no_farmstead: "헛간 없음",
  farmstead_no_road: "경작지 도로 접근 없음",
  no_labour: "일손 부족(경작)",
  harvest_waiting: "수확 대기",
  barn_full: "창고 넘침 — 헛간이 가득 차 수확을 못 들임",
  reserve_short: "비축 부족 — 다음 수확 전에 밀이 바닥남",
} as const;

export type ArableCauseKey = keyof typeof ARABLE_CAUSE_LABELS;

/** AF-10 prediction lines while painting an arable zone. */
export const ARABLE_PREDICTION_COPY = {
  fieldYield: (cells: number, wheat: number) => `경작 ${cells}칸 · 연간 밀 약 ${wheat}`,
  farmsteadNeeded: "헛간 1개 필요",
  farmsteadTends: "기존 헛간이 맡음",
} as const;

/** Farmstead inspector rows. */
export const FARMSTEAD_COPY = {
  tended: (strips: number, cells: number) => `맡은 띠 ${strips}개 · ${cells}칸`,
  expected: (wheat: number) => `올해 예상 수확 약 ${wheat}`,
  noField: "맡은 경작지 없음 — 경작지 구역 옆에 지어야 합니다",
} as const;
