/** Immutable, answer-time facts. Missing values use null with an explicit presence bit. */
export type AnswerEffectValue = string | number | boolean | null;
export const ANSWER_EFFECT_TARGETS = ['relation', 'treasury', 'right', 'land', 'person', 'command', 'oversight', 'condition', 'audit_recovery', 'marriage', 'term'] as const;
export type AnswerEffectTarget = (typeof ANSWER_EFFECT_TARGETS)[number];
export interface AnswerEffect {
  readonly target: AnswerEffectTarget;
  /** Stable domain path; array entities use their id/personId/estateId, otherwise their index. */
  readonly path: readonly string[];
  readonly before: AnswerEffectValue;
  readonly after: AnswerEffectValue;
  readonly beforePresent: boolean;
  readonly afterPresent: boolean;
  /** Arithmetic difference only when both values are numeric. Non-numeric transitions use null. */
  readonly delta: number | null;
}
