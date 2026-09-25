import { MONEY_LABEL } from "../content/moneyCopy.ko";
import type { PlacementTool } from "../render/renderer";
import type { BuildToolOption } from "./buildMenuModel";
import { getHistoricalFacilityPresentation } from "../render/historicalFacilityAssets";
import { historicalHouseAssetMeta } from "../render/historicalHouseAssets";
import { BRIDGE_TIMBER_PER_TILE } from "../world/bridges";

export const BUILD_CATEGORIES = [
  { key: "dwelling", label: "주택" },
  { key: "road", label: "도로" },
  { key: "production", label: "생산" },
  { key: "storage", label: "저장" },
  { key: "public", label: "공공" },
  { key: "defense", label: "방어" },
  { key: "zone", label: "구역" },
] as const;
export type BuildCategory = typeof BUILD_CATEGORIES[number]["key"];

export function buildCategorySelection(category: BuildCategory): PlacementTool | null {
  return category === "road" ? "road" : null;
}

export function buildCategory(tool: PlacementTool): BuildCategory {
  const categories = {
    house: "dwelling", road: "road", wheat_farm: "production", farmstead: "production", mill: "production",
    logging_camp: "production", sawmill: "production", quarry: "production", masonry: "production",
    storehouse: "storage", granary: "storage", well: "public", chapel: "public",
    church: "public", market: "public", keep: "defense",
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
