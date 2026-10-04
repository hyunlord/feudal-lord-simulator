/**
 * LM-E9b (spec docs/design/registry.md ER-21): the neighbour world makes the lord's situations — at each year's turn in
 * lord mode, a neighbour estate's papers may surface a claim of the lord's (NW07), a neighbour house whose head died
 * last year may leave a contested succession the lord can claim (NW08), and a house whose pieces the lord took claims
 * one back and sues (the Paston rule: the more the lord wins, the more he must keep), enforcing a judgment it won once a
 * year. Nothing runs without `state.agency`.
 */
import { NW07_CLAIM_SURFACES_PERMILLE, NW08_CONTESTED_SUCCESSION_PERMILLE, RECOVERY_CLAIM_PERMILLE } from "../content/neighbourRulesConfig";
import type { GameState } from "./engine.types";
import { estatesOf, LORD, raiseClaim } from "./estates";
import { enforcePossession, fileSuit } from "./estateSuits";
import { hashSeed } from "./prng";
import { stateCalendar } from "./scenarioState";

const YEAR = 4_000;

/** ER-21: the head of a neighbour house — in the estates' people or the town's persons. */
function houseHead(state: GameState, personId: string) {
  return estatesOf(state).people.find(person => person.id === personId) ?? state.persons?.people.find(person => person.id === personId);
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
  // Paston: a house claims back a piece the lord holds of its estate, and sues at once (the lord the defendant).
  for (const estate of estatesOf(next).estates) {
    if (!estate.offMap || estate.titleHolder === LORD) continue;
    const taken = estate.pieces.filter(piece => piece.titleHolder === LORD);
    const suing = estatesOf(next).claims.some(claim => claim.claimant === estate.titleHolder && claim.estateId === estate.id && (claim.status === "open" || claim.status === "suing"));
    if (taken.length === 0 || suing || hashSeed(state.seed, `recovery:${estate.id}`, year) % 1000 >= RECOVERY_CLAIM_PERMILLE) continue;
    const piece = taken[hashSeed(state.seed, `recovery-piece:${estate.id}`, year) % taken.length]!;
    next = raiseClaim(next, { claimant: estate.titleHolder, estateId: estate.id, pieceId: piece.id, basis: "inheritance" });
    const claim = estatesOf(next).claims.find(entry => entry.claimant === estate.titleHolder && entry.estateId === estate.id && entry.pieceId === piece.id && entry.status === "open");
    if (claim !== undefined) next = fileSuit(next, claim.id);
  }
  // A neighbour that won its judgment tries once a year to take possession (the lord's own suits are his to enforce).
  for (const suit of estatesOf(next).suits) if (suit.plaintiff !== LORD && suit.stage === "enforcing") next = enforcePossession(next, suit.id);
  return next;
}
