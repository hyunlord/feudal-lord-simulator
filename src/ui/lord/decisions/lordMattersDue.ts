import type { GameState } from "../../../engine/engine.types";
import { auditDecisionHead, marriageDecisionHead, offMapPetitionHead } from "./decisionCardsModel";

// PLAY-2 (Astra's second lord-mode play, friction 8: the will's chip was pushed out by newer ones and the will lapsed
// unanswered): the house's matters that wait for the lord's answer with a deadline — the father's will (or the contested
// inheritance), a Michaelmas audit's finding, an off-map estate's petition — each by its chip's id. The chips keep these
// until answered (useStoryPresentation `storyChips`); each chip's [결정하기] opens its card.
// ADAPTER: this reads what the engine exposes today (marriageDecisionDue, pendingAudits, the off-map petitions, through
// the decision cards' heads). The engine's SUIT-THREAD brings `lordMattersDue` (the will's deadline among them): swap
// this function's body for it then, keeping its shape; no deadline rule is computed here (`dueTick` is null until then).

export type LordMatterDue = Readonly<{ id: string; kind: "will_change" | "contested" | "audit" | "estate_petition"; title: string; dueTick: number | null }>;

/** The chip id of each matter (lordStoryBeats builds its chips with these). */
export const LORD_MATTER_CHIP = {
  marriage: (kind: string, claimId: string) => `marriage-decision:${kind}:${claimId}`,
  audit: (auditId: string) => `audit:${auditId}`,
  petition: (petitionId: string) => `estate-petition:${petitionId}`,
} as const;

/** The matters due now (the swap point for the engine's `lordMattersDue`). */
export function lordMattersDueNow(state: GameState): readonly LordMatterDue[] {
  const matters: LordMatterDue[] = [];
  const marriage = marriageDecisionHead(state);
  if (marriage !== null) matters.push({ id: LORD_MATTER_CHIP.marriage(marriage.kind, marriage.claimId), kind: marriage.kind, title: marriage.title, dueTick: null });
  const audit = auditDecisionHead(state);
  if (audit !== null) matters.push({ id: LORD_MATTER_CHIP.audit(audit.auditId), kind: "audit", title: audit.title, dueTick: null });
  const petition = offMapPetitionHead(state);
  if (petition !== null) matters.push({ id: LORD_MATTER_CHIP.petition(petition.petitionId), kind: "estate_petition", title: petition.title, dueTick: null });
  return matters;
}
