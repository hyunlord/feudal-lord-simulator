import { drawUiIcon } from "../ui/uiArt";
import { PALETTE, SEMANTIC_PALETTE } from "../content/palette";
import { BUILDING_CONFIG_BY_KIND, operationSuspended, type Building } from "../content/buildingConfig";
import { marketHasSaleCandidate } from "../engine/marketSettlement";
import { isMarketDay } from "../ui/residentTrips";
import type { GameState } from "../engine/engine.types";
import { buildingRoadAccessTiles } from "../engine/routing";
import { buildingFootprint } from "../geometry/buildingFootprint";
import { housePressureStatus } from "../population/housePressure";
import { persistentSignals } from "./signalPersistence";
import { burgageParcels } from "../zones/zoneFillAgent";
import { tileToScreen } from "./iso";
import { applyPaletteStroke } from "./style";
import { visibilityArt } from "./visibilityArtManifest";
import { drawCroppedWorldSprite } from "./worldSprite";
import { drawWave7 } from "./wave7Art";
export { drawSeasonalDecals } from "./seasonalDecals"; // one renderer import for the world's ground and signs
export { drawStoryWorldOverlays } from "./wetSummer"; // UI-4 story overlays (S12 departures, rain)

// World signs (visibility design 3절; F0-V the P0 three, INSTALL-7 the Wave 7 art and the rest): the world says what
// needs doing before an icon does.
//  - S1 empty plot: a stake and long grass on each burgage plot with no house and no house site yet.
//  - S2 road cut: dotted footprints from a building that needs a road but touches none, toward the nearest road.
//  - S4 cold house: residents but no bread in store, so no smoke (roofSmoke) — only its emphasis is drawn here.
//  - S6 empty stall: a market on a market day with nothing to sell.
//  - S9 idle latch: a building whose operation is paused or unpaid, a bar across its door.
//  - S12 leaving family: an F0-A household preparing to leave (stage 1), its bundles at the door.
//  - abandoned house: F0-A stage 2 — the boarded windows are a building overlay (buildingOverlays.ts); the ring is here.
// S2, S4 (and S8 on the plaques) wait one distribution cycle (R0-1, signalPersistence.ts); the rest show at once.
// At most MAX_EMPHASIS signs in view are emphasised (a steady ring), in PRIORITY order, nearest the view's centre
// first. Everything is read from the state; nothing is stored.
export type WorldSignKind = "road_cut" | "cold_house" | "leaving_family" | "abandoned_house" | "idle_latch" | "empty_stall" | "empty_plot";
export type WorldSign = Readonly<{ kind: WorldSignKind; tx: number; ty: number; toward: { readonly tx: number; readonly ty: number } | null }>;
export const MAX_EMPHASIS = 3;
const PRIORITY: Readonly<Record<WorldSignKind, number>> = {
  road_cut: 0, cold_house: 1, leaving_family: 2, abandoned_house: 3, idle_latch: 4, empty_stall: 5, empty_plot: 6,
};
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
  // R0-1: S2 and S4 show once their condition has held for a distribution cycle (signalPersistence).
  const cut = state.buildings.filter(building => BUILDING_CONFIG_BY_KIND[building.kind].requiresRoad && buildingRoadAccessTiles(state, building).length === 0);
  const cutShown = persistentSignals("road_cut", state, cut.map(building => building.id));
  const coldHouses = state.houses.filter(house => housePressureStatus(house) === "settled" && house.residents > 0 && house.breadStock <= 0);
  const byId = new Map(coldHouses.map(house => [house.buildingId, house]));
  // An empty larder counts from the engine's shortage start where it keeps one (FP-3 foodShortSinceTick).
  const coldShown = persistentSignals("cold_house", state, coldHouses.map(house => house.buildingId), id => byId.get(id)!.foodShortSinceTick);
  for (const building of cut) {
    if (!cutShown.has(building.id)) continue;
    const toward = nearestRoad(state, building.tx, building.ty);
    // The track starts from the footprint's edge tile nearest that road (a farm's anchor is under its field).
    const size = buildingFootprint(building);
    const edge = toward === null ? { tx: building.tx, ty: building.ty }
      : { tx: Math.max(building.tx, Math.min(building.tx + size.width - 1, toward.tx)), ty: Math.max(building.ty, Math.min(building.ty + size.height - 1, toward.ty)) };
    signs.push({ kind: "road_cut", tx: edge.tx, ty: edge.ty, toward });
  }
  const buildingById = new Map(state.buildings.map(building => [building.id, building]));
  const middle = (building: Building) => {
    const size = buildingFootprint(building); // a ring goes round the footprint's middle, not its top corner
    return { tx: building.tx + (size.width - 1) / 2, ty: building.ty + (size.height - 1) / 2 };
  };
  for (const house of state.houses) {
    const building = buildingById.get(house.buildingId);
    if (building === undefined) continue;
    const pressure = housePressureStatus(house);
    if (pressure === "leaving") signs.push({ kind: "leaving_family", ...middle(building), toward: null });
    else if (pressure === "abandoned") signs.push({ kind: "abandoned_house", ...middle(building), toward: null });
    else if (coldShown.has(house.buildingId)) signs.push({ kind: "cold_house", ...middle(building), toward: null });
  }
  const marketDay = isMarketDay(state.tick);
  for (const building of state.buildings) {
    if (operationSuspended(building)) signs.push({ kind: "idle_latch", ...middle(building), toward: null });
    if (marketDay && building.kind === "market" && !marketHasSaleCandidate(state, building)) signs.push({ kind: "empty_stall", ...middle(building), toward: null });
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

/** The emphasised signs among those within `reach` of `centre` (world screen coordinates; an off-screen sign never
 * takes a ring from one in view): priority, then nearest first. */
export function emphasisedSigns(signs: readonly WorldSign[], centre: { readonly x: number; readonly y: number }, reach = Infinity): readonly WorldSign[] {
  const distance = (sign: WorldSign) => { const at = tileToScreen(sign.tx, sign.ty); return Math.hypot(at.sx - centre.x, at.sy - centre.y); };
  return signs.filter(sign => distance(sign) <= reach)
    .sort((a, b) => PRIORITY[a.kind] - PRIORITY[b.kind] || distance(a) - distance(b)).slice(0, MAX_EMPHASIS);
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
    if (sign.kind === "empty_plot") {
      drawWave7(context, "tall_grass_plot", at.sx, at.sy + 14, SIGN_DECAL_SCALE);
      if (stake !== null) drawCroppedWorldSprite(context, stake, { x: 0, y: 0, width: 32, height: 48 }, { x: at.sx - 8, y: at.sy - 20, width: 16, height: 24 }, false, true);
    } else if (sign.kind === "road_cut" && sign.toward !== null) {
      if (!drawDottedTrack(context, sign, sign.toward)) drawDirtTrack(context, at, tileToScreen(sign.toward.tx, sign.toward.ty));
    } else if (sign.kind === "leaving_family") {
      drawWave7(context, "bundle_family_prop", at.sx + 18, at.sy + 14, SIGN_PROP_SCALE);
      drawUiIcon(context, "cause", "food", at.sx, at.sy - 44, 20); // UI-3: why they leave (FP-3 food shortage)
    } else if (sign.kind === "idle_latch") {
      drawWave7(context, "bar_latch", at.sx + 14, at.sy + 12, SIGN_PROP_SCALE);
    } else if (sign.kind === "empty_stall") {
      drawWave7(context, "empty_stall", at.sx + 40, at.sy + 26, SIGN_STALL_SCALE);
    }
  }
  // The emphasis is a steady ring (a frame is a function of the state and the camera only: no wall-clock pulse).
  for (const sign of emphasisedSigns(signs, centre, Math.hypot(viewport.width, viewport.height) / 2 / zoom)) {
    const at = tileToScreen(sign.tx, sign.ty);
    context.globalAlpha = 0.9;
    // Ink under the colour: the ring stays readable over thatch, tile roofs, soil and grass alike.
    for (const [colour, stroke] of [[PALETTE.ink, 4.2], [sign.kind === "empty_plot" ? SEMANTIC_PALETTE.vellum : PALETTE.gold, 2.2]] as const) {
      applyPaletteStroke(context, colour, Math.max(zoom, 0.5) / stroke); // line width stroke / zoom (the helper takes 1 / width)
      context.beginPath();
      context.ellipse(at.sx, at.sy + 4, 26, 13, 0, 0, Math.PI * 2);
      context.stroke();
    }
    context.globalAlpha = 1;
  }
  context.restore();
}

const SIGN_DECAL_SCALE = 0.5; // 128 x 64 decals over a 64 x 32 tile
const SIGN_PROP_SCALE = 0.42; // 48 px props: about 20 px at zoom 1
const SIGN_STALL_SCALE = 0.4;

/** INSTALL-7 S2: the Wave 7 dotted footprints, one decal per tile from the building's edge to the road, laid along
 * the step's axis (the `ne` decal runs with ty, the `nw` decal with tx); false while the art loads. */
function drawDottedTrack(context: CanvasRenderingContext2D, from: { readonly tx: number; readonly ty: number }, to: { readonly tx: number; readonly ty: number }): boolean {
  const steps = Math.max(1, Math.max(Math.abs(to.tx - from.tx), Math.abs(to.ty - from.ty)));
  const key = Math.abs(to.ty - from.ty) >= Math.abs(to.tx - from.tx) ? "footprints_dotted_ne" : "footprints_dotted_nw";
  for (let index = 1; index <= steps; index += 1) {
    const t = (index - 0.5) / steps;
    const at = tileToScreen(from.tx + (to.tx - from.tx) * t, from.ty + (to.ty - from.ty) * t);
    context.globalAlpha = 0.85 - 0.35 * t;
    if (!drawWave7(context, key, at.sx, at.sy + 14, SIGN_DECAL_SCALE)) { context.globalAlpha = 1; return false; }
  }
  context.globalAlpha = 1;
  return true;
}

/** Footprints from the building's edge to the road (about every third of a tile, fading toward the road). */
function drawDirtTrack(context: CanvasRenderingContext2D, from: { readonly sx: number; readonly sy: number }, to: { readonly sx: number; readonly sy: number }): void {
  const length = Math.hypot(to.sx - from.sx, to.sy - from.sy);
  const steps = Math.max(3, Math.min(12, Math.floor(length / 10)));
  context.fillStyle = PALETTE.ink;
  for (let index = 0; index <= steps; index += 1) {
    const t = index / steps;
    const side = index % 2 === 0 ? 3.5 : -3.5;
    context.globalAlpha = 0.7 * (1 - t * 0.5);
    context.beginPath();
    context.ellipse(from.sx + (to.sx - from.sx) * t + side, from.sy + (to.sy - from.sy) * t + 8, 4, 2, 0, 0, Math.PI * 2);
    context.fill();
  }
  context.globalAlpha = 1;
}
