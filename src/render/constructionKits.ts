import type { Building, BuildingKind } from "../content/buildingConfig";
import { constructionSiteFootprint, type ConstructionSite } from "../economy/construction";
import { isBuildingConstructionSite } from "../economy/constructionSiteAccessors";
import { fittedBuildingSpriteRect } from "./buildingSpriteFit";
import { BUILDING_SPRITE_ALPHA } from "./buildingSpriteFit.generated";
import { historicalFacilityManifest } from "./historicalFacilityManifest";
import { historicalFacilitySpriteRect } from "./historicalFacilityAssets";
import { historicalHouseAssetManifest } from "./historicalHouseAssetManifest.generated";
import { historicalHouseSpriteRect } from "./historicalHouseAssets";
import { TILE_H, TILE_W, tileToScreen } from "./iso";
import { drawWave11, drawWave11OnReference, type Wave11Key } from "./wave11Art";

// INSTALL-11 construction kits (Wave 11): a building site is built by its family's kit, one painting per stage (plot,
// foundation, frame, roof at 25 / 55 / 85 % work), each painted on the canvas of the finished art it grows into, so
// it is drawn with that art's own rect and crop (the reference) and stands where the building will:
//  - timber: house, farmstead (barn), logging camp, sawmill, mill -> small (the L0 house canvas) or medium (L2);
//  - stone: masonry, chapel -> medium (the masonry canvas); storehouse, granary -> large (the storehouse canvas);
//  - public: church, keep -> their own kits on their own canvases;
//  - defense: the tower kit at the corner turns of a stone wall site (walls: kitCornerTowers).
// A kind with no kit (well: its own three stages; market, quarry, wheat farm) keeps the common four-stage art.
// F0-V's anchor, bar, piles, dust and completion are unchanged: the kit only replaces the stage painting.
export type KitFamily = "timber" | "stone" | "public" | "defense";
type Reference = { readonly crop: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
  readonly declared: { readonly width: number; readonly height: number };
  readonly rect: (building: Building) => { readonly x: number; readonly y: number; readonly width: number; readonly height: number } | null };
type Kit = { readonly family: KitFamily; readonly prefix: string; readonly reference: Reference };

const STAGES = ["plot", "foundation", "frame", "roof"] as const;
const house = (level: number): Reference => {
  const meta = historicalHouseAssetManifest.find(entry => entry.level === level)!;
  return { crop: meta.alphaBounds, declared: meta, rect: building => historicalHouseSpriteRect(building, meta) };
};
const facility = (id: string, kind: BuildingKind): Reference => {
  const meta = historicalFacilityManifest.find(entry => entry.id === id)!;
  return { crop: meta.source, declared: meta, rect: building => historicalFacilitySpriteRect({ ...building, kind }) };
};
const storehouseFrame: Reference = {
  crop: { x: 0, y: 0, width: BUILDING_SPRITE_ALPHA.storehouse.width, height: BUILDING_SPRITE_ALPHA.storehouse.height },
  declared: BUILDING_SPRITE_ALPHA.storehouse,
  rect: building => fittedBuildingSpriteRect("storehouse", { ...building, kind: "storehouse" }),
};
const TIMBER_SMALL: Kit = { family: "timber", prefix: "kit_timber_stage_%_small", reference: house(0) };
const TIMBER_MEDIUM: Kit = { family: "timber", prefix: "kit_timber_stage_%_medium", reference: house(2) };
const STONE_MEDIUM: Kit = { family: "stone", prefix: "kit_stone_stage_%_medium", reference: facility("masonry", "masonry") };
const STONE_LARGE: Kit = { family: "stone", prefix: "kit_stone_stage_%_large", reference: storehouseFrame };
const KITS: Partial<Readonly<Record<BuildingKind, Kit>>> = {
  house: TIMBER_SMALL, logging_camp: TIMBER_SMALL,
  farmstead: TIMBER_MEDIUM, sawmill: TIMBER_MEDIUM, mill: TIMBER_MEDIUM,
  masonry: STONE_MEDIUM, chapel: STONE_MEDIUM,
  storehouse: STONE_LARGE, granary: STONE_LARGE,
  church: { family: "public", prefix: "kit_public_stage_%_church", reference: facility("church", "church") },
  keep: { family: "public", prefix: "kit_public_stage_%_keep", reference: facility("keep", "keep") },
};

/** The site's kit family and size (null: the common four-stage art). */
export function constructionKitFor(kind: ConstructionSite["kind"]): { readonly family: KitFamily; readonly key: (stage: number) => Wave11Key } | null {
  const kit = KITS[kind as BuildingKind];
  if (kit === undefined) return kind === "stone_wall_segment" ? { family: "defense", key: stage => `kit_defense_stage_${STAGES[stage]!}_tower` as Wave11Key } : null;
  return { family: kit.family, key: stage => kit.prefix.replace("%", STAGES[Math.max(0, Math.min(3, stage))]!) as Wave11Key };
}

function siteBuilding(site: ConstructionSite): Building | null {
  if (!isBuildingConstructionSite(site)) return null;
  return { id: site.id, kind: site.kind, tx: site.tx, ty: site.ty, workers: 0, inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0 };
}

/** Draws the kit's painting for `stage` (0-3) on the site; false for a kind without a kit or while it loads. */
export function drawKitStage(context: CanvasRenderingContext2D, site: ConstructionSite, stage: number): boolean {
  const kit = KITS[site.kind as BuildingKind];
  const building = siteBuilding(site);
  if (kit === undefined || building === null) return false;
  const rect = kit.reference.rect(building);
  if (rect === null) return false;
  return drawWave11OnReference(context, constructionKitFor(site.kind)!.key(stage), kit.reference.crop, kit.reference.declared, rect);
}

/**
 * Site props (zoom >= PROP_MIN_ZOOM; the small tools and stakes are noise below it): deterministic places just
 * outside the footprint diamond's edges, by family and stage.
 *  - timber: a beam stack and the laid-out wall frame (foundation), a saw pit (frame, roof);
 *  - stone: a mortar tub and a lime heap (foundation on);
 *  - public / defense: the treadwheel crane with a hoisted block (frame on), the centring arch (frame);
 */
export const PROP_MIN_ZOOM = 1;
type Prop = { readonly key: Wave11Key; readonly x: number; readonly y: number; readonly scale: number };

export function kitSiteProps(site: ConstructionSite, stage: number): readonly Prop[] {
  const kit = constructionKitFor(site.kind);
  if (kit === null || kit.family === "defense" || !isBuildingConstructionSite(site)) return [];
  const footprint = constructionSiteFootprint(site);
  const centre = tileToScreen(footprint.tx + (footprint.width - 1) / 2, footprint.ty + (footprint.height - 1) / 2);
  const hw = (footprint.width + footprint.height) * TILE_W / 4, hh = (footprint.width + footprint.height) * TILE_H / 4;
  const left = { x: centre.sx - hw * 0.95, y: centre.sy + hh * 0.35 };
  const right = { x: centre.sx + hw * 0.95, y: centre.sy + hh * 0.35 };
  const back = { x: centre.sx - hw * 0.45, y: centre.sy - hh * 0.55 };
  const props: Prop[] = [];
  if (kit.family === "timber") {
    if (stage === 1) props.push({ key: "timber_beam_stack", ...left, scale: 0.34 }, { key: "kit_timber_raising_frame", ...right, scale: 0.34 });
    if (stage >= 2) props.push({ key: "sawpit", ...left, scale: 0.34 });
  } else if (kit.family === "stone") {
    if (stage >= 1) props.push({ key: "mortar_tub", ...left, scale: 0.4 }, { key: "lime_heap", x: left.x + 12, y: left.y + 6, scale: 0.4 });
  } else {
    if (stage >= 2) props.push({ key: "treadwheel_crane", ...back, scale: 0.45 }, { key: "stone_block_hoisted", x: back.x + 22, y: back.y - 60, scale: 0.45 });
    if (stage === 2) props.push({ key: "centering_arch", ...right, scale: 0.4 });
    if (stage >= 1) props.push({ key: "mortar_tub", ...left, scale: 0.4 });
  }
  return props;
}

export function drawKitSiteProps(context: CanvasRenderingContext2D, site: ConstructionSite, stage: number, zoom: number): void {
  if (zoom < PROP_MIN_ZOOM) return;
  for (const prop of kitSiteProps(site, stage)) drawWave11(context, prop.key, prop.x, prop.y, prop.scale);
}

/** Defense: the tower kit stage at each corner turn of a stone wall site's path (the drum tower of 4d stands there). */
export function drawKitCornerTowers(context: CanvasRenderingContext2D, path: readonly { readonly x: number; readonly y: number }[], stage: number): boolean {
  let drawn = false;
  for (let index = 1; index < path.length - 1; index += 1) {
    const a = path[index - 1]!, b = path[index]!, c = path[index + 1]!;
    if ((b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x) === 0) continue; // straight: no tower
    const at = tileToScreen(b.x - 0.5, b.y - 0.5); // a path point is a tile corner
    drawn = drawWave11(context, `kit_defense_stage_${STAGES[stage]!}_tower` as Wave11Key, at.sx, at.sy, 0.2) || drawn;
  }
  return drawn;
}

/** The builder's body and tool at a kit site: carpenter (adze to the foundation, saw from the frame) or mason (trowel). */
export function kitWorker(kind: ConstructionSite["kind"], stage: number): { readonly sheet: "wk_carpenter" | "wk_mason"; readonly tool: "work_adze" | "work_saw" | "work_trowel" } | null {
  const kit = constructionKitFor(kind);
  if (kit === null) return null;
  if (kit.family === "timber") return { sheet: "wk_carpenter", tool: stage < 2 ? "work_adze" : "work_saw" };
  return { sheet: "wk_mason", tool: "work_trowel" };
}

