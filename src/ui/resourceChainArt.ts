import type { CSSProperties } from "react";
import { RESOURCE_CHAIN_SHEET_CELLS, type ResourceChainCell } from "../content/resourceCatalog";
import { WAVE3_ALE_IMAGES } from "../render/wave3AleManifest.generated";
import { assetUrlForBase } from "../render/worldAssets";

// INSTALL-3: the Wave 3 resource chain sheet (96 px masters in one row, scripts/installWave3Ale.py), drawn at the HUD's
// icon sizes as the Wave 19 scene icons are (one master, scaled by the background size; no 1x / 2x copies were made).
const SHEET = WAVE3_ALE_IMAGES.icon_resource_chain_sheet;

export const resourceChainSheetUrl = (): string => assetUrlForBase(SHEET.url, import.meta.env?.BASE_URL ?? "/");

export function resourceChainCellIndex(cell: ResourceChainCell): number {
  return RESOURCE_CHAIN_SHEET_CELLS.indexOf(cell);
}

/** Background style showing one chain cell as a `size` CSS px square. */
export function resourceChainIconStyle(cell: ResourceChainCell, size: number): CSSProperties {
  const cells = SHEET.width / SHEET.height;
  return {
    width: `${size}px`,
    height: `${size}px`,
    backgroundImage: `url("${resourceChainSheetUrl()}")`,
    backgroundSize: `${cells * size}px ${size}px`,
    backgroundPosition: `${-resourceChainCellIndex(cell) * size}px 0`,
    backgroundRepeat: "no-repeat",
  };
}
