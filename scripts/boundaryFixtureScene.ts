// The 12x12 fixed scene for the curved-ground work (D1a): a road with two bends, a T-junction, two dead ends, a
// two-tile river with a bridge, a forest edge and two separate wheat-field clusters, laid into open grass of the
// new-game map. Tests and the evidence captures both use it, so the pictures show exactly what the gates checked.
import type { Building } from "../src/content/buildingConfig";
import type { GameState } from "../src/engine/engine.types";
import type { Tile } from "../src/world/world.types";

export const BOUNDARY_FIXTURE_ORIGIN = { tx: 36, ty: 50 } as const;
export const BOUNDARY_FIXTURE_SIZE = 12;

// Local coordinates (x, y) inside the 12x12 block.
const ROAD = [
  [11, 3], [8, 3], [7, 3], [6, 3], [5, 3], [5, 4], [4, 4], [4, 5], [3, 5], [3, 6], [3, 7], [3, 8], [3, 9], [3, 10], [3, 11],
  [4, 7], [5, 7], [6, 7],
] as const;
const BRIDGE = [[9, 3], [10, 3]] as const;
const FOREST = [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 6], [1, 0], [1, 1], [1, 2], [1, 3], [1, 4], [2, 1], [2, 2], [1, 5]] as const;
const FARMS = [[5, 5], [7, 5], [4, 9], [6, 9]] as const;

export function boundaryFixtureState(base: GameState): GameState {
  const { tx: ox, ty: oy } = BOUNDARY_FIXTURE_ORIGIN;
  const local = (tile: Tile): { x: number; y: number } | null => {
    const x = tile.tx - ox; const y = tile.ty - oy;
    return x >= 0 && y >= 0 && x < BOUNDARY_FIXTURE_SIZE && y < BOUNDARY_FIXTURE_SIZE ? { x, y } : null;
  };
  const has = (list: readonly (readonly [number, number])[], x: number, y: number): boolean => list.some(([lx, ly]) => lx === x && ly === y);
  const farms: Building[] = FARMS.map(([x, y], index) => ({
    id: `boundary-fixture-farm-${index}`, kind: "wheat_farm", tx: ox + x, ty: oy + y, workers: 0,
    inventory: {}, reserved: {}, stockReserved: {}, productionProgress: index * 11,
  }));
  const farmAt = (x: number, y: number): string | null => {
    const farm = farms.find(candidate => ox + x >= candidate.tx && ox + x < candidate.tx + 2 && oy + y >= candidate.ty && oy + y < candidate.ty + 2);
    return farm?.id ?? null;
  };
  const tiles = base.tiles.map(tile => {
    const at = local(tile);
    if (at === null) return tile;
    const water = at.x === 9 || at.x === 10;
    return {
      tx: tile.tx, ty: tile.ty,
      terrain: water ? "water" : has(FOREST, at.x, at.y) ? "forest" : "grass",
      hasRoad: has(ROAD, at.x, at.y) || has(BRIDGE, at.x, at.y),
      buildingId: farmAt(at.x, at.y),
    } satisfies Tile;
  });
  return { ...base, tiles, buildings: [...base.buildings, ...farms], roadRevision: base.roadRevision + 1, pathCache: {} };
}
