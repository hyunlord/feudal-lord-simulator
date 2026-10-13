// The factions' relation stages' names, ready for the stage-crossing chip (lord-screen-v1.md §3, "상인 가문: 못마땅 → 화남").
// The stages are the engine's — DTR-4's thresholds (±30, ±60) through the read the engine was asked for
// (docs/requests/engine-relation-stages.md); the chip comes once that read lands. By the stage's rank, worst first.
export const RELATION_STAGE_COPY = {
  names: { "-2": "화남", "-1": "못마땅", "0": "무덤덤", "1": "호의", "2": "두터운 믿음" },
  crossed: (faction: string, from: string, to: string) => `${faction}: ${from} → ${to}`,
} as const;
