import type { Building, BuildingKind } from "../content/buildingConfig";
import { constructionSiteFootprint, type ConstructionSite } from "../economy/construction";
import { isBuildingConstructionSite } from "../economy/constructionSiteAccessors";
import type { GameState } from "../engine/engine.types";
import { drawUiIcon, type UiIconCell } from "../ui/uiArt";
import { constructionStageIndex } from "./constructionVisibility";
import { drawFarmsteadSprite } from "./farmsteadArt";
import { drawHistoricalFacility } from "./historicalFacilityAssets";
import { drawHistoricalHouse } from "./historicalHouseAssets";
import { buildingSpriteKey } from "./buildingSprites";
import { tileToScreen } from "./iso";
import { drawWorldSprite, type WorldSpriteOptions } from "./worldSprite";

// F0-V "what is being built" (construction correction v0.2, P0): until the frame shows the building's form (plot and
// foundation stages) the completed building's art is laid over the stakes at GHOST_ALPHA, and the sign post carries
// the building's first-session icon. The ghost is the art the finished building will draw (the same Building shape
// the engine's completion makes: constructionLifecycle.buildingFromSite) with the frame's sprite options (camera
// culling); a kind without that art (the storehouse is drawn in code) draws no ghost.
export const GHOST_ALPHA = 0.22;
const GHOST_STAGES = 2;

const SIGN_ICON: Partial<Readonly<Record<BuildingKind, UiIconCell<"building">>>> = {
  house: "hut", well: "well", farmstead: "barn", mill: "windmill", granary: "granary", storehouse: "warehouse",
  chapel: "chapel", church: "chapel", market: "market",
};

function ghostBuilding(site: ConstructionSite): Building | null {
  if (!isBuildingConstructionSite(site)) return null;
  return { id: site.id, kind: site.kind, tx: site.tx, ty: site.ty, workers: 0, inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0 };
}

/** The completed building at GHOST_ALPHA over a plot or foundation stage; false when nothing was drawn. */
export function drawConstructionGhost(context: CanvasRenderingContext2D, state: GameState, site: ConstructionSite, progress: number,
  options: WorldSpriteOptions = {}): boolean {
  if (site.kind === "well" || constructionStageIndex(progress) >= GHOST_STAGES) return false;
  const building = ghostBuilding(site);
  if (building === null) return false;
  context.save();
  context.globalAlpha *= GHOST_ALPHA;
  const drawn = building.kind === "house" ? drawHistoricalHouse(context, building, 0)
    : building.kind === "farmstead" ? drawFarmsteadSprite(context, building, state, options)
      : drawHistoricalFacility(context, building, state)
        || drawWorldSprite(context, buildingSpriteKey(building, 0), building.tx, building.ty, options); // e.g. the granary
  context.restore();
  return drawn;
}

/** The building's icon on the sign post's board (drawConstructionSign: the post stands at the footprint's left). */
export function drawConstructionSignIcon(context: CanvasRenderingContext2D, site: ConstructionSite): boolean {
  const cell = SIGN_ICON[site.kind as BuildingKind];
  if (cell === undefined) return false;
  const footprint = constructionSiteFootprint(site);
  const center = tileToScreen(footprint.tx + (footprint.width - 1) / 2, footprint.ty + (footprint.height - 1) / 2);
  const span = (footprint.width + footprint.height) * 27;
  return drawUiIcon(context, "building", cell, center.sx - span * 0.46, center.sy - 19, 12);
}
