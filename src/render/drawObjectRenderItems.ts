import type { GameState } from "../engine/engine.types";
import type { Tile } from "../world/world.types";
import type { CameraState } from "./camera";
import { drawBuildings } from "./drawBuildings";
import { drawConstructionSite } from "./drawConstructionSites";
import { drawPalisadeSegment } from "./drawPalisadeSegments";
import type { HouseMaterialWave } from "./buildingMaterialWave";
import type { RenderQueueItem } from "./objectRenderOrder";
import { getObjectRenderViewMode } from "./objectRenderViewMode";
import type { TileRange, ViewportSize } from "./renderer";
import type { TileCoordinate } from "../world/grid";
import { denseBuildingClusterIds } from "./occlusionModel";
import { drawRoadReadabilityOverlay } from "./roadReadabilityOverlay";

type DrawObjectRenderItemsInput = {
  readonly state: GameState;
  readonly tiles: readonly Tile[];
  readonly range: TileRange;
  readonly zoom: number;
  readonly camera: CameraState;
  readonly dpr: number;
  readonly viewport: ViewportSize;
  readonly objectRenderItems: readonly RenderQueueItem[];
  readonly constructionProgress?: ReadonlyMap<string, number> | undefined;
  readonly houseMaterialWave?: HouseMaterialWave | null;
  readonly nowMs?: number;
  readonly hoveredTile?: TileCoordinate | null;
};

export function drawObjectRenderItems(
  context: CanvasRenderingContext2D,
  input: DrawObjectRenderItemsInput,
): void {
  const walkerItems: Extract<RenderQueueItem, { readonly kind: "walker" }>[] = [];
  const viewMode = getObjectRenderViewMode();
  const denseBuildingIds = denseBuildingClusterIds(input.state.buildings);
  for (const item of input.objectRenderItems) {
    if (item.kind === "walker") {
      walkerItems.push(item);
      continue;
    }
    if (item.kind === "construction_site") {
      const presentationProgress = input.constructionProgress?.get(item.id)
        ?? item.presentationProgress;
      const drawInput = presentationProgress === undefined
        ? { site: item.site, schedule: item.schedule, zoom: input.zoom, viewMode }
        : {
            site: item.site,
            schedule: item.schedule,
            zoom: input.zoom,
            presentationProgress,
            viewMode,
          };
      drawConstructionSite(context, drawInput);
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
      houseMaterialWave: input.houseMaterialWave ?? null,
      nowMs: input.nowMs ?? 0,
      hoveredTile: input.hoveredTile ?? null,
      viewMode,
      denseBuildingIds,
    });
  }
  drawRoadReadabilityOverlay(context, input.state, input.tiles);
  for (const item of walkerItems) {
    drawBuildings(context, {
      state: input.state,
      tiles: input.tiles,
      range: input.range,
      zoom: input.zoom,
      camera: input.camera,
      dpr: input.dpr,
      viewport: input.viewport,
      objectRenderItems: [item],
      houseMaterialWave: input.houseMaterialWave ?? null,
      nowMs: input.nowMs ?? 0,
      hoveredTile: input.hoveredTile ?? null,
      viewMode,
      denseBuildingIds,
    });
  }
}
