import { BUILDING_CONFIG_BY_KIND, type Building } from "../content/buildingConfig";
import type { GameState } from "../engine/engine.types";
import { stockPileLayout } from "./stockPileLayout";
import { RESOURCE_STOCK_PILE_ART } from "./art/resourceStockPileArt";
import { farmsteadFieldWork } from "./farmsteadArt";
import { TILE_H, tileToScreen } from "./iso";
import { drawWave7, type Wave7Key } from "./wave7Art";
import { drawWave3Ale, type Wave3AleKey } from "./wave3AleArt";
import { drawWave3Cloth, type Wave3ClothKey } from "./wave3ClothArt";
import { aleBarrelPile, aleStockPile } from "./aleWorldArt";
import { clothStockPile } from "./clothWorldArt";
import { spinDoorProp } from "./doorProps"; // NAT-1: varied spinning-house door prop allocation
import { brewingDoor } from "./villageLife";
import { shownGranaryVariant } from "./wave32GranaryArt";

// INSTALL-7 stock piles (Wave 7, 3 levels each): what a building holds shows at its door, so the wheat -> bread -> home
// chain reads on the map.
//  - sacks at the barn's and granary's door: the wheat they hold (barn capacity 20, granary 200; INSTALL-32: not at a granary
//    showing its Wave 32 painting, whose stock layer shows it);
//  - bread beside the mill's oven: the bread baked and not yet carried (mill capacity 32);
//  - crates at the storehouse door: everything it holds but its malt (capacity 200);
//  - sheaves at the tended field's first harvested strip: the harvest waiting for the barn (strips harvested, one
//    level per strip, up to three).
// Level 1 from the first unit, 2 from a third of the capacity, 3 from two thirds. Read from the state; nothing stored.
export const PILE_SCALE = 0.3;

export function stockPileLevel(amount: number, capacity: number): 0 | 1 | 2 | 3 {
  if (!(amount > 0) || capacity <= 0) return 0;
  return amount >= capacity * 2 / 3 ? 3 : amount >= capacity / 3 ? 2 : 1;
}

// INSTALL-3 (Wave 3, aleWorldArt.ts): barley sacks at a barley barn (beside its wheat sacks while it still holds wheat),
// malt sacks at the kiln's and the storehouse's door (FIX-8: malt's store), the ale barrels at a brewing house's door (the door spot village life keeps for them,
// villageLife.ts `brewingDoor`). Same scale and thresholds as the Wave 7 piles (Astra drew them at Wave 7's size).
// CLOTH-UI (Wave 3 cloth, clothWorldArt.ts): fleece heaps, yarn skeins and raw-cloth bolts at cloth buildings' doors.
type Pile = { readonly key: Wave7Key; readonly x: number; readonly y: number; readonly wave3?: undefined; readonly cloth?: undefined }
  | { readonly key: Wave3AleKey; readonly x: number; readonly y: number; readonly wave3: true; readonly cloth?: undefined }
  | { readonly key: Wave3ClothKey; readonly x: number; readonly y: number; readonly wave3?: undefined; readonly cloth: true };

export function buildingStockPiles(state: GameState, building: Building): readonly Pile[] {
  const { hw, hh, door } = stockPileLayout(building);
  const capacity = BUILDING_CONFIG_BY_KIND[building.kind].storageCapacity;
  const piles: Pile[] = [];
  const add = (family: "sacks" | "bread" | "crates", amount: number) => {
    const level = stockPileLevel(amount, capacity);
    if (level !== 0) piles.push({ key: `pile_${family}_${level}`, ...door });
  };
  if (building.kind === "farmstead" || (building.kind === "granary" && shownGranaryVariant(building) === null)) add("sacks", building.inventory.wheat ?? 0);
  if (building.kind === "mill") add("bread", building.inventory.bread ?? 0);
  // UI-10 (FIX-8): the storehouse's malt shows as its own sacks beside the crates, so the crates count the rest.
  if (building.kind === "storehouse") add("crates", Object.entries(building.inventory).reduce((sum, [resource, value]) => resource === "malt" ? sum : sum + (value ?? 0), 0));
  const ale = aleStockPile(building, capacity);
  // Beside the wheat sacks (the storehouse's crates), a third of the way up the door's face, when it holds both.
  if (ale !== null) piles.push({ key: ale, wave3: true, ...(piles.length === 0 ? door : { x: door.x + hw * 0.3, y: door.y - hh * 0.3 }) });
  // CLOTH-UI: cloth resource piles at cloth chain buildings' doors (fleece heaps, yarn skeins, cloth bolts).
  const cloth = clothStockPile(building, capacity);
  if (cloth !== null) piles.push({ key: cloth, cloth: true, ...door });
  const house = building.kind === "house" ? state.houses.find(candidate => candidate.buildingId === building.id) : undefined;
  const barrels = house === undefined ? null : aleBarrelPile(house);
  if (barrels !== null) {
    const spot = brewingDoor(state, building.id);
    piles.push({ key: barrels, wave3: true, ...(spot === null ? door : { x: tileToScreen(spot.x, spot.y).sx, y: tileToScreen(spot.x, spot.y).sy }) });
  }
  // NAT-1: the spinning house's trade marker, varied by house id (doorProps.ts allocation).
  const skeins = house === undefined ? null : spinDoorProp(state, building.id);
  if (skeins !== null) piles.push({ key: skeins, cloth: true, x: door.x - hw * 0.5, y: door.y - hh * 0.1 });
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
  RESOURCE_STOCK_PILE_ART.draw(context, state, building, stockPileLayout(building).door);
  for (const pile of buildingStockPiles(state, building)) {
    if (pile.cloth === true) drawWave3Cloth(context, pile.key, pile.x, pile.y, PILE_SCALE);
    else if (pile.wave3 === true) drawWave3Ale(context, pile.key, pile.x, pile.y, PILE_SCALE);
    else drawWave7(context, pile.key, pile.x, pile.y, PILE_SCALE);
  }
}
