import { SEMANTIC_PALETTE } from "../content/palette";
import type { BoundaryPoint } from "../world/boundary/boundaryGeometry";
import type { FieldCluster, FieldEdgeDecal, ForestBoundary } from "../world/boundary/terrainBoundaries";
import { boundaryAsset } from "./boundaryAssets";
import type { BoundaryAssetKey } from "./boundaryAssetManifest";
import { tileToScreen } from "./iso";
import { getTerrainPattern, terrainPatternQuarterTurn, TERRAIN_TEXTURE_COMPOSITE_OPACITY, type TerrainPatternAssets } from "./terrainPatterns";
import { drawCroppedWorldSprite } from "./worldSprite";

// Forest edge and field outlines for the V2 ground chunks. Forest tiles are painted as grass first; the smoothed
// forest loops are then filled with the forest floor (even-odd, so enclosed clearings stay grass), and fringe decals
// are stamped on the shared line. Fields: one soil area per cluster outline, furrows on shared farm edges, grass
// edges along the outline.

const FRINGE_KEYS = ["forest_fringe_a", "forest_fringe_b", "forest_fringe_c"] as const satisfies readonly BoundaryAssetKey[];
const FRINGE_SIZE = { width: 64, height: 48, anchorX: 32, anchorY: 42 } as const;
const FIELD_DECAL_SIZE = { width: 64, height: 32 } as const;

type ScreenBounds = { readonly left: number; readonly top: number; readonly right: number; readonly bottom: number };

export function drawForestFill(
  context: CanvasRenderingContext2D,
  forest: ForestBoundary,
  loops: readonly number[],
  parity: boolean,
  chunkScreen: ScreenBounds,
  region: { readonly tx: number; readonly ty: number },
  seed: number,
  terrainPatterns?: TerrainPatternAssets,
): void {
  if (loops.length === 0 && !parity) return;
  const trace = (): void => {
    context.beginPath();
    for (const index of loops) traceLoop(context, forest.loops[index]?.smoothed ?? []);
    if (parity) {
      context.moveTo(chunkScreen.left, chunkScreen.top); context.lineTo(chunkScreen.right, chunkScreen.top);
      context.lineTo(chunkScreen.right, chunkScreen.bottom); context.lineTo(chunkScreen.left, chunkScreen.bottom);
      context.closePath();
    }
  };
  trace();
  context.fillStyle = SEMANTIC_PALETTE.forest;
  context.fill("evenodd");
  const pattern = getTerrainPattern(context, "forest_floor", terrainPatterns,
    terrainPatternQuarterTurn("forest_floor", region.tx, region.ty, seed));
  if (pattern === null) return;
  const previousAlpha = context.globalAlpha;
  context.globalAlpha = previousAlpha * TERRAIN_TEXTURE_COMPOSITE_OPACITY;
  context.fillStyle = pattern;
  context.fill("evenodd");
  context.globalAlpha = previousAlpha;
}

export function drawForestFringeDecals(context: CanvasRenderingContext2D, forest: ForestBoundary, loops: readonly number[]): void {
  const decals = loops.flatMap(index => forest.decals[index] ?? [])
    .map(decal => ({ decal, screen: tileToScreen(decal.anchor.x, decal.anchor.y) }))
    .sort((a, b) => a.screen.sy - b.screen.sy || a.screen.sx - b.screen.sx || a.decal.edgeKey - b.decal.edgeKey);
  for (const { decal, screen } of decals) {
    const image = boundaryAsset(FRINGE_KEYS[decal.variant % FRINGE_KEYS.length] as BoundaryAssetKey);
    if (image === null) continue;
    const width = FRINGE_SIZE.width * decal.scale; const height = FRINGE_SIZE.height * decal.scale;
    stamp(context, image, { x: screen.sx - FRINGE_SIZE.anchorX * decal.scale, y: screen.sy - FRINGE_SIZE.anchorY * decal.scale, width, height },
      decal.flipX ? screen.sx : null);
  }
}

export function drawFieldClusters(context: CanvasRenderingContext2D, fields: readonly FieldCluster[], clusters: readonly number[]): void {
  for (const index of clusters) {
    const field = fields[index];
    if (field === undefined) continue;
    context.save();
    context.beginPath();
    for (const loop of field.loops) traceLoop(context, loop.smoothed);
    context.fillStyle = SEMANTIC_PALETTE.earthDark;
    context.fill("evenodd");
    context.clip("evenodd");
    context.restore();
  }
  const decals = clusters.flatMap(index => fields[index]?.decals ?? [])
    .map(decal => ({ decal, screen: tileToScreen(decal.anchor.x, decal.anchor.y) }))
    .sort((a, b) => fieldDecalOrder(a.decal) - fieldDecalOrder(b.decal) || a.screen.sy - b.screen.sy || a.screen.sx - b.screen.sx);
  for (const { decal, screen } of decals) {
    const image = boundaryAsset(decal.kind === "furrow" ? "field_furrow" : "grass_edge");
    if (image === null) continue;
    const width = FIELD_DECAL_SIZE.width * decal.length; const height = FIELD_DECAL_SIZE.height * decal.length;
    stamp(context, image, { x: screen.sx - width / 2, y: screen.sy - height / 2, width, height }, decal.axis === "x" ? screen.sx : null);
  }
}

function fieldDecalOrder(decal: FieldEdgeDecal): number { return decal.kind === "furrow" ? 0 : 1; }

function stamp(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  destination: { readonly x: number; readonly y: number; readonly width: number; readonly height: number },
  mirrorAboutX: number | null,
): void {
  const source = { x: 0, y: 0, width: image.naturalWidth || image.width, height: image.naturalHeight || image.height };
  if (mirrorAboutX === null) { drawCroppedWorldSprite(context, image, source, destination, false, true); return; }
  context.save();
  context.translate(mirrorAboutX * 2, 0);
  context.scale(-1, 1);
  drawCroppedWorldSprite(context, image, source, destination, false, true);
  context.restore();
}

function traceLoop(context: CanvasRenderingContext2D, points: readonly BoundaryPoint[]): void {
  points.forEach((point, index) => {
    const screen = tileToScreen(point.x, point.y);
    if (index === 0) context.moveTo(screen.sx, screen.sy);
    else context.lineTo(screen.sx, screen.sy);
  });
  if (points.length > 0) context.closePath();
}
