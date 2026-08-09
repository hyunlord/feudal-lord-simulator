import type { CameraState, WorldBounds } from "./camera";

type Viewport = Readonly<{ width: number; height: number }>;

export type CanvasKeyResolution = Readonly<{
  camera: CameraState;
  spacePressed: boolean;
  dismissSelection: boolean;
  preventDefault: boolean;
  toggleOutlinesView: boolean;
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
    camera: input.camera,
    spacePressed: input.code === "Space" || input.spacePressed,
    dismissSelection: input.code === "Escape",
    preventDefault: input.code === "Space" || cameraKey || input.code === "KeyO",
    toggleOutlinesView: input.code === "KeyO",
  };
}
