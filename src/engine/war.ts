/**
 * F2-A chapter 2's war (spec docs/design/chapter-two-war.md WR-1…WR-9). At each season start from the War era (1337):
 *
 * - WR-1 the royal messenger comes with the era (the rumour of what follows); the rest counts seasons from his.
 * - WR-2 the wool levy, WR-3 the commission of array, WR-4 the lay subsidy: the Crown's demands, answered as petitions
 *   (`answerWarPetition`, called by `respondToPetition`). A demand left a season unanswered is refused.
 * - WR-5 the beacon burns a season ahead, then the coastal raid burns and loots what the walls do not cover.
 * - WR-6 the refugees ask to settle; WR-7 the Crown's recovery: the purveyance licence and the murage offer
 *   (the wall or the market, WR-8). A refused royal demand costs the Crown's favour: no licence, no murage.
 * - WR-9 chapter 2 ends when the war has passed and the stone wall stands or the market was chosen, by 1348 at the latest.
 */
import type { SourceRef } from "../contracts";
import { CHAPTER_TWO, type PetitionResponse } from "../content/chapterConfig";
import {
  LEVY_RESPONSE_PETITION_ID,
  REFUGEE_ADMISSION_PETITION_ID,
  WALL_OR_MARKET_PETITION_ID,
  WAR_BALANCE,
  WAR_ERA_ID,
  WAR_FUNDING_PETITION_ID,
  WAR_PETITION_IDS,
  WAR_SEQUENCE_ID,
  WOOL_PAYMENT_PETITION_ID,
} from "../content/warConfig";
import { archetypeOf } from "../content/scenario/registry";
import { postLedgerEntries, treasuryBalance } from "../ledger/ledger";
import type { LedgerCategory, LedgerPosting } from "../ledger/ledger.types";
import { houseLotArea } from "../geometry/buildingFootprint";
import { palisadeProtectionForBuilding } from "../geometry/palisadeProtection";
import { houseCapacity } from "../population/housing";
import type { House } from "../population/population.types";
import type { GameState } from "./engine.types";
import { burntHouse } from "./fire";
import { marketSalePrice } from "./marketSettlement";
import { EMPTY_MONEY, type UpkeepArrear } from "./money.types";
import type { PetitionRecord } from "./politics.types";
import { hashSeed } from "./prng";
import { calendar, scenarioOf } from "./scenarioState";
import { abandonHouse } from "./seasonPressure";
import type { Conscripts, RaidLosses, WarState, WarStep } from "./war.types";

const SEASON = 1000;
const CROWN: SourceRef = { type: "actor", id: "crown" };

export function warOf(state: Pick<GameState, "war">): WarState | undefined {
  return state.war;
}

export function warActive(state: Pick<GameState, "scenarioId">): boolean {
  return scenarioOf(state).activeEvents.includes(WAR_SEQUENCE_ID);
}

/** WR-5: a town on the coast (its archetype) has the beacon and the raid. */
export function warCoastal(state: Pick<GameState, "scenarioId">): boolean {
  return archetypeOf(scenarioOf(state))?.coastal === true;
}

/** WR-5: the raid's season, counted from the messenger's (the seed picks among `raidSeasons`). */
export function raidSeasonOffset(state: Pick<GameState, "seed">): number {
  const options = WAR_BALANCE.raidSeasons;
  return options[hashSeed(state.seed, "war:raid") % options.length]!;
}

/** WR-7: the recovery's season from the messenger's (two after the raid; inland, the latest raid's). */
export function recoverySeasonOffset(state: Pick<GameState, "seed" | "scenarioId">): number {
  return warCoastal(state) ? raidSeasonOffset(state) + WAR_BALANCE.recoverySeasonsAfterRaid : WAR_BALANCE.inlandRecoverySeason;
}

function livedIn(state: Pick<GameState, "houses">): readonly House[] {
  return state.houses.filter(house => house.residents > 0 && house.abandonedTick === undefined);
}

/** WR-2: the wool levy (pennies): per lived-in house when it comes. */
export function woolLevyAmount(state: Pick<GameState, "houses">): number {
  return livedIn(state).length * WAR_BALANCE.woolLevyPerHouse;
}

/** WR-3: the men the commission of array asks for. */
export function levyMen(state: Pick<GameState, "houses">): number {
  return Math.max(WAR_BALANCE.minMen, Math.ceil(livedIn(state).length / WAR_BALANCE.housesPerMan));
}

/** WR-4: the lay subsidy (pennies). */
export function subsidyAmount(state: Pick<GameState, "houses">): number {
  return livedIn(state).length * WAR_BALANCE.subsidyPerHouse;
}

/** WR-3: the men away now (they do not work: `labourPool` leaves them out). */
export function conscriptsAway(state: Pick<GameState, "war">): number {
  const conscripts = state.war?.conscripts;
  return conscripts === undefined || conscripts.returned ? 0 : conscripts.men;
}

/**
 * Charges the treasury `amount` (cash, category); what the cash cannot cover goes to the arrears account and queue
 * (paid off at the period close like unpaid upkeep, and counted by the failure ladder's arrears, FL-3).
 */
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
  return { ...state, treasuryCoin: posted.treasuryCoin, ledger: posted.ledger,
    ...(owed > 0 ? { money: { ...money, arrears: [...money.arrears, arrear] } } : {}) };
}

function earn(state: GameState, category: LedgerCategory, amount: number, sources: readonly [SourceRef, ...SourceRef[]]): GameState {
  if (amount <= 0) return state;
  const posted = postLedgerEntries(state, [{ account: "cash", category, amount, sourceRefs: sources }]);
  return { ...state, treasuryCoin: posted.treasuryCoin, ledger: posted.ledger };
}

function withWar(state: GameState, war: WarState): GameState {
  return { ...state, war };
}

function addPetition(state: GameState, defId: string, petitioner: PetitionRecord["petitioner"]): GameState {
  if (state.politics === undefined) return state;
  const petition: PetitionRecord = { id: `${defId}@${state.tick}`, defId, petitioner, arrivedTick: state.tick };
  return { ...state, politics: { ...state.politics, petitions: [...state.politics.petitions, petition] } };
}

/** WR-5: a closed ring's defence, permille (stone 1,000 a segment, timber 600; a ring with a gap holds nothing). */
export function ringDefencePermille(state: Pick<GameState, "palisade">): number {
  const segments = state.palisade?.segments ?? [];
  if (segments.length === 0 || !segments.every(segment => segment.completed)) return 0;
  const held = segments.reduce((sum, segment) => sum + (segment.material === "stone" && segment.replacementConstructionSiteId == null
    ? WAR_BALANCE.stoneDefencePermille : WAR_BALANCE.timberDefencePermille), 0);
  return Math.floor(held / segments.length);
}

/**
 * WR-5: what a raid would take from the town now with a ring of `defencePermille` (the raid's rule; `raid` applies it).
 * Buildings outside the ring (or every building, with no ring) are wholly exposed; inside, (1,000 − defence) ‰.
 * Houses burn edge-first up to `raidHouses` × the town's exposure; each store loses its exposure × `raidLootPermille`
 * of every good; the treasury `raidTreasuryPermille` × exposure (at most `raidTreasuryMax`).
 */
export function raidLosses(state: GameState, defencePermille = ringDefencePermille(state)): RaidLosses & { readonly houseIds: readonly string[];
  readonly loot: readonly { readonly buildingId: string; readonly resource: string; readonly amount: number }[] } {
  const ring = state.palisade === null ? null : { polygon: state.palisade.polygon, segments: [{ completed: true }] };
  const exposure = (building: GameState["buildings"][number]) => ring === null || palisadeProtectionForBuilding(building, ring) !== "inside"
    ? 1000 : 1000 - defencePermille;
  const edge = (building: GameState["buildings"][number]) => Math.min(building.tx, building.ty, state.width - 1 - building.tx, state.height - 1 - building.ty);
  const buildings = new Map(state.buildings.map(building => [building.id, building]));
  const standing = state.houses.filter(house => house.burntTick === undefined && buildings.has(house.buildingId));
  const exposed = standing.map(house => ({ house, building: buildings.get(house.buildingId)!, exposure: exposure(buildings.get(house.buildingId)!) }));
  const townExposure = exposed.length === 0 ? 0 : exposed.reduce((sum, entry) => sum + entry.exposure, 0) / exposed.length;
  const count = Math.min(exposed.length, Math.round(WAR_BALANCE.raidHouses * townExposure / 1000));
  const houseIds = exposed.filter(entry => entry.exposure > 0)
    .sort((a, b) => b.exposure - a.exposure || edge(a.building) - edge(b.building) || a.house.buildingId.localeCompare(b.house.buildingId))
    .slice(0, count).map(entry => entry.house.buildingId);
  const loot: { buildingId: string; resource: string; amount: number }[] = [];
  for (const building of [...state.buildings].sort((a, b) => a.id.localeCompare(b.id))) {
    const share = exposure(building) * WAR_BALANCE.raidLootPermille;
    for (const [resource, stock] of Object.entries(building.inventory ?? {}).sort(([a], [b]) => a.localeCompare(b))) {
      const amount = Math.floor(Math.max(0, stock ?? 0) * share / 1_000_000);
      if (amount > 0) loot.push({ buildingId: building.id, resource, amount });
    }
  }
  const coin = Math.min(WAR_BALANCE.raidTreasuryMax, Math.floor(Math.max(0, treasuryBalance(state)) * WAR_BALANCE.raidTreasuryPermille * townExposure / 1_000_000));
  return { burntHouses: houseIds.length, looted: loot.reduce((sum, entry) => sum + entry.amount, 0), coin, houseIds, loot };
}

export function raidEventId(tick: number): string {
  return `coastal_raid@${Math.floor(tick / SEASON)}`;
}

function raid(state: GameState, war: WarState): GameState {
  const defencePermille = ringDefencePermille(state);
  const losses = raidLosses(state, defencePermille);
  const eventId = raidEventId(state.tick);
  const burnt = new Set(losses.houseIds);
  const taken = new Map<string, Record<string, number>>();
  for (const entry of losses.loot) taken.set(entry.buildingId, { ...(taken.get(entry.buildingId) ?? {}), [entry.resource]: entry.amount });
  let next: GameState = {
    ...state,
    houses: state.houses.map(house => burnt.has(house.buildingId) ? burntHouse(house, state.tick, eventId) : house),
    buildings: state.buildings.map(building => {
      const out = taken.get(building.id);
      if (out === undefined) return building;
      const inventory = { ...building.inventory } as Record<string, number>;
      for (const [resource, amount] of Object.entries(out)) inventory[resource] = (inventory[resource] ?? 0) - amount;
      return { ...building, inventory };
    }),
  };
  if (losses.coin > 0) {
    const posted = postLedgerEntries(next, [{ account: "cash", category: "raid_loot", amount: -losses.coin,
      sourceRefs: [{ type: "event", id: eventId, detail: "coastal_raid" }, { type: "actor", id: "raiders" }] }]);
    next = { ...next, treasuryCoin: posted.treasuryCoin, ledger: posted.ledger };
  }
  return withWar(next, { ...war, raid: { tick: state.tick, defencePermille, losses: { burntHouses: losses.burntHouses, looted: losses.looted, coin: losses.coin } } });
}

/** WR-3: the households the array takes a man from (two adults or more, seed order), and those who lose him. */
function conscriptsFor(state: GameState, men: number): Conscripts {
  const houses = livedIn(state).filter(house => (house.members?.adults ?? Math.ceil(house.residents / 2)) >= 2)
    .sort((a, b) => hashSeed(state.seed, "war:array", ...[...a.buildingId].map(c => c.charCodeAt(0))) - hashSeed(state.seed, "war:array", ...[...b.buildingId].map(c => c.charCodeAt(0)))
      || a.buildingId.localeCompare(b.buildingId));
  const taken = houses.slice(0, men).map(house => house.buildingId);
  const seasonStart = Math.ceil(state.tick / SEASON) * SEASON;
  return { men: taken.length, returnTick: seasonStart + WAR_BALANCE.awaySeasons * SEASON, houseIds: taken,
    lostHouseIds: taken.filter((_, index) => index % WAR_BALANCE.lostEvery === WAR_BALANCE.lostEvery - 1), returned: false };
}

/** WR-6 (bot): the people the town could take in now — a household in each empty home, and the homes' room. */
export function refugeeRoom(state: GameState): number {
  const lots = new Map(state.buildings.map(building => [building.id, building]));
  return state.houses.reduce((sum, house) => {
    if (house.burntTick !== undefined) return sum;
    const capacity = houseCapacity(house, houseLotArea(lots.get(house.buildingId)));
    if (house.abandonedTick !== undefined) return sum + Math.min(capacity, WAR_BALANCE.refugeesPerHousehold);
    return house.residents > 0 ? sum + Math.max(0, capacity - house.residents) : sum;
  }, 0);
}

/** WR-6: settles `people` refugees, households of four: first into empty (abandoned) homes, then into homes with room. */
function admitRefugees(state: GameState, people: number): { readonly state: GameState; readonly admitted: number } {
  let left = people;
  const lots = new Map(state.buildings.map(building => [building.id, building]));
  const houses = [...state.houses];
  const order = houses.map((house, index) => ({ house, index })).sort((a, b) => a.house.buildingId.localeCompare(b.house.buildingId));
  for (const { house, index } of order) {
    if (left <= 0) break;
    if (house.abandonedTick === undefined || house.burntTick !== undefined) continue;
    const room = Math.min(houseCapacity(house, houseLotArea(lots.get(house.buildingId))), WAR_BALANCE.refugeesPerHousehold, left);
    if (room <= 0) continue;
    const { abandonedTick: _abandoned, ...rest } = house;
    houses[index] = { ...rest, residents: room };
    left -= room;
  }
  for (const { index } of order) {
    if (left <= 0) break;
    const house = houses[index]!;
    if (house.abandonedTick !== undefined || house.burntTick !== undefined || house.residents <= 0) continue;
    const room = Math.min(houseCapacity(house, houseLotArea(lots.get(house.buildingId))) - house.residents, left);
    if (room <= 0) continue;
    houses[index] = { ...house, residents: house.residents + room };
    left -= room;
  }
  const admitted = people - left;
  return { state: admitted === 0 ? state : { ...state, houses, population: state.population + admitted }, admitted };
}

/**
 * WR-2…WR-8: the lord's answer to a war petition (called by `respondToPetition`, which records the decision and marks
 * the petition answered). `expired` is a demand left unanswered: it counts as a refusal.
 */
export function answerWarPetition(state: GameState, petition: PetitionRecord, response: PetitionResponse | "expired"): GameState {
  const war = warOf(state);
  if (war === undefined) return state;
  const refused = response === "refuse" || response === "expired";
  const source: readonly [SourceRef, ...SourceRef[]] = [CROWN, { type: "claim", id: petition.id, detail: petition.defId }];
  let next: GameState = withWar(state, { ...war, answers: { ...war.answers, [petition.defId]: response },
    ...(refused && petition.petitioner === "crown" ? { favour: false } : {}) });
  const now = warOf(next)!;
  switch (petition.defId) {
    case WOOL_PAYMENT_PETITION_ID: {
      const levy = woolLevyAmount(state);
      if (response === "accept") {
        const total = Math.ceil(levy * WAR_BALANCE.woolInKindPermille / 1000);
        return withWar(next, { ...now, instalments: [...now.instalments, { category: "wool_levy", perSeason: Math.ceil(total / WAR_BALANCE.woolInKindSeasons), seasonsLeft: WAR_BALANCE.woolInKindSeasons }] });
      }
      return charge(next, "wool_levy", response === "accept_with_price" ? levy : Math.ceil(levy * WAR_BALANCE.woolSeizedPermille / 1000), source);
    }
    case LEVY_RESPONSE_PETITION_ID: {
      const men = levyMen(state);
      if (response === "accept") return withWar(next, { ...now, conscripts: conscriptsFor(state, men) });
      if (response === "accept_with_price") return charge(next, "war_exemption", men * WAR_BALANCE.exemptionPerMan, source);
      return next;
    }
    case WAR_FUNDING_PETITION_ID: {
      const subsidy = subsidyAmount(state);
      if (response === "accept") {
        // The merchants lend the subsidy, the treasury hands it on, and repays it with interest over eight seasons.
        next = earn(next, "war_loan", subsidy, [{ type: "actor", id: "merchants" }, { type: "claim", id: petition.id, detail: "loan" }]);
        next = charge(next, "war_subsidy", subsidy, source);
        const total = Math.ceil(subsidy * (1000 + WAR_BALANCE.loanInterestPermille) / 1000);
        return withWar(next, { ...warOf(next)!, instalments: [...now.instalments, { category: "war_loan", perSeason: Math.ceil(total / WAR_BALANCE.loanSeasons), seasonsLeft: WAR_BALANCE.loanSeasons }] });
      }
      if (response === "accept_with_price") return withWar(charge(next, "war_subsidy", subsidy, source), { ...now, taxSeasonsLeft: WAR_BALANCE.taxSeasons });
      return next;
    }
    case REFUGEE_ADMISSION_PETITION_ID: {
      if (refused) return next;
      const households = response === "accept" ? WAR_BALANCE.refugeeHouseholds : Math.floor(WAR_BALANCE.refugeeHouseholds / 2);
      const admitted = admitRefugees(next, households * WAR_BALANCE.refugeesPerHousehold);
      next = admitted.state;
      if (response === "accept_with_price") {
        next = earn(next, "refugee_fee", Math.ceil(admitted.admitted / WAR_BALANCE.refugeesPerHousehold) * WAR_BALANCE.refugeeFeePerHousehold,
          [{ type: "actor", id: "refugees" }, { type: "claim", id: petition.id, detail: `people:${admitted.admitted}` }]);
      }
      return next;
    }
    case WALL_OR_MARKET_PETITION_ID:
      return withWar(next, { ...now, wall: refused ? "market" : response === "accept_with_price" && war.favour ? "murage" : "stone_wall" });
    default:
      return next;
  }
}

/** WR-2…WR-8 prediction (HL-3): the treasury after the answer, two seasons on, from the rules above. */
export function warDecisionForecast(state: GameState, defId: string, response: PetitionResponse): number {
  const treasury = treasuryBalance(state);
  switch (defId) {
    case WOOL_PAYMENT_PETITION_ID: {
      const levy = woolLevyAmount(state);
      return response === "accept" ? treasury - 2 * Math.ceil(Math.ceil(levy * WAR_BALANCE.woolInKindPermille / 1000) / WAR_BALANCE.woolInKindSeasons)
        : treasury - (response === "accept_with_price" ? levy : Math.ceil(levy * WAR_BALANCE.woolSeizedPermille / 1000));
    }
    case LEVY_RESPONSE_PETITION_ID:
      return response === "accept_with_price" ? treasury - levyMen(state) * WAR_BALANCE.exemptionPerMan : treasury;
    case WAR_FUNDING_PETITION_ID: {
      const subsidy = subsidyAmount(state);
      return response === "accept" ? treasury - 2 * Math.ceil(Math.ceil(subsidy * (1000 + WAR_BALANCE.loanInterestPermille) / 1000) / WAR_BALANCE.loanSeasons)
        : response === "accept_with_price" ? treasury - subsidy : treasury;
    }
    case REFUGEE_ADMISSION_PETITION_ID:
      return response === "accept_with_price" ? treasury + Math.floor(WAR_BALANCE.refugeeHouseholds / 2) * WAR_BALANCE.refugeeFeePerHousehold : treasury;
    default:
      return treasury;
  }
}

/** WR-9: the war has passed its recovery (the raid two seasons gone, or inland its time). */
export function warRecovered(state: Pick<GameState, "war" | "tick" | "seed" | "scenarioId">): boolean {
  const war = state.war;
  return war !== undefined && state.tick >= war.messengerTick + recoverySeasonOffset(state) * SEASON;
}

/** WR-1 API `warForecast`: the sequence's steps (ticks), ahead, now (this season) or done. */
export function warForecast(state: GameState): readonly WarStep[] {
  const war = warOf(state);
  if (war === undefined) return [];
  const at = (offset: number) => war.messengerTick + offset * SEASON;
  const raidOffset = raidSeasonOffset(state);
  const steps: [WarStep["id"], number][] = [["messenger", at(0)], ["wool_levy", at(WAR_BALANCE.woolLevySeason)], ["commission", at(WAR_BALANCE.levySeason)],
    ["subsidy", at(WAR_BALANCE.fundingSeason)]];
  if (warCoastal(state)) steps.push(["beacon", at(raidOffset - WAR_BALANCE.beaconSeasons)], ["raid", at(raidOffset)], ["refugees", at(raidOffset + WAR_BALANCE.refugeeSeasonsAfterRaid)]);
  steps.push(["recovery", at(recoverySeasonOffset(state))]);
  return steps.map(([id, tick]) => ({ id, tick, state: state.tick < tick ? "ahead" : state.tick < tick + SEASON ? "now" : "done" }));
}

/** WR-5: the beacon is lit (the season before the raid, until it comes). */
export function beaconLit(state: GameState): boolean {
  const war = warOf(state);
  if (war === undefined || !warCoastal(state) || war.raid !== undefined) return false;
  const raidTick = war.messengerTick + raidSeasonOffset(state) * SEASON;
  return state.tick >= raidTick - WAR_BALANCE.beaconSeasons * SEASON && state.tick < raidTick;
}

/** WR-8 (money rules): the tolls' multiplier while the murage stone wall is building, permille. */
export function murageTollPermille(state: Pick<GameState, "war" | "palisade">): number {
  if (state.war?.wall !== "murage") return 1000;
  const segments = state.palisade?.segments ?? [];
  const standing = segments.length > 0 && segments.every(segment => segment.completed && segment.material === "stone" && segment.replacementConstructionSiteId == null);
  return standing ? 1000 : WAR_BALANCE.murageTollPermille;
}

/** WR-8 (money rules): the market's dues multiplier once the market was chosen, permille. */
export function marketExpansionPermille(state: Pick<GameState, "war">): number {
  return state.war?.wall === "market" ? WAR_BALANCE.marketExpansionPermille : 1000;
}

/** WR-4 (money rules): the war tax's rent surcharge now, permille of the rent. */
export function warTaxPermille(state: Pick<GameState, "war">): number {
  return (state.war?.taxSeasonsLeft ?? 0) > 0 ? WAR_BALANCE.taxSurchargePermille : 0;
}

function seasonalCharges(state: GameState, war: WarState): GameState {
  let next = state;
  for (const instalment of war.instalments) {
    const source: readonly [SourceRef, ...SourceRef[]] = instalment.category === "war_loan"
      ? [{ type: "actor", id: "merchants" }, { type: "claim", id: "war_loan", detail: "repayment" }] : [CROWN, { type: "claim", id: "wool_levy", detail: "in_kind" }];
    next = charge(next, instalment.category, instalment.perSeason, source);
  }
  const instalments = war.instalments.map(entry => ({ ...entry, seasonsLeft: entry.seasonsLeft - 1 })).filter(entry => entry.seasonsLeft > 0);
  let current = { ...warOf(next)!, instalments };
  // WR-4: a season of the war tax may drive one household away (the poorest: lowest level, least bread, then id).
  if ((current.taxSeasonsLeft ?? 0) > 0) {
    if (hashSeed(state.seed, "war:tax-flight", state.tick) % 1000 < WAR_BALANCE.taxFlightPermille) {
      const leaving = livedIn(next).filter(house => house.burntTick === undefined)
        .sort((a, b) => a.level - b.level || a.breadStock - b.breadStock || a.buildingId.localeCompare(b.buildingId))[0];
      if (leaving !== undefined) {
        next = { ...next, population: next.population - leaving.residents,
          houses: next.houses.map(house => house === leaving ? abandonHouse(house, state.tick) : house) };
      }
    }
    current = { ...current, taxSeasonsLeft: current.taxSeasonsLeft! - 1 };
  }
  // WR-7: the purveyors buy their share of the granaries' wheat at the market price.
  if ((current.licenceSeasonsLeft ?? 0) > 0) {
    const price = marketSalePrice(next, "wheat");
    const postings: LedgerPosting[] = [];
    const sold = new Map<string, number>();
    for (const granary of next.buildings.filter(building => building.kind === "granary").sort((a, b) => a.id.localeCompare(b.id))) {
      const wheat = Math.floor(Math.max(0, granary.inventory.wheat ?? 0) * WAR_BALANCE.licenceWheatPermille / 1000);
      if (wheat <= 0) continue;
      sold.set(granary.id, wheat);
      postings.push({ account: "cash", category: "purveyance", amount: wheat * price, sourceRefs: [CROWN, { type: "building", id: granary.id, detail: `wheat:${wheat}` }] });
    }
    if (postings.length > 0) {
      const posted = postLedgerEntries(next, postings);
      next = { ...next, treasuryCoin: posted.treasuryCoin, ledger: posted.ledger, buildings: next.buildings.map(building => {
        const wheat = sold.get(building.id);
        return wheat === undefined ? building : { ...building, inventory: { ...building.inventory, wheat: (building.inventory.wheat ?? 0) - wheat } };
      }) };
    }
    current = { ...current, licenceSeasonsLeft: current.licenceSeasonsLeft! - 1 };
  }
  return withWar(next, current);
}

/** WR-3: the men come home; one in five does not, and his household is one smaller. */
function conscriptsReturn(state: GameState, war: WarState): GameState {
  const conscripts = war.conscripts!;
  const lost = new Set(conscripts.lostHouseIds);
  let population = state.population;
  const houses = state.houses.map(house => {
    if (!lost.has(house.buildingId) || house.residents <= 0) return house;
    population -= 1;
    return { ...house, residents: house.residents - 1 };
  });
  return withWar({ ...state, houses, population }, { ...war, conscripts: { ...conscripts, returned: true } });
}

/** WR-9: chapter 2 ends (campaign): the war passed and the stone wall stands or the market was chosen, or it is 1348. */
function chapterTwoEnds(state: GameState, war: WarState): boolean {
  if (scenarioOf(state).mode !== "campaign" || state.politics?.chapter.number !== CHAPTER_TWO.chapter) return false;
  if (state.politics.chapterEnds.some(end => end.chapter === CHAPTER_TWO.chapter)) return false;
  if (calendar(state.tick, scenarioOf(state).startYear).year >= WAR_BALANCE.chapterEndYear) return true;
  if (!warRecovered(state)) return false;
  const segments = state.palisade?.segments ?? [];
  const stone = segments.length > 0 && segments.every(segment => segment.completed && segment.material === "stone" && segment.replacementConstructionSiteId == null);
  return war.wall === "market" || (war.wall !== undefined && stone);
}

/** WR-9: the wall's outcome the chapter ended with. */
export function chapterTwoWallOutcome(state: Pick<GameState, "war" | "palisade">): "stone_wall" | "market" | "unfinished" {
  if (state.war?.wall === "market") return "market";
  const segments = state.palisade?.segments ?? [];
  return segments.length > 0 && segments.every(segment => segment.completed && segment.material === "stone" && segment.replacementConstructionSiteId == null) ? "stone_wall" : "unfinished";
}

/** One tick of F2-A (a no-op except at season starts, and for a scenario without the war). */
export function advanceWar(state: GameState, endChapter: (state: GameState) => GameState): GameState {
  if (state.tick <= 0 || state.tick % SEASON !== 0 || !warActive(state)) return state;
  let war = warOf(state);
  if (war === undefined) {
    // WR-1: the messenger comes with the War era.
    if (!(state.historicalEras ?? []).some(entry => entry.id === WAR_ERA_ID)) return state;
    if (calendar(state.tick, scenarioOf(state).startYear).year > WAR_BALANCE.messengerLastYear) return state;
    return withWar(state, { messengerTick: state.tick, favour: true, answers: {}, instalments: [] });
  }
  let next: GameState = state;
  const offset = Math.round((state.tick - war.messengerTick) / SEASON);
  const coastal = warCoastal(state);
  const raidOffset = raidSeasonOffset(state);
  // A demand left a season unanswered is refused.
  for (const petition of state.politics?.petitions ?? []) {
    if (petition.response !== undefined || !(WAR_PETITION_IDS as readonly string[]).includes(petition.defId)) continue;
    if (state.tick - petition.arrivedTick < WAR_BALANCE.answerSeasons * SEASON) continue;
    next = answerWarPetition(next, petition, "expired");
    next = { ...next, politics: { ...next.politics!, petitions: next.politics!.petitions.map(entry => entry.id === petition.id
      ? { ...entry, response: "expired" as const, respondedTick: state.tick } : entry) } };
  }
  war = warOf(next)!;
  if (war.conscripts !== undefined && !war.conscripts.returned && state.tick >= war.conscripts.returnTick) next = conscriptsReturn(next, war);
  next = seasonalCharges(next, warOf(next)!);
  if (offset === WAR_BALANCE.woolLevySeason) next = addPetition(next, WOOL_PAYMENT_PETITION_ID, "crown");
  if (offset === WAR_BALANCE.levySeason) next = addPetition(next, LEVY_RESPONSE_PETITION_ID, "crown");
  if (offset === WAR_BALANCE.fundingSeason) next = addPetition(next, WAR_FUNDING_PETITION_ID, "crown");
  if (coastal && offset === raidOffset) next = raid(next, warOf(next)!);
  if (coastal && offset === raidOffset + WAR_BALANCE.refugeeSeasonsAfterRaid) next = addPetition(next, REFUGEE_ADMISSION_PETITION_ID, "refugees");
  if (offset === recoverySeasonOffset(state)) {
    const current = warOf(next)!;
    if (current.favour) next = withWar(next, { ...current, licenceSeasonsLeft: WAR_BALANCE.licenceSeasons });
    next = addPetition(next, WALL_OR_MARKET_PETITION_ID, "townsfolk");
  }
  return chapterTwoEnds(next, warOf(next)!) ? endChapter(next) : next;
}
