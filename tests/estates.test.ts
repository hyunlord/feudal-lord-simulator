/** LM-E2 estates and rights (spec docs/design/estates.md ES-1…ES-10): the rights scenarios. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { HOME_ESTATE_ID, OLD_POSSESSION_YEARS } from "../src/content/estateConfig";
import { LORD_RIGHT_IDS } from "../src/content/lordshipConfig";
import { PRESSURE_BALANCE } from "../src/content/balanceConfig";
import { LEDGER_PERIOD_TICKS } from "../src/ledger/ledger";
import type { GameState } from "../src/engine/engine.types";
import {
  advanceEstates, claimsOn, estateById, estatePerson, estatePortfolio, estatesOf, houseChanged, LORD, lordRightsLost, PIECE_OF_RIGHT,
  raiseClaim, restorePossession, settleForLife, takePossession,
} from "../src/engine/estates";
import { addSuitEvidence, advanceSuits, enforcePossession, fileSuit, fileSuitRefusal, seekSuitPatron, suitHearing } from "../src/engine/estateSuits";
import { lordRights, rightHeld } from "../src/engine/lordshipState";
import { settleMoneyPeriod } from "../src/engine/moneyRules";
import { currentYear } from "../src/engine/persons";
import { decodeSave } from "../src/save/saveCodec";
import { migrateV37ToV38 } from "../src/save/migrations/v37ToV38";

const SEASON = PRESSURE_BALANCE.seasonTicks;
const YEAR = 4 * SEASON;
const load = (name: string, version = 38): GameState =>
  decodeSave(new Uint8Array(readFileSync(`fixtures/saves/v${version}/${name}.save.json`))).envelope.state as GameState;
const town = load("chapter-two-town");
const piece = (state: GameState, estateId: string, pieceId: string) => estateById(state, estateId)!.pieces.find(entry => entry.id === pieceId)!;
const FISHERY = "estate-neighbour-1:fishery";
/** The suit's next season (its stages move at a season's first tick). */
const season = (state: GameState): GameState => advanceSuits({ ...state, tick: (Math.floor(state.tick / SEASON) + 1) * SEASON });

test("ES-1 ES-9 the opening portfolio is read from the seed: the home estate held whole, three neighbours, no state kept", () => {
  assert.equal(town.estates, undefined, "a town that lost, claimed and sued nothing keeps no estates");
  const portfolio = estatePortfolio(town);
  assert.deepEqual(portfolio.map(estate => estate.id), [HOME_ESTATE_ID, "estate-neighbour-1", "estate-neighbour-2", "estate-neighbour-3"]);
  const home = portfolio[0]!;
  assert.deepEqual([home.titleHolder, home.possessor, home.titleStrength, home.possessionStrength, home.offMap], [LORD, LORD, 100, 100, false]);
  assert.ok(home.pieces.every(entry => entry.titleHolder === LORD && entry.possessor === LORD));
  assert.deepEqual(home.pieces.map(entry => entry.kind), ["land_rent", "manor_court", "market", "tolls", "mill", "fishery", "advowson"]);
  // Manors and the year's worth are apart (Paston 1444): the first neighbour has three manors worth 40 marks, the others two at 25.
  assert.deepEqual(portfolio.slice(1).map(estate => [estate.manors, estate.annualValue]), [[3, 6400], [2, 4000], [2, 4000]]);
  assert.ok(home.annualValue > 0 && home.pieces.find(entry => entry.kind === "land_rent")!.yearValue > 0, "the paying pieces are read from the ledger");
});

test("ES-8 the third neighbour: an old lord with daughters only, of like rank, in money trouble", () => {
  const old = estateById(town, "estate-neighbour-3")!;
  const year = currentYear(town);
  const lord = estatePerson(town, old.house!.lordId)!;
  const family = old.house!.familyIds.map(id => estatePerson(town, id)!);
  assert.ok(year - lord.birthYear >= 60, "an old lord");
  assert.equal(lord.sex, "male");
  assert.deepEqual(family.filter(person => person.id !== lord.id).map(person => person.sex), ["female", "female"], "daughters only");
  assert.ok(family.every(person => person.classBand === "gentry") && old.house!.rank === "gentry", "of like rank");
  assert.ok(old.burdens.debt > old.annualValue, "debts past a year's worth");
  // The other two are the neighbouring lords of FACTION-0, led by the factions' own leaders.
  for (const [id, faction] of [["estate-neighbour-1", "neighbour_1"], ["estate-neighbour-2", "neighbour_2"]] as const) {
    const view = estatePortfolio(town).find(estate => estate.id === id)!;
    assert.equal(view.house!.lordId, town.factions!.factions.find(entry => entry.id === faction)!.leaderId);
  }
});

test("ES-3 title only: the overlord's custody takes the market's possession — the lord keeps the title, the income stops", () => {
  const custody = takePossession(town, HOME_ESTATE_ID, PIECE_OF_RIGHT.market, "overlord", "suspended");
  const market = piece(custody, HOME_ESTATE_ID, PIECE_OF_RIGHT.market);
  assert.deepEqual([market.titleHolder, market.possessor, market.loss], [LORD, "overlord", "suspended"]);
  assert.equal(rightHeld(custody, "market"), false);
  assert.deepEqual(lordRights(custody).find(right => right.id === "market"), { id: "market", present: true, status: "suspended", by: "overlord", since: town.tick });
  // FL-1 unchanged: no stall fee for the lord while it is in custody.
  const period = (Math.floor(town.tick / LEDGER_PERIOD_TICKS) + 1) * LEDGER_PERIOD_TICKS;
  const fee = (state: GameState) => (settleMoneyPeriod({ ...state, tick: period }).ledger?.entries ?? [])
    .filter(entry => entry.tick === period && entry.category === "stall_fee").length;
  assert.ok(fee(town) > 0);
  assert.equal(fee(custody), 0);
  assert.ok(fee(restorePossession(custody, HOME_ESTATE_ID, PIECE_OF_RIGHT.market)) > 0, "the possession back, the fee back");
});

test("ES-3 possession only: a neighbour fishes the lord's reach by force; thirty years of it raise its own claim", () => {
  const forced = takePossession(town, HOME_ESTATE_ID, "home:fishery", "neighbour_1", "forced");
  const fishery = piece(forced, HOME_ESTATE_ID, "home:fishery");
  assert.deepEqual([fishery.titleHolder, fishery.possessor], [LORD, "neighbour_1"]);
  const yearStart = (Math.floor(forced.tick / YEAR) + 1) * YEAR;
  assert.deepEqual(claimsOn(advanceEstates({ ...forced, tick: yearStart }), HOME_ESTATE_ID, "home:fishery"), [], "not yet");
  const later = advanceEstates({ ...forced, tick: yearStart + OLD_POSSESSION_YEARS * YEAR });
  const claims = claimsOn(later, HOME_ESTATE_ID, "home:fishery");
  assert.deepEqual(claims.map(claim => [claim.claimant, claim.basis]), [["neighbour_1", "old_possession"]]);
});

test("ES-3 both: a neighbour's own pieces are its title and its possession; the lord's are the lord's", () => {
  for (const estate of estatesOf(town).estates) {
    for (const entry of estate.pieces) assert.equal(entry.titleHolder, entry.possessor, `${entry.id}`);
  }
  assert.ok(LORD_RIGHT_IDS.every(id => rightHeld(town, id)));
});

test("ES-4 a life estate: the tenant holds for life, the title stays; at the tenant's death the remainder takes both", () => {
  const tenant = town.persons!.people.find(person => person.alive && person.householdId !== "manor")!;
  const settled = settleForLife(town, HOME_ESTATE_ID, `person:${tenant.id}`, LORD, ["home:manor_court"]);
  const court = piece(settled, HOME_ESTATE_ID, "home:manor_court");
  assert.deepEqual([court.titleHolder, court.possessor, court.lifeTenant, court.remainder], [LORD, `person:${tenant.id}`, `person:${tenant.id}`, LORD]);
  const yearStart = (Math.floor(settled.tick / YEAR) + 1) * YEAR;
  assert.equal(piece(advanceEstates({ ...settled, tick: yearStart }), HOME_ESTATE_ID, "home:manor_court").possessor, `person:${tenant.id}`, "alive: held");
  const dead = { ...settled, tick: yearStart, persons: { ...settled.persons!, people: settled.persons!.people.map(person => person.id === tenant.id ? { ...person, alive: false } : person) } };
  const after = piece(advanceEstates(dead), HOME_ESTATE_ID, "home:manor_court");
  assert.deepEqual([after.titleHolder, after.possessor, after.lifeTenant], [LORD, LORD, undefined]);
});

test("ES-4 a remainder: the old lord's estate for his life, the remainder his elder daughter — she takes title and possession", () => {
  const old = estateById(town, "estate-neighbour-3")!;
  const [lordId, elder] = old.house!.familyIds;
  const settled = settleForLife(town, "estate-neighbour-3", `person:${lordId}`, `person:${elder}`);
  assert.equal(estateById(settled, "estate-neighbour-3")!.remainder, `person:${elder}`);
  const yearStart = (Math.floor(settled.tick / YEAR) + 1) * YEAR;
  const people = estatesOf(settled).people.map(person => person.id === lordId ? { ...person, alive: false } : person);
  const after = advanceEstates({ ...settled, tick: yearStart, estates: { ...estatesOf(settled), people } });
  const estate = estateById(after, "estate-neighbour-3")!;
  assert.deepEqual([estate.titleHolder, estate.possessor], [`person:${elder}`, `person:${elder}`]);
  assert.ok(estate.pieces.every(entry => entry.titleHolder === `person:${elder}` && entry.possessor === `person:${elder}`));
});

test("ES-2 a piece apart (Ermington 1432): the manor goes for life, the fishery is kept back by its holder", () => {
  const settled = settleForLife(town, "estate-neighbour-1", "person:heir", "neighbour_1",
    ["estate-neighbour-1:land_rent", "estate-neighbour-1:manor_court", "estate-neighbour-1:hunting"]);
  const pieces = estateById(settled, "estate-neighbour-1")!.pieces;
  assert.deepEqual(pieces.filter(entry => entry.possessor === "person:heir").map(entry => entry.kind), ["land_rent", "manor_court", "hunting"]);
  assert.deepEqual([piece(settled, "estate-neighbour-1", FISHERY).possessor, estateById(settled, "estate-neighbour-1")!.possessor], ["neighbour_1", "neighbour_1"]);
});

test("ES-5 competing claims: two claimants on one fishery; the lord's suit is judged and the other's claim stays open", () => {
  const rival = raiseClaim(town, { claimant: "neighbour_2", estateId: "estate-neighbour-1", pieceId: FISHERY, basis: "inheritance" });
  assert.deepEqual(claimsOn(rival, "estate-neighbour-1", FISHERY).map(claim => [claim.claimant, claim.basis, claim.strength]),
    [[LORD, "grant", 45], ["neighbour_2", "inheritance", 60]]);
  assert.equal(raiseClaim(rival, { claimant: "neighbour_2", estateId: "estate-neighbour-1", pieceId: FISHERY, basis: "inheritance" }), rival, "never twice");
  let state = fileSuit(rival, "claim-1");
  for (const kind of ["charter", "court_roll", "witnesses"] as const) state = addSuitEvidence(state, "suit-1", kind);
  for (let index = 0; index < 5; index += 1) state = season(state);
  assert.equal(piece(state, "estate-neighbour-1", FISHERY).titleHolder, LORD);
  assert.deepEqual(claimsOn(state, "estate-neighbour-1", FISHERY).map(claim => claim.claimant), ["neighbour_2"], "the rival now claims against the lord");
  assert.equal(fileSuitRefusal(state, "claim-1"), "not_open");
});

test("ES-7 a suit lost: no evidence, no patron — the defence holds the title, the claim is lost", () => {
  let state = fileSuit(town, "claim-1");
  for (let index = 0; index < 5; index += 1) state = season(state);
  const suit = estatesOf(state).suits[0]!;
  assert.deepEqual([suit.verdict, suit.stage], ["defendant", "closed"]);
  assert.equal(estatesOf(state).claims[0]!.status, "lost");
  assert.equal(piece(state, "estate-neighbour-1", FISHERY).titleHolder, "neighbour_1");
  // PLAY-2: the hearing says who leads and, closed, that nothing more can be added.
  assert.deepEqual(suitHearing(state, "suit-1"), { plaintiff: 45, defence: 80, verdictNow: "defendant", reachable: false });
});

test("ES-7 a judgment moves the title only: the neighbour keeps the fishery until the possession is enforced", () => {
  let state = fileSuit(town, "claim-1");
  for (const kind of ["charter", "court_roll", "witnesses"] as const) state = addSuitEvidence(state, "suit-1", kind);
  for (let index = 0; index < 5; index += 1) state = season(state);
  const judged = estatesOf(state).suits[0]!;
  assert.deepEqual([judged.verdict, judged.stage, judged.hold], ["plaintiff", "enforcing", 75]);
  const fishery = piece(state, "estate-neighbour-1", FISHERY);
  assert.deepEqual([fishery.titleHolder, fishery.possessor, fishery.loss], [LORD, "neighbour_1", "held_against_judgment"]);
  // Two more seasons with no enforcement change nothing: the title is the lord's, the fish the neighbour's.
  assert.equal(piece(season(season(state)), "estate-neighbour-1", FISHERY).possessor, "neighbour_1");
});

test("ES-7 enforcing the possession without a patron: the holder resists twice, the third attempt takes it; each costs and is counted", () => {
  let state = fileSuit(town, "claim-1");
  for (const kind of ["charter", "court_roll", "witnesses"] as const) state = addSuitEvidence(state, "suit-1", kind);
  for (let index = 0; index < 5; index += 1) state = season(state);
  const first = enforcePossession(state, "suit-1");
  assert.deepEqual([estatesOf(first).suits[0]!.enforced, estatesOf(first).suits[0]!.hold, piece(first, "estate-neighbour-1", FISHERY).possessor],
    [false, 55, "neighbour_1"]);
  const resisted = enforcePossession(first, "suit-1");
  assert.deepEqual([estatesOf(resisted).suits[0]!.enforced, estatesOf(resisted).suits[0]!.hold], [false, 35]);
  const second = enforcePossession(resisted, "suit-1");
  const suit = estatesOf(second).suits[0]!;
  assert.deepEqual([suit.enforced, suit.enforcements, suit.stage], [true, 3, "closed"]);
  const fishery = piece(second, "estate-neighbour-1", FISHERY);
  assert.deepEqual([fishery.titleHolder, fishery.possessor, fishery.loss], [LORD, LORD, undefined]);
  const lawsuit = (second.ledger?.entries ?? []).filter(entry => entry.category === "lawsuit");
  assert.equal(-lawsuit.reduce((sum, entry) => sum + entry.amount, 0), suit.costs);
  assert.equal(suit.costs, 60 + 40 + 20 + 24 + 120 + 80 * 3);
});

test("ES-7 a patron: a faction the lord stands well with backs the suit by its relation (capped); one below the bar does not", () => {
  let state = fileSuit(town, "claim-1");
  state = season(season(season(state)));
  assert.equal(estatesOf(state).suits[0]!.stage, "patronage");
  assert.equal(seekSuitPatron(state, "suit-1", "neighbour_2"), state, "relation 0: no patron");
  const backed = seekSuitPatron(state, "suit-1", "bishop");
  assert.deepEqual([estatesOf(backed).suits[0]!.patron, estatesOf(backed).suits[0]!.patronSupport], ["bishop", 20]);
  assert.equal(suitHearing(backed, "suit-1")!.plaintiff, 45 + 20);
});

test("ES-6 a new house takes the town: the rights the old one lost come back, and its kin keeps a claim by inheritance", () => {
  const lost = takePossession(town, HOME_ESTATE_ID, PIECE_OF_RIGHT.mill, "merchants", "seized");
  const kin = town.persons!.people.filter(person => person.alive && person.tags.includes("lord-house:1"))
    .sort((a, b) => a.birthYear - b.birthYear || a.id.localeCompare(b.id))[0]!;
  const changed = houseChanged(lost, 1);
  assert.ok(rightHeld(changed, "mill"));
  assert.deepEqual(lordRightsLost(changed), []);
  assert.deepEqual(claimsOn(changed, HOME_ESTATE_ID).map(claim => [claim.claimant, claim.basis]), [[`person:${kin.id}`, "inheritance"]]);
});

test("ES-10 chapters 4–5: the franchises granted from the town are the grantees' pieces in the portfolio, as the grants record them", () => {
  const five = load("chapter-five-town");
  const home = estatePortfolio(five).find(estate => estate.id === HOME_ESTATE_ID)!;
  const rights = five.politics!.rights;
  assert.ok(rights.length > 0, "chapters 1–4 granted franchises");
  assert.deepEqual(home.grants.map(grant => [grant.id, grant.titleHolder, grant.possessor, grant.since]),
    rights.map(right => [`grant:${right.id}`, right.holder, right.holder, right.grantedTick]));
  assert.ok(home.grants.every(grant => grant.kind !== null), "each stands on a piece");
  assert.ok(home.pieces.every(entry => entry.titleHolder === LORD), "the lord keeps the pieces' titles");
});

test("ES-9 save v38: a v37 town that lost a right moves it to the home estate's possession (title kept); the others keep no estates", () => {
  for (const name of ["new-game", "chapter-two-town", "chapter-three-town", "chapter-four-town", "chapter-five-town"]) {
    const old = JSON.parse(readFileSync(`fixtures/saves/v37/${name}.save.json`, "utf8")) as { state: GameState & { lordship?: { lostRights?: unknown[] } } };
    const migrated = load(name);
    assert.equal(migrated.estates, undefined, `${name}: nothing lost, no estates`);
    assert.equal((migrated.lordship as { lostRights?: unknown } | undefined)?.lostRights, undefined, `${name}: lostRights left the lordship`);
    assert.deepEqual(old.state.lordship?.lostRights ?? [], [], `${name} lost nothing in v37`);
    assert.deepEqual(lordRights(migrated).map(right => right.status), ["held", "held", "held"]);
  }
  const raw = JSON.parse(readFileSync("fixtures/saves/v37/chapter-two-town.save.json", "utf8")) as { state: GameState & { lordship: object } };
  const lostAt = raw.state.tick - SEASON;
  const v37 = { ...raw, state: { ...raw.state, lordship: { ...raw.state.lordship, lostRights: [{ id: "market", status: "seized", by: "merchants", since: lostAt }] } } };
  const state = (migrateV37ToV38(v37) as { state: GameState }).state;
  assert.deepEqual(lordRights(state).find(right => right.id === "market"), { id: "market", present: true, status: "seized", by: "merchants", since: lostAt });
  assert.equal(piece(state, HOME_ESTATE_ID, PIECE_OF_RIGHT.market).titleHolder, LORD);
  assert.equal(rightHeld(state, "market"), false);
});
