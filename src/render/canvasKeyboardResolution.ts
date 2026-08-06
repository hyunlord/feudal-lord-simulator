import type { CameraState, WorldBounds } from "./camera";
import { panByKey } from "./interactions";

type Viewport = Readonly<{ width: number; height: number }>;

export type CanvasKeyResolution = Readonly<{
  camera: CameraState;
  spacePressed: boolean;
  dismissSelection: boolean;
  preventDefault: boolean;
}>;

export function resolveCanvasKeyDown(input: Readonly<{
  code: string;
  key: string;
  camera: CameraState;
  spacePressed: boolean;
  viewport: Viewport;
  world: WorldBounds;
}>): CanvasKeyResolution {
  const cameraKey = /^(?:w|a|s|d|ArrowUp|ArrowDown|ArrowLeft|ArrowRight)$/.test(input.key);
  return {
    camera: panByKey({
      camera: input.camera,
      key: input.key,
      viewport: input.viewport,
      world: input.world,
    }),
    spacePressed: input.code === "Space" || input.spacePressed,
    dismissSelection: input.code === "Escape",
    preventDefault: input.code === "Space" || cameraKey,
  };
}
