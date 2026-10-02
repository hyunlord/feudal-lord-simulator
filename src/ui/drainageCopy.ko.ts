import type { DrainageRefusal } from "../engine/drainage";

// LAND-UI (LU-D6, MA-11): the fen's drainage tool — its build-drawer card, the chip over a mere and the refusals.
export const DRAINAGE_COPY = {
  card: "습지 배수",
  cardHint: "고인 물 칸당 목재 5",
  chipTitle: "배수 공사",
  cells: (cells: number) => `메울 물 ${cells}칸`,
  timber: (timber: number) => `목재 ${timber}`,
  seasons: (seasons: number, diggers: number) => `일꾼 ${diggers}명이면 약 ${seasons}계절`,
  confirm: "클릭하여 공사 시작 · Esc/우클릭 취소",
  started: (cells: number) => `배수 공사 시작 — 물 ${cells}칸`,
  /** FIX-13: the insufficient_timber refusal's amounts (the engine's timberNeeded / timberHave). */
  timberShort: (needed: number, have: number) => `목재 ${needed} 필요 · 지금 ${have}`,
  refusal: {
    not_fen: "습지 땅에서만 메울 수 있습니다",
    not_still_water: "고인 물(웅덩이·늪)을 고르세요 — 강물과 길은 안 됩니다",
    no_bank: "풀밭 둑에 닿은 물이어야 합니다",
    busy: "이미 공사 중인 물입니다",
    too_many_works: "배수 공사는 한 번에 둘까지입니다",
    insufficient_timber: "목재가 부족합니다",
  } satisfies Record<DrainageRefusal, string>,
} as const;
