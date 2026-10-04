/**
 * LM-E9b (spec docs/design/registry.md ER-21): the neighbour world makes the lord's situations — at each year's turn in
 * lord mode, a neighbour estate's papers may surface a claim of the lord's (NW07), and a neighbour house whose head died
 * last year may leave a contested succession the lord can claim (NW08). Nothing runs without `state.agency`.
 */
import { NW07_CLAIM_SURFACES_PERMILLE, NW08_CONTESTED_SUCCESSION_PERMILLE } from "../content/neighbourRulesConfig";
import type { GameState } from "./engine.types";
import { estatesOf, LORD, raiseClaim } from "./estates";
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
  return next;
}
