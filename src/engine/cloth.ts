/**
 * C5 the cloth chain (spec docs/design/cloth-chain.md CL-1…CL-10):
 *
 * - CL-1/CL-2 the pasture: each pasture cell carries two sheep; the nearest pastoral farm within reach tends it
 *   (`pastureTending`). At the shearing (early summer) each farm shears its flocks — a fleece a sheep, as far as its
 *   shepherds are staffed — into its yard, and its carter takes the fleece to the storehouses.
 * - CL-3 the shepherds: a pastoral farm's cells ask a twentieth of the hands a field's do (`pastoralFieldNeed`, the
 *   labour rule's field-hand tier).
 * - CL-4 spinning: every batch a house of level 3 or more with a woman takes up spinning in its second slot once the town
 *   has fleece; she fetches a fleece from the nearest store that holds it, spins a skein and takes it to the nearest
 *   storehouse with room (the process errand of LB-8).
 * - CL-5…CL-7 the weaver's house, the fulling mill (by the water; its toll the lord's), the dyehouse (by the water; dyes
 *   the merchants bring each season), the tenter yard: production buildings (`buildingConfig.ts`).
 * - CL-8 the market sells the finished cloth to the long-distance merchants; the aulnager's seal is the treasury's.
 */
import { BALANCE, PRESSURE_BALANCE } from "../content/balanceConfig";
import { BUILDING_CONFIG_BY_KIND, operationSuspended, type Building } from "../content/buildingConfig";
import { CLOTH_BALANCE } from "../content/clothConfig";
import { REORGANISATION_BALANCE } from "../content/reorganisationConfig";
import { buildingFootprintDistance } from "../geometry/buildingDistance";
import { postLedgerEntries } from "../ledger/ledger";
import type { LedgerPosting } from "../ledger/ledger.types";
import { craftDefinition } from "../population/householdSlots";
import type { House, HouseholdSlot } from "../population/population.types";
import { zonesOf } from "../zones/zoneEdits";
import type { GameState } from "./engine.types";
import { archetypeRules, scaleByPermille } from "./archetype";
import { laborSeason } from "./labourDemand";
import { ageOf, currentYear } from "./persons";

export const SPIN_YARN_CRAFT_ID = "spin_yarn";
const SEASON = PRESSURE_BALANCE.seasonTicks;
const YEAR = BALANCE.TICKS_PER_YEAR;
const FLEECE_STORES = new Set(["storehouse", "pastoral_farm"]);
const SPIN_SLOT = 1;
/** CL-4: a weaver's house takes the spinners' skeins until it holds this many (four cloths' worth). */
const WEAVER_YARN_WANTED = 16;

// --- CL-1…CL-3 the pasture -----------------------------------------------------------------------------------------

/** CL-1: the sheep the town's pastures carry. */
export function pastureSheep(state: Pick<GameState, "zones">): number {
  const cells = zonesOf(state).reduce((sum, zone) => sum + (zone.kind === "pasture" ? zone.membership.length : 0), 0);
  return cells * CLOTH_BALANCE.sheepPerPastureCell;
}

/**
 * CL-2: the pasture cells each pastoral farm tends (farm id → cells): a cell goes to the nearest farm within reach
 * (Chebyshev distance to its footprint; then id). Rule 10 cache: (a) keys the zones array and the farms' ids and
 * positions; (b) nothing else is read; (c) the labour step calls it every tick, the shearing once a year.
 */
let tendingMemo: { zones: unknown; farms: string; width: number; value: ReadonlyMap<string, number> } | null = null;
export function pastureTending(state: Pick<GameState, "zones" | "buildings" | "width">): ReadonlyMap<string, number> {
  const farms = state.buildings.filter(building => building.kind === "pastoral_farm").sort((a, b) => a.id.localeCompare(b.id));
  const key = farms.map(farm => `${farm.id}@${farm.tx},${farm.ty}`).join("|");
  const zones = zonesOf(state);
  if (tendingMemo !== null && tendingMemo.zones === zones && tendingMemo.farms === key && tendingMemo.width === state.width) return tendingMemo.value;
  const value = new Map<string, number>();
  if (farms.length > 0) {
    const def = BUILDING_CONFIG_BY_KIND.pastoral_farm;
    for (const zone of zones) {
      if (zone.kind !== "pasture") continue;
      for (const index of zone.membership) {
        const x = index % state.width, y = Math.floor(index / state.width);
        let best: { id: string; distance: number } | null = null;
        for (const farm of farms) {
          const dx = Math.max(farm.tx - x, 0, x - (farm.tx + def.width - 1));
          const dy = Math.max(farm.ty - y, 0, y - (farm.ty + def.height - 1));
          const distance = Math.max(dx, dy);
          if (distance <= CLOTH_BALANCE.pastoralReach && (best === null || distance < best.distance)) best = { id: farm.id, distance };
        }
        if (best !== null) value.set(best.id, (value.get(best.id) ?? 0) + 1);
      }
    }
  }
  tendingMemo = { zones, farms: key, width: state.width, value };
  return value;
}

/** CL-3: the hands a pastoral farm's tended cells ask for this season (its own workers count first). */
export function pastoralFieldNeed(tendedCells: number, tick: number): number {
  const cells = Math.max(0, Math.floor(tendedCells));
  return Math.ceil(cells * CLOTH_BALANCE.pastureHandsPerCellPermille * laborSeason(tick).permille / 1_000_000);
}

/** CL-2: the shearing — each farm's flocks, as far as its shepherds are staffed, into its yard (up to its room). */
function shear(state: GameState): GameState {
  const tended = pastureTending(state);
  if (tended.size === 0) return state;
  // ARCH-1 (MA-4 ②): the land's pasture — the down's flocks clip more, the forest's less.
  const pastoralPermille = archetypeRules(state).pastoralPermille;
  let changed = false;
  const buildings = state.buildings.map(building => {
    const cells = tended.get(building.id) ?? 0;
    if (building.kind !== "pastoral_farm" || cells === 0 || operationSuspended(building)) return building;
    const need = Math.max(1, pastoralFieldNeed(cells, state.tick));
    const hands = Math.max(0, building.workers) + Math.max(0, building.fieldHands ?? 0);
    const staffed = Math.min(1000, Math.floor(hands * 1000 / need));
    const clip = scaleByPermille(Math.floor(cells * CLOTH_BALANCE.sheepPerPastureCell * CLOTH_BALANCE.fleecesPerSheepYear * staffed / 1000), pastoralPermille);
    const held = Object.values(building.inventory).reduce((sum, amount) => sum + Math.max(0, amount ?? 0), 0);
    const fleece = Math.min(clip, Math.max(0, BUILDING_CONFIG_BY_KIND.pastoral_farm.storageCapacity - held));
    if (fleece <= 0) return building;
    changed = true;
    return { ...building, inventory: { ...building.inventory, fleece: (building.inventory.fleece ?? 0) + fleece } };
  });
  return changed ? { ...state, buildings } : state;
}

// --- CL-4 spinning ----------------------------------------------------------------------------------------------

function spinCraft() {
  const craft = craftDefinition(SPIN_YARN_CRAFT_ID);
  if (craft === null) throw new Error("spin_yarn craft missing");
  return craft;
}

/** CL-4: the household's second slot, when it spins. */
export function spinningSlot(house: Pick<House, "crafts">): HouseholdSlot | null {
  const slot = house.crafts?.[SPIN_SLOT];
  return slot?.craftId === SPIN_YARN_CRAFT_ID ? slot : null;
}

function hasSpinster(state: GameState, house: House): boolean {
  if (state.persons === undefined) return true;
  const year = currentYear(state);
  return state.persons.people.some(person => person.householdId === house.buildingId && person.sex === "female" && ageOf(person, year) >= 14);
}

const held = (building: Building) => Object.values(building.inventory).reduce((sum, amount) => sum + Math.max(0, amount ?? 0), 0);

/** CL-4: one spinning batch across the town — slots taken up, fleece fetched, skeins spun and taken to a storehouse. */
function spinBatch(state: GameState): GameState {
  const craft = spinCraft();
  const fleeceHeld = state.buildings.some(building => FLEECE_STORES.has(building.kind) && (building.inventory.fleece ?? 0) > 0);
  if (!fleeceHeld && !state.houses.some(house => spinningSlot(house) !== null)) return state;
  const byId = new Map(state.buildings.map(building => [building.id, building]));
  const buildings = [...state.buildings];
  const index = new Map(buildings.map((building, at) => [building.id, at]));
  let changed = false;
  const houses = state.houses.map(original => {
    let house = original;
    if (house.residents <= 0 || house.burntTick !== undefined || house.abandonedTick !== undefined || house.level < CLOTH_BALANCE.spinFromLevel) return house;
    let slot = spinningSlot(house);
    if (slot === null) {
      if (house.crafts?.[SPIN_SLOT]?.craftId != null || !fleeceHeld || !hasSpinster(state, house)) return house;
      slot = { craftId: craft.id, workers: craft.workers, input: { ...craft.input }, output: { ...craft.output }, stock: {} };
    }
    const home = byId.get(house.buildingId);
    if (home === undefined) return house;
    const nearest = (accept: (building: Building) => boolean) => buildings.filter(accept)
      .sort((a, b) => buildingFootprintDistance(home, a) - buildingFootprintDistance(home, b) || a.id.localeCompare(b.id))[0];
    if ((slot.stock.fleece ?? 0) < (craft.input.fleece ?? 1)) {
      const store = nearest(building => FLEECE_STORES.has(building.kind) && (building.inventory.fleece ?? 0) > 0);
      if (store !== undefined) {
        buildings[index.get(store.id)!] = { ...store, inventory: { ...store.inventory, fleece: (store.inventory.fleece ?? 0) - 1 } };
        slot = { ...slot, stock: { ...slot.stock, fleece: (slot.stock.fleece ?? 0) + 1 } };
      }
    }
    // She spins a skein and carries it to the nearest weaver's house short of yarn (the process errand, LB-8), else the
    // nearest storehouse with room (none: she keeps the fleece for later).
    const weaver = nearest(building => building.kind === "weaver_house" && (building.inventory.yarn ?? 0) < WEAVER_YARN_WANTED
      && held(building) < BUILDING_CONFIG_BY_KIND.weaver_house.storageCapacity);
    const storehouse = weaver ?? nearest(building => building.kind === "storehouse" && held(building) < BUILDING_CONFIG_BY_KIND.storehouse.storageCapacity);
    if ((slot.stock.fleece ?? 0) >= (craft.input.fleece ?? 1) && storehouse !== undefined) {
      slot = { ...slot, stock: { ...slot.stock, fleece: (slot.stock.fleece ?? 0) - (craft.input.fleece ?? 1) } };
      const at = index.get(storehouse.id)!;
      const current = buildings[at]!;
      buildings[at] = { ...current, inventory: { ...current.inventory, yarn: (current.inventory.yarn ?? 0) + (craft.output.yarn ?? 1) } };
    }
    if (slot !== house.crafts?.[SPIN_SLOT]) {
      const crafts = [...(house.crafts ?? [])];
      // A house with a spinning slot but no craft in its first keeps the first empty.
      for (let at = 0; at < SPIN_SLOT; at += 1) crafts[at] ??= { craftId: null, workers: 0, input: {}, output: {}, stock: {} };
      crafts[SPIN_SLOT] = slot;
      house = { ...house, crafts };
      changed = true;
    }
    return house;
  });
  if (!changed && buildings.every((building, at) => building === state.buildings[at])) return state;
  return { ...state, houses, buildings };
}

// --- CL-5, CL-6 the lord's toll, the merchants' dyes -----------------------------------------------------------

/** CL-5 (production): the fulling mills' toll on the cloth they fulled this tick (the treasury, `fulling_toll`). */
export function fullingToll(state: GameState, fulled: ReadonlyMap<string, number>): GameState {
  if (fulled.size === 0) return state;
  const postings: LedgerPosting[] = [...fulled.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([id, cloths]) => ({
    account: "cash", category: "fulling_toll", amount: cloths * CLOTH_BALANCE.fullingTollPerCloth, sourceRefs: [{ type: "building", id, detail: `cloth:${cloths}` }],
  }));
  const posted = postLedgerEntries(state, postings);
  return { ...state, treasuryCoin: posted.treasuryCoin, ledger: posted.ledger };
}

/** CL-6: each season the long-distance merchants bring the working dyehouses their dyes (a market in town). */
function bringDyes(state: GameState): GameState {
  const market = state.buildings.some(building => building.kind === "market" && !operationSuspended(building));
  if (!market) return state;
  let changed = false;
  const buildings = state.buildings.map(building => {
    if (building.kind !== "dyehouse" || operationSuspended(building)) return building;
    const room = BUILDING_CONFIG_BY_KIND.dyehouse.storageCapacity - held(building);
    // F4-A (RG-3): from chapter 4 the merchants bring twice the dyes (the cloth trade at its height).
    const perSeason = state.reorganisation === undefined ? CLOTH_BALANCE.dyesPerSeason : REORGANISATION_BALANCE.dyesPerSeason;
    const dyes = Math.min(perSeason, Math.max(0, CLOTH_BALANCE.dyesHeld - (building.inventory.dyes ?? 0)), Math.max(0, room));
    if (dyes <= 0) return building;
    changed = true;
    return { ...building, inventory: { ...building.inventory, dyes: (building.inventory.dyes ?? 0) + dyes } };
  });
  return changed ? { ...state, buildings } : state;
}

// --- API ----------------------------------------------------------------------------------------------------------

/** CL-10 API: the town's cloth chain — each good held (stores, yards, slots) and the chain's buildings. */
export interface TownCloth {
  readonly sheep: number;
  readonly tendedCells: number;
  readonly goods: Readonly<Record<"fleece" | "yarn" | "raw_cloth" | "fulled_cloth" | "dyes" | "dyed_cloth" | "finished_cloth", number>>;
  readonly spinningHouses: number;
  readonly buildings: Readonly<Record<"pastoral_farm" | "weaver_house" | "fulling_mill" | "dyehouse" | "tenter_yard", number>>;
}

const CLOTH_GOODS = ["fleece", "yarn", "raw_cloth", "fulled_cloth", "dyes", "dyed_cloth", "finished_cloth"] as const;
const CLOTH_KINDS = ["pastoral_farm", "weaver_house", "fulling_mill", "dyehouse", "tenter_yard"] as const;

export function townCloth(state: GameState): TownCloth {
  const goods = Object.fromEntries(CLOTH_GOODS.map(good => [good, state.buildings.reduce((sum, building) => sum + Math.max(0, building.inventory[good] ?? 0), 0)
    + state.houses.reduce((sum, house) => sum + (house.crafts ?? []).reduce((total, slot) => total + Math.max(0, slot?.stock[good] ?? 0), 0), 0)])) as TownCloth["goods"];
  const tended = [...pastureTending(state).values()].reduce((sum, cells) => sum + cells, 0);
  return { sheep: pastureSheep(state), tendedCells: tended, goods, spinningHouses: state.houses.filter(house => spinningSlot(house) !== null).length,
    buildings: Object.fromEntries(CLOTH_KINDS.map(kind => [kind, state.buildings.filter(building => building.kind === kind).length])) as TownCloth["buildings"] };
}

/** One tick of C5 (a no-op except at the shearing, the spinning batches and the seasons' starts). */
export function advanceCloth(state: GameState): GameState {
  if (state.tick <= 0) return state;
  let next = state;
  if (state.tick % YEAR === CLOTH_BALANCE.shearingInYearTick) next = shear(next);
  if (state.tick % CLOTH_BALANCE.spinTicksPerBatch === 0) next = spinBatch(next);
  if (state.tick % SEASON === 0) next = bringDyes(next);
  return next;
}

