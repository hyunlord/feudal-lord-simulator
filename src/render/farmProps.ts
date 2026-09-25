import type { GameState } from "../engine/engine.types";
import { zonesOf } from "../zones/zoneEdits";
import { farmsteadFieldWork } from "./farmsteadArt";
import { tileToScreen } from "./iso";
import { drawCroppedWorldSprite } from "./worldSprite";
import { ZONE_ASSETS } from "./zoneAssetManifest";
import { zoneAsset, zoneAssetRaster } from "./zoneAssets";

// Farm props (C1f, Wave 4c), display only: nothing moves, nothing is simulated, the same state gives the same props.
//  - Pasture zones: sheep flocks and cattle pairs, one per PASTURE_CELLS_PER_PROP owned cells (at least one), on cells
//    chosen by a position hash, at least PROP_SPACING tiles apart; two in three are sheep.
//  - Farmsteads (C1c-2 arableStripStates): while a strip it tends is `ploughed`, the ox plough team stands on that
//    strip's middle cell; while one is `harvested`, the ox hay cart does (first such strip in layout order).
// Drawn in the object pass like zone props (bottom-centre anchor from the zone asset manifest, never mirrored).

export type FarmPropKind = "sheep_flock" | "cattle_pair" | "ox_plough_team" | "ox_cart_hay";
export type FarmProp = { readonly kind: FarmPropKind; readonly x: number; readonly y: number; readonly id: string };

const PASTURE_CELLS_PER_PROP = 14;
const PROP_SPACING = 2.5;

function hash(a: number, b: number): number {
  let h = (Math.imul(a, 0x9e3779b1) ^ Math.imul(b + 0x7f4a7c15, 0x85ebca6b)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d) >>> 0;
  return (h ^ (h >>> 15)) >>> 0;
}

/** Pasture animals, cached on the zones array (zone edits replace it; nothing else is read). */
const pastureCache = new WeakMap<object, readonly FarmProp[]>();
function pastureAnimals(state: Pick<GameState, "zones" | "width" | "seed">): readonly FarmProp[] {
  const zones = zonesOf(state);
  const cached = pastureCache.get(zones);
  if (cached !== undefined) return cached;
  const props: FarmProp[] = [];
  for (const zone of zones) {
    if (zone.kind !== "pasture" || zone.membership.length === 0) continue;
    const count = Math.max(1, Math.floor(zone.membership.length / PASTURE_CELLS_PER_PROP));
    const ranked = [...zone.membership].sort((a, b) => hash(a, state.seed) - hash(b, state.seed) || a - b);
    const placed: FarmProp[] = [];
    for (const index of ranked) {
      if (placed.length >= count) break;
      const x = index % state.width; const y = Math.floor(index / state.width);
      if (placed.some(other => Math.hypot(other.x - x, other.y - y) < PROP_SPACING)) continue;
      const kind: FarmPropKind = hash(index, state.seed + 1) % 3 === 2 ? "cattle_pair" : "sheep_flock";
      placed.push({ kind, x, y, id: `farm-prop:${zone.id}:${index}` });
    }
    props.push(...placed);
  }
  pastureCache.set(zones, props);
  return props;
}

/** All farm props, cached on the pasture list and the farmstead field work (both cached on their own inputs). */
const propCache = new WeakMap<object, WeakMap<object, readonly FarmProp[]>>();
export function farmProps(state: GameState): readonly FarmProp[] {
  const pasture = pastureAnimals(state);
  const fieldWork = farmsteadFieldWork(state);
  let byWork = propCache.get(pasture);
  if (byWork === undefined) { byWork = new WeakMap(); propCache.set(pasture, byWork); }
  const cached = byWork.get(fieldWork);
  if (cached !== undefined) return cached;
  const props = [...pasture];
  for (const [farmsteadId, work] of fieldWork) {
    for (const [cells, kind] of [[work.ploughed, "ox_plough_team"], [work.harvested, "ox_cart_hay"]] as const) {
      if (cells === null || cells.length === 0) continue;
      const cell = cells[Math.floor(cells.length / 2)] as { readonly tx: number; readonly ty: number };
      props.push({ kind, x: cell.tx, y: cell.ty, id: `farm-prop:${farmsteadId}:${kind}` });
    }
  }
  byWork.set(fieldWork, props);
  return props;
}

export function drawFarmProp(context: CanvasRenderingContext2D, prop: FarmProp): void {
  const meta = ZONE_ASSETS.find(asset => asset.key === prop.kind);
  const image = zoneAsset(prop.kind);
  if (meta === undefined || meta.role !== "prop" || image === null) return;
  const raster = zoneAssetRaster(prop.kind);
  const foot = tileToScreen(prop.x, prop.y);
  const width = meta.displayWidth; const height = width * meta.height / meta.width;
  drawCroppedWorldSprite(context, raster?.image ?? image, raster?.source ?? { x: 0, y: 0, width: meta.width, height: meta.height },
    { x: foot.sx - width * meta.anchorX / meta.width, y: foot.sy - height * meta.anchorY / meta.height, width, height }, false, true);
}
