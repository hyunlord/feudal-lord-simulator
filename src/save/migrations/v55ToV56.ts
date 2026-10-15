/**
 * v56 is TRACE-LINK + INERT with growthBlock's `since` (the user's rulings 2026-10-10/13: one version for all of them).
 * Every new field is optional and absent on an older save — never guessed backwards from it:
 *  - TRACE-LINK: `trace.answers` (each answer's own trace, the choice's actual target, overlapping causes, immediate,
 *    conditional or unobserved), `trace.answers[].effects` (the answer's before/after facts, `answerEffects`), the estate
 *    relations' evidence, and the displayed wording's entry id on the answered commands;
 *  - INERT: an estate's `charterResistance`, a steward's `toleratedErrors` and `auditTolerance`, an audit's `decidedBy`,
 *    `policyAuditId` and `superseded`, a season summary's `charterLoss` and `toleratedLosses`;
 *  - growthBlock (GB2A-7): `agency.seasonGrowth`, the town at the last season's close and the last close it grew.
 * So only the version moves (the TRACE-LINK and INERT branches' provisional v55–v57 steps are not used).
 */
export function migrateV55ToV56(input: unknown): unknown {
  if (typeof input !== "object" || input === null) throw new TypeError("Schema v55 save must be an envelope object");
  const envelope = input as { readonly state?: unknown };
  if (typeof envelope.state !== "object" || envelope.state === null) throw new TypeError("Schema v55 save has no state");
  return { ...envelope, schemaVersion: 56 };
}
