import { useId, useMemo } from "react";

import { KO_UI } from "../content/locale.ko";
import { SEMANTIC_PALETTE, type PaletteColor } from "../content/palette";
import type { TerrainType } from "../content/terrainConfig";
import type { Grid } from "../world/grid";

const SAMPLE_AXIS_LIMIT = 12;

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

type MapShieldProps = { readonly grid: Grid };

export function MapShield({ grid }: MapShieldProps) {
  const { height, tiles, width } = grid;
  const idPrefix = useId().replaceAll(":", "");
  const titleId = `${idPrefix}-map-shield-title`;
  const clipId = `${idPrefix}-terrain-shield-clip`;
  const samples = useMemo(
    () => sampleMinimapTiles({ height, tiles, width }),
    [height, tiles, width],
  );

  return (
    <div className="map-shield-wrap">
      <svg className="map-shield" viewBox="0 0 96 104" role="img" aria-labelledby={titleId}>
        <title id={titleId}>{KO_UI.map.title}</title>
        <defs>
          <clipPath id={clipId}>
            <path d="M48 3 90 17v36c0 24-17 40-42 48C23 93 6 77 6 53V17Z" />
          </clipPath>
        </defs>
        <g clipPath={`url(#${clipId})`}>
          {samples.map((sample) => (
            <rect
              key={`${sample.x}:${sample.y}`}
              x={sample.x * 8}
              y={sample.y * 8}
              width="8"
              height="8"
              fill={terrainColour(sample.terrain)}
            />
          ))}
        </g>
        <path d="M48 3 90 17v36c0 24-17 40-42 48C23 93 6 77 6 53V17Z" fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>
      <span className="shield-caption">{KO_UI.map.caption}</span>
    </div>
  );
}

function terrainColour(terrain: TerrainType): PaletteColor {
  switch (terrain) {
    case "grass": return SEMANTIC_PALETTE.sage;
    case "forest": return SEMANTIC_PALETTE.forest;
    case "water": return SEMANTIC_PALETTE.water;
    case "rock": return SEMANTIC_PALETTE.stone;
  }
}
