import type { Walker } from "./walker.types";

export type {
  DeliveryInventoryPort,
  DeliveryRoutePort,
  DeliveryStepInput,
  DeliveryStepResult,
} from "./deliveryTypes";
export { spawnCarters } from "./deliverySpawn";
export { stepCarters } from "./deliveryStep";

export function planDelivery(walker: Walker): Walker {
  return walker;
}
