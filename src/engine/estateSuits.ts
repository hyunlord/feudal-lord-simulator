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
  FRESH_HOLD_BASE, FRESH_HOLD_PER_YEAR, JUDGMENT_HOLD_PERMILLE, PATRON_MIN_RELATION, PATRON_SUPPORT_MAX, SUIT_STAGE_COST, SUIT_STAKE_PERMILLE,
} from "../content/estateConfig";
import { postLedgerEntries, treasuryBalance } from "../ledger/ledger";
import type { GameState } from "./engine.types";
import { estatesOf, LORD } from "./estates";
import type { Claim, Estate, EstatesState, Evidence, RightPiece, Suit, SuitStage } from "./estates.types";
import { advanceEntryThreats } from "./suitDefence";

const SEASON = PRESSURE_BALANCE.seasonTicks;

/** ES-7: why a suit command was refused (the screens say it; the state is unchanged). */
export type SuitRefusal = "no_claim" | "not_open" | "own_title" | "treasury";

export function suitTarget(estates: EstatesState, estateId: string, pieceId: string | undefined): { readonly estate: Estate; readonly piece?: RightPiece } | null {
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

/** DTR-21: what a suit's stake is worth a year — the piece's (a ruling's scope its share), or the off-map estate's. */
export function stakeYear(state: GameState, suit: Pick<Suit, "estateId" | "pieceId">): number {
  const found = suitTarget(estatesOf(state), suit.estateId, suit.pieceId);
  if (found === null) return 0;
  if (found.piece !== undefined) return found.piece.scope === undefined ? found.piece.annualValue : Math.round(found.piece.annualValue * found.piece.scope.sharePermille / 1000);
  return found.estate.offMap ? found.estate.annualValue : 0;
}

/** DTR-21 API: a stage's cost — its fee, or in lord mode the stake's share if larger. */
export function suitStageCost(state: GameState, suit: Pick<Suit, "estateId" | "pieceId">, stage: SuitStage): number {
  const fee = SUIT_STAGE_COST[stage] ?? 0;
  if (state.agency === undefined) return fee;
  return Math.max(fee, Math.round(stakeYear(state, suit) * (SUIT_STAKE_PERMILLE[stage] ?? 0) / 1000));
}

/**
 * The lord pays a stage's cost from the treasury (a ledger line); another plaintiff's costs are its own. DTR-21: as a
 * defendant the lord pays his defence (`defence`), what the treasury holds of it — he cannot refuse to be sued.
 */
function pay(state: GameState, suit: Suit, amount: number, stage: string, defence = false): GameState | null {
  if (defence) {
    if (suit.defendant !== LORD || state.agency === undefined) return state;
    const owed = Math.min(amount, Math.max(0, treasuryBalance(state)));
    if (owed <= 0) return state;
    const posted = postLedgerEntries(state, [{ account: "cash", category: "lawsuit", amount: -owed,
      sourceRefs: [{ type: "claim", id: suit.claimId, detail: `${suit.id}:defence:${stage}` }] }]);
    return { ...state, ledger: posted.ledger, treasuryCoin: posted.treasuryCoin };
  }
  if (amount <= 0 || suit.plaintiff !== LORD) return state;
  if (treasuryBalance(state) < amount) return null;
  const posted = postLedgerEntries(state, [{ account: "cash", category: "lawsuit", amount: -amount,
    sourceRefs: [{ type: "claim", id: suit.claimId, detail: `${suit.id}:${stage}` }] }]);
  return { ...state, ledger: posted.ledger, treasuryCoin: posted.treasuryCoin };
}

export function withSuit(state: GameState, suit: Suit): GameState {
  const estates = estatesOf(state);
  return { ...state, estates: { ...estates, suits: estates.suits.map(entry => entry.id === suit.id ? suit : entry) } };
}

export function withClaim(state: GameState, claim: Claim): GameState {
  const estates = estatesOf(state);
  return { ...state, estates: { ...estates, claims: estates.claims.map(entry => entry.id === claim.id ? claim : entry) } };
}

/** ES-7 API: why filing this claim would be refused, or null. */
export function fileSuitRefusal(state: GameState, claimId: string): SuitRefusal | null {
  const estates = estatesOf(state);
  const claim = estates.claims.find(entry => entry.id === claimId);
  if (claim === undefined) return "no_claim";
  if (claim.status !== "open") return "not_open";
  const found = suitTarget(estates, claim.estateId, claim.pieceId);
  if (found === null) return "no_claim";
  // DTR-21: a title holder out of possession sues the possessor; one who holds both has nothing to sue for.
  if (titleOf(found) === claim.claimant && possessorOf(found) === claim.claimant) return "own_title";
  if (claim.claimant === LORD && treasuryBalance(state) < suitStageCost(state, { estateId: claim.estateId, ...(claim.pieceId === undefined ? {} : { pieceId: claim.pieceId }) }, "filed")) return "treasury";
  return null;
}

/** ES-7: a claim filed as a suit against the title holder (the filing fee paid). Refused: the state unchanged. */
export function fileSuit(state: GameState, claimId: string): GameState {
  if (fileSuitRefusal(state, claimId) !== null) return state;
  const estates = estatesOf(state);
  const claim = estates.claims.find(entry => entry.id === claimId)!;
  const found = suitTarget(estates, claim.estateId, claim.pieceId)!;
  const defendant = titleOf(found) === claim.claimant ? possessorOf(found) : titleOf(found);
  const suit: Suit = { id: `suit-${estates.nextSuit}`, claimId, plaintiff: claim.claimant, defendant, estateId: claim.estateId,
    ...(claim.pieceId === undefined ? {} : { pieceId: claim.pieceId }), stage: "filed", stageSince: state.tick, patronSupport: 0, enforcements: 0, costs: 0,
    ...(claim.novel === true ? { fast: true as const } : {}) };
  const fee = suitStageCost(state, suit, "filed");
  const charged = pay(state, suit, fee, "filed");
  const paid = charged === null ? null : pay(charged, suit, fee, "filed", true);
  if (paid === null) return state;
  return { ...paid, estates: { ...estates, suits: [...estates.suits, { ...suit, costs: suit.plaintiff === LORD ? fee : 0 }], nextSuit: estates.nextSuit + 1,
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
  const found = suit === undefined ? null : suitTarget(estates, suit.estateId, suit.pieceId);
  if (suit === undefined || claim === undefined || found === null) return null;
  const plaintiff = claim.strength + claim.evidence.reduce((sum, entry) => sum + entry.weight, 0) + suit.patronSupport;
  // DTR-23: the lord sued brings his own evidence and patron.
  const defence = Math.floor(found.estate.titleStrength * DEFENCE_TITLE_PERMILLE / 1000)
    + Math.floor(found.estate.possessionStrength * DEFENCE_POSSESSION_PERMILLE / 1000)
    + (suit.defenceEvidence ?? []).reduce((sum, entry) => sum + entry.weight, 0) + (suit.defenceSupport ?? 0);
  return { plaintiff, defence };
}

/**
 * DTR-22 (S1): a title the lord wins from a house leaves that house a remembered right (`former`); a house that wins its
 * own back ends it. Another's judgment between houses leaves none of the lord's concern.
 */
function remembered<T extends { readonly former?: string }>(held: T, from: string, to: string): T {
  if (to === LORD && from !== LORD) return { ...held, former: from };
  if (held.former === undefined || held.former !== to) return held;
  const { former: _former, ...rest } = held;
  return rest as T;
}

/** ES-7: the judgment — for the plaintiff the title moves to it, and only the title (the possessor stays). */
function judge(state: GameState, suit: Suit): GameState {
  const hearing = suitHearing(state, suit.id)!;
  const won = hearing.plaintiff > hearing.defence;
  const estates = estatesOf(state);
  const claim = estates.claims.find(entry => entry.id === suit.claimId)!;
  const found = suitTarget(estates, suit.estateId, suit.pieceId)!;
  let next = withClaim(state, { ...claim, status: won ? "won" : "lost" });
  if (won) {
    const moved = estatesOf(next);
    const estate = found.estate;
    const changed: Estate = found.piece === undefined ? remembered({ ...estate, titleHolder: suit.plaintiff }, estate.titleHolder, suit.plaintiff)
      : { ...estate, pieces: estate.pieces.map(piece => piece.id === found.piece!.id
        ? remembered({ ...piece, titleHolder: suit.plaintiff, ...(piece.possessor === suit.plaintiff ? {} : { loss: "held_against_judgment" as const }) }, piece.titleHolder, suit.plaintiff) : piece) };
    next = { ...next, estates: { ...moved, estates: moved.estates.map(entry => entry.id === estate.id ? changed : entry) } };
  }
  const holding = won && possessorOf(found) !== suit.plaintiff;
  // DTR-21: a possession the lord took lately holds weakly (in lord mode) — its years firm it.
  const held = Math.floor(found.estate.possessionStrength * JUDGMENT_HOLD_PERMILLE / 1000);
  const since = found.piece?.possessedSince ?? 0;
  const fresh = state.agency !== undefined && possessorOf(found) === LORD && found.estate.offMap
    ? Math.min(held, FRESH_HOLD_BASE + Math.floor((state.tick - since) / (4 * SEASON)) * FRESH_HOLD_PER_YEAR) : held;
  return withSuit(next, { ...suit, verdict: won ? "plaintiff" : "defendant", stage: holding ? "enforcing" : "closed", stageSince: state.tick,
    ...(holding ? { hold: fresh } : {}) });
}

/** ES-7: one attempt to put the judgment's loser out — the plaintiff's force against the possessor's hold. */
export function enforcePossession(state: GameState, suitId: string): GameState {
  const suit = estatesOf(state).suits.find(entry => entry.id === suitId);
  if (suit === undefined || suit.stage !== "enforcing") return state;
  const cost = suitStageCost(state, suit, "enforcing");
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

/**
 * LM-R2-E ② API: what the lord can do in a suit now and why not — each kind of evidence (its cost to the lord, its
 * weight, the refusal), each faction as patron (its support, the refusal), the enforcement (its cost, the force against
 * the hold), and the tick the suit moves to its next stage (null when it has none). The screen reads this rather than the
 * costs and thresholds (`estateConfig.ts`); the commands refuse by the same rules.
 */
export interface SuitActions {
  readonly evidence: readonly { readonly kind: Evidence["kind"]; readonly cost: number; readonly weight: number; readonly refusal: "stage" | "given" | "treasury" | null }[];
  readonly patrons: readonly { readonly factionId: string; readonly support: number; readonly refusal: "stage" | "chosen" | "relation" | null }[];
  readonly enforce: { readonly cost: number; readonly force: number; readonly hold: number; readonly refusal: "stage" | "treasury" | null } | null;
  readonly nextStageTick: number | null;
}
export function suitActions(state: GameState, suitId: string): SuitActions | null {
  const estates = estatesOf(state);
  const suit = estates.suits.find(entry => entry.id === suitId);
  const claim = estates.claims.find(entry => entry.id === suit?.claimId);
  // A suit against the lord (a neighbour's recovery, ER-21) has no command of his: the screen shows it only.
  if (suit === undefined || claim === undefined || suit.plaintiff !== LORD) return null;
  const treasury = treasuryBalance(state);
  const gathering = suit.stage === "filed" || suit.stage === "evidence";
  const evidence = (Object.keys(EVIDENCE_COST) as Evidence["kind"][]).map(kind => {
    const cost = EVIDENCE_COST[kind];
    const refusal = !gathering ? "stage" as const : claim.evidence.some(entry => entry.kind === kind) ? "given" as const : cost > 0 && treasury < cost ? "treasury" as const : null;
    return { kind, cost, weight: EVIDENCE_WEIGHT[kind], refusal };
  });
  const patrons = (state.factions?.factions ?? []).map(faction => ({ factionId: faction.id, support: Math.min(PATRON_SUPPORT_MAX, Math.max(0, faction.relation)),
    refusal: suit.stage !== "patronage" ? "stage" as const : suit.patron !== undefined ? "chosen" as const : faction.relation < PATRON_MIN_RELATION ? "relation" as const : null }));
  const enforceCost = suitStageCost(state, suit, "enforcing");
  const enforce = suit.stage === "closed" ? null : { cost: enforceCost, force: ENFORCEMENT_BASE + suit.patronSupport, hold: suit.hold ?? 0,
    refusal: suit.stage !== "enforcing" ? "stage" as const : enforceCost > 0 && treasury < enforceCost ? "treasury" as const : null };
  const nextStageTick = nextSuitStage(suit) === undefined ? null : Math.ceil((suit.stageSince + SEASON) / SEASON) * SEASON;
  return { evidence, patrons, enforce, nextStageTick };
}

/** ES-7: the stage after each; a stage lasts one season at least, and the hearing waits for its fee. */
const NEXT_STAGE: Readonly<Partial<Record<SuitStage, SuitStage>>> = { filed: "evidence", evidence: "patronage", patronage: "hearing", hearing: "judged" };
/** DTR-23: a novel disseisin's track — its filing, then the hearing. */
const FAST_NEXT_STAGE: Readonly<Partial<Record<SuitStage, SuitStage>>> = { filed: "hearing", hearing: "judged" };
/** The stage after this suit's own (a novel disseisin's is shorter). */
export const nextSuitStage = (suit: Pick<Suit, "stage" | "fast">): SuitStage | undefined => (suit.fast === true ? FAST_NEXT_STAGE : NEXT_STAGE)[suit.stage];

/** ES-7: the suits' season, at each season's first tick (nothing with no stored estates or no suit going). */
export function advanceSuits(state: GameState): GameState {
  if (state.estates === undefined || state.tick <= 0 || state.tick % SEASON !== 0) return state;
  let next = advanceEntryThreats(state);
  for (const suit of estatesOf(next).suits) {
    const stage = nextSuitStage(suit);
    if (stage === undefined || state.tick - suit.stageSince < SEASON) continue;
    if (stage === "judged") { next = judge(next, suit); continue; }
    const cost = suitStageCost(next, suit, stage);
    const charged = pay(next, suit, cost, stage);
    // DTR-21: the lord as defendant pays his side of the hearing.
    const paid = charged === null ? null : stage === "hearing" ? pay(charged, suit, cost, stage, true) : charged;
    if (paid === null) continue;
    next = withSuit(paid, { ...suit, stage, stageSince: state.tick, costs: suit.costs + cost });
  }
  return next;
}
