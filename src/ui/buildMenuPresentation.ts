import { buildingEntry } from "../content/buildingCatalog";
import type { PlacementTool } from "../render/renderer";
import type { BuildToolOption } from "./buildMenuModel";
import { getHistoricalFacilityPresentation } from "../render/historicalFacilityAssets";
import { historicalHouseAssetMeta } from "../render/historicalHouseAssets";
import { BRIDGE_TIMBER_PER_TILE, FORD_TIMBER_PER_TILE } from "../world/bridges";
import { BUILD_MENU_COPY } from "./buildMenuCopy.ko";
import { TUTORIAL_COPY } from "./tutorial/tutorialCopy.ko";
import type { BuildCategoryKey } from "./tutorial/tutorialModel";
import { RESOURCE_TYPES } from "../content/resourceConfig";
import { resourceName } from "../content/resourceCatalog.ko";

// UX-1 build menu (research E "건설 메뉴 재분류"): six categories; zones left the categories for the control layer switch
// (직접 / 구역 / 방향, BuildMenu.tsx). The labels live in tutorialCopy.ko.ts.
export const BUILD_CATEGORIES = [
  { key: "living", label: TUTORIAL_COPY.categories.living },
  { key: "paths", label: TUTORIAL_COPY.categories.paths },
  { key: "trade", label: TUTORIAL_COPY.categories.trade },
  { key: "storage", label: TUTORIAL_COPY.categories.storage },
  { key: "public", label: TUTORIAL_COPY.categories.public },
  { key: "defense", label: TUTORIAL_COPY.categories.defense },
] as const satisfies readonly { readonly key: BuildCategoryKey; readonly label: string }[];
export type BuildCategory = typeof BUILD_CATEGORIES[number]["key"];

export function buildCategorySelection(category: BuildCategory): PlacementTool | null {
  return category === "paths" ? "road" : null;
}

/** BLD-REG: a building's category is its catalog line; the road's is the paths. */
export function buildCategory(tool: PlacementTool): BuildCategory {
  return tool === "road" ? "paths" : buildingEntry(tool).category;
}

/** The build card's picture (BLD-REG `thumbnail`): the first house, the kind's facility picture or an early file; null: its icon or glyph. */
export function buildThumbnail(tool: PlacementTool): string | null {
  if (tool === "road") return null;
  const thumbnail = buildingEntry(tool).thumbnail;
  if (thumbnail === undefined) return null;
  if (thumbnail === "house") return historicalHouseAssetMeta(0)?.url ?? null;
  if (thumbnail === "facility") return getHistoricalFacilityPresentation(tool)?.url ?? null;
  return `/assets/buildings/${thumbnail.file}.png`;
}

export function buildCostLabel(option: BuildToolOption): string {
  if (option.tool === "road") return BUILD_MENU_COPY.roadCost(BRIDGE_TIMBER_PER_TILE, FORD_TIMBER_PER_TILE);
  const parts = RESOURCE_TYPES.flatMap(resource => {
    const amount = option.cost[resource] ?? 0;
    return amount > 0 ? [`${resourceName(resource)} ${amount}`] : [];
  });
  return parts.length > 0 ? parts.join(" · ") : "무료";
}
