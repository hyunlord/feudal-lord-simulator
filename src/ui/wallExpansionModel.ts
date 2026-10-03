import type { GameState } from "../engine/engine.types";
import { history } from "../engine/history";
import { previewPalisadeExpansion, type PalisadeExpansionPreview } from "../engine/palisade";
import { palisadeExpansionWarning } from "../engine/palisadeExpansion";
import { palisadeCoreFootprintsForState, palisadeFootprintsForState } from "../engine/palisadeFootprints";
import { PRESSURE_BALANCE } from "../content/balanceConfig";
import { palisadePathEnclosesFootprints, palisadePathHasBuildingClearance, validatePalisadeCandidate, type PalisadeFootprint, type PalisadePath,
  type ValidPalisadeCandidate } from "../world/palisadeGeometry";
import type { PredictionLine } from "./predictionTypes";
import { WALL_EXPANSION_COPY } from "./wallExpansionCopy.ko";

// UX-0b2 WALL-2 on screen: an expansion draft starts from the wall as it stands; while it is edited the engine's
// preview (`previewPalisadeExpansion`, WX-2) says what the new ring costs, how much it takes in and which fields go
// inside (and will be pasture a season on, WX-4); after the expansion the warning (`palisadeExpansionWarning`) says
// which are still to turn and when. Dates are calendar seasons, never ticks.

/**
 * The era console's wall proposal as a draft candidate, or null when it does not validate. FIX-15: the proposal may
 * take the water as its bound where the ring runs through it (the engine's proclamation and bot do), so the screen
 * validates it the same way; a stricter check refused it and "성벽 제안" did nothing on water-heavy lands (seed 77777).
 */
export function proposalDraftCandidate(state: GameState, path: PalisadePath, footprints: readonly PalisadeFootprint[]): ValidPalisadeCandidate | null {
  const validation = validatePalisadeCandidate(state, path, footprints, palisadeCoreFootprintsForState(state), 1, { waterReach: true });
  return validation.ok ? validation.candidate : null;
}

/**
 * The wall as it stands, as a draft candidate whose runs can be dragged outward. The town may have built against the
 * wall since it was proclaimed (a farmstead a tile off it), so the standing ring is taken without the clearance test;
 * every drag and the preview then test the new ring against every building.
 */
export function expansionStartCandidate(state: GameState): ValidPalisadeCandidate | null {
  const palisade = state.palisade;
  if (palisade === null) return null;
  const enclosed = palisadeFootprintsForState(state).filter(footprint => palisadePathEnclosesFootprints(palisade.polygon, [footprint]));
  // FIX-15: a standing ring may run through water (the water is its bound there).
  const validation = validatePalisadeCandidate(state, palisade.polygon, [], enclosed, 1, { waterReach: true });
  return validation.ok ? validation.candidate : null;
}

/**
 * The footprints an expansion draft's edits are tested against: every building but those already crowding the standing
 * wall (a farmstead built a tile off it) — they would fail every drag of every other side — and, for the enclosure, all
 * the standing wall holds. The engine's preview tests the finished ring against every building (WX-1).
 */
export function expansionDraftFootprints(state: GameState): Readonly<{ footprints: readonly PalisadeFootprint[]; enclosure: readonly PalisadeFootprint[] }> {
  const palisade = state.palisade;
  const all = palisadeFootprintsForState(state);
  if (palisade === null) return { footprints: all, enclosure: all };
  return { footprints: all.filter(footprint => palisadePathHasBuildingClearance(palisade.polygon, [footprint])),
    enclosure: all.filter(footprint => palisadePathEnclosesFootprints(palisade.polygon, [footprint])) };
}

// Cache — key: the wall (`state.palisade`), the zones and the draft path (the preview reads nothing else that an
// edit or a tick changes); reason: the preview tests every map cell against the old and the new ring and the canvas and
// the console ask for it every frame. Measured with tsx on the seed 2 chapter 1 town (64 x 64 map, a ring of 23 runs,
// one run dragged a step out): 0.59 ms a preview (median of 12), a hit 0.0009 ms.
let lastPreview: { readonly palisade: unknown; readonly zones: unknown; readonly key: string; readonly preview: PalisadeExpansionPreview } | null = null;

export function cachedExpansionPreview(state: GameState, path: PalisadePath): PalisadeExpansionPreview {
  const key = path.map(point => `${point.x},${point.y}`).join(";");
  if (lastPreview !== null && lastPreview.palisade === state.palisade && lastPreview.zones === state.zones && lastPreview.key === key) return lastPreview.preview;
  const preview = previewPalisadeExpansion(state, path);
  lastPreview = { palisade: state.palisade, zones: state.zones, key, preview };
  return preview;
}

const seasonLabel = (state: Pick<GameState, "scenarioId">, tick: number) => { const date = history.date({ tick }, state); return WALL_EXPANSION_COPY.date(date.year, date.season); };

/** The draft's preview lines: cost, area and the fields it takes in (a warning), or why it cannot be proclaimed. */
export function expansionLines(state: GameState, preview: PalisadeExpansionPreview): readonly PredictionLine[] {
  if (!preview.ok) return [{ id: "expansion-invalid", severity: "block", sources: [], text: WALL_EXPANSION_COPY.failure[preview.reason] }];
  const fields = preview.enclosedArableCells.length;
  return [
    { id: "expansion-cost", severity: "info", sources: [], text: WALL_EXPANSION_COPY.cost(preview.newSteps, preview.timber) },
    { id: "expansion-area", severity: "ok", sources: [], text: WALL_EXPANSION_COPY.area(preview.interiorBefore, preview.interiorAfter) },
    fields === 0 ? { id: "expansion-fields", severity: "info", sources: [], text: WALL_EXPANSION_COPY.noFields }
      : { id: "expansion-fields", severity: "warn", sources: [], text: WALL_EXPANSION_COPY.fields(fields, seasonLabel(state, state.tick + PRESSURE_BALANCE.seasonTicks)) },
  ];
}

/** After an expansion: the fields still to turn to pasture and when (WX-4), or null. */
export function pendingPastureWarning(state: GameState): Readonly<{ cells: readonly number[]; date: string; line: string }> | null {
  const warning = palisadeExpansionWarning(state);
  if (warning === null) return null;
  const date = seasonLabel(state, warning.convertsAtTick);
  return { cells: warning.cells, date, line: WALL_EXPANSION_COPY.pending(warning.cells.length, date) };
}
