import type { GameState } from '../src/engine/engine.types';
import { buildingFootprint } from '../src/geometry/buildingFootprint';
import { buildBuildingVisualState } from '../src/render/buildingVisualState';
import { worldToCanvas } from '../src/render/camera';
import { problemMarkerKind } from '../src/render/drawBuildingDetails';
import { drawBuildings } from '../src/render/drawBuildings';
import { tileToScreen } from '../src/render/iso';
import { preloadGameArt } from '../src/render/preloadGameArt';
import { computeVisibleTileRange, objectRenderItemsForFrame, renderFrame, visibleTilesInDrawOrder } from '../src/render/renderer';
import { CANVAS_SURROUND_COLOR } from '../src/render/worldBackdrop';
import { setObjectRenderViewMode } from '../src/render/objectRenderViewMode';
import { efficientAssetFailures } from './efficientGrowthCaptureAssets';

export const CAPTURE_VIEWPORT = { width: 1600, height: 1100 } as const;
export function efficientCaptureCamera(state: GameState) {
  if (state.buildings.length === 0) throw new RangeError('Cannot center a city without completed buildings');
  const corners = state.buildings.flatMap(building => {
    const size = buildingFootprint(building);
    const points = [[building.tx - 0.5, building.ty - 0.5], [building.tx + size.width - 0.5, building.ty - 0.5],
      [building.tx - 0.5, building.ty + size.height - 0.5],
      [building.tx + size.width - 0.5, building.ty + size.height - 0.5]] as const;
    return points.map(([tx, ty]) => tileToScreen(tx, ty));
  });
  const centerX = (Math.min(...corners.map(point => point.sx)) + Math.max(...corners.map(point => point.sx))) / 2;
  const centerY = (Math.min(...corners.map(point => point.sy)) + Math.max(...corners.map(point => point.sy))) / 2;
  return { zoom: 0.9, panX: CAPTURE_VIEWPORT.width / 2 - centerX * 0.9, panY: CAPTURE_VIEWPORT.height / 2 - centerY * 0.9 };
}

/** Saved final-state replay: uses the product renderFrame, never advances simulation. */
export async function captureEfficientCity(state: GameState) {
  if (window.devicePixelRatio !== 1) throw new RangeError('Capture requires DPR 1');
  const inputState = JSON.stringify(state);
  const stateSha256 = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(inputState)))]
    .map(value => value.toString(16).padStart(2, '0')).join('');
  await preloadGameArt();
  const assetFailures = efficientAssetFailures();
  const canvas = document.createElement('canvas');
  canvas.width = CAPTURE_VIEWPORT.width;
  canvas.height = CAPTURE_VIEWPORT.height;
  document.body.replaceChildren(canvas);
  document.body.style.margin = '0';
  const context = canvas.getContext('2d');
  if (context === null) throw new Error('Canvas 2D unavailable');
  const camera = efficientCaptureCamera(state);
  setObjectRenderViewMode('normal');
  context.fillStyle = CANVAS_SURROUND_COLOR;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.setTransform(camera.zoom, 0, 0, camera.zoom, camera.panX, camera.panY);
  renderFrame({ context, state, camera, viewport: CAPTURE_VIEWPORT, nowMs: 0,
    preview: { tile: null, tool: null, footprint: [], roadPath: [], ok: true, reason: null, cursor: null } });
  const range = computeVisibleTileRange({ camera, viewport: CAPTURE_VIEWPORT, world: state });
  const visibleTiles = visibleTilesInDrawOrder({ grid: state, range });
  const queue = objectRenderItemsForFrame({ state, visibleTiles, range, includeGroundCover: true });
  const probe = document.createElement('canvas');
  probe.width = canvas.width;
  probe.height = canvas.height;
  const probeContext = probe.getContext('2d', { willReadFrequently: true });
  if (probeContext === null) throw new Error('Visibility canvas unavailable');
  const buildingIds = new Set<string>();
  const warningIds = new Set<string>();
  for (const item of queue) {
    if (item.kind !== 'building') continue;
    probeContext.resetTransform();
    probeContext.clearRect(0, 0, probe.width, probe.height);
    probeContext.setTransform(camera.zoom, 0, 0, camera.zoom, camera.panX, camera.panY);
    drawBuildings(probeContext, { state, tiles: visibleTiles, range, zoom: camera.zoom, camera,
      viewport: CAPTURE_VIEWPORT, dpr: 1, objectRenderItems: [item], viewMode: 'normal', nowMs: 0 });
    const pixels = probeContext.getImageData(0, 0, probe.width, probe.height).data;
    let hasPixels = false;
    for (let offset = 3; offset < pixels.length; offset += 4) {
      if ((pixels[offset] ?? 0) > 0) { hasPixels = true; break; }
    }
    if (!hasPixels) continue;
    buildingIds.add(item.id);
    const visualState = buildBuildingVisualState(item.building, state.houses);
    if (problemMarkerKind({ kind: item.building.kind, visualState }) === null) continue;
    const size = buildingFootprint(item.building);
    const center = tileToScreen(item.building.tx + (size.width - 1) / 2, item.building.ty + (size.height - 1) / 2);
    const marker = worldToCanvas({ x: center.sx + 16, y: center.sy - 39 }, camera);
    if (marker.x + 10 * camera.zoom >= 0 && marker.x - 10 * camera.zoom < canvas.width &&
      marker.y + 13 * camera.zoom >= 0 && marker.y - 10 * camera.zoom < canvas.height) warningIds.add(item.id);
  }
  if (JSON.stringify(state) !== inputState) throw new Error('Renderer modified the supplied final state');
  return { stateSha256, jpeg: canvas.toDataURL('image/jpeg', 0.68), ...CAPTURE_VIEWPORT, dpr: 1, zoom: camera.zoom, camera,
    tick: state.tick, seed: state.seed, assetsLoaded: assetFailures.length === 0, assetFailures,
    buildings: buildingIds.size, warnings: warningIds.size, buildingIds: [...buildingIds], warningIds: [...warningIds],
    visibility: 'Product queue and per-building clipped draw pixels; overlapping buildings counted, warnings conservatively counted before occlusion',
    classification: 'Product renderer replay of unmodified final state, not live UI play' };
}
