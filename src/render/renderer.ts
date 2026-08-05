import type { BuildingKind } from "../content/buildingConfig";
import type { GameState, OverlayMode } from "../engine/engine.types";
import type { CameraState } from "./camera";
import { canvasToWorld } from "./camera";
import { drawBuildings } from "./drawBuildings";
import { drawTerrain } from "./drawTerrain";
import { drawWorldVignette } from "./worldBackdrop";
import { TILE_H, depthKey, screenToTile } from "./iso";
import { drawOverlay, drawPlacementOverlay, type PlacementPreview } from "./overlays";
import { maxSpriteAnchorY } from "./worldAssets";
import type { Grid } from "../world/grid";
import type { Tile } from "../world/world.types";

export { ambientOffset, objectPhase, type AmbientInput } from "./renderMotion";

export type PlacementTool = BuildingKind | "road";

export type TileRange = {
  readonly minTx: number;
  readonly minTy: number;
  readonly maxTx: number;
  readonly maxTy: number;
};

export type ViewportSize = {
  readonly width: number;
  readonly height: number;
};

export type WorldSize = {
  readonly width: number;
  readonly height: number;
};

export type VisibleRangeInput = {
  readonly camera: CameraState;
  readonly viewport: ViewportSize;
  readonly world: WorldSize;
};

export type RenderPasses = {
  readonly ground: () => void;
  readonly objects: () => void;
  readonly overhang: () => void;
};

const RANGE_MARGIN_TILES = Math.max(3, Math.ceil(maxSpriteAnchorY() / TILE_H));
export type RenderFrameInput = {
  readonly context: CanvasRenderingContext2D;
  readonly state: GameState;
  readonly camera: CameraState;
  readonly viewport: ViewportSize;
  readonly preview: PlacementPreview;
  readonly overlayMode?: OverlayMode;
};

export const renderFrame = (input: RenderFrameInput): void => {
  const range = computeVisibleTileRange({
    camera: input.camera,
    viewport: input.viewport,
    world: input.state,
  });
  const visibleTiles = visibleTilesInDrawOrder({ grid: input.state, range });
  runRenderPasses({
    ground: () => {
      drawWorldVignette(input.context, input.state);
      drawTerrain(input.context, {
        state: input.state,
        tiles: visibleTiles,
        range,
        zoom: input.camera.zoom,
      });
    },
    objects: () =>
      drawBuildings(input.context, {
        state: input.state,
        tiles: visibleTiles,
        range,
        zoom: input.camera.zoom,
        camera: input.camera,
        dpr: devicePixelRatioFor(input.context, input.viewport),
        viewport: input.viewport,
      }),
    overhang: () => undefined,
  });
  drawOverlay({
    context: input.context,
    state: input.state,
    mode: input.overlayMode ?? "none",
    zoom: input.camera.zoom,
  });
  drawPlacementOverlay(input.context, { preview: input.preview, zoom: input.camera.zoom });
};

export const computeVisibleTileRange = (input: VisibleRangeInput): TileRange => {
  const corners = [
    { x: 0, y: 0 },
    { x: input.viewport.width, y: 0 },
    { x: 0, y: input.viewport.height },
    { x: input.viewport.width, y: input.viewport.height },
  ].map((point) => screenToTilePoint(canvasToWorld(point, input.camera)));
  const txValues = corners.map((point) => point.tx);
  const tyValues = corners.map((point) => point.ty);
  return {
    minTx: clampTile(Math.floor(Math.min(...txValues)) - RANGE_MARGIN_TILES, input.world.width),
    minTy: clampTile(Math.floor(Math.min(...tyValues)) - RANGE_MARGIN_TILES, input.world.height),
    maxTx: clampTile(Math.ceil(Math.max(...txValues)) + RANGE_MARGIN_TILES, input.world.width),
    maxTy: clampTile(Math.ceil(Math.max(...tyValues)) + RANGE_MARGIN_TILES, input.world.height),
  };
};

export const visibleTilesInDrawOrder = (input: {
  readonly grid: Grid;
  readonly range: TileRange;
}): readonly Tile[] => {
  const tiles: Tile[] = [];
  const minTx = Math.max(0, input.range.minTx);
  const minTy = Math.max(0, input.range.minTy);
  const maxTx = Math.min(input.grid.width - 1, input.range.maxTx);
  const maxTy = Math.min(input.grid.height - 1, input.range.maxTy);

  for (let ty = minTy; ty <= maxTy; ty += 1) {
    for (let tx = minTx; tx <= maxTx; tx += 1) {
      const tile = input.grid.tiles[ty * input.grid.width + tx];
      if (tile !== undefined) tiles.push(tile);
    }
  }

  return tiles.sort(
    (left, right) =>
      depthKey(left.tx, left.ty) - depthKey(right.tx, right.ty) ||
      left.ty - right.ty ||
      left.tx - right.tx,
  );
};

export const runRenderPasses = (passes: RenderPasses): void => {
  passes.ground();
  passes.objects();
  passes.overhang();
};

const screenToTilePoint = (point: { readonly x: number; readonly y: number }) =>
  screenToTile(point.x, point.y);

const clampTile = (value: number, size: number): number =>
  Math.max(0, Math.min(size - 1, value));

const devicePixelRatioFor = (
  context: CanvasRenderingContext2D,
  viewport: ViewportSize,
): number => {
  if (viewport.width <= 0) return 1;
  const dpr = context.canvas.width / viewport.width;
  return Number.isFinite(dpr) && dpr > 0 ? dpr : 1;
};
