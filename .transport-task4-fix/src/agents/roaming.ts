import type { Rng } from "../content/random";
import type { Walker } from "./walker.types";

export function planRoaming(walker: Walker, rng: Rng): Walker {
  if (walker.roamTilesRemaining > 0) return walker;

  return {
    ...walker,
    roamDirection: rng.int(0, 4),
    roamTilesRemaining: rng.int(2, 6),
  };
}
