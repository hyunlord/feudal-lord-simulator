import { MONEY_LABEL } from "../content/moneyCopy.ko";
import type { PlacementTool } from "../render/renderer";
import type { BuildToolOption } from "./buildMenuModel";
import { getHistoricalFacilityPresentation } from "../render/historicalFacilityAssets";
import { historicalHouseAssetMeta } from "../render/historicalHouseAssets";
import { BRIDGE_TIMBER_PER_TILE } from "../world/bridges";
import { TUTORIAL_COPY } from "./tutorial/tutorialCopy.ko";
import type { BuildCategoryKey } from "./tutorial/tutorialModel";

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

export function buildCategory(tool: PlacementTool): BuildCategory {
  const categories = {
    house: "living", well: "living", road: "paths",
    wheat_farm: "trade", farmstead: "trade", mill: "trade", logging_camp: "trade", sawmill: "trade", quarry: "trade", masonry: "trade",
    storehouse: "storage", granary: "storage", market: "storage",
    chapel: "public", church: "public", keep: "defense",
  } as const satisfies Record<PlacementTool, BuildCategory>;
  return categories[tool];
}

export function buildThumbnail(tool: PlacementTool): string | null {
  if (tool === "road" || tool === "farmstead") return null;
  if (tool === "house") return historicalHouseAssetMeta(0)?.url ?? null;
  const facility = getHistoricalFacilityPresentation(tool);
  if (facility !== null) return facility.url;
  const asset = tool === "granary" ? "barn" : tool;
  return `/assets/buildings/${asset}.png`;
}

export function buildCostLabel(option: BuildToolOption): string {
  if (option.tool === "road") return `육지 무료 · 다리 목재 ${BRIDGE_TIMBER_PER_TILE}/칸`;
  const labels = { wheat: "밀", bread: "빵", logs: "통나무", timber: "목재", stone_raw: "원석", stone: "석재", coin: MONEY_LABEL } as const;
  const parts = Object.entries(labels).flatMap(([resource, label]) => {
    const amount = option.cost[resource as keyof typeof labels] ?? 0;
    return amount > 0 ? [`${label} ${amount}`] : [];
  });
  return parts.length > 0 ? parts.join(" · ") : "무료";
}
