/**
 * DTR-23 (the user's decision 2026-10-08; Astra lordplay2 friction 1: "영주가 막을 명령은 없습니다"): the lord sued, or
 * threatened, has his own moves. In a house's suit against him he brings evidence and seeks a patron as a plaintiff
 * does (they add to his side of the hearing), settles by a final concord — pays the house off at the price of its odds,
 * or yields the piece — and after a judgment against him puts men in to hold the possession (the rent stays withheld
 * meanwhile, DTR-21). A hostile house's large act (S3, the ±60 rule) is a forcible entry forewarned a season ahead: the
 * lord guards the piece or appeases the house, else it enters, and he has a novel disseisin to sue on (filing, then
 * the hearing). Lord mode only; the costs scale to the stake's year (`SUIT_DEFENCE`, `estateConfig.ts`).
 */
import { PRESSURE_BALANCE } from "../content/balanceConfig";
import { EVIDENCE_COST, EVIDENCE_WEIGHT, PATRON_MIN_RELATION, PATRON_SUPPORT_MAX, SUIT_DEFENCE } from "../content/estateConfig";
import { postLedgerEntries, treasuryBalance } from "../ledger/ledger";
import type { LedgerCategory } from "../ledger/ledger.types";
import type { GameState } from "./engine.types";
import { estatesOf, LORD, raiseClaim } from "./estates";
import type { Estate, EntryThreat, Evidence, RightPiece, Suit } from "./estates.types";
import { stakeYear, suitHearing, suitTarget, withClaim, withSuit } from "./estateSuits";

const SEASON = PRESSURE_BALANCE.seasonTicks;
const YEAR = 4 * SEASON;

/** The house's relation with the lord (a neighbour faction's; a house that is no faction counts as neutral). */
function houseRelation(state: GameState, house: string): number {
  return state.factions?.factions.find(faction => faction.id === house)?.relation ?? 0;
}

/** The lord pays from the treasury (a ledger line); null when it cannot. */
function spend(state: GameState, amount: number, category: LedgerCategory, refs: { readonly claimId?: string; readonly detail: string; readonly house?: string }): GameState | null {
  if (amount <= 0) return state;
  if (treasuryBalance(state) < amount) return null;
  const sourceRefs = refs.claimId === undefined
    ? [{ type: "actor" as const, id: refs.house ?? "neighbour" }, { type: "claim" as const, id: refs.detail }] as const
    : [{ type: "claim" as const, id: refs.claimId, detail: refs.detail }] as const;
  const posted = postLedgerEntries(state, [{ account: "cash", category, amount: -amount, sourceRefs: [...sourceRefs] as [typeof sourceRefs[number], ...typeof sourceRefs[number][]] }]);
  return { ...state, ledger: posted.ledger, treasuryCoin: posted.treasuryCoin };
}

/** A suit against the lord, while it stands (not closed). */
function defending(state: GameState, suitId: string): Suit | undefined {
  if (state.agency === undefined) return undefined;
  return estatesOf(state).suits.find(suit => suit.id === suitId && suit.defendant === LORD && suit.plaintiff !== LORD && suit.stage !== "closed");
}

const scaled = (state: GameState, suit: Pick<Suit, "estateId" | "pieceId">, permille: number) =>
  Math.max(SUIT_DEFENCE.floor, Math.round(stakeYear(state, suit) * permille / 1000));

// --- the suit -----------------------------------------------------------------------------------------------------------

/** DTR-23: the lord's evidence for his side, while the suit is filed or gathering it (once per kind; its cost as a plaintiff's). */
export function addDefenceEvidence(state: GameState, suitId: string, kind: Evidence["kind"]): GameState {
  const suit = defending(state, suitId);
  if (suit === undefined || (suit.stage !== "filed" && suit.stage !== "evidence") || (suit.defenceEvidence ?? []).some(entry => entry.kind === kind)) return state;
  const paid = spend(state, EVIDENCE_COST[kind], "lawsuit", { claimId: suit.claimId, detail: `${suit.id}:defence:evidence:${kind}` });
  if (paid === null) return state;
  return withSuit(paid, { ...suit, defenceEvidence: [...(suit.defenceEvidence ?? []), { kind, weight: EVIDENCE_WEIGHT[kind], tick: state.tick }] });
}

/** DTR-23: a faction won over to the lord's side during the patronage stage (its relation, capped — as a plaintiff's patron). */
export function seekDefencePatron(state: GameState, suitId: string, factionId: string): GameState {
  const suit = defending(state, suitId);
  if (suit === undefined || suit.stage !== "patronage" || suit.defencePatron !== undefined || factionId === suit.plaintiff) return state;
  const relation = houseRelation(state, factionId);
  if (relation < PATRON_MIN_RELATION) return state;
  return withSuit(state, { ...suit, defencePatron: factionId, defenceSupport: Math.min(PATRON_SUPPORT_MAX, relation) });
}

/**
 * DTR-23 API: what a final concord costs the lord now — the stake's year × `concordPermille` × the plaintiff's share of
 * the hearing's two sides (the whole after a judgment against him), doubled with a house past −60.
 */
export function concordPrice(state: GameState, suit: Suit): number {
  const hearing = suitHearing(state, suit.id);
  const share = suit.verdict === "plaintiff" || hearing === null || hearing.plaintiff + hearing.defence <= 0 ? 1 : hearing.plaintiff / (hearing.plaintiff + hearing.defence);
  const hostile = houseRelation(state, suit.plaintiff) <= SUIT_DEFENCE.concordHostileAt ? SUIT_DEFENCE.concordHostileFactor : 1;
  return Math.max(SUIT_DEFENCE.floor, Math.round(stakeYear(state, suit) * SUIT_DEFENCE.concordPermille / 1000 * share * hostile));
}

/** The piece (or estate) back to the lord's whole hold, or over to the house — and its remembered right ended either way. */
function settleHold(state: GameState, suit: Suit, to: string): GameState {
  const estates = estatesOf(state);
  const clean = <T extends { readonly former?: string; readonly loss?: RightPiece["loss"] }>(held: T): T => {
    const { former: _former, loss: _loss, ...rest } = held;
    return rest as T;
  };
  return { ...state, estates: { ...estates, estates: estates.estates.map((estate): Estate => {
    if (estate.id !== suit.estateId) return estate;
    if (suit.pieceId === undefined) return { ...clean(estate), titleHolder: to, possessor: to };
    return { ...estate, pieces: estate.pieces.map(piece => piece.id !== suit.pieceId ? piece
      : { ...clean(piece), titleHolder: to, possessor: to, ...(piece.possessor === to ? {} : { possessedSince: state.tick }) }) };
  }) } };
}

/**
 * DTR-23: a final concord. `pay`: the lord pays the price (`concordPrice`) and keeps the piece, title and possession —
 * after a judgment against him too; `yield`: he gives it up to the house. The suit closes, the claim lapses, and the
 * house's remembered right on it ends (DTR-22).
 */
export function settleSuit(state: GameState, suitId: string, terms: "pay" | "yield"): GameState {
  const suit = defending(state, suitId);
  if (suit === undefined) return state;
  let next: GameState | null = state;
  if (terms === "pay") next = spend(state, concordPrice(state, suit), "lawsuit", { claimId: suit.claimId, detail: `${suit.id}:concord` });
  if (next === null) return state;
  next = settleHold(next, suit, terms === "pay" ? LORD : suit.plaintiff);
  const claim = estatesOf(next).claims.find(entry => entry.id === suit.claimId);
  if (claim !== undefined) next = withClaim(next, { ...claim, status: "lapsed" });
  return withSuit(next, { ...suit, stage: "closed", stageSince: state.tick, settled: terms });
}

/** DTR-23 API: the lord's hold on a possession a judgment went against: its cost now, and why not. */
export function holdCost(state: GameState, suit: Suit): number {
  return scaled(state, suit, SUIT_DEFENCE.holdPermille);
}

/** DTR-23: men put in to hold the possession against the house's enforcement — the hold rises, once a year. */
export function holdPossession(state: GameState, suitId: string): GameState {
  const suit = defending(state, suitId);
  if (suit === undefined || suit.stage !== "enforcing" || (suit.heldTick !== undefined && state.tick - suit.heldTick < YEAR)) return state;
  const found = suitTarget(estatesOf(state), suit.estateId, suit.pieceId);
  if (found === null || (found.piece?.possessor ?? found.estate.possessor) !== LORD) return state;
  const paid = spend(state, holdCost(state, suit), "lawsuit", { claimId: suit.claimId, detail: `${suit.id}:defence:hold` });
  if (paid === null) return state;
  return withSuit(paid, { ...suit, hold: Math.min(SUIT_DEFENCE.holdCap, (suit.hold ?? 0) + SUIT_DEFENCE.holdBoost), heldTick: state.tick });
}

/**
 * DTR-23 API: what the lord can do in a suit against him now, and why not (the screen reads this, the commands refuse
 * by the same rules): his evidence by kind, a patron, the concord (pay, its price; yield), and the hold.
 */
export interface SuitDefenceActions {
  readonly evidence: readonly { readonly kind: Evidence["kind"]; readonly cost: number; readonly weight: number; readonly refusal: "stage" | "given" | "treasury" | null }[];
  readonly patrons: readonly { readonly factionId: string; readonly support: number; readonly refusal: "stage" | "chosen" | "relation" | null }[];
  readonly concord: { readonly price: number; readonly refusal: "treasury" | null };
  readonly yieldPiece: true;
  readonly hold: { readonly cost: number; readonly boost: number; readonly hold: number; readonly refusal: "stage" | "not_possessor" | "held" | "treasury" | null };
  /** The hearing's two sides now. */
  readonly hearing: { readonly plaintiff: number; readonly defence: number } | null;
}
export function suitDefenceActions(state: GameState, suitId: string): SuitDefenceActions | null {
  const suit = defending(state, suitId);
  if (suit === undefined) return null;
  const treasury = treasuryBalance(state);
  const gathering = suit.stage === "filed" || suit.stage === "evidence";
  const evidence = (Object.keys(EVIDENCE_COST) as Evidence["kind"][]).map(kind => {
    const cost = EVIDENCE_COST[kind];
    const refusal = !gathering ? "stage" as const : (suit.defenceEvidence ?? []).some(entry => entry.kind === kind) ? "given" as const : cost > 0 && treasury < cost ? "treasury" as const : null;
    return { kind, cost, weight: EVIDENCE_WEIGHT[kind], refusal };
  });
  const patrons = (state.factions?.factions ?? []).filter(faction => faction.id !== suit.plaintiff).map(faction => ({ factionId: faction.id,
    support: Math.min(PATRON_SUPPORT_MAX, Math.max(0, faction.relation)),
    refusal: suit.stage !== "patronage" ? "stage" as const : suit.defencePatron !== undefined ? "chosen" as const : faction.relation < PATRON_MIN_RELATION ? "relation" as const : null }));
  const price = concordPrice(state, suit);
  const found = suitTarget(estatesOf(state), suit.estateId, suit.pieceId);
  const possessor = found?.piece?.possessor ?? found?.estate.possessor;
  const cost = holdCost(state, suit);
  const hold = { cost, boost: SUIT_DEFENCE.holdBoost, hold: suit.hold ?? 0,
    refusal: suit.stage !== "enforcing" ? "stage" as const : possessor !== LORD ? "not_possessor" as const
      : suit.heldTick !== undefined && state.tick - suit.heldTick < YEAR ? "held" as const : treasury < cost ? "treasury" as const : null };
  return { evidence, patrons, concord: { price, refusal: treasury < price ? "treasury" : null }, yieldPiece: true, hold, hearing: suitHearing(state, suit.id) };
}

// --- the forcible entry -----------------------------------------------------------------------------------------------------

const threatsOf = (state: GameState): readonly EntryThreat[] => state.estates?.threats ?? [];

function withThreats(state: GameState, threats: readonly EntryThreat[]): GameState {
  const estates = estatesOf(state);
  return { ...state, estates: { ...estates, threats } };
}

/** DTR-23 (S3): a house gathers men against a piece the lord possesses of its estate — forewarned, due next season. Null: none to enter. */
export function threatenEntry(state: GameState, house: string, estateId: string): { readonly state: GameState; readonly threat: EntryThreat } | null {
  if (state.agency === undefined || threatsOf(state).some(threat => threat.house === house)) return null;
  const estate = estatesOf(state).estates.find(entry => entry.id === estateId);
  const pieces = estate?.pieces.filter(piece => piece.possessor === LORD) ?? [];
  if (estate === undefined || pieces.length === 0) return null;
  // The richest piece first (what a house would seize), then by id.
  const piece = [...pieces].sort((a, b) => b.annualValue - a.annualValue || a.id.localeCompare(b.id))[0]!;
  const threat: EntryThreat = { id: `threat-${state.tick}-${piece.id}`, house, estateId, pieceId: piece.id, tick: state.tick,
    due: (Math.floor(state.tick / SEASON) + 1) * SEASON };
  return { state: withThreats(state, [...threatsOf(state), threat]), threat };
}

/** DTR-23 API: the forcible entries forewarned and not yet come. */
export function entryThreats(state: GameState): readonly EntryThreat[] {
  return threatsOf(state);
}

/** DTR-23 API: what guarding a threatened piece for the season costs, and appeasing its house. */
export function entryDefenceCosts(state: GameState, threat: EntryThreat): { readonly guard: number; readonly appease: number } {
  const suit = { estateId: threat.estateId, pieceId: threat.pieceId };
  return { guard: scaled(state, suit, SUIT_DEFENCE.guardPermille), appease: scaled(state, suit, SUIT_DEFENCE.appeasePermille) };
}

/** DTR-23: men to guard the piece for the season — the house's men find it held. */
export function guardPossession(state: GameState, threatId: string): GameState {
  const threat = threatsOf(state).find(entry => entry.id === threatId);
  if (threat === undefined || threat.guarded === true) return state;
  const paid = spend(state, entryDefenceCosts(state, threat).guard, "lawsuit", { detail: `guard:${threat.id}`, house: threat.house });
  if (paid === null) return state;
  return withThreats(paid, threatsOf(paid).map(entry => entry.id === threatId ? { ...entry, guarded: true as const } : entry));
}

/** DTR-23: a gift to the house — it stands its men down (its relation rises; `decisionRelationDrafts`). */
export function appeaseNeighbour(state: GameState, threatId: string): GameState {
  const threat = threatsOf(state).find(entry => entry.id === threatId);
  if (threat === undefined) return state;
  const paid = spend(state, entryDefenceCosts(state, threat).appease, "faction_demand", { detail: `appease:${threat.id}`, house: threat.house });
  if (paid === null) return state;
  return withThreats(paid, threatsOf(paid).filter(entry => entry.id !== threatId));
}

/**
 * DTR-23: the season's turn for the entries due — a guarded piece holds (the threat ends); else the house enters: the
 * possession is its (by force), and the lord has a novel disseisin to sue on.
 */
export function advanceEntryThreats(state: GameState): GameState {
  const due = threatsOf(state).filter(threat => threat.due <= state.tick);
  if (due.length === 0) return state;
  let next = withThreats(state, threatsOf(state).filter(threat => threat.due > state.tick));
  for (const threat of due) {
    if (threat.guarded === true) continue;
    const estates = estatesOf(next);
    const piece = estates.estates.find(entry => entry.id === threat.estateId)?.pieces.find(entry => entry.id === threat.pieceId);
    if (piece === undefined || piece.possessor !== LORD) continue;
    next = { ...next, estates: { ...estates, estates: estates.estates.map(estate => estate.id !== threat.estateId ? estate
      : { ...estate, pieces: estate.pieces.map(entry => entry.id !== threat.pieceId ? entry
        : { ...entry, possessor: threat.house, possessedSince: state.tick, ...(entry.titleHolder === threat.house ? {} : { loss: "forced" as const }) }) }) } };
    next = raiseClaim(next, { claimant: LORD, estateId: threat.estateId, pieceId: threat.pieceId, basis: "old_possession", strength: SUIT_DEFENCE.novelStrength });
    const claims = estatesOf(next).claims;
    const claim = claims.find(entry => entry.claimant === LORD && entry.estateId === threat.estateId && entry.pieceId === threat.pieceId && entry.status === "open");
    if (claim !== undefined) next = withClaim(next, { ...claim, novel: true });
  }
  return next;
}
