import { BUILDING_CONFIG_BY_KIND } from "../../content/buildingConfig";
import type { GameState } from "../../engine/engine.types";
import { calendarLabel } from "../../engine/scenarioState";
import { buildingCauseLine } from "../../render/BuildingInspector";
import type { CameraState } from "../../render/camera";
import { pickTile } from "../../render/picking";
import type { WorldSelection } from "../../render/worldSelection";
import { walkerHeadline } from "../persons/personModels";
import { walkerDiagnosisModel } from "../walkerDiagnosisModel";
import { QA_OVERLAY_COPY as COPY } from "./qaOverlayCopy.ko";

// NAT-2 QA tool: the QA info overlay's lines (pure). Astra could not collect ticks or camera coordinates; the overlay
// shows what a report needs to put the same scene back: the tick, the calendar, the speed, the camera (zoom, pan, the
// world point and the tile under the screen's centre), the tile under the last map click and what the selection is
// doing or waiting for (a walker: the card's headline and status, what is left of its way, a cancelled delivery's
// reason; a building: its cause line).
export type QaLine = Readonly<{ key: string; label: string; value: string }>;
export type QaTile = Readonly<{ tx: number; ty: number }>;
export type QaReading = Readonly<{
  tick: number;
  calendar: string;
  speed: number;
  camera: CameraState;
  viewport: Readonly<{ width: number; height: number }>;
  click: QaTile | null;
  selection: readonly QaLine[];
}>;

/** The world point (world screen px, the iso plane) under the canvas centre: canvas = world × zoom + pan. */
export function viewCenter(camera: CameraState, viewport: QaReading["viewport"]): Readonly<{ x: number; y: number }> {
  return { x: (viewport.width / 2 - camera.panX) / camera.zoom, y: (viewport.height / 2 - camera.panY) / camera.zoom };
}

const line = (key: string, label: string, value: string): QaLine => ({ key, label, value });

/** What the map's selection is and does (none: one "없음" line). */
export function qaSelectionLines(state: GameState, selection: WorldSelection | null): readonly QaLine[] {
  if (selection === null) return [line("selection", COPY.selection, COPY.none)];
  switch (selection.kind) {
    case "walker": {
      const walker = state.walkers.find(candidate => candidate.id === selection.walkerId);
      if (walker === undefined) return [line("selection", COPY.selection, COPY.gone(selection.walkerId))];
      const headline = walkerHeadline(state, walker.id);
      const diagnosis = walkerDiagnosisModel(state, walker.id);
      const rows = [line("selection", COPY.selection, COPY.walker(diagnosis?.roleLabel ?? walker.kind, walker.id, headline?.name ?? null))];
      if (diagnosis !== null) {
        rows.push(line("state", COPY.state, COPY.walkerState(diagnosis.statusLabel, headline?.line ?? null)));
        rows.push(diagnosis.cancellationLabel === null ? line("way", COPY.way, COPY.walkerLeft(diagnosis.remainingDistance, diagnosis.etaTicks))
          : line("way", COPY.cancelled, diagnosis.cancellationLabel));
      }
      return rows;
    }
    case "building": {
      const building = state.buildings.find(candidate => candidate.id === selection.buildingId);
      if (building === undefined) return [line("selection", COPY.selection, COPY.gone(selection.buildingId))];
      const cause = buildingCauseLine(state, building.id);
      return [line("selection", COPY.selection, COPY.building(BUILDING_CONFIG_BY_KIND[building.kind].name, building.id, building.tx, building.ty)),
        ...(cause === null ? [] : [line("state", COPY.state, cause)])];
    }
    case "construction_site":
      return [line("selection", COPY.selection, COPY.site(selection.siteId))];
    case "wall_segment":
      return [line("selection", COPY.selection, COPY.wall(selection.segmentId))];
  }
}

export function qaOverlayLines(reading: QaReading): readonly QaLine[] {
  const { camera } = reading;
  const center = viewCenter(camera, reading.viewport);
  const centerTile = pickTile(center);
  return [
    line("tick", COPY.tick, String(reading.tick)),
    line("calendar", COPY.calendar, reading.calendar),
    line("speed", COPY.speed, COPY.speedValue(reading.speed)),
    line("zoom", COPY.zoom, camera.zoom.toFixed(3)),
    line("pan", COPY.pan, COPY.point(Math.round(camera.panX), Math.round(camera.panY))),
    line("center", COPY.center, COPY.point(Math.round(center.x), Math.round(center.y))),
    line("centerTile", COPY.centerTile, centerTile === null ? COPY.none : COPY.tile(centerTile.tx, centerTile.ty)),
    line("click", COPY.click, reading.click === null ? COPY.none : COPY.tile(reading.click.tx, reading.click.ty)),
    ...reading.selection,
  ];
}

/** The lines as text for a QA report (one "label: value" a line). */
export function qaOverlayText(lines: readonly QaLine[]): string {
  return lines.map(entry => `${entry.label}: ${entry.value}`).join("\n");
}

/** The reading of a game state (the calendar from the state, the rest as given). */
export function qaReading(state: GameState, input: Omit<QaReading, "tick" | "calendar" | "selection"> & { readonly selection: WorldSelection | null }): QaReading {
  return { tick: state.tick, calendar: calendarLabel(state), speed: input.speed, camera: input.camera, viewport: input.viewport, click: input.click,
    selection: qaSelectionLines(state, input.selection) };
}
