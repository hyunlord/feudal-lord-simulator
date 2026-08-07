import type { GameState } from "../engine/engine.types";
import type { Tile } from "../world/world.types";
import type { CameraState } from "./camera";
import { drawBuildings } from "./drawBuildings";
import { drawConstructionSite } from "./drawConstructionSites";
import { drawPalisadeSegment } from "./drawPalisadeSegments";
import type { RenderQueueItem } from "./objectRenderOrder";
import type { TileRange, ViewportSize } from "./renderer";

type DrawObjectRenderItemsInput = {
  readonly state: GameState;
  readonly tiles: readonly Tile[];
  readonly range: TileRange;
  readonly zoom: number;
  readonly camera: CameraState;
  readonly dpr: number;
  readonly viewport: ViewportSize;
  readonly objectRenderItems: readonly RenderQueueItem[];
};

export function drawObjectRenderItems(
  context: CanvasRenderingContext2D,
  input: DrawObjectRenderItemsInput,
): void {
  for (const item of input.objectRenderItems) {
    if (item.kind === "construction_site") {
      drawConstructionSite(context, {
        site: item.site,
        schedule: item.schedule,
        zoom: input.zoom,
      });
      continue;
    }
    if (item.kind === "palisade_segment") {
      drawPalisadeSegment(context, {
        segment: item.segment,
        gate: item.gate,
        zoom: input.zoom,
      });
      continue;
    }
    drawBuildings(context, {
      state: input.state,
      tiles: input.tiles,
      range: input.range,
      zoom: input.zoom,
      camera: input.camera,
      dpr: input.dpr,
      viewport: input.viewport,
      objectRenderItems: [item],
    });
  }
}
