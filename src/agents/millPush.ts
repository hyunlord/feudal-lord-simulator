import { BUILDING_CONFIG_BY_KIND, operationSuspended, type Building } from "../content/buildingConfig";
import { LABOUR_BALANCE } from "../content/balanceConfig";
import { buildingFootprintDistance } from "../geometry/buildingDistance";

/** LB-7: a staffed, operating mill within a granary's push reach (footprint distance ≤ `pushRadius`). */
export function pushableMill(granary: Building, mill: Building): boolean {
  return mill.kind === "mill" && !operationSuspended(mill)
    && mill.workers >= BUILDING_CONFIG_BY_KIND.mill.workersRequired
    && buildingFootprintDistance(granary, mill) <= LABOUR_BALANCE.pushRadius;
}
