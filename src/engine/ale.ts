/**
 * C4 the ale chain (spec docs/design/ale-chain.md AL-1…AL-9):
 *
 * - AL-4 household brewing: every batch (the craft's `ticksPerBatch`), a house of level 1 or more with a woman among its
 *   adults brews ale in its first slot once the town has malt; she fetches one malt from the nearest of the town's stores
 *   that holds it (bought as from the maltster: no reach, decision AL9), and the batch turns it into ale in the slot.
 * - AL-5 alehouses: a brewing house of level 2 or more hangs out the ale-stake. At each season's start every house of
 *   level 1 or more drinks a cask, its own brew first, else from the nearest alehouse in reach with ale; the alehouse
 *   pays its dues on what it sold.
 * - AL-6 the requirement: from 1318 (chapter 2), a house rises to level 2 or more only when served by ale (it drank
 *   within two seasons, or its own slot holds ale); a house already there does not fall for want of ale.
 * - AL-10 (FIX-7) the town's ale on the ledger: `townAle` sums the slots' casks and the season's brewing and drinking
 *   (counted in `state.ale`, save v25); AL-2 (FIX-7) barley waits for the malt kiln (`farmsteadCropLock`).
 */
import { ALE_BALANCE } from "../content/aleConfig";
import { PRESSURE_BALANCE } from "../content/balanceConfig";
import { CHAPTER_TWO } from "../content/chapterConfig";
import { craftDefinition } from "../population/householdSlots";
import type { House, HouseholdSlot } from "../population/population.types";
import { buildingFootprintDistance } from "../geometry/buildingDistance";
import { postLedgerEntries } from "../ledger/ledger";
import type { LedgerPosting } from "../ledger/ledger.types";
import type { Building, FieldCrop } from "../content/buildingConfig";
import { buildingUnlockStage, isBuildingUnlocked } from "../world/placement";
import { ALE_COPY } from "../content/aleCopy.ko";
import type { AleSeasonCount, AleState } from "./ale.types";
import type { GameState } from "./engine.types";
import { ageOf, currentYear } from "./persons";
import { scenarioOf } from "./scenarioState";

export const BREW_ALE_CRAFT_ID = "brew_ale";
const SEASON = PRESSURE_BALANCE.seasonTicks;
const MALT_STORES = new Set(["granary", "storehouse", "malt_kiln"]);

function brewCraft() {
  const craft = craftDefinition(BREW_ALE_CRAFT_ID);
  if (craft === null) throw new Error("brew_ale craft missing");
  return craft;
}

/** AL-4: the household's first slot, when it brews. */
export function brewingSlot(house: Pick<House, "crafts">): HouseholdSlot | null {
  const slot = house.crafts?.[0];
  return slot?.craftId === BREW_ALE_CRAFT_ID ? slot : null;
}

/** AL-4: a woman of fourteen or more lives in the house (every house counts before persons are known). */
function hasBrewster(state: GameState, house: House): boolean {
  if (state.persons === undefined) return true;
  const year = currentYear(state);
  return state.persons.people.some(person => person.householdId === house.buildingId && person.sex === "female" && ageOf(person, year) >= 14);
}

/** AL-5: the house hangs out the ale-stake (level 2 or more, brewing: the stake stays up while she brews, sold out or not). */
export function isAlehouse(house: House): boolean {
  return house.level >= ALE_BALANCE.alehouseMinLevel && house.residents > 0 && house.burntTick === undefined && brewingSlot(house) !== null;
}

/** AL-5 API: the town's alehouses (house ids, by id). */
export function alehouses(state: Pick<GameState, "houses">): readonly string[] {
  return state.houses.filter(isAlehouse).map(house => house.buildingId).sort();
}

/**
 * AL-6: a house needs an alehouse in reach to rise to level 2+ — in the campaign from chapter 2 (chapter 1 may brew, it
 * need not, however long its famine keeps it past 1318), in the sandbox from 1318.
 */
export function aleRequired(state: Pick<GameState, "tick" | "scenarioId" | "politics">): boolean {
  if (scenarioOf(state).mode === "campaign") return (state.politics?.chapter.number ?? 1) >= CHAPTER_TWO.chapter;
  return currentYear(state) >= ALE_BALANCE.requiredFromYear;
}

/** AL-5/AL-6: the households served by ale now — they drank this season or the last, or their own slot holds ale. */
export function aleServedHouses(state: Pick<GameState, "houses" | "tick">): ReadonlySet<string> {
  return new Set(state.houses.filter(house => (house.aleUntilTick ?? -1) >= state.tick
    || (brewingSlot(house)?.stock.ale ?? 0) > 0).map(house => house.buildingId));
}

function withSlot(house: House, slot: HouseholdSlot): House {
  const crafts = [...(house.crafts ?? [])];
  crafts[0] = slot;
  return { ...house, crafts };
}

/** AL-4: one batch across the town — the slots taken up, malt fetched, ale brewed. */
function brewBatch(state: GameState): GameState {
  const craft = brewCraft();
  const maltHeld = state.buildings.some(building => MALT_STORES.has(building.kind) && (building.inventory.malt ?? 0) > 0);
  const hasKiln = state.buildings.some(building => building.kind === "malt_kiln");
  if (!maltHeld && !hasKiln && !state.houses.some(house => brewingSlot(house) !== null)) return state;
  const byId = new Map(state.buildings.map(building => [building.id, building]));
  let buildings = [...state.buildings];
  const index = new Map(buildings.map((building, at) => [building.id, at]));
  let changed = false;
  let brewed = 0;
  let maltUsed = 0;
  // The higher houses (the alehouses) fetch first when the malt is short.
  const houses = [...state.houses].sort((a, b) => b.level - a.level || a.buildingId.localeCompare(b.buildingId)).map(original => {
    let house = original;
    if (house.residents <= 0 || house.burntTick !== undefined || house.abandonedTick !== undefined || house.level < Math.min(...craft.levels)) return house;
    let slot = brewingSlot(house);
    if (slot === null) {
      if (house.crafts?.[0]?.craftId != null || (!maltHeld && !hasKiln) || !hasBrewster(state, house)) return house;
      slot = { craftId: craft.id, workers: craft.workers, input: { ...craft.input }, output: { ...craft.output }, stock: {} };
    }
    const home = byId.get(house.buildingId);
    // She fetches a batch's malt from the nearest of the town's stores that has it (decision AL9: run 3's kilns carted
    // their malt to granaries 14–30 tiles from the nearest house, where a reach of 12 left every slot dry).
    if ((slot.stock.malt ?? 0) < (craft.input.malt ?? 1) && home !== undefined) {
      const store = buildings.filter(building => MALT_STORES.has(building.kind) && (building.inventory.malt ?? 0) > 0)
        .sort((a, b) => buildingFootprintDistance(home, a) - buildingFootprintDistance(home, b) || a.id.localeCompare(b.id))[0];
      if (store !== undefined) {
        buildings[index.get(store.id)!] = { ...store, inventory: { ...store.inventory, malt: (store.inventory.malt ?? 0) - 1 } };
        slot = { ...slot, stock: { ...slot.stock, malt: (slot.stock.malt ?? 0) + 1 } };
      }
    }
    if ((slot.stock.malt ?? 0) >= (craft.input.malt ?? 1) && (slot.stock.ale ?? 0) < ALE_BALANCE.slotAleCap) {
      const ale = Math.min(ALE_BALANCE.slotAleCap, (slot.stock.ale ?? 0) + (craft.output.ale ?? 1));
      brewed += ale - (slot.stock.ale ?? 0);
      maltUsed += craft.input.malt ?? 1;
      slot = { ...slot, stock: { ...slot.stock, malt: (slot.stock.malt ?? 0) - (craft.input.malt ?? 1), ale } };
    }
    if (slot !== house.crafts?.[0]) { house = withSlot(house, slot); changed = true; }
    return house;
  });
  if (!changed) return state;
  const order = new Map(state.houses.map((house, at) => [house.buildingId, at]));
  houses.sort((a, b) => order.get(a.buildingId)! - order.get(b.buildingId)!);
  if (buildings.every((building, at) => building === state.buildings[at])) buildings = state.buildings as Building[];
  return counted({ ...state, houses, buildings }, { brewed, maltUsed });
}

/**
 * AL-5: the season's drinking — each house of level 1+ drinks its own brew first (decision AL9: a level-1 brewer with a
 * full slot went dry when the alehouses did), else from its nearest alehouse with ale; the alehouses' dues on their sales.
 */
function drinkSeason(state: GameState): GameState {
  const buildings = new Map(state.buildings.map(building => [building.id, building]));
  const houses = [...state.houses];
  const at = new Map(houses.map((house, index) => [house.buildingId, index]));
  const sold = new Map<string, number>();
  let drunk = 0;
  for (const house of [...state.houses].sort((a, b) => a.buildingId.localeCompare(b.buildingId))) {
    if (house.level < 1 || house.residents <= 0) continue;
    const home = buildings.get(house.buildingId);
    if (home === undefined) continue;
    const own = houses[at.get(house.buildingId)!]!;
    const ownSlot = brewingSlot(own);
    if (ownSlot !== null && (ownSlot.stock.ale ?? 0) >= ALE_BALANCE.alePerHouseSeason) {
      houses[at.get(house.buildingId)!] = { ...withSlot(own, { ...ownSlot, stock: { ...ownSlot.stock, ale: (ownSlot.stock.ale ?? 0) - ALE_BALANCE.alePerHouseSeason } }),
        aleUntilTick: state.tick + ALE_BALANCE.aleServedTicks };
      drunk += ALE_BALANCE.alePerHouseSeason;
      continue;
    }
    const stake = houses.filter(entry => isAlehouse(entry) && (brewingSlot(entry)?.stock.ale ?? 0) > 0 && buildings.has(entry.buildingId)
      && buildingFootprintDistance(home, buildings.get(entry.buildingId)!) <= ALE_BALANCE.alehouseReach)
      .sort((a, b) => buildingFootprintDistance(home, buildings.get(a.buildingId)!) - buildingFootprintDistance(home, buildings.get(b.buildingId)!)
        || a.buildingId.localeCompare(b.buildingId))[0];
    if (stake === undefined) continue;
    const slot = brewingSlot(stake)!;
    const drink = Math.min(ALE_BALANCE.alePerHouseSeason, slot.stock.ale ?? 0);
    if (drink <= 0) continue;
    houses[at.get(stake.buildingId)!] = withSlot(stake, { ...slot, stock: { ...slot.stock, ale: (slot.stock.ale ?? 0) - drink } });
    const drinker = houses[at.get(house.buildingId)!]!;
    houses[at.get(house.buildingId)!] = { ...drinker, aleUntilTick: state.tick + ALE_BALANCE.aleServedTicks };
    sold.set(stake.buildingId, (sold.get(stake.buildingId) ?? 0) + drink);
    drunk += drink;
  }
  const next = counted({ ...state, houses }, { drunk, sold: [...sold.values()].reduce((sum, casks) => sum + casks, 0) });
  if (sold.size === 0) return next;
  const postings: LedgerPosting[] = [];
  for (const [id, casks] of [...sold.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const dues = Math.ceil(casks * ALE_BALANCE.alePrice * ALE_BALANCE.alehouseDuesPermille / 1000);
    if (dues > 0) postings.push({ account: "cash", category: "stall_fee", amount: dues, sourceRefs: [{ type: "building", id, detail: `alehouse:${casks}` }] });
  }
  if (postings.length === 0) return next;
  const posted = postLedgerEntries(next, postings);
  return { ...next, treasuryCoin: posted.treasuryCoin, ledger: posted.ledger };
}

/**
 * AL-2 game command `set_farmstead_crop`: the crop a farmstead sows from now on (the player's barn card and the bot use
 * it alike). Strips already sown keep their crop; the barn carts out what it holds of the other.
 */
export function setFarmsteadCrop(state: GameState, barnId: string, crop: FieldCrop): GameState {
  const barn = state.buildings.find(building => building.id === barnId);
  if (barn === undefined || barn.kind !== "farmstead" || (barn.crop ?? "wheat") === crop || farmsteadCropLock(state, crop) !== null) return state;
  const { crop: _old, ...rest } = barn;
  const next: Building = crop === "wheat" ? rest : { ...rest, crop };
  return { ...state, buildings: state.buildings.map(building => building === barn ? next : building) };
}

/** Why the barn cannot be set to `crop` now (the reason's code and the player's line), or null when it can. */
export interface FarmsteadCropLock {
  readonly code: "kiln_locked";
  /** The settlement stage that unlocks the malt kiln (and with it the barley). */
  readonly unlockStage: string;
  readonly reason: string;
}

/**
 * AL-2 (FIX-7, decision FX7-3): barley waits for the malt kiln — while the kiln is locked (before the market town, the
 * unlock of SC-5) the command turns no barn to barley and says why; wheat is always allowed. A barn already in barley
 * (an older save) keeps it: the lock is on the command, not on the barn.
 */
export function farmsteadCropLock(state: Pick<GameState, "era" | "scenarioId">, crop: FieldCrop): FarmsteadCropLock | null {
  if (crop !== "barley" || isBuildingUnlocked("malt_kiln", state.era, state.scenarioId)) return null;
  return { code: "kiln_locked", unlockStage: buildingUnlockStage("malt_kiln", state.scenarioId), reason: ALE_COPY.barleyLocked };
}

const NO_ALE: AleSeasonCount = { startTick: 0, brewed: 0, maltUsed: 0, drunk: 0, sold: 0 };

/** AL-10: adds to the season's count (the count opens at the first brew or drink: a town without ale has no `ale`). */
function counted(state: GameState, add: Partial<Omit<AleSeasonCount, "startTick">>): GameState {
  if (Object.values(add).every(value => value === 0)) return state;
  const current = state.ale?.current ?? { ...NO_ALE, startTick: Math.floor(state.tick / SEASON) * SEASON };
  const next: AleSeasonCount = { startTick: current.startTick, brewed: current.brewed + (add.brewed ?? 0), maltUsed: current.maltUsed + (add.maltUsed ?? 0),
    drunk: current.drunk + (add.drunk ?? 0), sold: current.sold + (add.sold ?? 0) };
  return { ...state, ale: { ...state.ale, current: next } };
}

/** AL-10: at a season's start the count so far becomes the last season's and a new one opens (before the drinking). */
function closeAleSeason(state: GameState): GameState {
  const ale = state.ale;
  if (ale === undefined || ale.current.startTick >= state.tick) return state;
  const closed: AleState = { current: { ...NO_ALE, startTick: state.tick }, last: ale.current };
  return { ...state, ale: closed };
}

/** AL-10 API: the town's ale — its casks, where they are, and the season's brewing and drinking. */
export interface TownAle {
  /** Casks in the households' brewing slots (and any in a store). */
  readonly stock: number;
  /** Of those, the casks in the alehouses (what the town can buy). */
  readonly inAlehouses: number;
  readonly brewingHouses: number;
  readonly alehouses: number;
  /** Houses served by ale now (`aleServedHouses`) of the houses that drink (level 1 or more, lived in). */
  readonly servedHouses: number;
  readonly drinkingHouses: number;
  /** A season's drink for the drinking houses (what the town needs a season). */
  readonly seasonNeed: number;
  /** This season so far (from its start), and the last closed season (null before a season with ale has closed). */
  readonly season: AleSeasonCount;
  readonly lastSeason: AleSeasonCount | null;
}

const townAleCache = new WeakMap<GameState, TownAle>();

/** AL-10 API: the whole town's ale for the ledger drawer, the stores and the season's settlement (cached per state). */
export function townAle(state: GameState): TownAle {
  const cached = townAleCache.get(state);
  if (cached !== undefined) return cached;
  let stock = 0;
  let inAlehouses = 0;
  let brewingHouses = 0;
  for (const house of state.houses) {
    const casks = brewingSlot(house)?.stock.ale ?? 0;
    if (brewingSlot(house) !== null && house.residents > 0) brewingHouses += 1;
    stock += casks;
    if (isAlehouse(house)) inAlehouses += casks;
  }
  for (const building of state.buildings) stock += Math.max(0, building.inventory.ale ?? 0);
  const drinking = state.houses.filter(house => house.level >= 1 && house.residents > 0);
  const served = aleServedHouses(state);
  const seasonStart = Math.floor(state.tick / SEASON) * SEASON;
  const current = state.ale?.current;
  const season = current !== undefined && current.startTick === seasonStart ? current : { ...NO_ALE, startTick: seasonStart };
  // A count left open from an earlier season (no ale since) is that season's, the last one only if it just closed.
  const lastSeason = current !== undefined && current.startTick < seasonStart ? (current.startTick === seasonStart - SEASON ? current : null) : state.ale?.last ?? null;
  const result: TownAle = { stock, inAlehouses, brewingHouses, alehouses: state.houses.filter(isAlehouse).length,
    servedHouses: drinking.filter(house => served.has(house.buildingId)).length, drinkingHouses: drinking.length,
    seasonNeed: drinking.length * ALE_BALANCE.alePerHouseSeason, season, lastSeason };
  townAleCache.set(state, result);
  return result;
}

/** One tick of C4 (a no-op except on the craft's batch ticks and the seasons' starts). */
export function advanceAle(state: GameState): GameState {
  if (state.tick <= 0) return state;
  let next = state;
  if (state.tick % SEASON === 0) next = closeAleSeason(next);
  if (state.tick % brewCraft().ticksPerBatch === 0) next = brewBatch(next);
  if (state.tick % SEASON === 0) next = drinkSeason(next);
  return next;
}
