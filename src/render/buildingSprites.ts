import type { Building } from "../economy/economy.types";
import type { CameraState } from "./camera";
import type { ViewportSize } from "./renderer";
import type { WorldSpriteOptions } from "./worldSprite";

export function buildingSpriteKey(building: Building, houseLevel: number): string {
  if (building.kind === "house") {
    return `house_l${Math.max(0, Math.min(4, houseLevel))}`;
  }
  if (building.kind === "granary") {
    return "barn";
  }
  return building.kind;
}

export function spriteOptionsFor(input: {
  readonly camera?: CameraState;
  readonly dpr?: number;
  readonly viewport?: ViewportSize;
}): WorldSpriteOptions {
  return {
    ...(input.camera === undefined ? {} : { camera: input.camera }),
    ...(input.dpr === undefined ? {} : { dpr: input.dpr }),
    ...(input.viewport === undefined ? {} : { viewport: input.viewport }),
  };
}
