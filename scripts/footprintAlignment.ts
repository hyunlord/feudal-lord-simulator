// Completed-building art vs its footprint diamond (render fix R0-2): every art the game draws for a finished building
// — house levels (single and pair lots), historical facilities, the animated mill, the farmstead, the anchor sprites
// and every Wave 2 variant — is placed the way its draw path places it (the path's own rect function or meta), its
// opaque pixels (alpha >= 128) are mapped to world pixels and the art's ground contour is compared with the footprint
// diamond the building occupies:
//  - `dy`: the art's lowest opaque pixel minus the diamond's front vertex (positive = the art sinks below the plot);
//  - `centre`: the centre of the art's alpha extent; `width`: that extent over the diamond's width (an art sized
//    for one tile on a 2 x 2 plot is ~0.5); `dx` / `foot` (the ground band's centre and the lower third's width) are
//    reported for reading only. The verdict is `misaligned` below.
// Read by tests/footprintAlignment.test.ts; `tsx scripts/footprintAlignment.ts` prints the table.
import { BUILDING_CONFIG_BY_KIND, type Building, type BuildingKind } from "../src/content/buildingConfig";
import { buildingFootprint } from "../src/geometry/buildingFootprint";
import { millRegistration } from "../src/render/animatedMill";
import { BUILDING_VARIANT_POOLS } from "../src/render/buildingVariantManifest";
import { buildingSpriteKey } from "../src/render/buildingSprites";
import { fittedBuildingSpriteRect, isFittedSpriteKey } from "../src/render/buildingSpriteFit";
import { historicalFacilityManifest } from "../src/render/historicalFacilityManifest";
import { historicalHouseAssetManifest } from "../src/render/historicalHouseAssetManifest.generated";
import { historicalFacilitySpriteRect } from "../src/render/historicalFacilityAssets";
import { historicalHouseSpriteRect } from "../src/render/historicalHouseAssets";
import { houseCompoundAssetManifest } from "../src/render/houseCompoundAssetManifest.generated";
import { houseCompoundSpriteRect } from "../src/render/houseCompoundAssets";
import { TILE_H, TILE_W, tileToScreen } from "../src/render/iso";
import { spriteMeta } from "../src/render/worldAssets";
import { readPng, type RgbaImage } from "./processBuildingSprite";

type Rect = { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
export type ArtPlacement = {
  readonly label: string;
  readonly kind: BuildingKind;
  readonly png: string;
  readonly crop: Rect;
  /** The image size the crop is written in (the manifests declare the authored size; runtime PNGs are downsized). */
  readonly declared: { readonly width: number; readonly height: number };
  readonly dest: Rect;
  readonly footprint: { readonly tx: number; readonly ty: number; readonly width: number; readonly height: number };
  /** The draw path (for the fix: which registration moves). */
  readonly path: "historical_house" | "house_pair" | "facility" | "mill" | "farmstead" | "sprite";
};
export type Alignment = ArtPlacement & { readonly dx: number; readonly dy: number; readonly foot: number; readonly width: number; readonly centre: number };

const TX = 20, TY = 20;
const building = (kind: BuildingKind, houseLot?: "horizontal" | "vertical"): Building => ({
  id: `probe-${kind}`, kind, tx: TX, ty: TY, workers: 0, inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0,
  ...(houseLot === undefined ? {} : { houseLot }),
});
const footprintOf = (b: Building) => ({ tx: b.tx, ty: b.ty, ...buildingFootprint(b) });
const scaleCrop = (crop: Rect, from: { width: number; height: number }, to: { width: number; height: number }): Rect => ({
  x: crop.x * to.width / from.width, y: crop.y * to.height / from.height,
  width: crop.width * to.width / from.width, height: crop.height * to.height / from.height,
});
const full = (width: number, height: number): Rect => ({ x: 0, y: 0, width, height });
const pool = (kind: BuildingKind, extra: (p: typeof BUILDING_VARIANT_POOLS[number]) => boolean = () => true) =>
  BUILDING_VARIANT_POOLS.filter(p => p.kind === kind && extra(p)).flatMap(p => p.variants.flatMap(v =>
    v.url === null || !("width" in v) ? [] : [{ pool: p, id: v.id, url: v.url, width: v.width as number, height: v.height as number }]));

/** Anchor sprite path (drawWorldSprite): the meta's own footprint picks the far tile the anchor sits on. */
function spriteRect(key: string, tx: number, ty: number, scale = 1, atFarTile = true): Rect | null {
  const meta = spriteMeta(key);
  if (meta === null) return null;
  const at = tileToScreen(atFarTile ? tx + meta.footprint.width - 1 : tx, atFarTile ? ty + meta.footprint.height - 1 : ty);
  const s = scale * meta.renderScale;
  return { x: at.sx - meta.anchor.x * s, y: at.sy - meta.anchor.y * s, width: meta.width * s, height: meta.height * s };
}

export function artPlacements(): readonly ArtPlacement[] {
  const out: ArtPlacement[] = [];
  const add = (p: ArtPlacement) => out.push(p);
  // House levels, single lot (historicalHouseAssets) and its variants.
  const single = building("house");
  for (const meta of historicalHouseAssetManifest) {
    const dest = historicalHouseSpriteRect(single, meta);
    add({ label: `house_l${meta.level}`, kind: "house", png: meta.url, crop: meta.alphaBounds, declared: meta, dest, footprint: footprintOf(single), path: "historical_house" });
    for (const v of pool("house", p => "level" in p && p.level === meta.level && p.lot === "single"))
      add({ label: `house_l${meta.level}:${v.id}`, kind: "house", png: v.url, crop: scaleCrop(meta.alphaBounds, meta, v), declared: v, dest, footprint: footprintOf(single), path: "historical_house" });
  }
  // Pair lots (houseCompoundAssets) and their variants.
  for (const meta of houseCompoundAssetManifest) {
    const pair = building("house", meta.axis);
    const dest = houseCompoundSpriteRect(pair, meta);
    add({ label: `house_pair_l${meta.level}_${meta.axis}`, kind: "house", png: meta.url, crop: meta.alphaBounds, declared: meta, dest, footprint: footprintOf(pair), path: "house_pair" });
    for (const v of pool("house", p => "level" in p && p.level === meta.level && p.lot === meta.axis))
      add({ label: `house_pair_l${meta.level}_${meta.axis}:${v.id}`, kind: "house", png: v.url, crop: scaleCrop(meta.alphaBounds, meta, v), declared: v, dest, footprint: footprintOf(pair), path: "house_pair" });
  }
  // Historical facilities (the rect comes from the kind's first manifest entry, the crop from the drawn id's own).
  for (const meta of historicalFacilityManifest) {
    const b = building(meta.kind as BuildingKind);
    const dest = historicalFacilitySpriteRect(b);
    if (dest === null) continue;
    add({ label: meta.id, kind: b.kind, png: meta.url, crop: meta.source, declared: meta, dest, footprint: footprintOf(b), path: "facility" });
  }
  for (const kind of ["market", "chapel", "mill"] as const) {
    const b = building(kind);
    const dest = historicalFacilitySpriteRect(b);
    const meta = historicalFacilityManifest.find(entry => entry.kind === kind);
    if (dest === null || meta === undefined) continue;
    for (const v of pool(kind)) add({ label: `${kind}:${v.id}`, kind, png: v.url, crop: scaleCrop(meta.source, meta, v), declared: v, dest, footprint: footprintOf(b), path: "facility" });
  }
  // The animated mill's body (animatedMill: the body's ground line on the tile's front vertex).
  {
    const b = building("mill");
    const center = tileToScreen(b.tx, b.ty);
    const scale = millRegistration.bodyDisplayWidth / millRegistration.body.width;
    add({ label: "mill_body(animated)", kind: "mill", png: millRegistration.body.url, crop: full(millRegistration.body.width, millRegistration.body.height), declared: millRegistration.body,
      dest: { x: center.sx - millRegistration.bodyCentreX * scale, y: center.sy + TILE_H / 2 - millRegistration.groundY * scale,
        width: millRegistration.body.width * scale, height: millRegistration.body.height * scale }, footprint: footprintOf(b), path: "mill" });
  }
  // Farmstead: every barn painting in the storehouse frame, fitted to its own tile (buildingSpriteFit).
  {
    const b = building("farmstead");
    const dest = fittedBuildingSpriteRect("farmstead", b);
    for (const v of pool("farmstead"))
      add({ label: `farmstead:${v.id}`, kind: "farmstead", png: v.url, crop: full(v.width, v.height), declared: v, dest, footprint: footprintOf(b), path: "farmstead" });
  }
  // Anchor sprites: the kinds whose finished art is a world sprite (no historical art), and their variants.
  for (const kind of ["well", "storehouse", "granary", "logging_camp"] as const) {
    const b = building(kind);
    const key = buildingSpriteKey(b, 0);
    const meta = spriteMeta(key);
    const dest = isFittedSpriteKey(key) ? fittedBuildingSpriteRect(key, b) : spriteRect(key, b.tx, b.ty);
    if (meta === null || dest === null) continue;
    add({ label: key === kind ? kind : `${kind}(${key})`, kind, png: meta.url, crop: full(meta.width, meta.height), declared: meta, dest, footprint: footprintOf(b), path: "sprite" });
    for (const v of pool(kind)) add({ label: `${kind}:${v.id}`, kind, png: v.url, crop: full(v.width, v.height), declared: v, dest, footprint: footprintOf(b), path: "sprite" });
  }
  return out.filter(p => BUILDING_CONFIG_BY_KIND[p.kind] !== undefined);
}

const images = new Map<string, RgbaImage>();
function image(url: string): RgbaImage {
  const path = `public/${url.replace(/^\//, "")}`;
  let hit = images.get(path);
  if (hit === undefined) { hit = readPng(path); images.set(path, hit); }
  return hit;
}

/** The diamond of a footprint in world pixels: centre, half width, half height. */
export function footprintDiamond(footprint: ArtPlacement["footprint"]) {
  const centre = tileToScreen(footprint.tx + (footprint.width - 1) / 2, footprint.ty + (footprint.height - 1) / 2);
  return { cx: centre.sx, cy: centre.sy, hw: (footprint.width + footprint.height) * TILE_W / 4, hh: (footprint.width + footprint.height) * TILE_H / 4 };
}

export function measureAlignment(placement: ArtPlacement): Alignment {
  const { dimensions, rgba } = image(placement.png);
  const { dest } = placement;
  const crop = scaleCrop(placement.crop, placement.declared, dimensions);
  const sx = dest.width / crop.width, sy = dest.height / crop.height;
  const points: { x: number; y: number }[] = [];
  const x0 = Math.max(0, Math.floor(crop.x)), x1 = Math.min(dimensions.width, Math.ceil(crop.x + crop.width));
  const y0 = Math.max(0, Math.floor(crop.y)), y1 = Math.min(dimensions.height, Math.ceil(crop.y + crop.height));
  for (let px = x0; px < x1; px += 1) for (let py = y1 - 1; py >= y0; py -= 1) {
    if (rgba[(py * dimensions.width + px) * 4 + 3]! < 128) continue;
    points.push({ x: dest.x + (px + 0.5 - crop.x) * sx, y: dest.y + (py + 1 - crop.y) * sy });
    break; // the column's lowest opaque pixel: the ground contour
  }
  const d = footprintDiamond(placement.footprint);
  const bottom = Math.max(...points.map(p => p.y));
  const band = points.filter(p => p.y >= bottom - TILE_H / 4 * (placement.footprint.width + placement.footprint.height) / 2);
  const left = Math.min(...band.map(p => p.x)), right = Math.max(...band.map(p => p.x));
  // The foot: the art's width in its lower third (walls meet the ground there), over the diamond's width.
  const top = Math.min(...points.map(p => p.y));
  const lower = points.filter(p => p.y >= bottom - (bottom - top) / 3);
  const footWidth = Math.max(...lower.map(p => p.x)) - Math.min(...lower.map(p => p.x));
  const minX = Math.min(...points.map(p => p.x)), maxX = Math.max(...points.map(p => p.x));
  const width = (maxX - minX) / (2 * d.hw);
  return { ...placement, dx: (left + right) / 2 - d.cx, dy: bottom - (d.cy + d.hh), foot: footWidth / (2 * d.hw), width, centre: (minX + maxX) / 2 };
}

/**
 * What reads as "standing on its plot" (world px at zoom 1, as fractions of the diamond's half size):
 *  - centre: the art's alpha extent centred on the diamond (`cx`, within `dx` of the half width);
 *  - ground: the lowest opaque pixel on the diamond's front vertex drawn in by the art's width (an art 0.87 of the
 *    diamond wide — the houses' size — meets the front vertex; a small well meets its tile's middle), within `dy`;
 *  - size: art width over the diamond's width in [`widthMin`, `widthMax`]; small structures (the well) from `smallMin`.
 */
export const ALIGNMENT_LIMITS = { dx: 0.12, dy: 0.25, widthMin: 0.72, widthMax: 1.05, smallMin: 0.3 } as const;
export const SMALL_STRUCTURES: ReadonlySet<BuildingKind> = new Set(["well"]);
const FILLED_WIDTH = 0.87;
export function misaligned(a: Alignment): readonly string[] {
  const d = footprintDiamond(a.footprint);
  const problems: string[] = [];
  const centre = a.centre - d.cx;
  const ground = (d.cy + d.hh * Math.min(1, a.width / FILLED_WIDTH)) - (d.cy + d.hh);
  const dy = a.dy - ground;
  if (Math.abs(centre) > ALIGNMENT_LIMITS.dx * d.hw) problems.push(`off-centre ${centre.toFixed(1)}`);
  if (dy < -ALIGNMENT_LIMITS.dy * d.hh) problems.push(`floats ${(-dy).toFixed(1)}`);
  if (dy > ALIGNMENT_LIMITS.dy * d.hh) problems.push(`sinks ${dy.toFixed(1)}`);
  const min = SMALL_STRUCTURES.has(a.kind) ? ALIGNMENT_LIMITS.smallMin : ALIGNMENT_LIMITS.widthMin;
  if (a.width < min) problems.push(`width ${a.width.toFixed(2)} (too small)`);
  if (a.width > ALIGNMENT_LIMITS.widthMax) problems.push(`width ${a.width.toFixed(2)} (too wide)`);
  return problems;
}

if (import.meta.url === `file://${process.argv[1]}` && process.argv[2] !== "--json") {
  for (const placement of artPlacements()) {
    const a = measureAlignment(placement);
    const bad = misaligned(a);
    console.log([a.label.padEnd(34), a.path.padEnd(16), `${a.footprint.width}x${a.footprint.height}`, `centre ${(a.centre - footprintDiamond(a.footprint).cx).toFixed(1).padStart(6)}`,
      `dy ${a.dy.toFixed(1).padStart(6)}`, `foot ${a.foot.toFixed(2)}`, `w ${a.width.toFixed(2)}`, bad.length === 0 ? "ok" : `!! ${bad.join(", ")}`].join("  "));
  }
}

/** `--json out.json`: every placement with its measurement and diamond, for scripts/footprintBoard.py (the capture). */
if (import.meta.url === `file://${process.argv[1]}` && process.argv[2] === "--json") {
  const { writeFileSync } = await import("node:fs");
  writeFileSync(process.argv[3]!, JSON.stringify(artPlacements().map(p => {
    const a = measureAlignment(p);
    return { ...a, diamond: footprintDiamond(p.footprint), problems: misaligned(a) };
  }), null, 1));
}
