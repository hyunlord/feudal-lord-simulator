import { constructionMaterialSources } from "../agents/deliveryConstruction";
import type { Building } from "../content/buildingConfig";
import { constructionStall, createConstructionSite } from "../economy/construction";
import type { GameState } from "./engine.types";
import { buildingHasRequiredRoadAccess } from "./roadAccess";
import { createDeliveryInventoryPort, createSimulationRoutePorts } from "./simulationPorts";

export function hasConnectedConstructionRoute(state: GameState, candidate: Building): boolean {
  if (!buildingHasRequiredRoadAccess(state, candidate)) return false;
  const site = createConstructionSite({
    ordinal: state.nextConstructionOrdinal,
    kind: candidate.kind,
    tx: candidate.tx,
    ty: candidate.ty,
    startedTick: state.tick,
  });
  const stall = constructionStall(site, constructionMaterialSources({
    site,
    buildings: state.buildings,
    routes: createSimulationRoutePorts({
      ...state,
      constructionSites: [...state.constructionSites, site],
    }).delivery,
    inventory: createDeliveryInventoryPort(),
    treasuryTimber: state.treasuryTimber,
  }));
  return stall !== "no_route" && stall !== "no_material_source";
}
