// The factions' relation stages' names, ready for the stage-crossing chip (lord-screen-v1.md §3, "상인 가문: 못마땅 → 화남").
// The stages are the engine's — DTR-4's thresholds (±30, ±60) through the read the engine was asked for
// (docs/requests/engine-relation-stages.md; `relationStage`, v56). By the stage's rank (−2 hostile … 2 devoted).
export const RELATION_STAGE_COPY = {
  names: { "-2": "화남", "-1": "못마땅", "0": "무덤덤", "1": "호의", "2": "두터운 믿음" },
  crossed: (faction: string, from: string, to: string) => `${faction}: ${from} → ${to}`,
  /** The chip's line: the one decision that moved it there (its date and what it was), else several causes (P-C2). */
  cause: (date: string, decision: string) => `${date}의 결정: ${decision}`,
  severalCauses: "여러 까닭",
  advice: "단계 안에서의 관계 수치는 세력 화면과 연말 카드에서 볼 수 있습니다.",
} as const;
