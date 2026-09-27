import { SCENARIO_COPY } from "../content/scenario/scenarioCopy.ko";

// UX-0b2 WALL-2 on screen (spec docs/design/wall-expansion.md WX-1, WX-2, WX-4): widening a wall that stands — the
// console's entry, the draft's preview lines and the fields an expansion takes in, which turn to pasture a season on.
export const WALL_EXPANSION_COPY = {
  begin: "목책 넓히기",
  hint: "성벽의 한 변을 골라 밖으로 끄세요. 옛 성 안은 모두 새 성 안이어야 합니다.",
  confirm: "목책 확장 선포",
  cancel: "확장 취소",
  date: (year: number, season: 0 | 1 | 2 | 3) => `${year}년 ${SCENARIO_COPY.seasons[season]}`,
  cost: (steps: number, timber: number) => `새 목책 ${steps}걸음 · 목재 ${timber}`,
  area: (before: number, after: number) => `성 안 ${before}칸 → ${after}칸`,
  /** WX-4: the fields the expansion takes in (a season after it, those still fields become pasture). */
  fields: (cells: number, date: string) => `밭 ${cells}칸이 성 안에 들어갑니다 — ${date}에 목초지로 바뀝니다(먼저 지우면 그대로)`,
  noFields: "성 안에 들어가는 밭은 없습니다",
  failure: {
    no_palisade: "넓힐 성벽이 없습니다",
    invalid_path: "새 둘레가 건물·물·지도 끝과 맞지 않습니다",
    not_containing: "옛 성 안을 모두 새 성 안에 두어야 합니다",
    not_larger: "성 안이 넓어지지 않습니다 — 한 변을 밖으로 끄세요",
    no_gate: "새 둘레에 성문 자리가 없습니다",
  },
  /** After an expansion (WX-4 warning): what is still to turn, and when. */
  pending: (cells: number, date: string) => `성 안이 된 밭 ${cells}칸이 ${date}에 목초지로 바뀝니다 — 먼저 지우면 그대로`,
  alertTitle: "밭이 목초지로 바뀜",
  alertCause: (cells: number, date: string) => `성 안이 된 밭 ${cells}칸 · ${date}에 목초지로`,
} as const;
