import type { Dispatch } from "react";
import type { GameState } from "../engine/engine.types";
import type { GameAction } from "../state/gameStore.types";
import type { WorldPoint } from "../input/inputIntent";
import type { TileCoordinate } from "../world/grid";
import { cachedDrainPreview, drainRefusalText, type DrainPreview } from "../ui/drainToolModel";
import { DRAINAGE_COPY } from "../ui/drainageCopy.ko";
import { playPlacementSound } from "../audio/soundDirector";
import type { CanvasMutableRefs } from "./canvasRuntimeRefs";
import { pickTile } from "./picking";
import { createPlacementFeedback } from "./placementFeedback";
import { drawMarkTile } from "./placementTileOverlay";

// LAND-UI (LU-D6, MA-11): the canvas side of the fen's drain tool, armed from its build-drawer card (App `drainTool`).
// Only active while armed; otherwise every function returns false / null and the canvas keeps its usual behaviour.
//  - hover: drainagePlan at the pointer's tile — its cells light up as placement-fine tiles (a refusal hatches the
//    hovered tile), and the prediction chip shows cells, timber and seasons, or the refusal (drainToolModel.ts);
//  - select (click / tap): `{ type: "drain_fen", tx, ty }` when the plan holds, else the refusal as placement failure
//    feedback; the tool stays armed for the second works;
//  - cancel aimed at the map (right click): disarms, as Esc does through the UI state machine (App).

export type DrainToolContext = {
  readonly armedRef: { current: boolean };
  readonly disarmRef: { current: (() => void) | undefined };
  readonly refs: CanvasMutableRefs;
  readonly stateRef: { current: GameState };
  readonly dispatch: Dispatch<GameAction>;
};

/** The armed tool's preview at the hovered tile, or null. */
export function drainToolPreview(context: DrainToolContext): DrainPreview | null {
  const tile = context.refs.hoverRef.current;
  return context.armedRef.current && tile !== null ? cachedDrainPreview(context.stateRef.current, tile) : null;
}

/** The `select` intent with the tool armed: the command, or the refusal's feedback. True when it took the click. */
export function drainSelect(context: DrainToolContext, world: WorldPoint): boolean {
  if (!context.armedRef.current) return false;
  const tile: TileCoordinate | null = pickTile(world);
  if (tile === null) return true;
  const preview = cachedDrainPreview(context.stateRef.current, tile);
  const nowMs = performance.now();
  const action: GameAction | null = preview.ok ? { type: "drain_fen", tx: tile.tx, ty: tile.ty } : null;
  const feedback = createPlacementFeedback({ kind: preview.ok ? "success" : "failure", anchor: { kind: "tile", tile }, nowMs,
    message: preview.ok ? DRAINAGE_COPY.started(preview.cells.length) : preview.refusalText ?? drainRefusalText(preview.reason ?? "not_still_water") });
  context.refs.feedbackRef.current = feedback;
  playPlacementSound({ action, feedback });
  if (action !== null) context.dispatch(action);
  return true;
}

/** A right click on the map with the tool armed: disarm. */
export function drainCancel(context: DrainToolContext): boolean {
  if (!context.armedRef.current) return false;
  context.disarmRef.current?.();
  return true;
}

/** The plan's cells over the map (world transform), placement-mark style. */
export function drawDrainPreview(context: CanvasRenderingContext2D, state: Pick<GameState, "width">, preview: DrainPreview, zoom: number): void {
  if (!preview.ok) {
    drawMarkTile(context, { tx: preview.tile.tx, ty: preview.tile.ty, ok: false, reason: null, icon: false, ring: false }, zoom);
    return;
  }
  for (const cell of preview.cells) {
    drawMarkTile(context, { tx: cell % state.width, ty: Math.floor(cell / state.width), ok: true, reason: null, icon: false, ring: false }, zoom);
  }
}
