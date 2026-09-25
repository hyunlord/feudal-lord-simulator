import type { Building } from "../../src/content/buildingConfig";
import type { GameState } from "../../src/engine/engine.types";
import { DEFAULT_GAME_STATE, gameReducer } from "../../src/state/gameStore";
import { stepArableFields } from "../../src/zones/arableFields";
import type { ZoneStroke } from "../../src/zones/zone.types";

/** A polygon stroke covering cells [x0, x1) × [y0, y1). */
export function rectangle(x0: number, y0: number, x1: number, y1: number): ZoneStroke {
  return { tool: "polygon", points: [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }] };
}

export function farmsteadAt(tx: number, ty: number, workers = 4, id = `farmstead-${tx}-${ty}`): Building {
  return { id, kind: "farmstead", tx, ty, workers, inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0 };
}

/**
 * The opening map with a 4×3 arable zone on open grass (cells x 6–9, y 9–11) and, unless `farmstead` is null,
 * a finished farmstead beside it at (10,10) with a road tile east of it. No other building, walker or house.
 */
export function fieldWorld(options: { readonly farmstead?: Building | null; readonly field?: ZoneStroke; readonly tick?: number } = {}): GameState {
  const base: GameState = { ...structuredClone(DEFAULT_GAME_STATE), buildings: [], houses: [], walkers: [], population: 0,
    tick: options.tick ?? 0, tiles: DEFAULT_GAME_STATE.tiles.map(tile => ({ ...tile, buildingId: null, hasRoad: tile.tx === 11 && tile.ty >= 9 && tile.ty <= 12 })) };
  const painted = gameReducer(base, { type: "zone_paint", kind: "arable", stroke: options.field ?? rectangle(6, 9, 10, 12) });
  const farmstead = options.farmstead === undefined ? farmsteadAt(10, 10) : options.farmstead;
  if (farmstead === null) return painted;
  return { ...painted, buildings: [farmstead],
    tiles: painted.tiles.map(tile => tile.tx === farmstead.tx && tile.ty === farmstead.ty ? { ...tile, buildingId: farmstead.id } : tile) };
}

/** Runs only the field rule (AF-3…AF-9) for `ticks` ticks, workers held fixed. */
export function runFields(state: GameState, ticks: number, observe?: (state: GameState) => void): GameState {
  let current = state;
  for (let index = 0; index < ticks; index += 1) {
    current = { ...stepArableFields(current).state };
    observe?.(current);
    current = { ...current, tick: current.tick + 1 };
  }
  return current;
}
