/**
 * C4 the ale chain (spec docs/design/ale-chain.md AL-1…AL-9):
 *
 * - AL-4 household brewing: every batch (the craft's `ticksPerBatch`), a house of level 1 or more with a woman among its
 *   adults brews ale in its first slot once the town has malt; she fetches one malt from a store in reach, and the batch
 *   turns it into ale in the slot's stock.
 * - AL-5 alehouses: a house of level 2 or more whose slot holds ale hangs out the ale-stake. At each season's start every
 *   house of level 2 or more drinks from the nearest alehouse in reach; the alehouse pays its dues on what it sold.
 * - AL-6 the requirement: from 1318 (chapter 2), a house rises to level 2 or more only with an alehouse in reach
 *   (a house already there does not fall for want of ale).
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

/** AL-5/AL-6: the households served by ale now — they drank this season or the last, or keep an alehouse with ale in it. */
export function aleServedHouses(state: Pick<GameState, "houses" | "tick">): ReadonlySet<string> {
  return new Set(state.houses.filter(house => (house.aleUntilTick ?? -1) >= state.tick
    || (isAlehouse(house) && (brewingSlot(house)?.stock.ale ?? 0) > 0)).map(house => house.buildingId));
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
    // She fetches a batch's malt from the nearest store in reach that has it.
    if ((slot.stock.malt ?? 0) < (craft.input.malt ?? 1) && home !== undefined) {
      const store = buildings.filter(building => MALT_STORES.has(building.kind) && (building.inventory.malt ?? 0) > 0
        && buildingFootprintDistance(home, building) <= ALE_BALANCE.maltReach)
        .sort((a, b) => buildingFootprintDistance(home, a) - buildingFootprintDistance(home, b) || a.id.localeCompare(b.id))[0];
      if (store !== undefined) {
        buildings[index.get(store.id)!] = { ...store, inventory: { ...store.inventory, malt: (store.inventory.malt ?? 0) - 1 } };
        slot = { ...slot, stock: { ...slot.stock, malt: (slot.stock.malt ?? 0) + 1 } };
      }
    }
    if ((slot.stock.malt ?? 0) >= (craft.input.malt ?? 1) && (slot.stock.ale ?? 0) < ALE_BALANCE.slotAleCap) {
      slot = { ...slot, stock: { ...slot.stock, malt: (slot.stock.malt ?? 0) - (craft.input.malt ?? 1),
        ale: Math.min(ALE_BALANCE.slotAleCap, (slot.stock.ale ?? 0) + (craft.output.ale ?? 1)) } };
    }
    if (slot !== house.crafts?.[0]) { house = withSlot(house, slot); changed = true; }
    return house;
  });
  if (!changed) return state;
  const order = new Map(state.houses.map((house, at) => [house.buildingId, at]));
  houses.sort((a, b) => order.get(a.buildingId)! - order.get(b.buildingId)!);
  if (buildings.every((building, at) => building === state.buildings[at])) buildings = state.buildings as Building[];
  return { ...state, houses, buildings };
}

/** AL-5: the season's drinking — each house of level 1+ from its nearest alehouse with ale; the alehouses' dues on their sales. */
function drinkSeason(state: GameState): GameState {
  const buildings = new Map(state.buildings.map(building => [building.id, building]));
  const houses = [...state.houses];
  const at = new Map(houses.map((house, index) => [house.buildingId, index]));
  const sold = new Map<string, number>();
  for (const house of [...state.houses].sort((a, b) => a.buildingId.localeCompare(b.buildingId))) {
    if (house.level < 1 || house.residents <= 0) continue;
    const home = buildings.get(house.buildingId);
    if (home === undefined) continue;
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
  }
  if (sold.size === 0) return state;
  const postings: LedgerPosting[] = [];
  for (const [id, casks] of [...sold.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const dues = Math.ceil(casks * ALE_BALANCE.alePrice * ALE_BALANCE.alehouseDuesPermille / 1000);
    if (dues > 0) postings.push({ account: "cash", category: "stall_fee", amount: dues, sourceRefs: [{ type: "building", id, detail: `alehouse:${casks}` }] });
  }
  const next = { ...state, houses };
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
  if (barn === undefined || barn.kind !== "farmstead" || (barn.crop ?? "wheat") === crop) return state;
  const { crop: _old, ...rest } = barn;
  const next: Building = crop === "wheat" ? rest : { ...rest, crop };
  return { ...state, buildings: state.buildings.map(building => building === barn ? next : building) };
}

/** One tick of C4 (a no-op except on the craft's batch ticks and the seasons' starts). */
export function advanceAle(state: GameState): GameState {
  if (state.tick <= 0) return state;
  let next = state;
  if (state.tick % brewCraft().ticksPerBatch === 0) next = brewBatch(next);
  if (state.tick % SEASON === 0) next = drinkSeason(next);
  return next;
}
