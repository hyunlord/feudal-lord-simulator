/**
 * F5-A chapter 5's state (save v29, spec docs/design/chapter-five-legacy.md LG-1…LG-11): the steps' ticks, the four
 * answers, the heir's candidates and the heir, the mayor, the backlash, the legacy, the scores and the ending.
 */
import type { PetitionResponse } from "../content/chapterConfig";
import type { HeirKind, LegacyAxis, LegacyEndingId, LegacyStepId } from "../content/legacyConfig";

/** LG-3: one heir the old lord may name (a real person of the family, or one who came with the question). */
export interface HeirCandidate {
  readonly kind: HeirKind;
  readonly personId: string;
  /** The family member he or she comes through (the daughter, the brother or sister), or null (the son, a kinsman). */
  readonly throughId: string | null;
  /** LG-3: a nephew of the lord's brother or sister, or a distant kinsman when the lord has none. */
  readonly relation: "son" | "daughter" | "husband" | "nephew" | "kinsman";
  /** Came with the question (not yet of the family): leaves again if not chosen. */
  readonly created: boolean;
}

export interface HeirRecord {
  readonly kind: HeirKind;
  readonly personId: string;
  readonly previousHeadId: string | null;
  readonly tick: number;
  readonly relief: number;
}

/** LG-7: the three axes. */
export interface LegacyScores {
  readonly town: number;
  readonly family: number;
  readonly church: number;
  /** The parts behind each (for the card and the book). */
  readonly parts: Readonly<Record<LegacyAxis, Readonly<Record<string, number>>>>;
}

/** LG-7: the campaign's ending (written at the last market day). */
export interface LegacyEnding {
  readonly id: LegacyEndingId;
  readonly highest: LegacyAxis;
  readonly chosen: LegacyAxis | null;
  /** The ledger records the sentence quotes (ids). */
  readonly quotes: readonly string[];
  /** The sentence's parameters (the years, the names), rebuilt with `legacyCopy.ko.ts`. */
  readonly params: Readonly<Record<string, string | number>>;
}

export interface LegacyState {
  readonly startTick: number;
  /** LG-1: the tick each step came (absent: still ahead). */
  readonly steps: Readonly<Partial<Record<LegacyStepId, number>>>;
  readonly answers: Readonly<Partial<Record<string, PetitionResponse | "expired">>>;
  /** LG-1: the merchants' candidate for mayor (the first merchant house's head), and the mayor once the charter is sealed. */
  readonly mayorCandidateId: string | null;
  readonly mayorId?: string | null;
  /** LG-3: the heirs offered, and the one named. */
  readonly candidates: readonly HeirCandidate[];
  readonly heir?: HeirRecord;
  /** LG-4: what the Crown was paid. */
  readonly royalSubsidy: number;
  /** LG-2: the town's backlash (chapter 4's, then the refusal's), 0–100. */
  readonly backlash: number;
  /** LG-2: the fee farm the town pays each spring from chapter 5 (chapter 4's until the charter is sealed). */
  readonly feeFarm: number;
  /** LG-1: the family left the manor for its country seat, or stayed. */
  readonly family?: "departed" | "stayed";
  /** LG-5: the legacy and what it cost. */
  readonly legacy?: LegacyAxis | null;
  readonly endowment: number;
  /** LG-7: the cloth sold in chapter 5 (the seals). */
  readonly clothSold: number;
  /** LG-7: at the last market day. */
  readonly scores?: LegacyScores;
  readonly ending?: LegacyEnding;
  readonly endedTick?: number;
}

/** LG-12: one step of the sequence and its state. */
export interface LegacyStep {
  readonly id: LegacyStepId;
  readonly tick: number | null;
  readonly state: "done" | "now" | "ahead";
}
