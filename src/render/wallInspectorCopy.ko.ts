// Player-facing copy of the wall inspector (a finished wall segment's card, and the ring defence row of a wall
// construction site's card). UI-6, chapter 2's coastal raid (WR-5 `ringDefencePermille`).
export const WALL_INSPECTOR_COPY = {
  type: "성벽",
  art: "성벽",
  label: (name: string) => `${name} 방어 진단`,
  name: (stone: boolean) => (stone ? "석벽 구간" : "목책 구간"),
  purpose: "성 안의 집과 창고를 습격에서 지킵니다. 고리가 모두 이어져야 막아 줍니다.",
  segments: (completed: number, total: number) => `고리 ${total}구간 가운데 ${completed}구간 완공`,
  replacing: "석벽으로 바꾸는 공사 중 · 그동안 목책만큼 막습니다",
  defenceTerm: "성벽 방어",
  defenceClosed: (percent: number) => `성벽 방어 ${percent}% · 고리가 닫혔습니다`,
  defenceOpen: (gaps: number) => `성벽 방어 0% · 틈 ${gaps}구간이 남아 고리가 열려 있습니다`,
  defenceNone: "성벽 방어 0% · 두른 성벽이 없습니다",
  defenceValueClosed: (percent: number) => `${percent}% · 고리 닫힘`,
  defenceValueOpen: (gaps: number) => `0% · 틈 ${gaps}구간`,
} as const;
