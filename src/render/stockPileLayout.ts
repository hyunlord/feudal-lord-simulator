import type { Building } from '../content/buildingConfig';
import { buildingFootprint } from '../geometry/buildingFootprint';
import { TILE_H, TILE_W, tileToScreen } from './iso';

/** Shared door-side ground anchor for existing piles and authored resource piles. */
export function stockPileLayout(building: Building) {
  const size = buildingFootprint(building);
  const centre = tileToScreen(building.tx + (size.width - 1) / 2, building.ty + (size.height - 1) / 2);
  const hw = (size.width + size.height) * TILE_W / 4, hh = (size.width + size.height) * TILE_H / 4;
  return { hw, hh, door: { x: centre.sx + hw * 0.55, y: centre.sy + hh * 0.62 } };
}
