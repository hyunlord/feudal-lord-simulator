import { useEffect, useId, useMemo, useState, type PointerEvent } from "react";

import { KO_UI } from "../content/locale.ko";
import { SEMANTIC_PALETTE, type PaletteColor } from "../content/palette";
import type { TerrainType } from "../content/terrainConfig";
import {
  MINIMAP_CAMERA_JUMP_EVENT,
  MINIMAP_VIEWPORT_EVENT,
  type MinimapViewportRect,
} from "../render/minimapCameraJump";
import type { Grid, TileCoordinate } from "../world/grid";

const SAMPLE_AXIS_LIMIT = 12;
const MAP_VIEWBOX_SIZE = 120;
const MAP_CELL_SIZE = MAP_VIEWBOX_SIZE / SAMPLE_AXIS_LIMIT;

export type MinimapSample = {
  readonly x: number;
  readonly y: number;
  readonly terrain: TerrainType;
};

export function sampleMinimapTiles(
  grid: Grid,
  requestedColumns = SAMPLE_AXIS_LIMIT,
  requestedRows = SAMPLE_AXIS_LIMIT,
): readonly MinimapSample[] {
  const columns = Math.min(SAMPLE_AXIS_LIMIT, grid.width, Math.max(0, Math.floor(requestedColumns)));
  const rows = Math.min(SAMPLE_AXIS_LIMIT, grid.height, Math.max(0, Math.floor(requestedRows)));
  const samples: MinimapSample[] = [];

  for (let y = 0; y < rows; y += 1) {
    const ty = Math.floor((y * grid.height) / rows);
    for (let x = 0; x < columns; x += 1) {
      const tx = Math.floor((x * grid.width) / columns);
      const tile = grid.tiles[ty * grid.width + tx];
      if (tile !== undefined) samples.push({ x, y, terrain: tile.terrain });
    }
  }
  return samples;
}

export type MinimapClientRect = {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
};

export type MinimapClientPoint = {
  readonly clientX: number;
  readonly clientY: number;
};

export function minimapTileFromClientPoint(
  point: MinimapClientPoint,
  rect: MinimapClientRect,
  grid: Pick<Grid, "height" | "width">,
): TileCoordinate {
  const localX = Math.min(rect.width - 1, Math.max(0, point.clientX - rect.left));
  const localY = Math.min(rect.height - 1, Math.max(0, point.clientY - rect.top));
  return {
    tx: Math.floor((localX / rect.width) * grid.width),
    ty: Math.floor((localY / rect.height) * grid.height),
  };
}

type MapOverviewProps = {
  readonly grid: Grid;
  readonly onJumpToTile?: (tile: TileCoordinate) => void;
  readonly viewportRect?: MinimapViewportRect;
};

const INITIAL_VIEWPORT_RECT = {
  x: 44,
  y: 44,
  width: 32,
  height: 32,
} as const satisfies MinimapViewportRect;

export function MapOverview({ grid, onJumpToTile, viewportRect }: MapOverviewProps) {
  const { height, tiles, width } = grid;
  const idPrefix = useId().replaceAll(":", "");
  const titleId = `${idPrefix}-map-overview-title`;
  const [runtimeViewportRect, setRuntimeViewportRect] = useState<MinimapViewportRect | null>(null);
  const currentViewport = viewportRect ?? runtimeViewportRect ?? INITIAL_VIEWPORT_RECT;
  const samples = useMemo(
    () => sampleMinimapTiles({ height, tiles, width }),
    [height, tiles, width],
  );
  useEffect(() => {
    if (viewportRect !== undefined) return undefined;
    const updateViewport = (event: Event) => {
      const rect = minimapViewportRectFromEvent(event);
      if (rect !== null) setRuntimeViewportRect((current) => sameViewportRect(current, rect) ? current : rect);
    };
    window.addEventListener(MINIMAP_VIEWPORT_EVENT, updateViewport);
    return () => window.removeEventListener(MINIMAP_VIEWPORT_EVENT, updateViewport);
  }, [viewportRect]);
  const jumpToTile = (event: PointerEvent<HTMLButtonElement>) => {
    const tile = minimapTileFromClientPoint(event, event.currentTarget.getBoundingClientRect(), grid);
    if (onJumpToTile !== undefined) {
      onJumpToTile(tile);
      return;
    }
    window.dispatchEvent(new CustomEvent(MINIMAP_CAMERA_JUMP_EVENT, { detail: tile }));
  };

  return (
    <div className="map-overview-wrap">
      <button
        type="button"
        className="map-overview"
        aria-label={KO_UI.map.jumpLabel}
        onPointerDown={jumpToTile}
      >
        <svg viewBox="0 0 120 120" role="img" aria-labelledby={titleId}>
          <title id={titleId}>{KO_UI.map.title}</title>
          <g>
            {samples.map((sample) => (
              <rect
                key={`${sample.x}:${sample.y}`}
                x={sample.x * MAP_CELL_SIZE}
                y={sample.y * MAP_CELL_SIZE}
                width={MAP_CELL_SIZE}
                height={MAP_CELL_SIZE}
                fill={terrainColour(sample.terrain)}
              />
            ))}
          </g>
          <rect
            className="map-overview-viewport"
            x={currentViewport.x}
            y={currentViewport.y}
            width={currentViewport.width}
            height={currentViewport.height}
          />
        </svg>
      </button>
    </div>
  );
}

export const MapShield = MapOverview;

function minimapViewportRectFromEvent(event: Event): MinimapViewportRect | null {
  if (!(event instanceof CustomEvent)) return null;
  const detail: unknown = event.detail;
  if (typeof detail !== "object" || detail === null) return null;
  if (!("x" in detail) || !("y" in detail) || !("width" in detail) || !("height" in detail)) return null;
  const { x, y, width, height } = detail;
  if (typeof x !== "number" || typeof y !== "number" || typeof width !== "number" || typeof height !== "number") return null;
  return { x, y, width, height };
}

function sameViewportRect(current: MinimapViewportRect | null, next: MinimapViewportRect): boolean {
  return current !== null && current.x === next.x && current.y === next.y && current.width === next.width && current.height === next.height;
}

function terrainColour(terrain: TerrainType): PaletteColor {
  switch (terrain) {
    case "grass": return SEMANTIC_PALETTE.sage;
    case "forest": return SEMANTIC_PALETTE.forest;
    case "water": return SEMANTIC_PALETTE.water;
    case "rock": return SEMANTIC_PALETTE.stone;
  }
}
