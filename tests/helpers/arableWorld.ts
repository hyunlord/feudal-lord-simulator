import type { Building } from "../../src/content/buildingConfig";
import type { GameState } from "../../src/engine/engine.types";
import { DEFAULT_GAME_STATE, gameReducer } from "../../src/state/gameStore";
import { stepArableFields } from "../../src/zones/arableFields";
import type { ZoneStroke } from "../../src/zones/zone.types";

/**
 * ARCH-1b: the fields' corner of the opening map moved with the river — the riverside town's river crosses the old
 * corner (x 2–11, y 8–13), so the tests' coordinates are read shifted onto open meadow north-east (x 42–51, y 1–6).
 */
export const FIELD_SHIFT = { tx: 40, ty: -7 } as const;

/** A polygon stroke covering cells [x0, x1) × [y0, y1) (in the tests' coordinates, shifted by `FIELD_SHIFT`). */
export function rectangle(x0: number, y0: number, x1: number, y1: number): ZoneStroke {
  const [a, b, c, d] = [x0 + FIELD_SHIFT.tx, y0 + FIELD_SHIFT.ty, x1 + FIELD_SHIFT.tx, y1 + FIELD_SHIFT.ty];
  return { tool: "polygon", points: [{ x: a, y: b }, { x: c, y: b }, { x: c, y: d }, { x: a, y: d }] };
}

export function farmsteadAt(tx: number, ty: number, workers = 4, id = `farmstead-${tx}-${ty}`): Building {
  return { id, kind: "farmstead", tx: tx + FIELD_SHIFT.tx, ty: ty + FIELD_SHIFT.ty, workers, inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0 };
}

/**
 * The opening map with a 4×3 arable zone on open grass (cells x 6–9, y 9–11, shifted) and, unless `farmstead` is null,
 * a finished farmstead beside it at (10,10, shifted) with a road east of it. No other building, walker or house.
 */
export function fieldWorld(options: { readonly farmstead?: Building | null; readonly field?: ZoneStroke; readonly tick?: number } = {}): GameState {
  const base: GameState = { ...structuredClone(DEFAULT_GAME_STATE), buildings: [], houses: [], walkers: [], population: 0,
    tick: options.tick ?? 0, tiles: DEFAULT_GAME_STATE.tiles.map(tile => ({ ...tile, buildingId: null, hasRoad: tile.tx === 11 + FIELD_SHIFT.tx && tile.ty >= 9 + FIELD_SHIFT.ty && tile.ty <= 12 + FIELD_SHIFT.ty })) };
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
