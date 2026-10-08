import { HOME_ESTATE_ID } from "../../../content/estateConfig";
import { factionDisplayName } from "../../../content/factionCopy.ko";
import { GENTRY_NAMES_KO } from "../../../content/gentryNames";
import type { GameState } from "../../../engine/engine.types";
import { estatesOf, LORD } from "../../../engine/estates";
import { faction } from "../../../engine/factions";
import { marriageDecisionDue } from "../../../engine/marriage";
import { diplomacyOf } from "../../../engine/negotiation";
import { personDisplayName } from "../../../engine/persons";
import type { Person } from "../../../engine/persons.types";
import { lordEstatePetitions, pendingAudits, stewardshipOf } from "../../../engine/stewardship";
import type { EstatePetition } from "../../../engine/stewardship.types";
import { lordMode } from "../../../engine/townAgency";
import type { GameAction } from "../../../state/gameStore.types";
import type { DecisionCardView, DecisionChoiceView } from "../../decisionCard/decisionCardTypes";
import { lordAnswer } from "../../decisionCard/families/lordOutcome";
import { LORD_OUTCOME_COPY as OUTCOME } from "../../decisionCard/families/lordOutcomeCopy.ko";
import { calendarDays } from "../../gameTimeCopy.ko";
import { courtLine } from "../../lordCardsModel";
import { perState } from "../../perState";
import { ESTATES_COPY } from "../estates/estatesCopy.ko";
import { DECISION_CARDS_COPY as COPY, OFFMAP_PETITION_COPY } from "./decisionCardsCopy.ko";

// LM-R2 (lord mode) the lord's decision cards as view models: the father's new will and the contested inheritance
// (NG-8 `marriageDecisionDue`), a Michaelmas audit's finding (SW-6 `pendingAudits`) and an off-map estate's petition
// (SW-4 `lordEstatePetitions`, the home estate's are LM-R1's card). DEC-CARD: each is the heavy decision card
// (src/ui/decisionCard/): the situation, the stake, the deadline and what silence means, and each answer's now / later /
// who remembers from the engine's outlook for its command (DEC-CARD-2 `lordAnswer`: `answerOutlook`, null = the engine
// refuses it) and the dry run for what the outlook lacks (claims, the steward, goodwill, promises' terms), so no rule,
// cost or threshold is copied here. Engine request docs/requests/engine-lmr2-seen-and-reads.md §2 asks for the
// same as read models (`estatePetitionEffect`, `auditAnswerEffect`, `willChangeRefusal`); they would replace the runs.
// The runs happen only for a card that is up, once per state (`perState`: AppModals re-renders on clock and UI events
// while a card is up); the chips read the heads, which run nothing.

/** A card's answer in the heavy layout: its command's value, its label, and its now / later / who remembers. */
type Choice = DecisionChoiceView;

export type WillChangeView = Readonly<{ kind: "will_change"; estate: string; card: DecisionCardView }>;
export type ContestedView = Readonly<{ kind: "contested"; estate: string; suit: string;
  /** What the ledger screen opens on: the lord's suit on the claim, else the claim itself. */
  focus: string; card: DecisionCardView }>;
export type MarriageDecisionView = WillChangeView | ContestedView;

export type AuditDecisionView = AuditDecisionHead & Readonly<{ card: DecisionCardView }>;
export type OffMapPetitionView = OffMapPetitionHead & Readonly<{ card: DecisionCardView }>;

/** One answer: the engine's outlook for its command and the dry run (`lordAnswer`), in words, or shut with why. */
function answer(state: GameState, id: string, label: string, action: GameAction, refused: string,
  extra: { readonly now?: readonly string[]; readonly later?: readonly string[] } = {}): Choice {
  const outcome = lordAnswer(state, action);
  if (outcome === null) return { id, label, now: [], later: [], remembers: [], refusal: refused };
  return { id, label, now: [...extra.now ?? [], ...outcome.now], later: [...outcome.later, ...extra.later ?? []], remembers: outcome.remembers, refusal: null };
}

/** An estate by its house's Korean reading ("드 헤로넬 영지"), as the registry card names it (GENTRY_NAMES_KO). */
const estateName = (state: GameState, estateId: string) => {
  const name = estatesOf(state).estates.find(estate => estate.id === estateId)?.name;
  return COPY.estate(name === undefined ? null : GENTRY_NAMES_KO[name] ?? name);
};

function personOf(state: GameState, id: string): Person | undefined {
  return estatesOf(state).people.find(person => person.id === id) ?? state.persons?.people.find(person => person.id === id);
}

const factionName = (state: GameState, id: string): string => {
  const view = faction(state, id as Parameters<typeof faction>[1]);
  return view === undefined ? id : factionDisplayName(view.id, view.name);
};

const holderName = (state: GameState, holder: string | undefined): string => {
  const person = holder?.startsWith("person:") === true ? personOf(state, holder.slice("person:".length)) : undefined;
  return person === undefined ? COPY.rivalUnknown : personDisplayName(person);
};

export type MarriageDecisionHead = Readonly<{ kind: "will_change" | "contested"; claimId: string; estate: string; title: string; line: string;
  suit: string; focus: string }>;

/** The father's will or the contested inheritance as its chip says it (no dry run); null: neither, or not lord mode. */
export function marriageDecisionHead(state: GameState): MarriageDecisionHead | null {
  if (!lordMode(state)) return null;
  const due = marriageDecisionDue(state);
  const plan = diplomacyOf(state).marriage;
  if (due === null || plan === undefined) return null;
  const estate = estateName(state, plan.estateId);
  if (due === "will_change") return { kind: due, claimId: plan.claimId, estate, title: COPY.willTitle, line: COPY.willLine(estate), suit: "", focus: plan.claimId };
  const suit = estatesOf(state).suits.find(entry => entry.claimId === plan.claimId && entry.plaintiff === LORD && entry.stage !== "closed");
  return { kind: due, claimId: plan.claimId, estate, title: COPY.contestTitle, line: COPY.contestLine(estate, holderName(state, plan.rival)),
    suit: suit === undefined ? COPY.contestNoSuit : COPY.contestSuit(COPY.suitStage[suit.stage] ?? suit.stage), focus: suit?.id ?? plan.claimId };
}

/** A claim's strength by its id, or null. */
const claimStrength = (state: GameState, claimId: string | undefined) =>
  claimId === undefined ? null : estatesOf(state).claims.find(claim => claim.id === claimId)?.strength ?? null;

/** The father's will to answer, or the inheritance contested (its suit), as the lord's card shows it; null: neither. */
export const marriageDecisionView = perState((state: GameState): MarriageDecisionView | null => {
  const head = marriageDecisionHead(state);
  if (head === null) return null;
  const { estate, title } = head;
  const base = { family: head.kind, subjectId: head.claimId, title, court: courtLine(state), illustration: null };
  if (head.kind === "contested") {
    const rival = estatesOf(state).claims.find(claim => claim.estateId === diplomacyOf(state).marriage?.estateId && claim.claimant === diplomacyOf(state).marriage?.rival);
    return { kind: "contested", estate, suit: head.suit, focus: head.focus, card: { ...base, from: head.suit, situation: head.line,
      stake: COPY.contestStake(estate, claimStrength(state, head.claimId), rival?.strength ?? null), deadline: null, choices: [] } };
  }
  const choice = (id: "favour" | "support_promise" | "let_it_be", label: string, later: readonly string[] = []) =>
    answer(state, id, label, { type: "answer_will_change", choice: id }, id === "favour" ? COPY.refusedTreasury : COPY.refusedNow, { later });
  return { kind: "will_change", estate, card: { ...base, from: COPY.willFrom(estate), situation: COPY.willSituation(estate),
    stake: COPY.willStake(estate, claimStrength(state, head.claimId) ?? 0), deadline: COPY.willDeadline,
    choices: [choice("favour", COPY.willFavour), choice("support_promise", COPY.willSupport), choice("let_it_be", COPY.willLetBe, [COPY.willLetBeLater])] } };
});

export type AuditDecisionHead = Readonly<{ auditId: string; estateId: string; kicker: string; title: string; line: string; waits: string }>;

/** The first audit that found something and waits for the lord, as its chip says it (no dry run); null: none. */
export function auditDecisionHead(state: GameState): AuditDecisionHead | null {
  if (!lordMode(state)) return null;
  const audit = pendingAudits(state)[0];
  if (audit === undefined) return null;
  const steward = personOf(state, audit.stewardId);
  return {
    auditId: audit.id, estateId: audit.estateId, kicker: COPY.auditKicker(audit.mode === "visit"), title: COPY.auditTitle,
    line: COPY.auditLine(estateName(state, audit.estateId), steward === undefined ? COPY.rivalUnknown : personDisplayName(steward), audit.revealedKept, audit.revealedErrors),
    waits: COPY.waits(calendarDays(audit.deadline - state.tick)),
  };
}

/** The first audit that found something and waits for the lord, as its card shows it; null: none (or not lord mode). */
export const auditDecisionView = perState((state: GameState): AuditDecisionView | null => {
  const head = auditDecisionHead(state);
  if (head === null) return null;
  const audit = pendingAudits(state)[0]!;
  const steward = stewardshipOf(state).stewards.find(entry => entry.personId === audit.stewardId);
  const person = personOf(state, audit.stewardId);
  const name = person === undefined ? COPY.rivalUnknown : personDisplayName(person);
  const connection = steward?.connection === null || steward?.connection === undefined ? null : factionName(state, steward.connection);
  const choice = (id: "punish" | "replace" | "tolerate", label: string) => answer(state, id, label, { type: "answer_audit", auditId: audit.id, choice: id },
    id === "tolerate" ? COPY.refusedNow : COPY.auditNoSuccessor, id === "tolerate" ? { now: [OUTCOME.stewardStays(name)] } : {});
  return { ...head, card: { family: "audit", subjectId: audit.id, title: head.title, court: courtLine(state), from: head.kicker, situation: head.line,
    stake: COPY.auditStake(estateName(state, audit.estateId), name, steward === undefined ? "" : ESTATES_COPY.dispositions[steward.disposition], connection),
    deadline: COPY.auditDeadline(calendarDays(audit.deadline - state.tick)), illustration: null,
    choices: [choice("punish", COPY.auditPunish), choice("replace", COPY.auditReplace), choice("tolerate", COPY.auditTolerate)] } };
});

/** The off-map estates' petitions waiting for the lord and still answerable (the home estate's have their own card; one past
 * its deadline only waits for its season to lapse it, and the engine refuses an answer to it). */
export function openOffMapPetitions(state: GameState): readonly EstatePetition[] {
  return lordMode(state) ? lordEstatePetitions(state).filter(petition => petition.estateId !== HOME_ESTATE_ID && state.tick <= petition.deadline
    && petition.kind in OFFMAP_PETITION_COPY) : [];
}

export type OffMapPetitionHead = Readonly<{ petitionId: string; estateId: string; kind: EstatePetition["kind"]; kicker: string; title: string;
  line: string; why: string; waits: string }>;

/** The first off-map estate's petition waiting for the lord, as its chip says it (no dry run); null: none. */
export function offMapPetitionHead(state: GameState): OffMapPetitionHead | null {
  const petition = openOffMapPetitions(state)[0];
  if (petition === undefined) return null;
  const copy = OFFMAP_PETITION_COPY[petition.kind as keyof typeof OFFMAP_PETITION_COPY];
  const estate = estateName(state, petition.estateId);
  return {
    petitionId: petition.id, estateId: petition.estateId, kind: petition.kind, kicker: COPY.petitionKicker(estate), title: copy.title,
    line: COPY.petitionLine(estate, petition.group, copy.title, petition.amount), why: COPY.petitionWhy(petition.escalated),
    waits: COPY.waits(calendarDays(petition.deadline - state.tick)),
  };
}

/** The first off-map estate's petition waiting for the lord, as its card shows it; null: none. */
export const offMapPetitionView = perState((state: GameState): OffMapPetitionView | null => {
  const head = offMapPetitionHead(state);
  if (head === null) return null;
  const petition = openOffMapPetitions(state)[0]!;
  const copy = OFFMAP_PETITION_COPY[head.kind as keyof typeof OFFMAP_PETITION_COPY];
  const goodwill = stewardshipOf(state).oversight.find(entry => entry.estateId === head.estateId)?.[petition.group] ?? 0;
  const choice = (grant: boolean) => answer(state, grant ? "grant" : "refuse", grant ? copy.grant : copy.refuse,
    { type: "answer_estate_petition", petitionId: head.petitionId, grant }, COPY.refusedNow);
  return { ...head, card: { family: "estate_petition_offmap", subjectId: head.petitionId, title: head.title, court: courtLine(state), from: head.kicker,
    situation: head.why === "" ? head.line : `${head.line} ${head.why}.`, stake: COPY.petitionStake(estateName(state, head.estateId), petition.group, goodwill),
    deadline: COPY.petitionDeadline(calendarDays(petition.deadline - state.tick)), illustration: null, choices: [choice(true), choice(false)] } };
});
