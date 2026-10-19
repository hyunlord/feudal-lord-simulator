// The factions' relation stages' names, ready for the stage-crossing chip (lord-screen-v1.md §3, "상인 가문: 못마땅 → 화남").
// The stages are the engine's — DTR-4's thresholds (±30, ±60) through the read the engine was asked for
// (docs/requests/engine-relation-stages.md; `relationStage`, v56). By the stage's rank (−2 hostile … 2 devoted).
const SHORT_FACTION: Readonly<Record<string, string>> = { town: "도시", commons: "농민", bishop: "교회", crown: "왕실" };

/** A house's family name: its first word, with its particle ("드 이브르쿠르"), the brackets aside ("(이웃 영주)"). */
const familyWord = (name: string): string => {
  const words = name.replace(/\(.*\)$/, "").trim().split(" ");
  return words[0] === "드" && words.length > 1 ? `${words[0]} ${words[1]}` : words[0] ?? name;
};

export const RELATION_STAGE_COPY = {
  names: { "-2": "화남", "-1": "못마땅", "0": "무덤덤", "1": "호의", "2": "두터운 믿음" },
  crossed: (faction: string, from: string, to: string) => `${faction}: ${from} → ${to}`,
  /** LS1-17 (the user's ruling 2026-10-19): the rail chip's short form — the faction's short word and the stage it came
   * to ("언더우드 · 무덤덤"); the whole crossing is its card's title. A house by its family's name, the others by their
   * own word. */
  chip: (factionId: string, faction: string, to: string) => `${SHORT_FACTION[factionId] ?? familyWord(faction)} · ${to}`,
  /** The chip's line: the one decision that moved it there (its date and what it was), else several causes (P-C2). */
  cause: (date: string, decision: string) => `${date}의 결정: ${decision}`,
  severalCauses: "여러 까닭",
  advice: "단계 안에서의 관계 수치는 세력 화면과 연말 카드에서 볼 수 있습니다.",
} as const;
