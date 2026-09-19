import { cancelCarter } from "../agents/deliveryReturn";
import type { Walker } from "../agents/walker.types";
import { createDeliveryInventoryPort, createSimulationRoutePorts } from "./simulationPorts";
import {
  allocateBuildingAndConstructionLabour,
  builderWalkersForSites,
} from "../population/labour";
import type { GameState } from "./engine.types";

/** Completed houses refund no materials; their residents and stored food leave. */
export function demolishHouse(state: GameState, buildingId: string): GameState {
  const home = state.buildings.find((building) => building.id === buildingId);
  if (home?.kind !== "house") return state;

  const houses = state.houses.filter((house) => house.buildingId !== buildingId);
  const population = houses.reduce((total, house) => total + house.residents, 0);
  const labour = allocateBuildingAndConstructionLabour(
    state.buildings.filter((building) => building.id !== buildingId),
    state.constructionSites,
    population,
    { era: state.era, tick: state.tick, eraProclaimedTick: state.eraProclaimedTick },
  );

  const demolished: GameState = {
    ...state,
    houses,
    population,
    buildings: [...labour.buildings],
    constructionSites: [...labour.constructionSites],
    idleWorkers: labour.idleWorkers,
    walkers: [
      ...state.walkers.filter((walker) => walker.kind !== "builder"),
      ...builderWalkersForSites(labour.constructionSites),
    ],
    tiles: state.tiles.map((tile) =>
      tile.buildingId === buildingId ? { ...tile, buildingId: null } : tile,
    ),
  };
  const inventory = createDeliveryInventoryPort();
  const routes = createSimulationRoutePorts(demolished).delivery;
  let result = demolished;
  const walkers: Walker[] = [];
  for (const walker of demolished.walkers) {
    if (walker.kind !== "carter" || walker.homeBuildingId !== buildingId || walker.phase === "returning") {
      walkers.push(walker);
      continue;
    }
    // A house can be the dispatch anchor for treasury-funded construction.
    // Release its delivery claim and let the normal return step recover cargo.
    const cancelled = cancelCarter(state.tick, result, walker, inventory, routes, "source_unavailable");
    result = {
      ...result,
      buildings: [...cancelled.buildings],
      constructionSites: [...cancelled.constructionSites],
      treasuryTimber: cancelled.treasuryTimber,
    };
    if (cancelled.walker !== null) walkers.push(cancelled.walker);
  }
  return { ...result, walkers };
}
