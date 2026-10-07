import { recordFoodFlow } from './autoplayFoodFlow';
import {
  operationSuspended,
  BUILDING_CONFIG_BY_KIND,
  type Building,
} from "../content/buildingConfig";
import type { ResourceType } from "../content/resourceConfig";
import type { GameState } from "./engine.types";
import { buildingRoadAccessTiles } from "./routing";
import type { TileCoordinate } from "../world/grid";
import { constructionExportReserve } from './constructionExportReserve';
import { existingRoadComponent } from "../world/roadGraph";
import { postLedgerEntries } from "../ledger/ledger";
import { scenarioOf } from "./scenarioState";
import { stageDef } from "../content/scenario/registry";
import type { LedgerPosting } from "../ledger/ledger.types";
import { foodPricePermille } from "./eventSchedule";
import { foodPriceSource } from "./events";
import { CLOTH_BALANCE } from "../content/clothConfig";
import { reorganisationClothTrade } from "./reorganisation";

type MarketResource = Exclude<ResourceType, "coin">;

type SaleRule = {
  readonly resource: MarketResource;
  readonly reserve: number;
  /** Trade priority (dearest goods first); since C2 a price only for the owner, or for demesne sales. */
  readonly coin: number;
};

type SaleCandidate = SaleRule & {
  readonly building: Building;
};

const SALE_RULES = [
  { resource: "wheat", reserve: 30, coin: 2 },
  { resource: "logs", reserve: 30, coin: 2 },
  { resource: "bread", reserve: 40, coin: 5 },
  { resource: "timber", reserve: 60, coin: 6 },
  { resource: "stone_raw", reserve: 40, coin: 3 },
  { resource: "stone", reserve: 40, coin: 8 },
  // C5 (CL-8): finished cloth to the long-distance merchants, before anything else (the dearest good), none kept back.
  { resource: "finished_cloth", reserve: 0, coin: CLOTH_BALANCE.clothPrice },
] as const satisfies readonly SaleRule[];

/** A market round, the town's market day: the markets trade (and, FIX-10, the traders bring ordered timber). */
export const MARKET_CADENCE_TICKS = 80;

/**
 * EV-5: the price a unit sells for now: the rule's price, bread and wheat × the food price of an arriving dearth
 * (rounded to a whole penny). Trade priority keeps the usual prices, so a dearth does not change what the market
 * sends out first.
 */
export function marketSalePrice(state: Pick<GameState, "seed" | "scenarioId" | "tick"> & Partial<Pick<GameState, "reorganisation" | "legacy">>, resource: MarketResource): number {
  // F4-A (RG-3): chapter 4's cloth price (the long-distance merchants' trade at its height).
  if (resource === "finished_cloth") return reorganisationClothTrade(state as Pick<GameState, "reorganisation"> & Pick<GameState, "tick">)?.price ?? CLOTH_BALANCE.clothPrice;
  const base = SALE_RULES.find(rule => rule.resource === resource)?.coin ?? 0;
  return resource === "bread" || resource === "wheat" ? Math.round(base * foodPricePermille(state, state.tick) / 1000) : base;
}

function coordinateKey(coordinate: TileCoordinate): string {
  return `${coordinate.tx},${coordinate.ty}`;
}

function amount(
  record: Partial<Record<ResourceType, number>>,
  resource: ResourceType,
): number {
  return Math.max(0, record[resource] ?? 0);
}

function withAmount(
  record: Partial<Record<ResourceType, number>>,
  resource: ResourceType,
  nextAmount: number,
): Partial<Record<ResourceType, number>> {
  if (nextAmount <= 0) {
    const { [resource]: _removed, ...remaining } = record;
    return remaining;
  }
  return { ...record, [resource]: nextAmount };
}

export function completedMarkets(buildings: readonly Building[]): readonly Building[] {
  return buildings
    .filter((building) => building.kind === "market")
    .filter((building) => !operationSuspended(building) && building.workers >= BUILDING_CONFIG_BY_KIND.market.workersRequired)
    .sort((left, right) => left.id.localeCompare(right.id));
}

function connectedStorageSources(
  state: GameState,
  market: Building,
  buildings: readonly Building[],
): readonly Building[] {
  const component = existingRoadComponent(state, buildingRoadAccessTiles(state, market));
  const componentKeys = new Set(component.map(coordinateKey));
  return buildings
    // C5 (CL-8): the merchants buy finished cloth at the tenter yard too.
    .filter((building) => building.kind === "granary" || building.kind === "storehouse" || building.kind === "tenter_yard")
    .filter((building) =>
      buildingRoadAccessTiles(state, building).some((road) =>
        componentKeys.has(coordinateKey(road)),
      ),
    );
}

/**
 * DEC-TRACE (DTR-13): a lord-mode hamlet whose market charter opened its market before its era (DTR-8) keeps out of the
 * market the timber its market-town proclamation waits on — else the stalls sell what the palisade needs and the town
 * stays a hamlet (125-year runs: 24 houses for good). Elsewhere a hamlet has no market, so nothing changes.
 */
export function hamletTimberKeep(state: GameState): number {
  if (state.era !== "hamlet" || state.agency === undefined) return 0;
  const condition = stageDef(scenarioOf(state), "market_town").enterWhen.all
    .find(entry => entry.kind === "spendable_resource_at_least" && entry.resource === "timber");
  return condition?.kind === "spendable_resource_at_least" ? condition.value : 0;
}

function saleCandidates(sources: readonly Building[], state: GameState): readonly SaleCandidate[] {
  const civicReserve = constructionExportReserve(state);
  const hamletKeep = hamletTimberKeep(state);
  const availableTimber = sources.reduce((total, building) => total +
    Math.max(0, amount(building.inventory, "timber") - amount(building.stockReserved, "timber")), 0);
  const availableStone = sources.reduce((total, building) => total +
    Math.max(0, amount(building.inventory, "stone") - amount(building.stockReserved, "stone")), 0);
  return sources.flatMap((building) =>
    SALE_RULES.flatMap((rule) => {
      if (state.era === "palisade" && rule.resource === "stone" && availableStone <= 400) return [];
      if (rule.resource === "timber" && availableTimber <= civicReserve.timber + hamletKeep) return [];
      if (rule.resource === "stone" && availableStone <= civicReserve.stone) return [];
      const stock = amount(building.inventory, rule.resource);
      const reserved = amount(building.stockReserved, rule.resource);
      const unreserved = Math.max(0, stock - reserved);
      return unreserved - 1 >= rule.reserve
        ? [{ ...rule, building }]
        : [];
    }),
  );
}

function compareCandidates(left: SaleCandidate, right: SaleCandidate): number {
  if (left.coin !== right.coin) return right.coin - left.coin;
  const leftResourceOrder = SALE_RULES.findIndex((rule) => rule.resource === left.resource);
  const rightResourceOrder = SALE_RULES.findIndex((rule) => rule.resource === right.resource);
  if (leftResourceOrder !== rightResourceOrder) return leftResourceOrder - rightResourceOrder;
  return left.building.id.localeCompare(right.building.id);
}

/**
 * FIX-11 (13, rule 10): the market-activity check (render's world signs and market art) keeps its answer exact and
 * caches only its costly part, the road search for the stores connected to the market.
 * (a) Key: the `tiles` array (weak), the market id and the number of buildings. A road, a building or a construction
 *     site placed or removed makes a new tiles array (tile `hasRoad` / `buildingId`).
 * (b) The stores' stock and reservations, the construction reserve and the era are read fresh on every call, so the
 *     answer is the same as without the cache; only which stores the market's road reaches is remembered.
 * (c) Measured (`scripts/perf/marketSaleCheck.ts`, chapter-five-town v35, one market, 93 buildings, this Mac): a check
 *     with the road search was 0.17 ms with warm road caches (NAT-2: 0.23 ms a frame at 5×); a frame at 5× (new stock,
 *     same tiles) is now 0.068 ms.
 */
interface ConnectedStores { readonly buildings: number; readonly ids: readonly string[] }
const connectedStoreMemo = new WeakMap<GameState["tiles"], Map<string, ConnectedStores>>();

export function marketHasSaleCandidate(state: GameState, market: Building): boolean {
  if (market.kind !== "market" || operationSuspended(market) || market.workers < BUILDING_CONFIG_BY_KIND.market.workersRequired) return false;
  let byMarket = connectedStoreMemo.get(state.tiles);
  if (byMarket === undefined) { byMarket = new Map(); connectedStoreMemo.set(state.tiles, byMarket); }
  let stores = byMarket.get(market.id);
  if (stores === undefined || stores.buildings !== state.buildings.length) {
    stores = { buildings: state.buildings.length, ids: connectedStorageSources(state, market, state.buildings).map(building => building.id) };
    byMarket.set(market.id, stores);
  }
  const wanted = new Set(stores.ids);
  return saleCandidates(state.buildings.filter(building => wanted.has(building.id)), state).length > 0;
}

function settleMarket(
  state: GameState,
  buildings: readonly Building[],
  market: Building,
  cloth: "any" | "only" | "none" = "any",
): { readonly buildings: readonly Building[]; readonly coin: number; readonly sold?: MarketResource; readonly from?: Building } {
  const candidate = [...saleCandidates(connectedStorageSources(state, market, buildings), state)]
    .filter(entry => cloth === "any" || (entry.resource === "finished_cloth") === (cloth === "only"))
    .sort(compareCandidates)[0];
  if (candidate === undefined) return { buildings, coin: 0 };

  return {
    coin: marketSalePrice(state, candidate.resource),
    sold: candidate.resource,
    from: candidate.building,
    buildings: buildings.map((building) =>
      building.id === candidate.building.id
        ? {
            ...building,
            inventory: withAmount(
              building.inventory,
              candidate.resource,
              amount(building.inventory, candidate.resource) - 1,
            ),
          }
        : building,
    ),
  };
}

/**
 * M-1: the market still trades goods out of connected storage (residents' and traders' goods), but the
 * proceeds belong to their owners, so nothing reaches the treasury. Only with the scenario's demesne rule
 * does a sale of the lord's own granary grain post `demesne_sale` (M-1b, off by default).
 */
export function settleMarkets(state: GameState): GameState {
  if (state.tick <= 0 || state.tick % MARKET_CADENCE_TICKS !== 0) return state;

  let buildings: readonly Building[] = state.buildings;
  const demesne: LedgerPosting[] = [];
  const demesneSale = scenarioOf(state).economyRules.demesneSale;
  let traded = false;
  let wheatExported = 0;
  let breadExported = 0;
  const ulnage: LedgerPosting[] = [];
  // F4-A (RG-3): from chapter 4 the long-distance merchants buy cloth apart from the market's everyday trade (a cloth a
  // round more), the seal is dearer and the lord takes a toll on each cloth sold.
  const clothTrade = reorganisationClothTrade(state);
  for (const market of completedMarkets(buildings)) {
    for (const cloth of clothTrade === null ? ["any"] as const : ["none", "only"] as const) {
    const result = settleMarket(state, buildings, market, cloth);
    buildings = result.buildings;
    if (result.sold === undefined) continue;
    traded = true;
    if (result.sold === "wheat") wheatExported += 1;
    if (result.sold === "bread") breadExported += 1;
    // C5 (CL-8): the aulnager seals each cloth sold; the seal's due is the treasury's.
    if (result.sold === "finished_cloth") ulnage.push({ account: "cash", category: "ulnage", amount: clothTrade?.ulnage ?? CLOTH_BALANCE.ulnagePerCloth,
      sourceRefs: [{ type: "building", id: market.id, detail: "cloth_sold" }, { type: "building", id: result.from!.id }] });
    if (result.sold === "finished_cloth" && clothTrade !== null && clothTrade.toll > 0) ulnage.push({ account: "cash", category: "cloth_toll", amount: clothTrade.toll,
      sourceRefs: [{ type: "building", id: market.id, detail: `cloth_price:${clothTrade.price}` }, { type: "building", id: result.from!.id }] });
    if (demesneSale && result.from?.kind === "granary" && (result.sold === "wheat" || result.sold === "bread")) {
      const dearth = foodPriceSource(state);
      demesne.push({ account: "cash", category: "demesne_sale", amount: result.coin,
        sourceRefs: [{ type: "building", id: result.from.id, detail: `sold:${result.sold}` }, { type: "building", id: market.id },
          ...(dearth === null ? [] : [dearth])] });
    }
    }
  }

  if (!traded) return state;
  const posted = demesne.length + ulnage.length === 0 ? null : postLedgerEntries(state, [...demesne, ...ulnage]);
  return recordFoodFlow({
    ...state,
    buildings: [...buildings],
    ...(posted === null ? {} : { treasuryCoin: posted.treasuryCoin, ledger: posted.ledger }),
  }, { wheatExported, breadExported });
}
