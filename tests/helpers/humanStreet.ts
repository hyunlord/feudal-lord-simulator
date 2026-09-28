/**
 * FIX-4 gate ② / CODE-1a human path: the player's street after the tutorial, as commands — a road west of the fields and
 * south into the open ground, two wells on it and burgage plots painted on both sides (twelve plots). Seed map, tutorial
 * at pace 1: the fields lie south of the village road, so the new street goes round them.
 */
import assert from "node:assert/strict";
import type { GameState } from "../../src/engine/engine.types";
import { gameReducer } from "../../src/state/gameStore";

const ROAD = [[{ tx: 42, ty: 39 }, { tx: 39, ty: 39 }], [{ tx: 39, ty: 40 }, { tx: 35, ty: 40 }], [{ tx: 35, ty: 41 }, { tx: 35, ty: 60 }]] as const;
const WELLS = [{ tx: 36, ty: 49 }, { tx: 36, ty: 57 }] as const;
const PLOT_SIDES = [[32, 34], [36, 38]] as const;

export function layStreet(start: GameState): GameState {
  let state = start;
  for (const [from, to] of ROAD) {
    const next = gameReducer(state, { type: "place_road_line", start: from, destination: to });
    assert.notEqual(next, state, `road ${from.tx},${from.ty} → ${to.tx},${to.ty}`);
    state = next;
  }
  for (const [west, east] of PLOT_SIDES) {
    state = gameReducer(state, { type: "zone_paint", kind: "burgage", stroke: { tool: "polygon", points: [
      { x: west, y: 42 }, { x: east + 1, y: 42 }, { x: east + 1, y: 61 }, { x: west, y: 61 }] } });
  }
  for (const well of WELLS) {
    const next = gameReducer(state, { type: "place_building", kind: "well", tx: well.tx, ty: well.ty });
    assert.notEqual(next, state, `well ${well.tx},${well.ty}`);
    state = next;
  }
  return state;
}

