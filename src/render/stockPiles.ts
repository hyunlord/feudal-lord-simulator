import { BUILDING_CONFIG_BY_KIND, type Building } from "../content/buildingConfig";
import type { GameState } from "../engine/engine.types";
import { buildingFootprint } from "../geometry/buildingFootprint";
import { farmsteadFieldWork } from "./farmsteadArt";
import { TILE_H, TILE_W, tileToScreen } from "./iso";
import { drawWave7, type Wave7Key } from "./wave7Art";

// INSTALL-7 stock piles (Wave 7, 3 levels each): what a building holds shows at its door, so the wheat -> bread -> home
// chain reads on the map.
//  - sacks at the barn's and granary's door: the wheat they hold (barn capacity 20, granary 200);
//  - bread beside the mill's oven: the bread baked and not yet carried (mill capacity 32);
//  - crates at the storehouse door: everything it holds (capacity 200);
//  - sheaves at the tended field's first harvested strip: the harvest waiting for the barn (strips harvested, one
//    level per strip, up to three).
// Level 1 from the first unit, 2 from a third of the capacity, 3 from two thirds. Read from the state; nothing stored.
export const PILE_SCALE = 0.3;

export function stockPileLevel(amount: number, capacity: number): 0 | 1 | 2 | 3 {
  if (!(amount > 0) || capacity <= 0) return 0;
  return amount >= capacity * 2 / 3 ? 3 : amount >= capacity / 3 ? 2 : 1;
}

type Pile = { readonly key: Wave7Key; readonly x: number; readonly y: number };

export function buildingStockPiles(state: GameState, building: Building): readonly Pile[] {
  const size = buildingFootprint(building);
  const centre = tileToScreen(building.tx + (size.width - 1) / 2, building.ty + (size.height - 1) / 2);
  const hw = (size.width + size.height) * TILE_W / 4, hh = (size.width + size.height) * TILE_H / 4;
  // The door side: the footprint's front right edge, a little outside the art's foot.
  const door = { x: centre.sx + hw * 0.55, y: centre.sy + hh * 0.62 };
  const capacity = BUILDING_CONFIG_BY_KIND[building.kind].storageCapacity;
  const piles: Pile[] = [];
  const add = (family: "sacks" | "bread" | "crates", amount: number) => {
    const level = stockPileLevel(amount, capacity);
    if (level !== 0) piles.push({ key: `pile_${family}_${level}`, ...door });
  };
  if (building.kind === "farmstead" || building.kind === "granary") add("sacks", building.inventory.wheat ?? 0);
  if (building.kind === "mill") add("bread", building.inventory.bread ?? 0);
  if (building.kind === "storehouse") add("crates", Object.values(building.inventory).reduce((sum, value) => sum + (value ?? 0), 0));
  if (building.kind === "farmstead") {
    const harvested = farmsteadFieldWork(state).get(building.id)?.harvested ?? null;
    const cell = harvested?.[0];
    if (cell !== undefined) {
      const at = tileToScreen(cell.tx, cell.ty);
      const level = Math.min(3, Math.max(1, Math.ceil((harvested?.length ?? 1) / 4))) as 1 | 2 | 3;
      piles.push({ key: `pile_sheaves_${level}`, x: at.sx, y: at.sy + TILE_H * 0.2 });
    }
  }
  return piles;
}

export function drawStockPiles(context: CanvasRenderingContext2D, state: GameState, building: Building): void {
  for (const pile of buildingStockPiles(state, building)) drawWave7(context, pile.key, pile.x, pile.y, PILE_SCALE);
}
