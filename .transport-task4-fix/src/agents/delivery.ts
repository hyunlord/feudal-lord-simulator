import type { Walker } from "./walker.types";

export function planDelivery(walker: Walker): Walker {
  if (walker.destinationBuildingId === null) return walker;
  return {
    ...walker,
    path: walker.path ?? [],
  };
}
