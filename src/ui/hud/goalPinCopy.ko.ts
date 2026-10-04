// LM-R1 (playtest 2026-10-02 #1, #10): the pinned goal — the town's current goal and the very next thing it waits on,
// and the chapter's flow beside it.
export const GOAL_PIN_COPY = {
  region: "지금 목표",
  townHeading: "도시 목표",
  chapterHeading: "이번 장",
  /** The very next thing the goal waits on. */
  short: (label: string, target: number, missing: number, unit: string) => `${label} ${target.toLocaleString("ko-KR")}${unit}까지 ${missing.toLocaleString("ko-KR")}${unit} 부족`,
  /** The glossary's units of the resources a stage asks for (목재 단, 석재 덩이). */
  units: { timber: "단", stone: "덩이" } as Readonly<Record<string, string>>,
  money: (target: string, missing: string) => `금고 ${target}까지 ${missing} 부족`,
  population: (target: number, missing: number) => `인구 ${target.toLocaleString("ko-KR")}명까지 ${missing.toLocaleString("ko-KR")}명 부족`,
  building: (name: string, current: number, target: number) => `${name} ${current}/${target} — 아직 서지 않았습니다`,
  proclaim: "시대를 선포할 수 있습니다",
  wall: (done: number, total: number) => `성벽 ${done}/${total}구간 완공`,
  wallStart: "성벽 공사가 아직 시작되지 않았습니다",
  supplied: (current: number, target: number) => `물과 빵이 닿는 가구 ${current}% — ${target}%가 필요합니다`,
  lots: (current: number, target: number) => `입주한 L4 주거 ${current}/${target}필지`,
  hold: (left: string) => `모든 조건을 갖췄습니다 — ${left} 더 유지하십시오`,
  /** The next action's button. */
  cta: { store: (store: string) => `${store} 보기`, ledger: "저장·생산 보기", goals: "조건 보기", proclaim: "선포하러 가기", wall: "공사 보기" },
  /** The chapter beside the town goal: its goal, and how many of the chapter's goals are reached. */
  chapterReached: (reached: number, total: number) => `이룸 ${reached}/${total}`,
  chapterApart: "도시 목표와 따로 흘러갑니다",
  /** The finished goals, folded under the pin. */
  doneList: (count: number) => `끝낸 목표 ${count}개`,
} as const;
