// DEC-CARD: the heavy decision card's own words — the four questions every card answers in the same place, and how a
// faction's move reads in words (a number alone does not say whether they are pleased). Words follow
// docs/design/glossary.md; the lord's answers are his act ("~한다"), the card's lines "~합니다".

/** How strongly a faction takes it, by the engine's relation move (the sign and its size). */
const feeling = (delta: number): string => {
  const size = Math.abs(delta);
  if (delta > 0) return size >= 10 ? "크게 고마워합니다" : size >= 5 ? "고마워합니다" : "조금 반깁니다";
  return size >= 10 ? "크게 원망합니다" : size >= 5 ? "못마땅해합니다" : "조금 서운해합니다";
};

export const DECISION_CARD_COPY = {
  situation: "무슨 일인가",
  stake: "걸린 것",
  now: "지금",
  later: "나중에",
  remembers: "기억하는 이",
  nobodyRemembers: "따로 기억할 사람은 없습니다",
  nothingLater: "뒤따르는 일은 없습니다",
  choose: (label: string) => `${label} — 이렇게 정한다`,
  later_: "나중에 정한다",
  feels: (delta: number) => `${feeling(delta)} (관계 ${delta > 0 ? "+" : ""}${delta})`,
} as const;
