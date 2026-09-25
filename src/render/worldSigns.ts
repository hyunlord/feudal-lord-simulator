import { PALETTE, SEMANTIC_PALETTE } from "../content/palette";
import { BUILDING_CONFIG_BY_KIND } from "../content/buildingConfig";
import type { GameState } from "../engine/engine.types";
import { buildingRoadAccessTiles } from "../engine/routing";
import { buildingFootprint } from "../geometry/buildingFootprint";
import { burgageParcels } from "../zones/zoneFillAgent";
import { tileToScreen } from "./iso";
import { applyPaletteStroke } from "./style";
import { visibilityArt } from "./visibilityArtManifest";
import { drawCroppedWorldSprite } from "./worldSprite";

// F0-V world signs (visibility design 3절, the P0 three): the world says what needs doing before an icon does.
//  - S1 empty plot: a stake on each burgage plot with no house and no house site yet ("여기 지을 수 있음").
//  - S2 road cut: dirt footprints from a building that needs a road but touches none, toward the nearest road.
//  - S4 cold house: residents but no bread in store, so no smoke (roofSmoke) — only its emphasis is drawn here.
// At most MAX_EMPHASIS signs are emphasised (a slow ring), road cut first, then cold houses, then empty plots,
// nearest the view's centre first. Everything is read from the state; nothing is stored.
export type WorldSignKind = "road_cut" | "cold_house" | "empty_plot";
export type WorldSign = Readonly<{ kind: WorldSignKind; tx: number; ty: number; toward: { readonly tx: number; readonly ty: number } | null }>;
export const MAX_EMPHASIS = 3;
const PRIORITY: Readonly<Record<WorldSignKind, number>> = { road_cut: 0, cold_house: 1, empty_plot: 2 };
const ROAD_SEARCH = 10;

// Cache: keyed by the state object (a new object every tick or edit), so every input (buildings, houses, zones,
// tiles, sites) is in the key; the signs are recomputed once per state instead of once per frame
// (measurement: the F0-V report's frame-time table).
const cache = new WeakMap<GameState, readonly WorldSign[]>();

export function worldSigns(state: GameState): readonly WorldSign[] {
  const hit = cache.get(state);
  if (hit !== undefined) return hit;
  const occupied = new Set<number>();
  for (const building of state.buildings) {
    const size = buildingFootprint(building);
    for (let dy = 0; dy < size.height; dy += 1) for (let dx = 0; dx < size.width; dx += 1) occupied.add((building.ty + dy) * state.width + building.tx + dx);
  }
  for (const site of state.constructionSites) if ("tx" in site) occupied.add(site.ty * state.width + site.tx);
  const signs: WorldSign[] = [];
  for (const building of state.buildings) {
    if (!BUILDING_CONFIG_BY_KIND[building.kind].requiresRoad || buildingRoadAccessTiles(state, building).length > 0) continue;
    signs.push({ kind: "road_cut", tx: building.tx, ty: building.ty, toward: nearestRoad(state, building.tx, building.ty) });
  }
  for (const house of state.houses) {
    if (house.residents <= 0 || house.breadStock > 0) continue;
    const building = state.buildings.find(candidate => candidate.id === house.buildingId);
    if (building !== undefined) signs.push({ kind: "cold_house", tx: building.tx, ty: building.ty, toward: null });
  }
  for (const parcel of burgageParcels(state)) {
    if (parcel.cells.some(cell => occupied.has(cell.ty * state.width + cell.tx))) continue;
    signs.push({ kind: "empty_plot", tx: parcel.anchor.tx, ty: parcel.anchor.ty, toward: null });
  }
  cache.set(state, signs);
  return signs;
}

function nearestRoad(state: GameState, tx: number, ty: number): { readonly tx: number; readonly ty: number } | null {
  let best: { tx: number; ty: number; d: number } | null = null;
  for (let dy = -ROAD_SEARCH; dy <= ROAD_SEARCH; dy += 1) for (let dx = -ROAD_SEARCH; dx <= ROAD_SEARCH; dx += 1) {
    const x = tx + dx, y = ty + dy;
    if (x < 0 || y < 0 || x >= state.width || y >= state.height || state.tiles[y * state.width + x]?.hasRoad !== true) continue;
    const d = Math.abs(dx) + Math.abs(dy);
    if (best === null || d < best.d) best = { tx: x, ty: y, d };
  }
  return best === null ? null : { tx: best.tx, ty: best.ty };
}

/** The emphasised signs: priority, then nearest to `centre` (world screen coordinates). */
export function emphasisedSigns(signs: readonly WorldSign[], centre: { readonly x: number; readonly y: number }): readonly WorldSign[] {
  const distance = (sign: WorldSign) => { const at = tileToScreen(sign.tx, sign.ty); return Math.hypot(at.sx - centre.x, at.sy - centre.y); };
  return [...signs].sort((a, b) => PRIORITY[a.kind] - PRIORITY[b.kind] || distance(a) - distance(b)).slice(0, MAX_EMPHASIS);
}

export function drawWorldSigns(context: CanvasRenderingContext2D, state: GameState,
  camera: { readonly zoom: number; readonly panX: number; readonly panY: number }, viewport: { readonly width: number; readonly height: number }): void {
  const zoom = camera.zoom;
  const centre = { x: (viewport.width / 2 - camera.panX) / zoom, y: (viewport.height / 2 - camera.panY) / zoom };
  const signs = worldSigns(state);
  if (signs.length === 0) return;
  context.save();
  const stake = visibilityArt("stake_empty_plot");
  for (const sign of signs) {
    const at = tileToScreen(sign.tx, sign.ty);
    if (sign.kind === "empty_plot" && stake !== null) {
      drawCroppedWorldSprite(context, stake, { x: 0, y: 0, width: 32, height: 48 }, { x: at.sx - 8, y: at.sy - 20, width: 16, height: 24 }, false, true);
    } else if (sign.kind === "road_cut" && sign.toward !== null) {
      drawDirtTrack(context, at, tileToScreen(sign.toward.tx, sign.toward.ty));
    }
  }
  // The emphasis is a steady ring (a frame is a function of the state and the camera only: no wall-clock pulse).
  for (const sign of emphasisedSigns(signs, centre)) {
    const at = tileToScreen(sign.tx, sign.ty);
    applyPaletteStroke(context, sign.kind === "empty_plot" ? SEMANTIC_PALETTE.vellum : PALETTE.gold, 1.8 / Math.max(zoom, 0.5));
    context.globalAlpha = 0.75;
    context.beginPath();
    context.ellipse(at.sx, at.sy + 4, 26, 13, 0, 0, Math.PI * 2);
    context.stroke();
    context.globalAlpha = 1;
  }
  context.restore();
}

/** Footprints in the dirt from the building toward the road (every half tile, fading with distance). */
function drawDirtTrack(context: CanvasRenderingContext2D, from: { readonly sx: number; readonly sy: number }, to: { readonly sx: number; readonly sy: number }): void {
  const length = Math.hypot(to.sx - from.sx, to.sy - from.sy);
  const steps = Math.max(2, Math.min(10, Math.floor(length / 18)));
  context.fillStyle = SEMANTIC_PALETTE.earthDark;
  for (let index = 1; index <= steps; index += 1) {
    const t = index / (steps + 1);
    const side = index % 2 === 0 ? 3 : -3;
    context.globalAlpha = 0.55 * (1 - t * 0.6);
    context.beginPath();
    context.ellipse(from.sx + (to.sx - from.sx) * t + side, from.sy + (to.sy - from.sy) * t + 6, 3, 1.6, 0, 0, Math.PI * 2);
    context.fill();
  }
  context.globalAlpha = 1;
}
