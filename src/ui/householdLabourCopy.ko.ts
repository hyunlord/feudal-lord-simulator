/** C3 labour and household copy (spec `docs/design/labour.md`, LB-6, LB-8, LB-9). */
export const HOUSEHOLD_LABOUR_COPY = {
  /** LB-6: `성인 3 · 방앗간 1 · 가내 1 · 일용 1`. */
  adults: (count: number) => `성인 ${count}`,
  facility: (name: string, count: number) => `${name} ${count}`,
  fieldHands: (count: number) => `들일 ${count}`,
  dayLabour: (count: number) => `일용 ${count}`,
  household: (count: number) => `가내 ${count}`,
  idle: (count: number) => `일손 남음 ${count}`,
  noAdults: "성인 없음",
  separator: " · ",
  /** LB-8. */
  householdProductionNone: "가내 생산: 없음",
  householdProduction: (names: string) => `가내 생산: ${names}`,
  /** LB-9: goal-panel line and the hint above the A″ 25% threshold (C4 adds household production). */
  idleShortLabel: "일손 남음",
  idleLine: (count: number) => `일손 남음 ${count}`,
  idleHint: "일손이 남습니다 — 건설을 늘리거나 경작지·헛간을 넓히세요",
  /** LB-5 farmstead detail row. */
  farmsteadFieldHands: (hands: number, need: number) => `들일 일손 ${hands} · 이번 철 필요 ${need}`,
  /** LB-7 granary detail row. */
  granaryHaulers: (count: number) => `방앗간 운반 ${count}명`,
} as const;
