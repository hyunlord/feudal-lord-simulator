import {
  BUILDING_CONFIG_BY_KIND,
  type Building,
} from "../content/buildingConfig";
import type { ResourceType } from "../content/resourceConfig";
import type { GameState } from "./engine.types";
import { buildingRoadAccessTiles } from "./routing";
import type { TileCoordinate } from "../world/grid";
import { existingRoadComponent } from "../world/roadGraph";

type MarketResource = Exclude<ResourceType, "coin">;

type SaleRule = {
  readonly resource: MarketResource;
  readonly reserve: number;
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
] as const satisfies readonly SaleRule[];

const MARKET_CADENCE_TICKS = 80;

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

function completedMarkets(buildings: readonly Building[]): readonly Building[] {
  return buildings
    .filter((building) => building.kind === "market")
    .filter((building) => building.workers >= BUILDING_CONFIG_BY_KIND.market.workersRequired)
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
    .filter((building) => building.kind === "granary" || building.kind === "storehouse")
    .filter((building) =>
      buildingRoadAccessTiles(state, building).some((road) =>
        componentKeys.has(coordinateKey(road)),
      ),
    );
}

function saleCandidates(sources: readonly Building[]): readonly SaleCandidate[] {
  return sources.flatMap((building) =>
    SALE_RULES.flatMap((rule) => {
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

function settleMarket(
  state: GameState,
  buildings: readonly Building[],
  market: Building,
): { readonly buildings: readonly Building[]; readonly coin: number } {
  const candidate = [...saleCandidates(connectedStorageSources(state, market, buildings))]
    .sort(compareCandidates)[0];
  if (candidate === undefined) return { buildings, coin: 0 };

  return {
    coin: candidate.coin,
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

export function settleMarkets(state: GameState): GameState {
  if (state.tick <= 0 || state.tick % MARKET_CADENCE_TICKS !== 0) return state;

  let buildings: readonly Building[] = state.buildings;
  let earnedCoin = 0;
  for (const market of completedMarkets(buildings)) {
    const result = settleMarket(state, buildings, market);
    buildings = result.buildings;
    earnedCoin += result.coin;
  }

  return earnedCoin === 0
    ? state
    : {
        ...state,
        buildings: [...buildings],
        treasuryCoin: state.treasuryCoin + earnedCoin,
      };
}
