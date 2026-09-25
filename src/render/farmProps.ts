import type { GameState } from "../engine/engine.types";
import { boundaryHash } from "../world/boundary/boundaryGeometry";
import type { ForestBoundary } from "../world/boundary/terrainBoundaries";
import { zonesOf } from "../zones/zoneEdits";
import { farmsteadFieldWork } from "./farmsteadArt";
import { groundBoundaryScene } from "./groundBoundaryScene";
import { tileToScreen } from "./iso";
import { drawCroppedWorldSprite } from "./worldSprite";
import { ZONE_ASSETS, ZONE_VARIANTS } from "./zoneAssetManifest";
import { zoneAsset, zoneAssetRaster } from "./zoneAssets";

// Farm props (C1f, Wave 4c), display only: nothing moves, nothing is simulated, the same state gives the same props.
//  - Pasture zones: sheep flocks and cattle pairs, one per PASTURE_CELLS_PER_PROP owned cells (at least one), on cells
//    chosen by a position hash, at least PROP_SPACING tiles apart; two in three are sheep. A flock is one of the four
//    flocks (Wave 4c a, Wave 4e b / c / d, INSTALL-4e) by a cell hash, stepped on when that flock already grazes
//    within FLOCK_REPEAT_RADIUS in the same zone.
//  - Pigs (Wave 4e pig pair, INSTALL-4e): woodland common zones take one pair per PASTURE_CELLS_PER_PROP cells like the
//    pasture; with no such zone, pairs stand rarely on the forest edge (one fringe edge in PIG_EDGE_ODDS by the edge's
//    hash, as the fringe decals are picked), at least PIG_SPACING tiles apart and never on an orchard cell.
//  - Farmsteads (C1c-2 arableStripStates): while a strip it tends is `ploughed`, the ox plough team stands on that
//    strip's middle cell; while one is `harvested`, the ox hay cart does (first such strip in layout order).
// Drawn in the object pass like zone props (bottom-centre anchor from the zone asset manifest, never mirrored).

export type FarmPropKind = (typeof ZONE_VARIANTS.sheepFlock)[number] | "cattle_pair" | "pig_pair" | "ox_plough_team" | "ox_cart_hay";
export type FarmProp = { readonly kind: FarmPropKind; readonly x: number; readonly y: number; readonly id: string };

const PASTURE_CELLS_PER_PROP = 14;
const PROP_SPACING = 2.5;
const FLOCK_REPEAT_RADIUS = 5;
const PIG_EDGE_ODDS = 48;
const PIG_SPACING = 8;

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
      const cattle = hash(index, state.seed + 1) % 3 === 2;
      const flocks = ZONE_VARIANTS.sheepFlock;
      let flock = hash(index, state.seed + 2) % flocks.length;
      for (let step = 0; step < flocks.length; step += 1) {
        const candidate = flocks[(flock + step) % flocks.length]!;
        if (!placed.some(other => other.kind === candidate && Math.hypot(other.x - x, other.y - y) < FLOCK_REPEAT_RADIUS)) { flock = (flock + step) % flocks.length; break; }
      }
      const kind: FarmPropKind = cattle ? "cattle_pair" : flocks[flock]!;
      placed.push({ kind, x, y, id: `farm-prop:${zone.id}:${index}` });
    }
    props.push(...placed);
  }
  pastureCache.set(zones, props);
  return props;
}

/**
 * Pig pairs, cached on the zones array and the forest boundary (the ground scene's, replaced when the tiles change;
 * AGENTS rule 10: (a) keys = those two objects, (b) nothing else is read but the seed and width, fixed per state,
 * (c) one pass over the woodland zones or the fringe edges when either changes, not per frame).
 */
const pigCache = new WeakMap<object, WeakMap<object, readonly FarmProp[]>>();
function woodlandPigs(state: GameState): readonly FarmProp[] {
  const zones = zonesOf(state);
  const forest: ForestBoundary = groundBoundaryScene(state).forest;
  let byForest = pigCache.get(zones);
  if (byForest === undefined) { byForest = new WeakMap(); pigCache.set(zones, byForest); }
  const cached = byForest.get(forest);
  if (cached !== undefined) return cached;
  const pigs: FarmProp[] = [];
  const woodland = zones.filter(zone => zone.kind === "woodland_common" && zone.membership.length > 0);
  for (const zone of woodland) {
    const count = Math.max(1, Math.floor(zone.membership.length / PASTURE_CELLS_PER_PROP));
    const ranked = [...zone.membership].sort((a, b) => hash(a, state.seed + 3) - hash(b, state.seed + 3) || a - b);
    for (const index of ranked) {
      if (pigs.filter(pig => pig.id.startsWith(`farm-prop:${zone.id}:`)).length >= count) break;
      const x = index % state.width; const y = Math.floor(index / state.width);
      if (pigs.some(other => Math.hypot(other.x - x, other.y - y) < PROP_SPACING)) continue;
      pigs.push({ kind: "pig_pair", x, y, id: `farm-prop:${zone.id}:${index}` });
    }
  }
  if (woodland.length === 0) {
    const orchard = new Set(zones.filter(zone => zone.kind === "orchard").flatMap(zone => zone.membership));
    for (const decal of forest.decals.flat()) {
      if (boundaryHash(decal.edgeKey, state.seed, 61) % PIG_EDGE_ODDS !== 0) continue;
      const x = decal.anchor.x; const y = decal.anchor.y;
      if (orchard.has(Math.round(y) * state.width + Math.round(x))) continue;
      if (pigs.some(other => Math.hypot(other.x - x, other.y - y) < PIG_SPACING)) continue;
      pigs.push({ kind: "pig_pair", x, y, id: `farm-prop:forest-edge:${decal.edgeKey}` });
    }
  }
  byForest.set(forest, pigs);
  return pigs;
}

/** All farm props, cached on the pasture list, the pigs and the farmstead field work (each cached on its own inputs). */
const propCache = new WeakMap<object, WeakMap<object, WeakMap<object, readonly FarmProp[]>>>();
export function farmProps(state: GameState): readonly FarmProp[] {
  const pasture = pastureAnimals(state);
  const pigs = woodlandPigs(state);
  const fieldWork = farmsteadFieldWork(state);
  let byPigs = propCache.get(pasture);
  if (byPigs === undefined) { byPigs = new WeakMap(); propCache.set(pasture, byPigs); }
  let byWork = byPigs.get(pigs);
  if (byWork === undefined) { byWork = new WeakMap(); byPigs.set(pigs, byWork); }
  const cached = byWork.get(fieldWork);
  if (cached !== undefined) return cached;
  const props = [...pasture, ...pigs];
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
