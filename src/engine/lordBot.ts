/**
 * LM-E8 (spec docs/design/lord-slice.md LS-3): the lord-mode bot — a stand-in player who plays only the lord, with
 * every feature: the chapters' petitions and famine, the estate policy, subsidies and market dues, the marriage
 * (offer, counter, promises, the will), the suits on his claims, the stewardship (exceptions, delegation, audit mode,
 * the petitions brought up and the audits) and the town's requests (charter, wall, timber). The town itself is built by
 * the town agency. Each command carries its kind (the slice's decision density counts them); `asked` marks a decision
 * that came to the lord (an answer), against one he took of himself.
 */
import type { BuildingKind } from "../content/buildingConfig";
import { WILL_FAVOUR_PENNIES } from "../content/diplomacyConfig";
import { treasuryBalance } from "../ledger/ledger";
import type { GameAction } from "../state/gameStore.types";
import { autoplayActionToGameAction } from "./autoplayActions";
import { chapterDecisionAction } from "./autoplayEvents";
import type { GameState } from "./engine.types";
import { estatesOf, LORD } from "./estates";
import { lordBotMarriageCommands, marriageDecisionDue } from "./marriage";
import { diplomacyOf } from "./negotiation";
import { currentYear } from "./persons";
import { lordEstatePetitions, pendingAudits, stewardCandidates, stewardshipOf } from "./stewardship";
import { lordRequests, subsidyRefusal } from "./townAgency";
import type { EstatePolicy } from "./townAgency.types";
import { AGENCY_WEEK_TICKS } from "../content/townAgencyConfig";
import { HOME_ESTATE_ID } from "../content/estateConfig";
import { HOME_PETITION_KINDS } from "../content/stewardshipConfig";
import type { HomePetitionKind } from "./stewardship.types";

export type LordDecisionKind =
  | "petition" | "famine" | "marriage_offer" | "counter" | "promise" | "will" | "suit"
  | "oversight" | "estate_petition" | "audit" | "policy" | "subsidy" | "dues" | "town_request";

/** LS-4: the kinds that come to the lord to be answered (the rest he takes of himself). */
export const ASKED_KINDS: ReadonlySet<LordDecisionKind> = new Set(["petition", "famine", "counter", "will", "estate_petition", "audit", "town_request"]);

export interface LordBotCommand {
  readonly kind: LordDecisionKind;
  readonly command: GameAction;
}

/** LS-3: the bot's estate policy by the year — growth first, revenue once the town stands, stability through the famine. */
export function lordBotPolicy(year: number): EstatePolicy {
  if (year < 1308) return "growth";
  if (year >= 1315 && year <= 1317) return "stability";
  return "revenue";
}

/** LS-3: the subsidy the bot offers by the year (one at a time), and the stall fee it asks. */
const SUBSIDIES: readonly { readonly from: number; readonly kind: BuildingKind; readonly amount: number }[] = [
  { from: 1300, kind: "granary", amount: 40 }, { from: 1306, kind: "market", amount: 60 }, { from: 1312, kind: "church", amount: 60 },
];
export function lordBotDues(year: number): number {
  return year < 1310 ? 800 : 1100;
}

/**
 * LS-3 API: what the lord bot does before this tick — the answers due now (each tick, cheap), and once a week its own
 * moves and the town's requests. Commands in order; the caller applies them one by one (a command the state refuses
 * leaves it as it was).
 */
export function lordBotCommands(state: GameState): readonly LordBotCommand[] {
  const commands: LordBotCommand[] = [];
  const answer = chapterDecisionAction(state, "relief", "accept", "pay");
  const answered = answer === null ? null : autoplayActionToGameAction(answer, state);
  if (answered !== null) commands.push({ kind: answered.type === "famine_response" ? "famine" : "petition", command: answered });
  if (state.tick % AGENCY_WEEK_TICKS !== 1) return commands;
  commands.push(...marriageMoves(state), ...suitMoves(state), ...stewardshipMoves(state), ...townMoves(state));
  return commands;
}

function marriageMoves(state: GameState): LordBotCommand[] {
  const moves: LordBotCommand[] = lordBotMarriageCommands(state).map(command => ({
    kind: command.type === "keep_promise" ? "promise" as const : command.type === "answer_counter" ? "counter" as const : "marriage_offer" as const, command,
  }));
  // The will's change: a favour while the treasury pays it, else a promise of support.
  if (marriageDecisionDue(state) === "will_change") {
    moves.push({ kind: "will", command: { type: "answer_will_change", choice: treasuryBalance(state) >= WILL_FAVOUR_PENNIES ? "favour" : "support_promise" } });
  }
  return moves;
}

/** The lord's claims in court: a contested marriage's, and any other open claim of his; each suit taken a step. */
function suitMoves(state: GameState): LordBotCommand[] {
  const estates = estatesOf(state);
  const marriageClaim = diplomacyOf(state).marriage?.claimId;
  const contested = marriageDecisionDue(state) === "contested";
  const moves: LordBotCommand[] = [];
  for (const claim of estates.claims) {
    if (claim.claimant !== LORD || claim.status !== "open" || (claim.id === marriageClaim && !contested)) continue;
    if (!estates.suits.some(suit => suit.claimId === claim.id)) moves.push({ kind: "suit", command: { type: "file_suit", claimId: claim.id } });
  }
  for (const suit of estates.suits) {
    if (suit.plaintiff !== LORD || suit.stage === "closed") continue;
    if (suit.stage === "filed" || suit.stage === "evidence") {
      for (const evidence of ["deed", "witnesses", "charter"] as const) moves.push({ kind: "suit", command: { type: "add_suit_evidence", suitId: suit.id, evidence } });
    } else if (suit.stage === "patronage" && suit.patron === undefined) moves.push({ kind: "suit", command: { type: "seek_suit_patron", suitId: suit.id, factionId: "bishop" } });
    else if (suit.stage === "enforcing") moves.push({ kind: "suit", command: { type: "enforce_possession", suitId: suit.id } });
  }
  return moves;
}

/**
 * A second estate: the exceptions set (£1 or more, a right, a marriage come to him), the estate given to its ablest
 * candidate who is not greedy, the first Michaelmas audited by a visit and the later ones by the accounts; what comes up
 * answered — the tenants' asks granted, the merchants' refused; an audit that found money kept back punished, else let be.
 */
function stewardshipMoves(state: GameState): LordBotCommand[] {
  const stewardship = state.stewardship;
  if (stewardship === undefined) return [];
  const moves: LordBotCommand[] = [];
  const rules = stewardship.rules;
  // The exceptions matter once an estate is held off the map (FIX-14: the home petitions bring the stewardship earlier).
  if (stewardship.oversight.length > 0 && (rules.amountAtLeast !== 240 || !rules.rights || !rules.marriage)) {
    moves.push({ kind: "oversight", command: { type: "set_exception_rules", rules: { amountAtLeast: 240, rights: true, marriage: true } } });
  }
  for (const oversight of stewardship.oversight) {
    if (oversight.mode === "direct") {
      const best = [...stewardCandidates(state, oversight.estateId)].filter(entry => entry.record.disposition !== "greedy" && entry.person?.alive !== false)
        .sort((a, b) => b.record.ability - a.record.ability || a.record.personId.localeCompare(b.record.personId))[0];
      if (best !== undefined) moves.push({ kind: "oversight", command: { type: "set_estate_oversight", estateId: oversight.estateId, mode: "steward", stewardId: best.record.personId } });
    }
    const audited = stewardship.audits.some(audit => audit.estateId === oversight.estateId);
    const mode = audited ? "accounts" : "visit";
    if (oversight.auditMode !== mode) moves.push({ kind: "oversight", command: { type: "set_audit_mode", estateId: oversight.estateId, mode } });
  }
  for (const petition of lordEstatePetitions(state)) {
    // FIX-14: a home petition that costs the treasury more than it holds is refused.
    const costly = petition.estateId === HOME_ESTATE_ID && HOME_PETITION_KINDS[petition.kind as HomePetitionKind].grant.income < 0 && petition.amount > treasuryBalance(state);
    moves.push({ kind: "estate_petition", command: { type: "answer_estate_petition", petitionId: petition.id, grant: petition.group === "tenants" && !costly } });
  }
  for (const audit of pendingAudits(state)) {
    moves.push({ kind: "audit", command: { type: "answer_audit", auditId: audit.id, choice: audit.revealedKept > 0 ? "punish" : "tolerate" } });
  }
  return moves;
}

/** The estate policy, the subsidy and the stall fee by the year; and what the town asks of its lord, granted. */
function townMoves(state: GameState): LordBotCommand[] {
  const agency = state.agency;
  if (agency === undefined) return [];
  const year = currentYear(state);
  const moves: LordBotCommand[] = [];
  const policy = lordBotPolicy(year);
  if (agency.policy !== policy) moves.push({ kind: "policy", command: { type: "set_estate_policy", policy } });
  const subsidy = [...SUBSIDIES].reverse().find(entry => entry.from <= year)!;
  for (const old of agency.subsidies) if (old.kind !== subsidy.kind) moves.push({ kind: "subsidy", command: { type: "set_project_subsidy", kind: old.kind, amount: 0 } });
  // Offered once the treasury carries it (TA-6 ②: a refused offer is not sent).
  if (!agency.subsidies.some(entry => entry.kind === subsidy.kind) && subsidyRefusal(state, subsidy.kind, subsidy.amount) === null) {
    moves.push({ kind: "subsidy", command: { type: "set_project_subsidy", kind: subsidy.kind, amount: subsidy.amount } });
  }
  const dues = lordBotDues(year);
  if (agency.duesPermille !== dues) moves.push({ kind: "dues", command: { type: "set_market_dues", permille: dues } });
  const request = lordRequests(state)[0];
  const granted = request === undefined ? null : autoplayActionToGameAction(request, state);
  if (granted !== null) moves.push({ kind: "town_request", command: granted });
  return moves;
}

/** The serving stewards' records (for the run's summary). */
export function servingStewards(state: GameState): readonly string[] {
  return stewardshipOf(state).stewards.filter(entry => entry.status === "serving").map(entry => entry.personId);
}
