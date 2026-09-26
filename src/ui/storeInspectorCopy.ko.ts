import { RESOURCE_NAMES } from "./hud/hudCopy.ko";

// UX-3R2 storage inspector (UX3R 6절): capacity, what it takes, stock per item with the week's change, who uses it.
export const STORE_INSPECTOR_COPY = {
  label: (name: string) => `${name} 저장소`,
  type: "저장소",
  capacity: (used: number, capacity: number, incoming: number) => incoming > 0 ? `${used} / ${capacity} · 들어올 몫 ${incoming}` : `${used} / ${capacity}`,
  capacityLabel: "용량",
  acceptsHeading: "받는 품목",
  /** No per-store item switch in the rules yet (F0-C1 FC10): the chips show what the store takes by rule. */
  acceptsNote: "품목을 끄고 켜는 규칙은 아직 없습니다 — 지금은 규칙대로 받습니다",
  stockHeading: "품목별 재고 · 이번 주",
  week: (delta: number | null) => delta === null ? "기록 중" : delta > 0 ? `+${delta}` : delta < 0 ? `−${-delta}` : "0",
  usersHeading: "이 창고를 쓰는 곳",
  usersNone: "아직 오간 수레가 없습니다",
  userOut: (name: string, resource: string) => `${name}에 ${resource} 내줌`,
  userIn: (name: string, resource: string) => `${name}에서 ${resource} 들여옴`,
  distributors: (count: number) => `배급꾼 ${count}명이 여기서 떠남`,
  site: (name: string) => `${name} 공사장`,
  lookAt: "위치로",
  resource: (resource: keyof typeof RESOURCE_NAMES) => RESOURCE_NAMES[resource],
} as const;
