/**
 * WALL-2 WX-4 (spec docs/design/wall-expansion.md): arable land an expansion encloses. New fields may not be painted
 * inside the wall (Z-5); an expansion that takes some in warns (`palisadeExpansionWarning`), and a season after the
 * expansion those fields, if still arable, turn to pasture (the player may erase them before). Fields that were inside
 * before the expansion are not its business. Converted with the zone module's own edits,
 * cell by cell, so fields and farmsteads follow as they do for a player's edit (not on the player's undo list).
 */
import { PRESSURE_BALANCE } from "../content/balanceConfig";
import { applyErase, applyPaint, cellInsideWall } from "../zones/zoneEdits";
import type { ZoneStroke } from "../zones/zone.types";
import type { GameState } from "./engine.types";

const SEASON = PRESSURE_BALANCE.seasonTicks;

/** WX-4: the cells the last expansion took inside that are still arable. */
export function enclosedArableCells(state: Pick<GameState, "zones" | "palisade" | "width">): readonly number[] {
  const expansion = state.palisade?.expansion;
  if (expansion === undefined) return [];
  const arable = new Set((state.zones ?? []).filter(zone => zone.kind === "arable").flatMap(zone => zone.membership));
  return expansion.arableCells.filter(cell => arable.has(cell) && cellInsideWall(state, cell));
}

/** WX-4: the warning after an expansion: the enclosed arable cells and the tick they turn to pasture. */
export function palisadeExpansionWarning(state: Pick<GameState, "zones" | "palisade" | "width">): { readonly cells: readonly number[]; readonly convertsAtTick: number } | null {
  const expansion = state.palisade?.expansion;
  if (expansion === undefined) return null;
  const cells = enclosedArableCells(state);
  return cells.length === 0 ? null : { cells, convertsAtTick: expansion.tick + SEASON };
}

function cellStroke(state: Pick<GameState, "width">, cell: number): ZoneStroke {
  const tx = cell % state.width;
  const ty = Math.floor(cell / state.width);
  return { tool: "brush", points: [{ x: tx + 0.5, y: ty + 0.5 }], radius: 0.5 };
}

/** WX-4: a season after an expansion, the fields it took in become pasture and the expansion's mark is cleared. */
export function advancePalisadeExpansion(state: GameState): GameState {
  const expansion = state.palisade?.expansion;
  if (expansion === undefined || state.palisade === null || state.tick < expansion.tick + SEASON) return state;
  let next = state;
  for (const cell of enclosedArableCells(state)) {
    const stroke = cellStroke(state, cell);
    next = applyPaint(applyErase(next, stroke), "pasture", stroke);
  }
  const { expansion: _expansion, ...palisade } = next.palisade!;
  return { ...next, palisade };
}
