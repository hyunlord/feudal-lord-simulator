import type { GameState } from "../engine/engine.types";
import type { TileCoordinate } from "../world/grid";
import { placeDiagnosticCard } from "./DiagnosticCard";
import {
  resolveBuildingPlacementAttempt,
  resolveRoadRemovalAttempt,
  resolveRoadPlacementAttempt,
  type PlacementAttemptOutcome,
} from "./interactions";
import { canvasToWorld, type CameraState, type Point } from "./camera";
import type { PlacementTool } from "./renderer";
import { selectWorldAtTile, type AnchoredWorldSelection } from "./worldSelection";
import { getTile } from "../world/grid";
import { tileToScreen } from './iso';
import { currentConstructionSiteLabel } from '../ui/constructionAccessModel';
import { isWallConstructionSite, palisadeConstructionSchedule } from '../economy/palisadeConstruction';

type ClickResolution =
  | { readonly kind: "ignored"; readonly clearSuppression: boolean }
  | { readonly kind: "selection"; readonly selection: AnchoredWorldSelection | null }
  | { readonly kind: "placement"; readonly attempt: PlacementAttemptOutcome };

type ClickResolutionInput = Readonly<{
  suppressClick: boolean;
  spacePressed: boolean;
  dragMode: "none" | "pan" | "road";
  hover: TileCoordinate | null;
  selectedTool: PlacementTool | null;
  state: GameState;
  point: Point;
  camera?: CameraState;
  viewport: { readonly width: number; readonly height: number };
  nowMs: number;
}>;

export function resolveCanvasClick(input: ClickResolutionInput): ClickResolution {
  if (input.suppressClick) return { kind: "ignored", clearSuppression: true };
  if (input.spacePressed || input.dragMode !== "none") {
    return { kind: "ignored", clearSuppression: false };
  }
  if (input.selectedTool === null) {
    const selected = selectedWallLabel(input.state, input.point, input.camera)
      ?? (input.hover === null ? null : selectWorldAtTile(input.state, input.hover));
    if (selected === null) return { kind: "selection", selection: null };
    const position = placeDiagnosticCard(
      input.viewport,
      { x: input.point.x - 12, y: input.point.y - 12, width: 24, height: 24 },
      { width: 300, height: 260 },
    );
    return { kind: "selection", selection: { ...selected, position } };
  }
  if (input.hover === null) return { kind: 'ignored', clearSuppression: false };
  if (input.selectedTool === "road") {
    if (getTile(input.state, input.hover)?.hasRoad !== true) {
      return {
        kind: "placement",
        attempt: resolveRoadPlacementAttempt({
          state: input.state,
          start: input.hover,
          destination: input.hover,
          nowMs: input.nowMs,
        }),
      };
    }
    return {
      kind: "placement",
      attempt: resolveRoadRemovalAttempt({
        state: input.state,
        tile: input.hover,
        nowMs: input.nowMs,
      }),
    };
  }
  return {
    kind: "placement",
    attempt: resolveBuildingPlacementAttempt({
      state: input.state,
      tool: input.selectedTool,
      tile: input.hover,
      nowMs: input.nowMs,
    }),
  };
}

function selectedWallLabel(state: GameState, point: Point, camera: CameraState | undefined) {
  if (camera === undefined) return null;
  const world = canvasToWorld(point, camera);
  for (const site of state.constructionSites) {
    if (!isWallConstructionSite(site)) continue;
    const schedule = palisadeConstructionSchedule(site, state.constructionSites);
    if (schedule.kind !== 'queued' && currentConstructionSiteLabel(state, site) === '') continue;
    const first = site.path[0];
    const last = site.path[site.path.length - 1];
    if (first === undefined || last === undefined) continue;
    const anchor = tileToScreen((first.x + last.x) / 2, (first.y + last.y) / 2);
    if (world.x >= anchor.sx - 26 && world.x <= anchor.sx + 170 / camera.zoom
      && world.y >= anchor.sy - 80 && world.y <= anchor.sy - 42) {
      return { kind: 'construction_site' as const, siteId: site.id };
    }
  }
  return null;
}
