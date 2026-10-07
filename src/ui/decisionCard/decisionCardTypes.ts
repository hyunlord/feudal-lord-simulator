import type { StoryIllustration } from "../storyArt";

// DEC-CARD: one shape for every heavy decision card (user 2026-10-06: "I choose without knowing what the options mean or
// affect"). Each family's view model fills it from the engine's own numbers and words in its *.ko.ts; the card
// (DecisionCard.tsx) lays it out the same way everywhere, so the player always finds the same four questions:
// what is happening, what is at stake, what each answer does now and later, and who will remember it.

/** Someone who will remember the answer: a faction, a house, the tenants — and how, in words ("고마워합니다"). */
export type Rememberer = Readonly<{ who: string; how: string; delta: number }>;

export type DecisionChoiceView = Readonly<{
  /** The command's own value (the family's answer id). */
  id: string;
  /** The lord's act, "~한다". */
  label: string;
  /** What happens at once, as sentences (the engine's numbers inside them). */
  now: readonly string[];
  /** What follows later (a deadline, an actual that will be written, a promise to keep, a claim that may come). */
  later: readonly string[];
  remembers: readonly Rememberer[];
  /** Why the engine refuses this answer now; the answer is shown, shut. */
  refusal: string | null;
}>;

export type DecisionCardView = Readonly<{
  /** The family (data-decision-card) and the subject's id (petition, occurrence, audit …). */
  family: string;
  subjectId: string;
  title: string;
  /** The court line (season, king, lord), as every lord card has. */
  court: string | null;
  /** Who brings it ("장원의 청원", "주교의 사절") — one short line. */
  from: string | null;
  /** 무슨 일인가: who wants what, in a sentence or two. */
  situation: string;
  /** 걸린 것: what is at stake for the town and the house. */
  stake: string;
  /** Until when, and what silence means ("답하지 않으면 기각으로 칩니다"); null: no deadline. */
  deadline: string | null;
  illustration: StoryIllustration | null;
  choices: readonly DecisionChoiceView[];
}>;
