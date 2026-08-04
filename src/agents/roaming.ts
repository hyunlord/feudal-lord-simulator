import type { Rng } from "../content/random";
import type { Walker } from "./walker.types";

export type {
  RoamingHouse,
  RoamingJunctionInput,
  RoamingRoutePort,
  RoamingSpawnInput,
  RoamingSpawnResult,
  RoamingStepInput,
  RoamingStepResult,
} from "./roamingTypes";
export { spawnDistributors } from "./roamingSpawn";
export { stepDistributors } from "./roamingStep";

export function planRoaming(walker: Walker, _rng: Rng): Walker {
  return walker;
}
