import { useEffect, useRef } from "react";

import type { GameState } from "../../../engine/engine.types";
import { lordMode } from "../../../engine/townAgency";
import { platformServices } from "../../../platform/platform";
import { MINIMAP_VIEWBOX_SIZE, MINIMAP_VIEWPORT_EVENT, type MinimapViewportRect } from "../../../render/minimapCameraJump";
import type { TileCoordinate } from "../../../world/grid";
import { townSeatTile } from "./townSeat";

// DEC-CARD A2 (Astra's lord-mode play: "불러오기 때 마을이 화면 밖에 있다"): a save does not keep the camera (src/save
// is the engine's), so lord mode keeps where the lord last looked in the platform preferences, per game, and looks
// there again when a game is loaded (the app remounts on a load or a new game, and so does the canvas); a game with no
// such record opens on its seat (townSeatTile). The sandbox and the campaign open as before (nothing here runs).
// Cache (AGENTS rule 10): (a) key `fls.lordCamera.v1:<scenarioId>:<seed>` — the game's own identity: every save of one
// game, any slot, shares its map; (b) nothing else enters: the value is the tile at the view's middle (the minimap's
// published view rectangle; the zoom stays the player's); (c) why: the save has no camera and the engine's save format
// is not the renderer's to change. Written at most every WRITE_MS while the view moves, and when the canvas goes.

// A scripted scene (`?phase10-proof=1`: captures, the geometry audit, replays) sets its own camera; this stays out of
// it unless the scene asks for it (`&lord-camera=1`, the DEC-CARD capture of this very behaviour).
const WRITE_MS = 2_000;
const scripted = (): boolean => {
  if (typeof window === "undefined") return false;
  const query = new URLSearchParams(window.location.search);
  return query.get("phase10-proof") === "1" && query.get("lord-camera") !== "1";
};
export const cameraKey = (state: Pick<GameState, "scenarioId" | "seed">): string => `fls.lordCamera.v1:${state.scenarioId}:${state.seed}`;

export function readCameraTile(key: string): TileCoordinate | null {
  const raw = platformServices().preferences.get(key);
  const [tx, ty] = (raw ?? "").split(",").map(Number);
  return raw === null || !Number.isFinite(tx) || !Number.isFinite(ty) ? null : { tx: tx!, ty: ty! };
}

/** The tile at the middle of the minimap's view rectangle (viewbox units) on a grid. */
export function viewCentreTile(rect: MinimapViewportRect, grid: Pick<GameState, "width" | "height">): TileCoordinate {
  return { tx: Math.round((rect.x + rect.width / 2) / MINIMAP_VIEWBOX_SIZE * grid.width),
    ty: Math.round((rect.y + rect.height / 2) / MINIMAP_VIEWBOX_SIZE * grid.height) };
}

/** Called by the game canvas after its runtime (its intent handler is listening by then): restores and records. */
export function useLordCamera(state: GameState): void {
  const first = useRef(state);
  useEffect(() => {
    const at = first.current;
    if (!lordMode(at) || scripted()) return undefined;
    const key = cameraKey(at);
    const target = readCameraTile(key) ?? townSeatTile(at);
    if (target !== null) platformServices().input.emit({ kind: "lookAt", tile: target });
    let latest: string | null = null;
    let written: string | null = null;
    const onView = (event: Event) => {
      const tile = viewCentreTile((event as CustomEvent<MinimapViewportRect>).detail, at);
      latest = `${tile.tx},${tile.ty}`;
    };
    const flush = () => { if (latest !== null && latest !== written) { platformServices().preferences.set(key, latest); written = latest; } };
    window.addEventListener(MINIMAP_VIEWPORT_EVENT, onView);
    const timer = window.setInterval(flush, WRITE_MS);
    return () => { window.removeEventListener(MINIMAP_VIEWPORT_EVENT, onView); window.clearInterval(timer); flush(); };
  }, []);
}
