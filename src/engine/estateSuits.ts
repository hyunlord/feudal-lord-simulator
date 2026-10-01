/**
 * LM-E2 the suit track (spec docs/design/estates.md ES-7): a claim is filed as a suit against the title holder; it goes
 * through evidence, patronage and the hearing (each one season at least) to a judgment that moves the title — and only
 * the title. Possession is enforced apart: a possessor who holds on must be put out again, and again, until its hold
 * gives (Gresham 1448: a bought title, the possession lost to force). Every stage costs the plaintiff and is a ledger
 * line; the lord's suits are the player's commands, a neighbour's are filed against the lord by the same functions.
 */
import { PRESSURE_BALANCE } from "../content/balanceConfig";
import {
  DEFENCE_POSSESSION_PERMILLE, DEFENCE_TITLE_PERMILLE, ENFORCEMENT_BASE, ENFORCEMENT_WEAR, EVIDENCE_COST, EVIDENCE_WEIGHT,
  JUDGMENT_HOLD_PERMILLE, PATRON_MIN_RELATION, PATRON_SUPPORT_MAX, SUIT_STAGE_COST,
} from "../content/estateConfig";
import { postLedgerEntries, treasuryBalance } from "../ledger/ledger";
import type { GameState } from "./engine.types";
import { estatesOf, LORD } from "./estates";
import type { Claim, Estate, EstatesState, Evidence, RightPiece, Suit, SuitStage } from "./estates.types";

const SEASON = PRESSURE_BALANCE.seasonTicks;

/** ES-7: why a suit command was refused (the screens say it; the state is unchanged). */
export type SuitRefusal = "no_claim" | "not_open" | "own_title" | "no_suit" | "wrong_stage" | "treasury" | "patron_relation" | "nothing_to_enforce";

function target(estates: EstatesState, estateId: string, pieceId: string | undefined): { readonly estate: Estate; readonly piece?: RightPiece } | null {
  const estate = estates.estates.find(entry => entry.id === estateId);
  if (estate === undefined) return null;
  if (pieceId === undefined) return { estate };
  const piece = estate.pieces.find(entry => entry.id === pieceId);
  return piece === undefined ? null : { estate, piece };
}

function titleOf(found: { readonly estate: Estate; readonly piece?: RightPiece }): string {
  return found.piece?.titleHolder ?? found.estate.titleHolder;
}

function possessorOf(found: { readonly estate: Estate; readonly piece?: RightPiece }): string {
  return found.piece?.possessor ?? found.estate.possessor;
}

/** The lord pays a stage's cost from the treasury (a ledger line); another plaintiff's costs are its own. */
function pay(state: GameState, suit: Suit, amount: number, stage: string): GameState | null {
  if (amount <= 0 || suit.plaintiff !== LORD) return state;
  if (treasuryBalance(state) < amount) return null;
  const posted = postLedgerEntries(state, [{ account: "cash", category: "lawsuit", amount: -amount,
    sourceRefs: [{ type: "claim", id: suit.claimId, detail: `${suit.id}:${stage}` }] }]);
  return { ...state, ledger: posted.ledger, treasuryCoin: posted.treasuryCoin };
}

function withSuit(state: GameState, suit: Suit): GameState {
  const estates = estatesOf(state);
  return { ...state, estates: { ...estates, suits: estates.suits.map(entry => entry.id === suit.id ? suit : entry) } };
}

function withClaim(state: GameState, claim: Claim): GameState {
  const estates = estatesOf(state);
  return { ...state, estates: { ...estates, claims: estates.claims.map(entry => entry.id === claim.id ? claim : entry) } };
}

/** ES-7 API: why filing this claim would be refused, or null. */
export function fileSuitRefusal(state: GameState, claimId: string): SuitRefusal | null {
  const estates = estatesOf(state);
  const claim = estates.claims.find(entry => entry.id === claimId);
  if (claim === undefined) return "no_claim";
  if (claim.status !== "open") return "not_open";
  const found = target(estates, claim.estateId, claim.pieceId);
  if (found === null) return "no_claim";
  if (titleOf(found) === claim.claimant) return "own_title";
  if (claim.claimant === LORD && treasuryBalance(state) < (SUIT_STAGE_COST.filed ?? 0)) return "treasury";
  return null;
}

/** ES-7: a claim filed as a suit against the title holder (the filing fee paid). Refused: the state unchanged. */
export function fileSuit(state: GameState, claimId: string): GameState {
  if (fileSuitRefusal(state, claimId) !== null) return state;
  const estates = estatesOf(state);
  const claim = estates.claims.find(entry => entry.id === claimId)!;
  const found = target(estates, claim.estateId, claim.pieceId)!;
  const suit: Suit = { id: `suit-${estates.nextSuit}`, claimId, plaintiff: claim.claimant, defendant: titleOf(found), estateId: claim.estateId,
    ...(claim.pieceId === undefined ? {} : { pieceId: claim.pieceId }), stage: "filed", stageSince: state.tick, patronSupport: 0, enforcements: 0, costs: SUIT_STAGE_COST.filed ?? 0 };
  const paid = pay(state, suit, SUIT_STAGE_COST.filed ?? 0, "filed");
  if (paid === null) return state;
  return { ...paid, estates: { ...estates, suits: [...estates.suits, suit], nextSuit: estates.nextSuit + 1,
    claims: estates.claims.map(entry => entry.id === claimId ? { ...entry, status: "suing" as const } : entry) } };
}

/** ES-7: evidence brought while the suit is filed or gathering it (once per kind; old possession counts its years). */
export function addSuitEvidence(state: GameState, suitId: string, kind: Evidence["kind"]): GameState {
  const estates = estatesOf(state);
  const suit = estates.suits.find(entry => entry.id === suitId);
  if (suit === undefined || (suit.stage !== "filed" && suit.stage !== "evidence")) return state;
  const claim = estates.claims.find(entry => entry.id === suit.claimId)!;
  if (claim.evidence.some(entry => entry.kind === kind)) return state;
  const paid = pay(state, suit, EVIDENCE_COST[kind], `evidence:${kind}`);
  if (paid === null) return state;
  const withEvidence = withClaim(paid, { ...claim, evidence: [...claim.evidence, { kind, weight: EVIDENCE_WEIGHT[kind], tick: state.tick }] });
  return withSuit(withEvidence, { ...suit, costs: suit.costs + EVIDENCE_COST[kind] });
}

/** ES-7: a faction won over as the suit's patron during the patronage stage — its relation with the lord, capped. */
export function seekSuitPatron(state: GameState, suitId: string, factionId: string): GameState {
  const suit = estatesOf(state).suits.find(entry => entry.id === suitId);
  if (suit === undefined || suit.stage !== "patronage" || suit.patron !== undefined) return state;
  const relation = state.factions?.factions.find(faction => faction.id === factionId)?.relation ?? 0;
  if (relation < PATRON_MIN_RELATION) return state;
  return withSuit(state, { ...suit, patron: factionId, patronSupport: Math.min(PATRON_SUPPORT_MAX, relation) });
}

/** ES-7 API: the hearing's two sides now — the claim with its evidence and patron, the defence's title and hold. */
export function suitHearing(state: GameState, suitId: string): { readonly plaintiff: number; readonly defence: number } | null {
  const estates = estatesOf(state);
  const suit = estates.suits.find(entry => entry.id === suitId);
  const claim = estates.claims.find(entry => entry.id === suit?.claimId);
  const found = suit === undefined ? null : target(estates, suit.estateId, suit.pieceId);
  if (suit === undefined || claim === undefined || found === null) return null;
  const plaintiff = claim.strength + claim.evidence.reduce((sum, entry) => sum + entry.weight, 0) + suit.patronSupport;
  const defence = Math.floor(found.estate.titleStrength * DEFENCE_TITLE_PERMILLE / 1000)
    + Math.floor(found.estate.possessionStrength * DEFENCE_POSSESSION_PERMILLE / 1000);
  return { plaintiff, defence };
}

/** ES-7: the judgment — for the plaintiff the title moves to it, and only the title (the possessor stays). */
function judge(state: GameState, suit: Suit): GameState {
  const hearing = suitHearing(state, suit.id)!;
  const won = hearing.plaintiff > hearing.defence;
  const estates = estatesOf(state);
  const claim = estates.claims.find(entry => entry.id === suit.claimId)!;
  const found = target(estates, suit.estateId, suit.pieceId)!;
  let next = withClaim(state, { ...claim, status: won ? "won" : "lost" });
  if (won) {
    const moved = estatesOf(next);
    const estate = found.estate;
    const changed: Estate = found.piece === undefined ? { ...estate, titleHolder: suit.plaintiff }
      : { ...estate, pieces: estate.pieces.map(piece => piece.id === found.piece!.id
        ? { ...piece, titleHolder: suit.plaintiff, ...(piece.possessor === suit.plaintiff ? {} : { loss: "held_against_judgment" as const }) } : piece) };
    next = { ...next, estates: { ...moved, estates: moved.estates.map(entry => entry.id === estate.id ? changed : entry) } };
  }
  const holding = won && possessorOf(found) !== suit.plaintiff;
  return withSuit(next, { ...suit, verdict: won ? "plaintiff" : "defendant", stage: holding ? "enforcing" : "closed", stageSince: state.tick,
    ...(holding ? { hold: Math.floor(found.estate.possessionStrength * JUDGMENT_HOLD_PERMILLE / 1000) } : {}) });
}

/** ES-7: one attempt to put the judgment's loser out — the plaintiff's force against the possessor's hold. */
export function enforcePossession(state: GameState, suitId: string): GameState {
  const suit = estatesOf(state).suits.find(entry => entry.id === suitId);
  if (suit === undefined || suit.stage !== "enforcing") return state;
  const cost = SUIT_STAGE_COST.enforcing ?? 0;
  const paid = pay(state, suit, cost, `enforcing:${suit.enforcements + 1}`);
  if (paid === null) return state;
  const hold = suit.hold ?? 0;
  const succeeded = ENFORCEMENT_BASE + suit.patronSupport > hold;
  const attempted: Suit = { ...suit, enforcements: suit.enforcements + 1, costs: suit.costs + cost, enforced: succeeded,
    hold: succeeded ? hold : Math.max(0, hold - ENFORCEMENT_WEAR), ...(succeeded ? { stage: "closed" as const, stageSince: state.tick } : {}) };
  let next = withSuit(paid, attempted);
  if (!succeeded) return next;
  const estates = estatesOf(next);
  next = { ...next, estates: { ...estates, estates: estates.estates.map(estate => {
    if (estate.id !== suit.estateId) return estate;
    if (suit.pieceId === undefined) return { ...estate, possessor: suit.plaintiff };
    return { ...estate, pieces: estate.pieces.map(piece => {
      if (piece.id !== suit.pieceId) return piece;
      const { loss: _loss, ...rest } = piece;
      return { ...rest, possessor: suit.plaintiff, possessedSince: state.tick };
    }) };
  }) } };
  return next;
}

/** ES-7: the stage after each; a stage lasts one season at least, and the hearing waits for its fee. */
const NEXT_STAGE: Readonly<Partial<Record<SuitStage, SuitStage>>> = { filed: "evidence", evidence: "patronage", patronage: "hearing", hearing: "judged" };

/** ES-7: the suits' season, at each season's first tick (nothing with no stored estates or no suit going). */
export function advanceSuits(state: GameState): GameState {
  if (state.estates === undefined || state.tick <= 0 || state.tick % SEASON !== 0) return state;
  let next = state;
  for (const suit of state.estates.suits) {
    const stage = NEXT_STAGE[suit.stage];
    if (stage === undefined || state.tick - suit.stageSince < SEASON) continue;
    if (stage === "judged") { next = judge(next, suit); continue; }
    const cost = SUIT_STAGE_COST[stage] ?? 0;
    const paid = pay(next, suit, cost, stage);
    if (paid === null) continue;
    next = withSuit(paid, { ...suit, stage, stageSince: state.tick, costs: suit.costs + cost });
  }
  return next;
}
