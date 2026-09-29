/**
 * F3-A chapter 3's Black Death (spec docs/design/chapter-three-plague.md PL-1…PL-11). At each season start from the
 * collapse era (1348):
 *
 * - PL-1 the harbour fever's rumour (a season after the era's first), then the pestilence (a coastal town a season
 *   later, an inland one two).
 * - PL-2 it rages four seasons and takes 42–48 % of the town's people (the seed's pick), person by person on each
 *   season's death day (`plagueVictims`, read by the persons): the old and small children first, the crowded houses
 *   and the town's inner third more. The lord's household dies at the same odds. A house it empties stands vacant.
 * - PL-3 from its arrival the growth rule adds nobody (`plagueHousing`): the town recovers by this rule only — its own
 *   births and kin, a share of the people it had, a season — and the empty plots wait for the resettlement.
 * - PL-4 labour is short (the labour rule sees the fewer adults), bread and wheat sell at four fifths, an empty plot pays
 *   no rent.
 * - PL-5…PL-8 the four decisions (petitions, `answerPlaguePetition`): the priest's seat, the wages, the empty plots,
 *   labour services or money rent. PL-5 the Statute of Labourers is read in the spring of 1351.
 * - PL-7 the resettlement from the spring of 1352; PL-9 the second pestilence of 1361 (the children's plague, lighter).
 * - PL-10 chapter 3 ends from 1362 once the town has 70 % of its people back, by 1364 at the latest.
 */
import type { SourceRef } from "../contracts";
import { CHAPTER_THREE, type PetitionResponse } from "../content/chapterConfig";
import {
  CASH_RENT_PETITION_ID,
  LAND_REDISTRIBUTION_PETITION_ID,
  PLAGUE_BALANCE,
  PLAGUE_ERA_ID,
  PLAGUE_PETITION_IDS,
  PLAGUE_SEQUENCE_ID,
  VACANT_PRIEST_PETITION_ID,
  WAGES_PETITION_ID,
} from "../content/plagueConfig";
import { archetypeOf } from "../content/scenario/registry";
import { houseLotArea } from "../geometry/buildingFootprint";
import { LEDGER_PERIOD_TICKS, postLedgerEntries, treasuryBalance } from "../ledger/ledger";
import { periodRent, upkeepCharges } from "./moneyRules";
import type { LedgerCategory, LedgerPosting } from "../ledger/ledger.types";
import { houseHasFood } from "../population/houseFood";
import { houseCapacity, type PlagueHousing } from "../population/housing";
import type { House } from "../population/population.types";
import type { GameState } from "./engine.types";
import { EMPTY_MONEY, type UpkeepArrear } from "./money.types";
import type { Person } from "./persons.types";
import type { Pestilence, PlagueState, PlagueStep } from "./plague.types";
import type { PetitionRecord } from "./politics.types";
import { hashSeed } from "./prng";
import { calendar, scenarioOf } from "./scenarioState";
import { abandonHouse } from "./seasonPressure";

const SEASON = 1000;
const YEAR = 4000;
const MANOR = "manor";
const PARISH: SourceRef = { type: "actor", id: "parish" };
const CHURCH_KINDS = new Set(["church", "chapel"]);

export function plagueOf(state: Pick<GameState, "plague">): PlagueState | undefined {
  return state.plague;
}

export function plagueActive(state: Pick<GameState, "scenarioId">): boolean {
  return scenarioOf(state).activeEvents.includes(PLAGUE_SEQUENCE_ID);
}

/** PL-1: a town on the coast or a river's mouth (its archetype) takes the pestilence a season sooner. */
export function plagueCoastal(state: Pick<GameState, "scenarioId">): boolean {
  return archetypeOf(scenarioOf(state))?.coastal === true;
}

/** PL-1: the pestilence's first season, counted from the era's. */
export function arrivalSeasonOffset(state: Pick<GameState, "scenarioId">): number {
  return PLAGUE_BALANCE.rumourSeason + (plagueCoastal(state) ? PLAGUE_BALANCE.coastalArrivalAfterRumour : PLAGUE_BALANCE.inlandArrivalAfterRumour);
}

const yearOf = (state: Pick<GameState, "scenarioId">, tick: number) => calendar(tick, scenarioOf(state).startYear).year;
/** The spring (first) tick of `year`. */
const springOf = (state: Pick<GameState, "scenarioId">, year: number) => (year - scenarioOf(state).startYear) * YEAR;

/** PL-2: a pestilence still raging at `tick` (its last season's death day not yet passed). */
function raging(pestilence: Pestilence | undefined, tick: number): pestilence is Pestilence {
  return pestilence !== undefined && pestilence.endTick === undefined && tick >= pestilence.arrivalTick;
}

/** PL-1 API: the stage now — the rumour, a pestilence arriving, the recovery, or done (null before the rumour). */
export function plagueStage(state: Pick<GameState, "plague" | "tick">): "rumour" | "arrival" | "recovery" | "done" | null {
  const plague = state.plague;
  if (plague?.rumourTick === undefined) return null;
  if (plague.endedTick !== undefined) return "done";
  if (raging(plague.first, state.tick) || raging(plague.second, state.tick)) return "arrival";
  return plague.first === undefined ? "rumour" : "recovery";
}

/** PL-3 / PL-4: the pestilence has come and the chapter (or the sequence) has not ended. */
function afterArrival(state: Pick<GameState, "plague">): boolean {
  return state.plague?.first !== undefined && state.plague.endedTick === undefined;
}

/** PL-3 / PL-7 (housing): the growth rule holds from the arrival to the end; the households that took the plots rise faster. */
export function plagueHousing(state: Pick<GameState, "plague">): PlagueHousing | undefined {
  if (!afterArrival(state)) return undefined;
  const expand = state.plague!.answers[LAND_REDISTRIBUTION_PETITION_ID];
  return { growthHeld: true, holdPermille: expand === "accept" || expand === "expired" ? PLAGUE_BALANCE.expandHoldPermille : 1_000 };
}

/** PL-4: bread and wheat's price share after the arrival (fewer mouths), permille (1,000 otherwise). */
export function plagueGrainPermille(state: Pick<GameState, "plague">): number {
  return afterArrival(state) ? PLAGUE_BALANCE.grainPricePermille : 1_000;
}

/** PL-8: the rent's share — money rent for labour services once commuted (for good), permille. */
export function plagueRentPermille(state: Pick<GameState, "plague">): number {
  return state.plague?.answers[CASH_RENT_PETITION_ID] === "accept" ? PLAGUE_BALANCE.cashRentPermille : 1_000;
}

/** PL-8: the upkeep's share while the tenants' week-work keeps the lord's works (labour services kept), permille. */
export function plagueUpkeepPermille(state: Pick<GameState, "plague">): number {
  const kept = state.plague?.answers[CASH_RENT_PETITION_ID];
  return afterArrival(state) && (kept === "refuse" || kept === "expired") ? PLAGUE_BALANCE.labourServiceUpkeepPermille : 1_000;
}

/** PL-3 (ladder): a house the pestilence emptied waits for the resettlement, not for the ladder's new household. */
export function plagueHoldsHouse(state: Pick<GameState, "plague">, houseId: string): boolean {
  return afterArrival(state) && state.plague!.vacantHouseIds.includes(houseId);
}

/** PL-3 API `plagueVacantPlots`: the houses the pestilence emptied (house ids, by id), and the empty plots' lost rent. */
export function plagueVacantPlots(state: Pick<GameState, "plague" | "houses">): readonly string[] {
  const ids = new Set(state.plague?.vacantHouseIds ?? []);
  return state.houses.filter(house => ids.has(house.buildingId) && house.residents <= 0).map(house => house.buildingId).sort();
}

/** PL-6: the priest's seat is empty now (the churches serve nobody) — no priest yet, or the monastery's not yet come. */
export function curacyVacant(state: Pick<GameState, "plague" | "tick">): boolean {
  const curacy = state.plague?.curacy;
  return curacy !== undefined && state.plague?.endedTick === undefined && (curacy.filledTick === undefined || state.tick < curacy.filledTick);
}

// --- PL-2 deaths --------------------------------------------------------------------------------------------------

const weightBy = (table: readonly (readonly [number, number])[], age: number) => table.find(([limit]) => age < limit)![1];

/** The pestilence raging now and its season's index (0…), or null. */
function ragingNow(state: Pick<GameState, "plague" | "tick">): { readonly which: "first" | "second"; readonly pestilence: Pestilence; readonly season: number } | null {
  const plague = state.plague;
  if (plague === undefined) return null;
  for (const which of ["second", "first"] as const) {
    const pestilence = plague[which];
    if (!raging(pestilence, state.tick)) continue;
    const season = Math.floor((state.tick - pestilence.arrivalTick) / SEASON);
    const seasons = which === "first" ? PLAGUE_BALANCE.arrivalSeasons : PLAGUE_BALANCE.secondSeasons;
    if (season < seasons) return { which, pestilence, season };
  }
  return null;
}

/**
 * PL-2 / PL-9: the people the pestilence takes on this death day (ids). The season's quota is its share of the
 * pestilence's dead less those already taken; the town's people are drawn by weight (a weighted draw without
 * replacement, keys from the seed); the lord's household each at the town's odds times their own weight.
 */
export function plagueVictims(state: GameState, people: readonly Person[], year: number): ReadonlySet<string> {
  const now = ragingNow(state);
  if (now === null) return new Set();
  const first = now.which === "first";
  const shares = first ? PLAGUE_BALANCE.arrivalShares : PLAGUE_BALANCE.secondShares;
  const ages = first ? PLAGUE_BALANCE.ageWeights : PLAGUE_BALANCE.secondAgeWeights;
  const total = Math.floor(now.pestilence.populationAtArrival * now.pestilence.deathPermille / 1000);
  const cumulative = shares.slice(0, now.season + 1).reduce((sum, share) => sum + share, 0);
  const town = people.filter(person => person.householdId !== MANOR);
  const quota = Math.max(0, Math.min(town.length, Math.round(total * cumulative / 1000) - now.pestilence.dead));
  const houses = new Map(state.houses.map(house => [house.buildingId, house]));
  const lots = new Map(state.buildings.map(building => [building.id, building]));
  // The town's inner and outer thirds by distance from the lived-in houses' middle.
  const lived = state.houses.filter(house => house.residents > 0 && lots.has(house.buildingId)).map(house => lots.get(house.buildingId)!);
  const cx = lived.reduce((sum, building) => sum + building.tx, 0) / Math.max(1, lived.length);
  const cy = lived.reduce((sum, building) => sum + building.ty, 0) / Math.max(1, lived.length);
  const distance = (id: string) => { const building = lots.get(id); return building === undefined ? Infinity : Math.hypot(building.tx - cx, building.ty - cy); };
  const ranked = [...lived].map(building => distance(building.id)).sort((a, b) => a - b);
  const inner = ranked[Math.floor(ranked.length / 3)] ?? 0;
  const outer = ranked[Math.floor(ranked.length * 2 / 3)] ?? Infinity;
  const weight = (person: Person): number => {
    let permille = weightBy(ages, year - person.birthYear);
    const house = houses.get(person.householdId);
    if (house !== undefined) {
      const room = houseCapacity(house, houseLotArea(lots.get(house.buildingId)));
      if (room > 0 && house.residents * 1000 >= room * PLAGUE_BALANCE.crowdedPermille) permille = permille * PLAGUE_BALANCE.crowdedWeight / 1000;
      const d = distance(house.buildingId);
      if (d <= inner) permille = permille * PLAGUE_BALANCE.innerWeight / 1000;
      else if (d > outer) permille = permille * PLAGUE_BALANCE.outerWeight / 1000;
    }
    return Math.max(1, permille);
  };
  const ordinal = (person: Person) => Number(person.id.slice(2));
  const drawKey = (salt: string, weightPermille: number, ...values: number[]) =>
    Math.log((hashSeed(state.seed, salt, ...values) + 1) / 4_294_967_297) / weightPermille;
  // Whole households first (the first pestilence): the season's share of the houses it takes whole, drawn by the house's
  // own weight (crowded, inner); all its people are the season's dead, within the quota.
  const victims = new Set<string>();
  if (first) {
    const lived = state.houses.filter(house => house.residents > 0 && house.abandonedTick === undefined && house.burntTick === undefined);
    const wipeTotal = Math.round((lived.length + now.pestilence.wipedHouses) * PLAGUE_BALANCE.wipedHousePermille / 1000);
    const wipe = Math.max(0, Math.round(wipeTotal * cumulative / 1000) - now.pestilence.wipedHouses);
    const houseWeight = (house: House) => {
      const sample = town.find(person => person.householdId === house.buildingId);
      return sample === undefined ? 1 : weight({ ...sample, birthYear: year - 30 });
    };
    const chosen = lived.map(house => ({ house, key: drawKey("plague-house", houseWeight(house), ...[...house.buildingId].map(char => char.charCodeAt(0)), state.tick) }))
      .sort((a, b) => b.key - a.key || a.house.buildingId.localeCompare(b.house.buildingId)).slice(0, wipe);
    for (const { house } of chosen) {
      const members = town.filter(person => person.householdId === house.buildingId);
      if (victims.size + members.length > quota) continue;
      for (const person of members) victims.add(person.id);
    }
  }
  for (const entry of town.filter(person => !victims.has(person.id)).map(person => ({ person, key: drawKey(`plague-death:${now.which}`, weight(person), ordinal(person), state.tick) }))
    .sort((a, b) => b.key - a.key || a.person.id.localeCompare(b.person.id))) {
    if (victims.size >= quota) break;
    victims.add(entry.person.id);
  }
  // The lord's household: each at the season's odds for the town (quota ÷ people) times their own weight.
  const odds = town.length === 0 ? 0 : quota / town.length;
  for (const person of people.filter(entry => entry.householdId === MANOR)) {
    const roll = hashSeed(state.seed, `plague-manor:${now.which}`, ordinal(person), person.id.charCodeAt(0), state.tick) / 4_294_967_296;
    if (roll < odds * weight(person) / 1000) victims.add(person.id);
  }
  return victims;
}

/** PL-2 (persons): the death day's dead are counted on the pestilence raging now. */
export function countPlagueDead(state: GameState, townDead: number, manorDead: number, wipedHouses = 0): GameState {
  const now = ragingNow(state);
  if (now === null || townDead + manorDead === 0) return state;
  const pestilence = { ...now.pestilence, dead: now.pestilence.dead + townDead, manorDead: now.pestilence.manorDead + manorDead,
    wipedHouses: now.pestilence.wipedHouses + wipedHouses };
  return { ...state, plague: { ...state.plague!, [now.which]: pestilence } };
}

// --- ledger ---------------------------------------------------------------------------------------------------------

/** The treasury pays `amount` (cash, category); what it cannot is owed (arrears, paid off at the period close, FL-3). */
function charge(state: GameState, category: LedgerCategory, amount: number, sources: readonly [SourceRef, ...SourceRef[]]): GameState {
  if (amount <= 0) return state;
  const paid = Math.min(amount, Math.max(0, treasuryBalance(state)));
  const owed = amount - paid;
  const postings: LedgerPosting[] = [];
  if (paid > 0) postings.push({ account: "cash", category, amount: -paid, sourceRefs: sources });
  if (owed > 0) postings.push({ account: "arrears", category, amount: owed, sourceRefs: [...sources, { type: "claim", id: `${category}:${state.tick}`, detail: "unpaid" }] });
  const posted = postLedgerEntries(state, postings);
  const money = state.money ?? EMPTY_MONEY;
  const arrear: UpkeepArrear = { tick: state.tick, amount: owed, facility: sources[0], category };
  return { ...state, treasuryCoin: posted.treasuryCoin, ledger: posted.ledger, ...(owed > 0 ? { money: { ...money, arrears: [...money.arrears, arrear] } } : {}) };
}

function earn(state: GameState, category: LedgerCategory, amount: number, sources: readonly [SourceRef, ...SourceRef[]]): GameState {
  if (amount <= 0) return state;
  const posted = postLedgerEntries(state, [{ account: "cash", category, amount, sourceRefs: sources }]);
  return { ...state, treasuryCoin: posted.treasuryCoin, ledger: posted.ledger };
}

// --- the sequence ---------------------------------------------------------------------------------------------------

function withPlague(state: GameState, plague: PlagueState): GameState {
  return { ...state, plague };
}

function addPetition(state: GameState, defId: string, petitioner: PetitionRecord["petitioner"]): GameState {
  if (state.politics === undefined) return state;
  const petition: PetitionRecord = { id: `${defId}@${state.tick}`, defId, petitioner, arrivedTick: state.tick };
  return { ...state, politics: { ...state.politics, petitions: [...state.politics.petitions, petition] } };
}

/** PL-6: the churches and chapels stand without a priest (or have one again). */
function setCuracy(state: GameState, vacant: boolean): GameState {
  let changed = false;
  const buildings = state.buildings.map(building => {
    if (!CHURCH_KINDS.has(building.kind) || (building.curacyVacant === true) === vacant) return building;
    changed = true;
    if (vacant) return { ...building, curacyVacant: true as const };
    const { curacyVacant: _filled, ...rest } = building;
    return rest;
  });
  return changed ? { ...state, buildings } : state;
}

const livedIn = (house: House) => house.residents > 0 && house.abandonedTick === undefined && house.burntTick === undefined;

/** PL-5 / PL-8: one household leaves (for wages elsewhere, or from its services) — the poorest first; its house stands vacant. */
function flee(state: GameState, salt: string, permille: number): GameState {
  if (hashSeed(state.seed, salt, state.tick) % 1000 >= permille) return state;
  const leaving = state.houses.filter(livedIn).sort((a, b) => a.level - b.level || a.breadStock - b.breadStock || a.buildingId.localeCompare(b.buildingId))[0];
  if (leaving === undefined || state.houses.filter(livedIn).length <= 1) return state;
  const plague = state.plague!;
  return withPlague({ ...state, population: state.population - leaving.residents, houses: state.houses.map(house => house === leaving ? abandonHouse(house, state.tick) : house) },
    { ...plague, fled: plague.fled + 1, vacantHouseIds: [...plague.vacantHouseIds, leaving.buildingId].sort() });
}

/** PL-3: the houses the death day emptied stand vacant (rent-free, waiting for the resettlement). */
function vacateEmptied(state: GameState): GameState {
  const plague = state.plague!;
  const emptied = state.houses.filter(house => house.residents <= 0 && house.abandonedTick === undefined && house.burntTick === undefined
    && !plague.vacantHouseIds.includes(house.buildingId));
  if (emptied.length === 0) return state;
  const ids = new Set(emptied.map(house => house.buildingId));
  return withPlague({ ...state, houses: state.houses.map(house => ids.has(house.buildingId) ? abandonHouse(house, state.tick) : house) },
    { ...plague, vacantHouseIds: [...plague.vacantHouseIds, ...ids].sort() });
}

/** PL-3: the town's own recovery, a season — births and kin into the fed, watered houses with room (seed order, one each round). */
function recover(state: GameState): GameState {
  const plague = state.plague!;
  // Never past the people the town had when the pestilence came.
  const cap = Math.max(0, (plague.first?.populationAtArrival ?? 0) - state.population);
  let budget = Math.min(cap, Math.ceil((plague.first?.populationAtArrival ?? 0) * PLAGUE_BALANCE.recoveryPermille / 1000));
  const lots = new Map(state.buildings.map(building => [building.id, building]));
  const key = (house: House) => hashSeed(state.seed, "plague-recover", state.tick, ...[...house.buildingId].map(char => char.charCodeAt(0)));
  const houses = [...state.houses];
  const order = houses.map((house, index) => ({ house, index })).filter(({ house }) => livedIn(house) && house.hasWater && houseHasFood(house) && house.leavingSinceTick === undefined)
    .sort((a, b) => key(a.house) - key(b.house) || a.house.buildingId.localeCompare(b.house.buildingId));
  let added = 0;
  while (budget > 0) {
    let any = false;
    for (const { index } of order) {
      if (budget <= 0) break;
      const house = houses[index]!;
      if (house.residents >= houseCapacity(house, houseLotArea(lots.get(house.buildingId)))) continue;
      houses[index] = { ...house, residents: house.residents + 1 };
      budget -= 1; added += 1; any = true;
    }
    if (!any) break;
  }
  if (added === 0) return state;
  return withPlague({ ...state, houses, population: state.population + added }, { ...plague, recovered: plague.recovered + added });
}

/**
 * PL-7: a season's resettlement — new settlers (two households, their entry fines) or, when the neighbours took the
 * plots, one household of kin a season; into the vacant houses with water, by id.
 */
function resettle(state: GameState): GameState {
  const plague = state.plague!;
  const settlers = plague.answers[LAND_REDISTRIBUTION_PETITION_ID] === "accept_with_price";
  const lots = new Map(state.buildings.map(building => [building.id, building]));
  let households = settlers ? PLAGUE_BALANCE.settlerHouseholds : 1;
  const houses = [...state.houses];
  const taken: string[] = [];
  let people = 0;
  for (const id of plague.vacantHouseIds) {
    if (households <= 0) break;
    const index = houses.findIndex(house => house.buildingId === id);
    const house = houses[index];
    if (house === undefined || house.burntTick !== undefined || !house.hasWater || house.residents > 0) continue;
    const room = houseCapacity(house, houseLotArea(lots.get(id)));
    const residents = Math.max(1, Math.min(room, settlers ? PLAGUE_BALANCE.settlerPeople : houseLotArea(lots.get(id))));
    const { abandonedTick: _vacant, ...rest } = house;
    houses[index] = { ...rest, residents };
    people += residents; taken.push(id); households -= 1;
  }
  if (taken.length === 0) return state;
  let next: GameState = withPlague({ ...state, houses, population: state.population + people },
    { ...plague, resettled: plague.resettled + taken.length, vacantHouseIds: plague.vacantHouseIds.filter(id => !taken.includes(id)) });
  if (settlers) next = earn(next, "entry_fine", taken.length * PLAGUE_BALANCE.entryFine, [{ type: "actor", id: "settlers" }, { type: "claim", id: "entry_fine", detail: `households:${taken.length}` }]);
  return next;
}

/** PL-5 (money rule): a ledger period's raised wages — each worker in the lord's buildings, `raisedWagePerWorker`. */
function payWages(state: GameState): GameState {
  const workers = state.buildings.reduce((sum, building) => sum + (building.kind === "house" ? 0 : Math.max(0, building.workers)), 0);
  return charge(state, "wages", workers * PLAGUE_BALANCE.raisedWagePerWorker, [{ type: "actor", id: "labourers" }, { type: "claim", id: "wages", detail: `workers:${workers}` }]);
}

function newPestilence(state: GameState, deathPermille: number): Pestilence {
  return { arrivalTick: state.tick, populationAtArrival: Math.max(0, state.population), deathPermille, dead: 0, manorDead: 0, wipedHouses: 0 };
}

/**
 * PL-5…PL-8: the lord's answer to a plague petition (called by `respondToPetition`, which records the decision and marks
 * the petition answered). `expired` is a petition left a season unanswered.
 */
export function answerPlaguePetition(state: GameState, petition: PetitionRecord, response: PetitionResponse | "expired"): GameState {
  const plague = plagueOf(state);
  if (plague === undefined) return state;
  let next = withPlague(state, { ...plague, answers: { ...plague.answers, [petition.defId]: response } });
  const now = plagueOf(next)!;
  switch (petition.defId) {
    case VACANT_PRIEST_PETITION_ID: {
      if (now.curacy === undefined || now.curacy.filledTick !== undefined) return next;
      if (response === "accept") {
        // The monastery sends a priest (its stipend now); he comes at the season's start after next.
        next = charge(next, "church_fee", PLAGUE_BALANCE.monasteryStipend, [PARISH, { type: "claim", id: petition.id, detail: "monastery" }]);
        const comes = (Math.floor(state.tick / SEASON) + PLAGUE_BALANCE.monasterySeasons) * SEASON + SEASON;
        return withPlague(next, { ...plagueOf(next)!, curacy: { ...now.curacy, filledTick: comes, by: "monastery" } });
      }
      // A lay clerk reads the offices at once (and the bishop remembers it).
      return setCuracy(withPlague(next, { ...now, curacy: { ...now.curacy, filledTick: state.tick, by: "clerk" } }), false);
    }
    case CASH_RENT_PETITION_ID: {
      if (response !== "accept" || next.politics === undefined) return next;
      // The tenants hold for money: the lord's right to their week-work goes (a right line the townsfolk hold).
      return { ...next, politics: { ...next.politics, rights: [...next.politics.rights, { id: "commuted_rent", holder: "townsfolk", grantedTick: state.tick,
        petitionId: petition.id, stallFeePermille: 1000 }] } };
    }
    default:
      // PL-5 wages and PL-7 land act through the seasons and the ledger periods.
      return next;
  }
}

/** PL-5…PL-8 prediction (HL-3): the treasury after the answer, two seasons on. */
export function plagueDecisionForecast(state: GameState, defId: string, response: PetitionResponse): number {
  const treasury = treasuryBalance(state);
  switch (defId) {
    case VACANT_PRIEST_PETITION_ID:
      return response === "accept" ? treasury - PLAGUE_BALANCE.monasteryStipend : treasury;
    case WAGES_PETITION_ID: {
      if (response !== "accept") return treasury;
      const workers = state.buildings.reduce((sum, building) => sum + (building.kind === "house" ? 0 : Math.max(0, building.workers)), 0);
      // Two seasons hold about one ledger period (2,400 ticks).
      return treasury - Math.round(workers * PLAGUE_BALANCE.raisedWagePerWorker * 2 * SEASON / LEDGER_PERIOD_TICKS);
    }
    case LAND_REDISTRIBUTION_PETITION_ID:
      return response === "accept_with_price" ? treasury + 2 * PLAGUE_BALANCE.settlerHouseholds * PLAGUE_BALANCE.entryFine : treasury;
    case CASH_RENT_PETITION_ID: {
      // FIX-9: money rent brings the rent's quarter more (× 1.25); the week-work kept spares the upkeep's quarter
      // (× 0.75) — over the two seasons, about one ledger period, as the wages'.
      const share = 2 * SEASON / LEDGER_PERIOD_TICKS;
      if (response === "accept") return treasury + Math.round(periodRent(state) * (PLAGUE_BALANCE.cashRentPermille - 1000) / 1000 * share);
      const upkeep = upkeepCharges(state).reduce((sum, charge) => sum + charge.amount, 0) * 1000 / plagueUpkeepPermille(state);
      return treasury + Math.round(upkeep * (1000 - PLAGUE_BALANCE.labourServiceUpkeepPermille) / 1000 * share);
    }
    default:
      return treasury;
  }
}

/** PL-1 API `plagueForecast`: the sequence's steps and their state. */
export function plagueForecast(state: GameState): readonly PlagueStep[] {
  const plague = plagueOf(state);
  if (plague === undefined) return [];
  const at = (offset: number) => plague.eraTick + offset * SEASON;
  const arrival = at(arrivalSeasonOffset(state));
  const steps: [PlagueStep["id"], number, number][] = [
    ["rumour", at(PLAGUE_BALANCE.rumourSeason), at(arrivalSeasonOffset(state))],
    ["arrival", arrival, arrival + PLAGUE_BALANCE.arrivalSeasons * SEASON],
    ["wage_demand", arrival + PLAGUE_BALANCE.wageDemandAfterArrival * SEASON, arrival + (PLAGUE_BALANCE.wageDemandAfterArrival + 1) * SEASON],
    ["abandoned_fields", arrival + PLAGUE_BALANCE.arrivalSeasons * SEASON, arrival + (PLAGUE_BALANCE.arrivalSeasons + 1) * SEASON],
    ["ordinance", springOf(state, PLAGUE_BALANCE.ordinanceYear), springOf(state, PLAGUE_BALANCE.ordinanceYear) + SEASON],
    ["resettlement", springOf(state, PLAGUE_BALANCE.resettlementYear), plague.endedTick ?? Infinity],
    ["second", springOf(state, PLAGUE_BALANCE.secondYear), springOf(state, PLAGUE_BALANCE.secondYear) + PLAGUE_BALANCE.secondSeasons * SEASON],
    ["end", plague.endedTick ?? springOf(state, PLAGUE_BALANCE.chapterEndFromYear), (plague.endedTick ?? springOf(state, PLAGUE_BALANCE.chapterEndYear)) + 1],
  ];
  return steps.map(([id, tick, until]) => ({ id, tick, state: state.tick < tick ? "ahead" : state.tick < until ? "now" : "done" }));
}

/** PL-10: chapter 3 ends (campaign): from 1362 once the town has 70 % of its people back, by 1364 at the latest. */
function chapterThreeEnds(state: GameState, plague: PlagueState): boolean {
  if (plague.first === undefined || plague.endedTick !== undefined) return false;
  const year = yearOf(state, state.tick);
  if (plague.second !== undefined && plague.second.endTick === undefined) return false;
  if (year >= PLAGUE_BALANCE.chapterEndYear) return true;
  return year >= PLAGUE_BALANCE.chapterEndFromYear && state.population * 1000 >= plague.first.populationAtArrival * PLAGUE_BALANCE.resettledPermille;
}

/** PL-10 API: how the chapter's resettlement stands — the people now against those at the arrival, permille. */
export function plagueRecoveryPermille(state: Pick<GameState, "plague" | "population">): number | null {
  const first = state.plague?.first;
  if (first === undefined || first.populationAtArrival <= 0) return null;
  return Math.floor(state.population * 1000 / first.populationAtArrival);
}

/**
 * One tick of F3-A (a no-op except at season starts, death days and ledger period closes, and for a scenario without
 * the pestilence). `endChapter` writes chapter 3's end (the politics).
 */
export function advancePlague(state: GameState, endChapter: (state: GameState) => GameState): GameState {
  if (state.tick <= 0 || !plagueActive(state)) return state;
  let plague = plagueOf(state);
  const seasonStart = state.tick % SEASON === 0;
  if (plague === undefined) {
    if (!seasonStart || !(state.historicalEras ?? []).some(entry => entry.id === PLAGUE_ERA_ID)) return state;
    // PL-1: a town first seen in the collapse era after 1350 (an old save) has missed the pestilence.
    if (yearOf(state, state.tick) > PLAGUE_BALANCE.rumourLastYear) return state;
    return withPlague(state, { eraTick: state.tick, answers: {}, vacantHouseIds: [], resettled: 0, recovered: 0, fled: 0 });
  }
  if (plague.endedTick !== undefined) return state;
  let next = state;
  // PL-3: the death day (after the persons) leaves some houses empty.
  if (state.tick % SEASON === 1 && plague.first !== undefined) next = vacateEmptied(next);
  // PL-5: the raised wages, each ledger period (after the period's close).
  if (state.tick % LEDGER_PERIOD_TICKS === 0 && plague.answers[WAGES_PETITION_ID] === "accept") next = payWages(next);
  if (!seasonStart) return next;

  const offset = Math.round((state.tick - plague.eraTick) / SEASON);
  const year = yearOf(state, state.tick);
  // A petition left a season unanswered: the lord's silence answers it.
  for (const petition of next.politics?.petitions ?? []) {
    if (petition.response !== undefined || !(PLAGUE_PETITION_IDS as readonly string[]).includes(petition.defId)) continue;
    if (state.tick - petition.arrivedTick < SEASON) continue;
    next = answerPlaguePetition(next, petition, "expired");
    next = { ...next, politics: { ...next.politics!, petitions: next.politics!.petitions.map(entry => entry.id === petition.id
      ? { ...entry, response: "expired" as const, respondedTick: state.tick } : entry) } };
  }
  plague = plagueOf(next)!;
  // A pestilence whose seasons have passed ends (its last death day was the season before).
  for (const which of ["first", "second"] as const) {
    const pestilence = plague[which];
    const seasons = which === "first" ? PLAGUE_BALANCE.arrivalSeasons : PLAGUE_BALANCE.secondSeasons;
    if (pestilence !== undefined && pestilence.endTick === undefined && state.tick >= pestilence.arrivalTick + seasons * SEASON) {
      plague = { ...plague, [which]: { ...pestilence, endTick: state.tick } };
      next = withPlague(next, plague);
      if (which === "first") next = addPetition(next, LAND_REDISTRIBUTION_PETITION_ID, "townsfolk");
      plague = plagueOf(next)!;
    }
  }
  // PL-1 the rumour; PL-2 the arrival (and PL-6 the priest dies with the first dead).
  if (offset === PLAGUE_BALANCE.rumourSeason && plague.rumourTick === undefined) next = withPlague(next, { ...plague, rumourTick: state.tick });
  plague = plagueOf(next)!;
  if (offset === arrivalSeasonOffset(state) && plague.first === undefined) {
    const span = PLAGUE_BALANCE.deathPermilleMax - PLAGUE_BALANCE.deathPermilleMin + 1;
    const permille = PLAGUE_BALANCE.deathPermilleMin + hashSeed(state.seed, "plague:share") % span;
    next = withPlague(next, { ...plague, ...(plague.rumourTick === undefined ? { rumourTick: state.tick } : {}), first: newPestilence(next, permille),
      curacy: { vacantSince: state.tick } });
    next = addPetition(next, VACANT_PRIEST_PETITION_ID, "parish");
  }
  plague = plagueOf(next)!;
  if (plague.first === undefined) return next;
  const arrival = plague.first.arrivalTick;
  // PL-6: the seat stays empty until filled; a church built meanwhile has no priest either.
  if (plague.curacy !== undefined) {
    const filled = plague.curacy.filledTick !== undefined && state.tick >= plague.curacy.filledTick;
    next = setCuracy(next, !filled);
  }
  // PL-5: the wage demand; the Statute read in the spring of 1351 (the justices fine a lord who raised wages).
  if (state.tick === arrival + PLAGUE_BALANCE.wageDemandAfterArrival * SEASON) next = addPetition(next, WAGES_PETITION_ID, "labourers");
  plague = plagueOf(next)!;
  if (plague.ordinanceTick === undefined && state.tick >= springOf(state, PLAGUE_BALANCE.ordinanceYear)) {
    const raised = plague.answers[WAGES_PETITION_ID] === "accept";
    next = withPlague(next, { ...plague, ordinanceTick: state.tick, ...(raised ? { statuteFine: PLAGUE_BALANCE.statuteFine } : {}) });
    if (raised) next = charge(next, "statute_fine", PLAGUE_BALANCE.statuteFine, [{ type: "actor", id: "crown" }, { type: "claim", id: "statute_of_labourers", detail: "wages" }]);
  }
  plague = plagueOf(next)!;
  const wages = plague.answers[WAGES_PETITION_ID];
  if (wages === "refuse" || wages === "expired") next = flee(next, "plague:wage-flight", PLAGUE_BALANCE.wageFlightPermille);
  const services = plagueOf(next)!.answers[CASH_RENT_PETITION_ID];
  if (services === "refuse" || services === "expired") next = flee(next, "plague:service-flight", PLAGUE_BALANCE.serviceFlightPermille);
  // PL-3 the town's own recovery once the first pestilence has passed (none while one rages); PL-7 the resettlement.
  plague = plagueOf(next)!;
  const quiet = plague.first!.endTick !== undefined && !raging(plague.second, state.tick);
  if (quiet) next = recover(next);
  if (quiet && year >= PLAGUE_BALANCE.resettlementYear) next = resettle(next);
  // PL-8: the tenants ask to pay money for their services when the resettlement begins.
  if (state.tick === springOf(state, PLAGUE_BALANCE.resettlementYear)) next = addPetition(next, CASH_RENT_PETITION_ID, "townsfolk");
  // PL-9: the second pestilence, the spring of 1361.
  plague = plagueOf(next)!;
  if (plague.second === undefined && state.tick === springOf(state, PLAGUE_BALANCE.secondYear)) {
    next = withPlague(next, { ...plague, second: newPestilence(next, PLAGUE_BALANCE.secondDeathPermille) });
  }
  // PL-10: the end — the chapter's in the campaign (the sequence's in the sandbox); the empty plots go back to the ladder.
  plague = plagueOf(next)!;
  const campaignChapter = scenarioOf(next).mode === "campaign" ? next.politics?.chapter.number : undefined;
  if (chapterThreeEnds(next, plague)) {
    next = setCuracy(withPlague(next, { ...plague, endedTick: state.tick }), false);
    if (campaignChapter === CHAPTER_THREE.chapter) next = endChapter(next);
  }
  return next;
}
