/**
 * LM-E9b (spec docs/design/registry.md ER-21): the neighbour world makes the lord's situations — claims surface on the
 * neighbour estates across the years (NW07, one open at a time on an estate), a dead head's house leaves a contested
 * succession (NW08), a house claims back a piece the lord took and sues (Paston); nothing outside lord mode.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { NW07_CLAIM_SURFACES_PERMILLE, NW08_CONTESTED_SUCCESSION_PERMILLE } from "../src/content/neighbourRulesConfig";
import type { GameState } from "../src/engine/engine.types";
import { estatesOf, LORD } from "../src/engine/estates";
import { advanceNeighbourRules } from "../src/engine/neighbourRules";
import { hashSeed } from "../src/engine/prng";
import { stateCalendar } from "../src/engine/scenarioState";
import { initialAgency } from "../src/engine/townAgency";
import { decodeSave } from "../src/save/saveCodec";

const YEAR = 4000;
const load = (name: string): GameState => decodeSave(new Uint8Array(readFileSync(`fixtures/saves/v49/${name}.save.json`))).envelope.state as GameState;
const lordTown = (): GameState => ({ ...load("chapter-two-town"), agency: initialAgency() });
const lordClaims = (state: GameState) => estatesOf(state).claims.filter(claim => claim.claimant === LORD);

test("ER-21 NW07 claims surface on the neighbour estates across the years, one open at a time on an estate", () => {
  let state = lordTown();
  const start = state.tick - (state.tick % YEAR);
  const before = lordClaims(state).length;
  const years: number[] = [];
  for (let year = 1; year <= 60; year += 1) {
    const next = advanceNeighbourRules({ ...state, tick: start + year * YEAR });
    if (lordClaims(next).length > lordClaims(state).length) years.push(stateCalendar(next).year);
    // The new claim is closed at once (as a lost suit would), so the estate can surface another later.
    state = { ...next, estates: { ...estatesOf(next), claims: estatesOf(next).claims.map(claim => claim.claimant === LORD && claim.basis === "purchase_deed" ? { ...claim, status: "lost" as const } : claim) } };
  }
  assert.ok(years.length >= 6, `claims surfaced in ${years.length} of 60 years (100‰ for each of the neighbour estates)`);
  assert.ok(years[years.length - 1]! - years[0]! >= 30, "spread over the decades, not at the start");
  // While a claim is open on an estate, no second one surfaces there.
  let open = lordTown();
  for (let year = 1; year <= 60; year += 1) open = advanceNeighbourRules({ ...open, tick: start + year * YEAR });
  for (const estate of estatesOf(open).estates.filter(entry => entry.offMap)) {
    const surfaced = lordClaims(open).filter(claim => claim.estateId === estate.id && claim.basis === "purchase_deed");
    assert.ok(surfaced.length <= 1, `${estate.id}: one at a time`);
  }
  assert.ok(lordClaims(open).length >= before);
  void NW07_CLAIM_SURFACES_PERMILLE;
});

test("ER-21 NW08 a neighbour house's head dead last year: a contested succession gives the lord a claim to the estate", () => {
  const town = lordTown();
  const estate = estatesOf(town).estates.find(entry => entry.offMap && entry.house !== undefined && entry.house.lordId !== "" && estatesOf(town).people.some(person => person.id === entry.house!.lordId))!;
  assert.ok(estate !== undefined, "a neighbour house whose head is among the estates' people");
  const start = town.tick - (town.tick % YEAR);
  // The first year whose draw falls under the chance.
  let at = start + YEAR;
  while (hashSeed(town.seed, `NW08:${estate.id}`, stateCalendar({ ...town, tick: at }).year) % 1000 >= NW08_CONTESTED_SUCCESSION_PERMILLE) at += YEAR;
  const year = stateCalendar({ ...town, tick: at }).year;
  const died: GameState = { ...town, tick: at, estates: { ...estatesOf(town), people: estatesOf(town).people.map(person => person.id === estate.house!.lordId ? { ...person, alive: false, deathYear: year - 1 } : person) } };
  const after = advanceNeighbourRules(died);
  assert.ok(lordClaims(after).some(claim => claim.estateId === estate.id && claim.basis === "inheritance" && claim.pieceId === undefined));
  // A head who died two years ago: no contested succession now.
  const older = advanceNeighbourRules({ ...died, estates: { ...estatesOf(died), people: estatesOf(died).people.map(person => person.id === estate.house!.lordId ? { ...person, deathYear: year - 2 } : person) } });
  assert.ok(!lordClaims(older).some(claim => claim.estateId === estate.id && claim.basis === "inheritance"));
});

test("ER-21 outside lord mode nothing happens", () => {
  const sandbox = { ...load("chapter-two-town"), tick: 40 * YEAR };
  assert.equal(advanceNeighbourRules(sandbox), sandbox);
});

test("ER-21 (Paston) a piece the lord took is claimed back by the house that holds the estate, which sues at once; a judgment it won is enforced", () => {
  let state = lordTown();
  const estate = estatesOf(state).estates.find(entry => entry.offMap && entry.titleHolder !== LORD)!;
  const piece = estate.pieces[0]!;
  // The lord holds one of its pieces (as a won suit leaves it).
  state = { ...state, estates: { ...estatesOf(state), estates: estatesOf(state).estates.map(entry => entry.id !== estate.id ? entry
    : { ...entry, pieces: entry.pieces.map(item => item.id === piece.id ? { ...item, titleHolder: LORD, possessor: LORD } : item) }) } };
  const start = state.tick - (state.tick % YEAR);
  let year = 1;
  let next = state;
  for (; year <= 80; year += 1) {
    next = advanceNeighbourRules({ ...state, tick: start + year * YEAR });
    if (estatesOf(next).suits.some(suit => suit.plaintiff === estate.titleHolder && suit.pieceId === piece.id)) break;
  }
  const suit = estatesOf(next).suits.find(entry => entry.plaintiff === estate.titleHolder && entry.pieceId === piece.id);
  assert.ok(suit !== undefined, "the house sued for the piece within 80 years");
  assert.equal(suit.defendant, LORD);
  assert.equal(estatesOf(next).claims.find(claim => claim.id === suit.claimId)!.basis, "inheritance");
  // A second claim is not raised on the estate while this one is open.
  const later = advanceNeighbourRules({ ...next, tick: start + (year + 1) * YEAR });
  assert.equal(estatesOf(later).claims.filter(claim => claim.claimant === estate.titleHolder && claim.estateId === estate.id && claim.status !== "won" && claim.status !== "lost").length, 1);
  // Won and enforcing: the house tries to take possession at the next year's turn.
  const enforcing: GameState = { ...later, estates: { ...estatesOf(later), suits: estatesOf(later).suits.map(entry => entry.id === suit.id ? { ...entry, stage: "enforcing" as const, verdict: "plaintiff" as const, hold: 0 } : entry) } };
  const tried = advanceNeighbourRules({ ...enforcing, tick: start + (year + 2) * YEAR });
  assert.equal(estatesOf(tried).suits.find(entry => entry.id === suit.id)!.enforcements, 1);
});
