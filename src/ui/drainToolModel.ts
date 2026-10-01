import { DRAINAGE_BALANCE } from "../content/drainageConfig";
import { drainagePlan, type DrainageRefusal } from "../engine/drainage";
import { stateArchetype } from "../engine/archetype";
import type { GameState } from "../engine/engine.types";
import type { TileCoordinate } from "../world/grid";
import { DRAINAGE_COPY } from "./drainageCopy.ko";
import type { PredictionLine } from "./predictionTypes";

// LAND-UI (LU-D6, MA-11): the drain tool's view of a hovered tile — the engine's drainagePlan as the cells to light,
// the chip lines (cells, timber, seasons; or the refusal in Korean) and the command a click sends.

export type DrainPreview = {
  readonly tile: TileCoordinate;
  readonly ok: boolean;
  /** The plan's cells (tile indices); empty when it refuses. */
  readonly cells: readonly number[];
  readonly reason: DrainageRefusal | null;
  readonly lines: readonly PredictionLine[];
};

/** The drain card shows only on the fen (LU-D6). */
export function drainToolAvailable(state: GameState): boolean {
  return stateArchetype(state)?.terrain.kind === "fen";
}

export function drainRefusalText(reason: DrainageRefusal): string {
  return DRAINAGE_COPY.refusal[reason];
}

export function drainPreview(state: GameState, tile: TileCoordinate): DrainPreview {
  const plan = drainagePlan(state, tile.tx, tile.ty);
  if (!plan.ok) {
    return { tile, ok: false, cells: [], reason: plan.reason,
      lines: [{ id: "drain-refusal", severity: "block", sources: [], text: drainRefusalText(plan.reason) }] };
  }
  return { tile, ok: true, cells: plan.cells, reason: null, lines: [
    { id: "drain-cells", severity: "ok", sources: [], text: `${DRAINAGE_COPY.chipTitle} · ${DRAINAGE_COPY.cells(plan.cells.length)}` },
    { id: "drain-timber", severity: "info", sources: [], text: DRAINAGE_COPY.timber(plan.timber) },
    { id: "drain-seasons", severity: "info", sources: [], text: DRAINAGE_COPY.seasons(plan.seasons, DRAINAGE_BALANCE.diggers) },
    { id: "drain-confirm", severity: "info", sources: [], text: DRAINAGE_COPY.confirm },
  ] };
}

let last: { readonly state: GameState; readonly tx: number; readonly ty: number; readonly preview: DrainPreview } | null = null;
/**
 * The preview at the pointer, cached (AGENTS rule 10): (a) key = the state object and the tile; (b) nothing else enters
 * drainagePlan; (c) the frame asks every frame while the tool is up, and the plan's flood fill and timber count need not
 * run again until a tick or a move.
 */
export function cachedDrainPreview(state: GameState, tile: TileCoordinate): DrainPreview {
  if (last !== null && last.state === state && last.tx === tile.tx && last.ty === tile.ty) return last.preview;
  const preview = drainPreview(state, tile);
  last = { state, tx: tile.tx, ty: tile.ty, preview };
  return preview;
}
