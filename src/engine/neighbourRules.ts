/**
 * LM-E9b (spec docs/design/registry.md ER-21): the neighbour world makes the lord's situations — at each year's turn in
 * lord mode, a neighbour estate's papers may surface a claim of the lord's (NW07), a neighbour house whose head died
 * last year may leave a contested succession the lord can claim (NW08), and a house whose pieces the lord took claims
 * one back and sues (the Paston rule: the more the lord wins, the more he must keep), enforcing a judgment it won once a
 * year. Nothing runs without `state.agency`.
 */
import { NW07_CLAIM_SURFACES_PERMILLE, NW08_CONTESTED_SUCCESSION_PERMILLE, RECOVERY_CLAIM_PERMILLE, RECOVERY_EVIDENCE, RECOVERY_EVIDENCE_PERMILLE,
  RECENT_RECOVERY_PERMILLE, RECENT_TAKING_YEARS, TITLE_RECOVERY_STRENGTH } from "../content/neighbourRulesConfig";
import type { GameState } from "./engine.types";
import type { RightPiece } from "./estates.types";
import { estatesOf, LORD, raiseClaim } from "./estates";
import { addSuitEvidence, enforcePossession, fileSuit } from "./estateSuits";
import { hashSeed } from "./prng";
import { stateCalendar } from "./scenarioState";

const YEAR = 4_000;

/** ER-21: the head of a neighbour house — in the estates' people or the town's persons. */
function houseHead(state: GameState, personId: string) {
  return estatesOf(state).people.find(person => person.id === personId) ?? state.persons?.people.find(person => person.id === personId);
}

/** ER-21: the house's old papers brought to its suit, each by the seed (a non-lord plaintiff's evidence costs the treasury nothing). */
function houseEvidence(state: GameState, claimId: string, year: number): GameState {
  const suit = estatesOf(state).suits.find(entry => entry.claimId === claimId);
  if (suit === undefined) return state;
  let next = state;
  for (const kind of RECOVERY_EVIDENCE) {
    if (hashSeed(state.seed, `recovery-evidence:${claimId}:${kind}`, year) % 1000 < RECOVERY_EVIDENCE_PERMILLE) next = addSuitEvidence(next, suit.id, kind);
  }
  return next;
}

/** DTR-22 (S1): the house's head (of the estate it holds, or held) died last year — its heir has just come in. */
function newHeir(state: GameState, house: string, year: number): boolean {
  const estate = estatesOf(state).estates.find(entry => entry.house !== undefined && (entry.titleHolder === house || entry.former === house
    || `person:${entry.house.lordId}` === house));
  const lordId = estate?.house?.lordId ?? "";
  // A neighbour faction's head is among the factions' people (FX-2).
  const head = lordId === "" ? undefined : houseHead(state, lordId) ?? state.factions?.people.find(person => person.id === lordId);
  return head !== undefined && !head.alive && head.deathYear === year - 1;
}

/** ER-21 API: the year's neighbour rules (at the year's turn, lord mode only). */
export function advanceNeighbourRules(state: GameState): GameState {
  if (state.agency === undefined || state.tick <= 0 || state.tick % YEAR !== 0) return state;
  const year = stateCalendar(state).year;
  let next = state;
  for (const estate of estatesOf(state).estates) {
    if (!estate.offMap || estate.titleHolder === LORD) continue;
    const head = estate.house === undefined || estate.house.lordId === "" ? undefined : houseHead(next, estate.house.lordId);
    // NW08: the head died last year — a contested succession, the lord a claimant to the whole estate.
    if (head !== undefined && !head.alive && head.deathYear === year - 1
      && hashSeed(state.seed, `NW08:${estate.id}`, year) % 1000 < NW08_CONTESTED_SUCCESSION_PERMILLE) {
      next = raiseClaim(next, { claimant: LORD, estateId: estate.id, basis: "inheritance" });
    }
    // NW07: papers surface a claim, while the lord has none open or in suit on this estate.
    const open = estatesOf(next).claims.some(claim => claim.claimant === LORD && claim.estateId === estate.id && (claim.status === "open" || claim.status === "suing"));
    if (open || hashSeed(state.seed, `NW07:${estate.id}`, year) % 1000 >= NW07_CLAIM_SURFACES_PERMILLE) continue;
    const pieces = estate.pieces.filter(piece => piece.titleHolder !== LORD && piece.possessor !== LORD);
    if (pieces.length === 0) continue;
    const piece = pieces[hashSeed(state.seed, `NW07-piece:${estate.id}`, year) % pieces.length]!;
    next = raiseClaim(next, { claimant: LORD, estateId: estate.id, pieceId: piece.id, basis: "purchase_deed" });
  }
  // DTR-22 (S1): a claim a house raised and did not take to court (a grudge's claim) is sued on at the next year's turn;
  // one it can no longer sue on (it holds the piece again) lapses — an open claim never stands for ever (it held back
  // the rent and barred every later claim on its estate).
  for (const claim of estatesOf(next).claims) {
    // A neighbour house's (a faction's) grudge claim; a will's rival keeps his claim for the inheritance (marriage.ts).
    if (claim.status !== "open" || state.tick - claim.since < YEAR || !(next.factions?.factions ?? []).some(faction => faction.id === claim.claimant)) continue;
    const filed = fileSuit(next, claim.id);
    next = filed !== next ? houseEvidence(filed, claim.id, year)
      : { ...next, estates: { ...estatesOf(next), claims: estatesOf(next).claims.map(entry => entry.id === claim.id ? { ...entry, status: "lapsed" as const } : entry) } };
  }
  // Paston: a house claims back a piece the lord holds of its estate, and sues at once (the lord the defendant).
  // DTR-21 (P-L3): a piece the lord only possesses by a judgment, its title still the house's, first — the title holder
  // claims its possession back, more often and stronger; then a fresh taking. DTR-22 (S1): then the house's remembered
  // right (`former`) — a piece or a whole estate whose title a judgment gave the lord — each year by chance, and in the
  // year after its head died for certain (the heir's first act is to claim what his father lost).
  for (const estate of estatesOf(next).estates) {
    const whole = estate.titleHolder === LORD && estate.former !== undefined && estate.former !== LORD ? estate.former : undefined;
    if (!estate.offMap || (estate.titleHolder === LORD && whole === undefined)) continue;
    const formerOf = (piece: RightPiece) => piece.former ?? (estate.titleHolder !== LORD ? estate.titleHolder : estate.former);
    const possessed = estate.titleHolder === LORD ? [] : estate.pieces.filter(piece => piece.possessor === LORD && piece.titleHolder === estate.titleHolder);
    const titled = estate.pieces.filter(piece => piece.titleHolder === LORD && formerOf(piece) !== undefined && formerOf(piece) !== LORD);
    const recent = titled.filter(piece => piece.possessor === LORD && state.tick - piece.possessedSince < RECENT_TAKING_YEARS * YEAR);
    const suing = estatesOf(next).claims.some(claim => claim.claimant !== LORD && claim.estateId === estate.id && (claim.status === "open" || claim.status === "suing"));
    if (suing) continue;
    const draw = hashSeed(state.seed, `recovery:${estate.id}`, year) % 1000;
    const byTitle = possessed.length > 0 && draw < RECENT_RECOVERY_PERMILLE;
    const byRecent = !byTitle && recent.length > 0 && draw < RECENT_RECOVERY_PERMILLE;
    const residual = byTitle || byRecent ? [] : whole !== undefined ? [undefined] : titled;
    const heir = residual.length > 0 && newHeir(next, residual[0] === undefined ? whole! : formerOf(residual[0]!)!, year);
    const byResidual = residual.length > 0 && (draw < RECOVERY_CLAIM_PERMILLE || heir);
    if (!byTitle && !byRecent && !byResidual) continue;
    const taken: readonly (RightPiece | undefined)[] = byTitle ? possessed : byRecent ? recent : residual;
    const piece = taken[hashSeed(state.seed, `recovery-piece:${estate.id}`, year) % taken.length];
    const claimant = piece === undefined ? whole! : byTitle ? estate.titleHolder : formerOf(piece)!;
    next = raiseClaim(next, { claimant, estateId: estate.id, ...(piece === undefined ? {} : { pieceId: piece.id }), basis: "inheritance", ...(byTitle ? { strength: TITLE_RECOVERY_STRENGTH } : {}) });
    const claim = estatesOf(next).claims.find(entry => entry.claimant === claimant && entry.estateId === estate.id && entry.pieceId === piece?.id && entry.status === "open");
    if (claim === undefined) continue;
    next = fileSuit(next, claim.id);
    if (estatesOf(next).suits.some(entry => entry.claimId === claim.id)) next = houseEvidence(next, claim.id, year);
  }
  // A neighbour that won its judgment tries once a year to take possession (the lord's own suits are his to enforce).
  for (const suit of estatesOf(next).suits) if (suit.plaintiff !== LORD && suit.stage === "enforcing") next = enforcePossession(next, suit.id);
  return next;
}
