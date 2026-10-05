import { HOME_ESTATE_ID } from "../../../content/estateConfig";
import { GENTRY_NAMES_KO } from "../../../content/gentryNames";
import type { GameState } from "../../../engine/engine.types";
import { estatesOf, LORD } from "../../../engine/estates";
import { answerWillChange, marriageDecisionDue } from "../../../engine/marriage";
import { diplomacyOf } from "../../../engine/negotiation";
import { personDisplayName } from "../../../engine/persons";
import type { Person } from "../../../engine/persons.types";
import { answerAudit, answerEstatePetition, lordEstatePetitions, pendingAudits, stewardshipOf } from "../../../engine/stewardship";
import type { EstatePetition } from "../../../engine/stewardship.types";
import { lordMode } from "../../../engine/townAgency";
import { treasuryBalance } from "../../../ledger/ledger";
import { calendarDays } from "../../gameTimeCopy.ko";
import { courtLine } from "../../lordCardsModel";
import { DECISION_CARDS_COPY as COPY, OFFMAP_PETITION_COPY } from "./decisionCardsCopy.ko";

// LM-R2 (lord mode) the lord's decision cards as view models: the father's new will and the contested inheritance
// (NG-8 `marriageDecisionDue`), a Michaelmas audit's finding (SW-6 `pendingAudits`) and an off-map estate's petition
// (SW-4 `lordEstatePetitions`, the home estate's are LM-R1's card). Each answer's numbers and refusal come from a dry
// run of the engine's own command on the state (it is pure: the same state back means the engine refuses it), so no
// rule, cost or threshold is copied here. Engine request docs/requests/engine-lmr2-seen-and-reads.md §2 asks for the
// same as read models (`estatePetitionEffect`, `auditAnswerEffect`, `willChangeRefusal`); they would replace the runs.

export type DecisionOption<T extends string> = Readonly<{ choice: T; label: string; line: string; refusal: string | null }>;

export type WillChangeView = Readonly<{ kind: "will_change"; estate: string; court: string; title: string; line: string;
  options: readonly DecisionOption<"favour" | "support_promise" | "let_it_be">[] }>;
export type ContestedView = Readonly<{ kind: "contested"; estate: string; court: string; title: string; line: string; suit: string;
  /** What the ledger screen opens on: the lord's suit on the claim, else the claim itself. */
  focus: string }>;
export type MarriageDecisionView = WillChangeView | ContestedView;

export type AuditDecisionView = Readonly<{ auditId: string; estateId: string; court: string; kicker: string; title: string; line: string;
  waits: string; options: readonly DecisionOption<"punish" | "replace" | "tolerate">[] }>;

export type OffMapPetitionView = Readonly<{ petitionId: string; estateId: string; kind: EstatePetition["kind"]; court: string; kicker: string;
  title: string; line: string; why: string; waits: string; options: readonly (DecisionOption<"grant" | "refuse"> & { readonly grant: boolean })[] }>;

/** An estate by its house's Korean reading ("드 헤로넬 영지"), as the registry card names it (GENTRY_NAMES_KO). */
const estateName = (state: GameState, estateId: string) => {
  const name = estatesOf(state).estates.find(estate => estate.id === estateId)?.name;
  return COPY.estate(name === undefined ? null : GENTRY_NAMES_KO[name] ?? name);
};

function personOf(state: GameState, id: string): Person | undefined {
  return estatesOf(state).people.find(person => person.id === id) ?? state.persons?.people.find(person => person.id === id);
}

const holderName = (state: GameState, holder: string | undefined): string => {
  const person = holder?.startsWith("person:") === true ? personOf(state, holder.slice("person:".length)) : undefined;
  return person === undefined ? COPY.rivalUnknown : personDisplayName(person);
};

/** The father's will to answer, or the inheritance contested (its suit), as the lord's card shows it; null: neither. */
export function marriageDecisionView(state: GameState): MarriageDecisionView | null {
  if (!lordMode(state)) return null;
  const due = marriageDecisionDue(state);
  const plan = diplomacyOf(state).marriage;
  if (due === null || plan === undefined) return null;
  const estate = estateName(state, plan.estateId);
  if (due === "contested") {
    const suit = estatesOf(state).suits.find(entry => entry.claimId === plan.claimId && entry.plaintiff === LORD && entry.stage !== "closed");
    return { kind: "contested", estate, court: courtLine(state), title: COPY.contestTitle, line: COPY.contestLine(estate, holderName(state, plan.rival)),
      suit: suit === undefined ? COPY.contestNoSuit : COPY.contestSuit(COPY.suitStage[suit.stage] ?? suit.stage), focus: suit?.id ?? plan.claimId };
  }
  const run = (choice: "favour" | "support_promise" | "let_it_be") => answerWillChange(state, choice);
  const option = (choice: "favour" | "support_promise" | "let_it_be", label: string, line: (after: GameState) => string) => {
    const after = run(choice);
    const refused = after === state;
    const short = refused && choice === "favour";
    return { choice, label, line: refused ? "" : line(after), refusal: refused ? (short ? COPY.refusedTreasury : COPY.refusedNow) : null };
  };
  const newPromise = (after: GameState) => diplomacyOf(after).promises.find(entry => !diplomacyOf(state).promises.some(old => old.id === entry.id));
  return {
    kind: "will_change", estate, court: courtLine(state), title: COPY.willTitle, line: COPY.willLine(estate),
    options: [
      option("favour", COPY.willFavour, after => COPY.willFavourLine(treasuryBalance(after) - treasuryBalance(state))),
      option("support_promise", COPY.willSupport, after => COPY.willSupportLine(calendarDays((newPromise(after)?.deadline ?? state.tick) - state.tick))),
      option("let_it_be", COPY.willLetBe, () => COPY.willLetBeLine),
    ],
  };
}

/** The first audit that found something and waits for the lord, as its card shows it; null: none (or not lord mode). */
export function auditDecisionView(state: GameState): AuditDecisionView | null {
  if (!lordMode(state)) return null;
  const audit = pendingAudits(state)[0];
  if (audit === undefined) return null;
  const estate = estateName(state, audit.estateId);
  const steward = personOf(state, audit.stewardId);
  const before = stewardshipOf(state);
  const option = (choice: "punish" | "replace" | "tolerate", label: string): DecisionOption<typeof choice> => {
    const after = answerAudit(state, audit.id, choice);
    if (after === state) return { choice, label, line: "", refusal: choice === "tolerate" ? COPY.refusedNow : COPY.auditNoSuccessor };
    if (choice === "tolerate") {
      const loyalty = (stewardshipOf(after).stewards.find(entry => entry.personId === audit.stewardId)?.loyalty ?? 0)
        - (before.stewards.find(entry => entry.personId === audit.stewardId)?.loyalty ?? 0);
      return { choice, label, line: COPY.auditStays(loyalty), refusal: null };
    }
    const successorId = stewardshipOf(after).oversight.find(entry => entry.estateId === audit.estateId)?.stewardId;
    const successor = successorId === undefined ? undefined : personOf(state, successorId);
    const recovered = COPY.auditRecovered(treasuryBalance(after) - treasuryBalance(state));
    return { choice, label, line: successor === undefined ? recovered : `${recovered} · ${COPY.auditSuccessor(personDisplayName(successor))}`, refusal: null };
  };
  return {
    auditId: audit.id, estateId: audit.estateId, court: courtLine(state), kicker: COPY.auditKicker(audit.mode === "visit"), title: COPY.auditTitle,
    line: COPY.auditLine(estate, steward === undefined ? COPY.rivalUnknown : personDisplayName(steward), audit.revealedKept, audit.revealedErrors),
    waits: COPY.waits(calendarDays(audit.deadline - state.tick)),
    options: [option("punish", COPY.auditPunish), option("replace", COPY.auditReplace), option("tolerate", COPY.auditTolerate)],
  };
}

/** The off-map estates' petitions waiting for the lord and still answerable (the home estate's have their own card; one past
 * its deadline only waits for its season to lapse it, and the engine refuses an answer to it). */
export function openOffMapPetitions(state: GameState): readonly EstatePetition[] {
  return lordMode(state) ? lordEstatePetitions(state).filter(petition => petition.estateId !== HOME_ESTATE_ID && state.tick <= petition.deadline
    && petition.kind in OFFMAP_PETITION_COPY) : [];
}

/** The first off-map estate's petition waiting for the lord, as its card shows it; null: none. */
export function offMapPetitionView(state: GameState): OffMapPetitionView | null {
  const petition = openOffMapPetitions(state)[0];
  if (petition === undefined) return null;
  const copy = OFFMAP_PETITION_COPY[petition.kind as keyof typeof OFFMAP_PETITION_COPY];
  const estate = estateName(state, petition.estateId);
  const oversight = (from: GameState) => stewardshipOf(from).oversight.find(entry => entry.estateId === petition.estateId);
  const value = (from: GameState) => estatesOf(from).estates.find(entry => entry.id === petition.estateId)?.annualValue ?? 0;
  const option = (grant: boolean) => {
    const choice = grant ? "grant" as const : "refuse" as const;
    const label = grant ? copy.grant : copy.refuse;
    const after = answerEstatePetition(state, petition.id, grant);
    if (after === state) return { choice, grant, label, line: "", refusal: COPY.refusedNow };
    const parts = [COPY.treasury(treasuryBalance(after) - treasuryBalance(state))];
    const [was, now] = [oversight(state), oversight(after)];
    if (was !== undefined && now !== undefined) {
      if (now.tenants !== was.tenants) parts.push(COPY.goodwill("tenants", now.tenants - was.tenants));
      if (now.merchants !== was.merchants) parts.push(COPY.goodwill("merchants", now.merchants - was.merchants));
    }
    if (value(after) < value(state)) parts.push(COPY.valueDrop);
    return { choice, grant, label, line: parts.join(" · "), refusal: null };
  };
  return {
    petitionId: petition.id, estateId: petition.estateId, kind: petition.kind, court: courtLine(state), kicker: COPY.petitionKicker(estate),
    title: copy.title, line: COPY.petitionLine(estate, petition.group, copy.title, petition.amount), why: COPY.petitionWhy(petition.escalated),
    waits: COPY.waits(calendarDays(petition.deadline - state.tick)), options: [option(true), option(false)],
  };
}
