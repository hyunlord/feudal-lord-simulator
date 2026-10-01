/**
 * FAIL-3 failure ladder, rungs 3 and 4 (spec docs/design/failure-ladder-campaign.md FL-3…FL-7), checked at each season's
 * start:
 * - Stage 3, decline: a town with a third of its houses derelict (FP-3 stage 2) or unpaid upkeep over four periods loses
 *   a right — the overlord takes it in custody for the arrears (breach-based suspension), the merchant elite seizes it
 *   for the dereliction (unilateral seizure) — and the lord's title is demoted.
 * - Recovery: once the cause has cleared, the right's holder offers it back (a `restore_right` petition, FL-6).
 * - Stage 4: a decline two years unbroken ends the house; a new one carries on with the town (no game over).
 * - FIX-5 (FL-13, FL-14): at every ladder sample, a town under 30 % of its chapter's starting population declines at
 *   once; an empty town declines, its house withdraws and the new house resettles the standing houses at once.
 */
import { PRESSURE_BALANCE } from "../content/balanceConfig";
import { RESTORE_RIGHT_PETITION_ID, type PetitionResponse } from "../content/chapterConfig";
import { LORDSHIP_BALANCE, SEIZURE_ORDER, SUSPENSION_ORDER } from "../content/lordshipConfig";
import { postLedgerEntries, treasuryBalance } from "../ledger/ledger";
import type { GameState } from "./engine.types";
import { houseLotArea } from "../geometry/buildingFootprint";
import { BUILDING_CONFIG_BY_KIND } from "../content/buildingConfig";
import { HOUSE_FOOD_INTERVAL, houseFoodRation } from "../content/houseFoodConfig";
import type { DeclineState, LordshipState } from "./lordship.types";
import { HOME_ESTATE_ID } from "../content/estateConfig";
import { houseChanged, PIECE_OF_RIGHT, restorePossession, takePossession } from "./estates";
import { lordHouseHeraldrySeed, lordHouseName, lordshipOf, rightHeld, rightPresent } from "./lordshipState";
import { HEIR_CANDIDATE_TAG, ageOf, currentYear, manorLord } from "./persons";
import { MANOR_HOUSEHOLD, type Person } from "./persons.types";
import type { PetitionRecord } from "./politics.types";

const SEASON = PRESSURE_BALANCE.seasonTicks;
const SAMPLE = PRESSURE_BALANCE.sampleTicks;
const YEAR = 4 * SEASON;
/** FIX-11: a lord under this age is in wardship. */
const WARDSHIP_AGE_YEARS = 21;

/** FL-3: the share of the houses (permille) standing derelict, or null for a town under `minHouses` houses. */
export function derelictPermille(state: Pick<GameState, "houses"> & Partial<Pick<GameState, "plague">>): number | null {
  if (state.houses.length < LORDSHIP_BALANCE.minHouses) return null;
  // F3-A (PL-3): a plot the pestilence emptied is the pestilence's loss, not the lord's neglect, until the chapter ends.
  const held = state.plague?.first !== undefined && state.plague.endedTick === undefined ? new Set(state.plague.vacantHouseIds) : null;
  return Math.floor(state.houses.filter(house => house.abandonedTick !== undefined && held?.has(house.buildingId) !== true).length * 1000 / state.houses.length);
}

/**
 * F3-A (PL-2): the lord's family is gone — none of the house's family is left and the pestilence took some of them (at
 * once, or a family it thinned dying out years on): the overlord grants the town to a new house (FL-7's change, with no
 * decline before it). A family gone without the pestilence is left as before (chapters 1–2 unchanged).
 */
export function lordFamilyExtinct(state: Pick<GameState, "persons" | "lordship" | "seed">): boolean {
  const tag = `lord-house:${lordshipOf(state).house.order}`;
  const persons = state.persons;
  if (persons === undefined || persons.people.some(person => person.tags.includes(tag))) return false;
  // FIX-11: heir candidates are pending succession — do not fire extinction while the heir petition is open.
  if (persons.people.some(person => person.tags.includes(HEIR_CANDIDATE_TAG))) return false;
  return persons.past.some(person => person.tags.includes(tag) && !person.alive && person.deathCause === "plague");
}

/** FIX-11: find the guardian for a minor lord (mother → adult blood kin → null = overlord wardship). */
function findWardshipGuardian(state: GameState, lord: Person, houseOrder: number): string | null {
  const year = currentYear(state);
  const manorPeople = (state.persons?.people ?? []).filter(p => p.householdId === MANOR_HOUSEHOLD);
  const houseTag = `lord-house:${houseOrder}`;
  const mother = manorPeople.find(p => p.sex === "female" && p.role === "spouse");
  if (mother !== undefined) return mother.id;
  const kin = manorPeople.find(p => p.tags.includes(houseTag) && p.id !== lord.id && ageOf(p, year) >= WARDSHIP_AGE_YEARS);
  if (kin !== undefined) return kin.id;
  return null;
}

/** FIX-11: begin wardship for a minor lord — sets guardianId in lordship state. */
export function beginWardship(state: GameState, tick: number, lord: Person): GameState {
  const lordship = lordshipOf(state);
  const guardianId = findWardshipGuardian(state, lord, lordship.house.order);
  return { ...state, lordship: { ...lordship, wardship: { guardianId, since: tick } } };
}

/** FL-3: the distinct ledger periods over which unpaid upkeep is still owed. */
export function arrearsPeriods(state: Pick<GameState, "money">): number {
  return new Set((state.money?.arrears ?? []).map(arrear => arrear.tick)).size;
}

/** FL-13: the town's people are fewer than 30 % of its chapter's starting population (none: FL-14). */
export function depopulated(state: Pick<GameState, "population" | "politics">): boolean {
  const start = state.politics?.chapter.populationStart ?? 0;
  return start > 0 && state.population * 1000 < start * LORDSHIP_BALANCE.depopulatedPermille;
}

/** FL-14: nobody lives in the town any more (a town that had people: its chapter started with some). */
export function townEmpty(state: Pick<GameState, "population" | "politics">): boolean {
  return state.population <= 0 && (state.politics?.chapter.populationStart ?? 0) > 0;
}

/** FL-3: why the town would decline now (arrears first; FL-13/FL-14 an emptied town), or null. */
export function declineCause(state: GameState): DeclineState["cause"] | null {
  if (arrearsPeriods(state) >= LORDSHIP_BALANCE.arrearsPeriods) return "arrears";
  const share = derelictPermille(state);
  if (share !== null && share >= LORDSHIP_BALANCE.derelictPermille) return "derelict";
  return townEmpty(state) ? "empty" : depopulated(state) ? "depopulated" : null;
}

/**
 * FL-4: stage 3 begins — the first right held in the path's order is lost, and the title is demoted. LM-E2 (ES-3): the
 * right's piece passes into the overlord's custody or the merchants' hands; the lord keeps its title.
 */
function enterDecline(state: GameState, lordship: LordshipState, cause: DeclineState["cause"]): GameState {
  // FL-13/FL-14: a town that cannot render its dues for want of people is taken in custody like one in arrears.
  const custody = cause !== "derelict";
  const by = custody ? "overlord" as const : "merchants" as const;
  const order = custody ? SUSPENSION_ORDER : SEIZURE_ORDER;
  const lost = order.find(id => rightPresent(state, id) && rightHeld(state, id)) ?? null;
  const { titleReturnsTick: _returns, ...rest } = lordship;
  const next = lost === null ? state : takePossession(state, HOME_ESTATE_ID, PIECE_OF_RIGHT[lost], by, cause === "arrears" ? "suspended" : "seized");
  return { ...next, lordship: { ...rest, titleDemoted: true, decline: { since: state.tick, cause, lost, by } } };
}

function openRestoration(state: GameState): PetitionRecord | undefined {
  return state.politics?.petitions.find(petition => petition.defId === RESTORE_RIGHT_PETITION_ID && petition.response === undefined);
}

/** FL-7: the house withdraws; a new one takes the town, its treasury halved, the merchants' grudge half forgotten. */
function changeHouse(state: GameState, lordship: LordshipState): GameState {
  const order = lordship.house.order + 1;
  const house = { order, name: lordHouseName(state.seed, order), heraldrySeed: lordHouseHeraldrySeed(state.seed, order), since: state.tick };
  const loss = Math.floor(Math.max(0, treasuryBalance(state)) * LORDSHIP_BALANCE.houseChangeTreasuryLossPermille / 1000);
  let next: GameState = state;
  if (loss > 0) {
    const posted = postLedgerEntries(state, [{ account: "cash", category: "house_change", amount: -loss,
      sourceRefs: [{ type: "actor", id: `lord_house:${lordship.house.order}`, detail: lordship.house.name }] }]);
    next = { ...next, treasuryCoin: posted.treasuryCoin, ledger: posted.ledger };
  }
  const politics = next.politics === undefined ? undefined : {
    ...next.politics,
    merchantGauge: Math.round((next.politics.merchantGauge + 50) / 2),
    petitions: next.politics.petitions.map(petition => petition.defId === RESTORE_RIGHT_PETITION_ID && petition.response === undefined
      ? { ...petition, response: "expired" as const, respondedTick: state.tick } : petition),
  };
  return {
    ...next,
    ...(politics === undefined ? {} : { politics }),
    lordship: { house, pastHouses: [...lordship.pastHouses, { ...lordship.house, until: state.tick }], titleDemoted: false, decline: null },
  };
}

/** FL-7 with LM-E2 (ES-6): the house changes, the rights it lost come back to the town's lord, its kin keeps a claim. */
function changeHouseAndEstate(state: GameState, lordship: LordshipState): GameState {
  return houseChanged(changeHouse(state, lordship), lordship.house.order);
}

/** One tick of FAIL-3 (a no-op except at season starts, and while a haggled title has not yet come back). */
export function advanceLordship(state: GameState): GameState {
  if (state.tick <= 0) return state;
  let lordship = lordshipOf(state);
  let next = state;
  // FL-13/FL-14: an emptied town does not wait for the season — it declines at the sample, and an empty one changes
  // its house and is resettled there and then (before the settlement's abandonment count can run out).
  if (state.tick % SAMPLE === 0 && (townEmpty(state) || (lordship.decline === null && depopulated(state)))) {
    if (lordship.decline === null) {
      next = enterDecline(next, lordship, townEmpty(state) ? "empty" : "depopulated");
      lordship = lordshipOf(next);
    }
    return townEmpty(next) ? resettleTown(changeHouseAndEstate(next, lordship)) : next;
  }
  // FL-6: a haggled restoration gives the title back a year later.
  if (lordship.titleReturnsTick !== undefined && state.tick >= lordship.titleReturnsTick) {
    const { titleReturnsTick: _returns, ...rest } = lordship;
    lordship = { ...rest, titleDemoted: lordship.decline !== null };
    next = { ...next, lordship };
  }
  if (state.tick % SEASON !== 0) return next;
  // F3-A (PL-2): the pestilence took the lord's whole family — a new house takes the town.
  if (lordFamilyExtinct(next)) return changeHouseAndEstate(next, lordship);
  // FIX-11: wardship — yearly check for minor lord start/end.
  if (state.tick % YEAR === 0) {
    const year = currentYear(next);
    const lord = manorLord(next.persons?.people ?? [], lordship.house.order, year);
    if (lord !== undefined && ageOf(lord, year) < WARDSHIP_AGE_YEARS && lordship.wardship === undefined) {
      lordship = { ...lordship, wardship: { guardianId: findWardshipGuardian(next, lord, lordship.house.order), since: state.tick } };
      next = { ...next, lordship };
    } else if (lord !== undefined && ageOf(lord, year) >= WARDSHIP_AGE_YEARS && lordship.wardship !== undefined) {
      const { wardship: _w, ...rest } = lordship;
      lordship = rest;
      next = { ...next, lordship };
    }
  }
  const decline = lordship.decline;
  if (decline === null) {
    const cause = declineCause(next);
    return cause === null ? next : enterDecline(next, lordship, cause);
  }
  // FL-7: two years unbroken.
  if (state.tick - decline.since >= LORDSHIP_BALANCE.houseChangeTicks) return changeHouseAndEstate(next, lordship);
  // FL-6: the cause cleared — the holder offers the right back (the merchants when nothing was lost).
  if (declineCause(next) === null && state.tick >= (decline.petitionFrom ?? 0) && next.politics !== undefined && openRestoration(next) === undefined) {
    const petition: PetitionRecord = { id: `${RESTORE_RIGHT_PETITION_ID}@${state.tick}`, defId: RESTORE_RIGHT_PETITION_ID,
      petitioner: decline.lost === null ? "merchants" : decline.by, arrivedTick: state.tick };
    next = { ...next, politics: { ...next.politics, petitions: [...next.politics.petitions, petition] } };
  }
  return next;
}

/**
 * FL-6: the lord's answer to a restoration petition (called by `respondToPetition`, which records the decision). A fee the
 * treasury cannot pay restores nothing; a refusal, or an unpaid fee, brings the petition back a year later.
 */
export function answerRestoration(state: GameState, petition: PetitionRecord, response: PetitionResponse): GameState {
  const lordship = lordshipOf(state);
  const decline = lordship.decline;
  if (decline === null) return state;
  const fee = response === "accept" ? LORDSHIP_BALANCE.restoreFee : response === "accept_with_price" ? LORDSHIP_BALANCE.restoreFeeHaggled : 0;
  if (response === "refuse" || treasuryBalance(state) < fee) {
    return { ...state, lordship: { ...lordship, decline: { ...decline, petitionFrom: state.tick + LORDSHIP_BALANCE.restoreRetryTicks } } };
  }
  const posted = postLedgerEntries(state, [{ account: "cash", category: "restoration_fee", amount: -fee,
    sourceRefs: [{ type: "right", id: decline.lost ?? "title", detail: `petition:${petition.id}` }, { type: "actor", id: petition.petitioner }] }]);
  const restored: LordshipState = {
    ...lordship,
    titleDemoted: response !== "accept",
    ...(response === "accept" ? {} : { titleReturnsTick: state.tick + LORDSHIP_BALANCE.titleReturnTicks }),
    decline: null,
  };
  // LM-E2 (ES-3): the holder hands the piece back — the lord's title never left.
  const back = decline.lost === null ? state : restorePossession(state, HOME_ESTATE_ID, PIECE_OF_RIGHT[decline.lost]);
  return { ...back, treasuryCoin: posted.treasuryCoin, ledger: posted.ledger, lordship: restored };
}

/**
 * FL-14: the new house brings settlers — one household in each standing house (not burnt). FIX-5b (decision FL16):
 * each household brings a season of bread at its ration, stored in the first working granary with room and the rest in
 * the households' own larders, and a meal's grace for the carts. A town that grows no food starves again after it.
 */
export function resettleTown(state: GameState): GameState {
  const lots = new Map(state.buildings.map(building => [building.id, building]));
  const settled = new Set<string>();
  let houses = state.houses.map(house => {
    if (house.burntTick !== undefined || house.residents > 0) return house;
    settled.add(house.buildingId);
    const { abandonedTick: _abandoned, leavingSinceTick: _leaving, foodShortSinceTick: _short, ...rest } = house;
    return { ...rest, residents: houseLotArea(lots.get(house.buildingId)), emptyFoodTicks: 0, starvationGraceUntilTick: state.tick + LORDSHIP_BALANCE.resettleGraceTicks };
  });
  const seasonOf = (house: typeof houses[number]) => Math.ceil(houseFoodRation(house) * LORDSHIP_BALANCE.resettleBreadTicks / HOUSE_FOOD_INTERVAL);
  const bread = houses.reduce((sum, house) => sum + (settled.has(house.buildingId) ? seasonOf(house) : 0), 0);
  const granary = state.buildings.filter(building => building.kind === "granary" && building.operationPaused !== true).sort((a, b) => a.id.localeCompare(b.id))
    .map(building => ({ building, room: BUILDING_CONFIG_BY_KIND.granary.storageCapacity - Object.values(building.inventory).reduce((sum, amount) => sum + (amount ?? 0), 0) }))
    .find(entry => entry.room > 0);
  const stored = Math.min(bread, granary?.room ?? 0);
  let left = bread - stored;
  if (left > 0) houses = houses.map(house => {
    if (!settled.has(house.buildingId) || left <= 0) return house;
    const share = Math.min(left, seasonOf(house));
    left -= share;
    return { ...house, breadStock: house.breadStock + share };
  });
  const buildings = stored <= 0 || granary === undefined ? state.buildings : state.buildings.map(building => building.id === granary.building.id
    ? { ...building, inventory: { ...building.inventory, bread: (building.inventory.bread ?? 0) + stored } } : building);
  return { ...state, houses, buildings, population: houses.reduce((sum, house) => sum + Math.max(0, house.residents), 0) };
}
