// LM-R1 (playtest 2026-10-02 #8): the burnt house's card — whether it is being rebuilt, what the rebuild needs, and what
// the player can do now.
export const BURNT_HOUSE_COPY = {
  heading: "불탄 집",
  statusTerm: "다시 짓는 중",
  conditionsTerm: "필요한 조건",
  nowTerm: "지금 할 일",
  /** The rebuild site stands: its work done and its builders. */
  rebuilding: (percent: number, builders: number) => builders > 0 ? `공사 ${percent}% · 일꾼 ${builders}명` : `공사 ${percent}% · 일꾼 없음`,
  /** No rebuild site yet. */
  notStarted: "아직 시작하지 않았습니다",
  /** Lord mode: the town rebuilds its houses itself (the town agency). */
  townWaits: "마을이 다시 지을 차례를 기다립니다",
  /** A material and how much of it the rebuild has (or will need). */
  material: (resource: string, delivered: number, required: number) => `${resource} ${delivered.toLocaleString("ko-KR")}/${required.toLocaleString("ko-KR")}`,
  materialNeeded: (resource: string, required: number) => `${resource} ${required.toLocaleString("ko-KR")}`,
  builders: "공사에 나갈 일꾼",
  /** The rebuild site lacks nothing. */
  allMet: "필요한 것을 모두 갖췄습니다",
  /** The site has all it needs: nothing to do but wait. */
  wait: "기다리면 됩니다 — 공사가 끝나면 가구가 다시 들어옵니다",
  startPrompt: "다시 짓기를 누르면 공사장이 섭니다",
  townPrompt: "기다리십시오 — 마을 사람들이 다시 짓습니다",
  rebuild: "다시 짓기",
  /** The household that stays in the burnt house (rent-free, no promotion until it is rebuilt). */
  household: (residents: number) => `${residents}명이 불탄 집에 남아 있습니다 — 다시 지을 때까지 지대도 승급도 없습니다`,
} as const;
