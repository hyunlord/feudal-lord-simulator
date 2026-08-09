import { BUILDING_CONFIG_BY_KIND } from "../content/buildingConfig";
import type { AutoplayAction } from "./autoplay";
import { canProclaimStoneTownEra } from "./era";
import type { GameState } from "./engine.types";
import type { GameAction } from "../state/gameStore.types";
import {
  computePalisadeProposal,
  validatePalisadeCandidate,
  type PalisadeFootprint,
  type PalisadePath,
} from "../world/palisadeGeometry";

function assertNever(value: never): never {
  throw new Error(`Unhandled autoplay action: ${JSON.stringify(value)}`);
}

function palisadeFootprintsForState(state: GameState): readonly PalisadeFootprint[] {
  return [...state.buildings]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((building) => {
      const definition = BUILDING_CONFIG_BY_KIND[building.kind];
      return {
        id: building.id,
        tx: building.tx,
        ty: building.ty,
        width: definition.width,
        height: definition.height,
      };
    });
}

function clampedPalisadePath(state: GameState, footprints: readonly PalisadeFootprint[]): PalisadePath | null {
  const first = footprints[0];
  if (first === undefined) return null;
  let minX = first.tx;
  let minY = first.ty;
  let maxX = first.tx + first.width;
  let maxY = first.ty + first.height;
  for (const footprint of footprints) {
    minX = Math.min(minX, footprint.tx);
    minY = Math.min(minY, footprint.ty);
    maxX = Math.max(maxX, footprint.tx + footprint.width);
    maxY = Math.max(maxY, footprint.ty + footprint.height);
  }
  const left = Math.max(0, minX - 1);
  const top = Math.max(0, minY - 1);
  const right = Math.min(state.width, maxX + 1);
  const bottom = Math.min(state.height, maxY + 1);
  if (left >= right || top >= bottom) return null;
  return [
    { x: left, y: top },
    { x: right, y: top },
    { x: right, y: bottom },
    { x: left, y: bottom },
    { x: left, y: top },
  ];
}

function eraGameAction(state: GameState): GameAction | null {
  if (state.era === "stone_town") return null;
  if (state.era === "palisade") {
    return canProclaimStoneTownEra(state) ? { type: "confirm_stone_town_proclamation" } : null;
  }
  const footprints = palisadeFootprintsForState(state);
  const proposal = computePalisadeProposal(state, footprints);
  const fallback = proposal.ok || proposal.reason !== "out_of_bounds" ? null : clampedPalisadePath(state, footprints);
  const path = proposal.ok ? proposal.path : fallback;
  if (path === null) return null;
  const validation = validatePalisadeCandidate(state, path, footprints);
  return validation.ok
    ? { type: "confirm_palisade_proclamation", candidatePath: validation.candidate.path }
    : null;
}

export function autoplayActionToGameAction(action: AutoplayAction, state?: GameState): GameAction | null {
  switch (action.kind) {
    case "place_building":
      return { type: "place_building", kind: action.building, tx: action.tx, ty: action.ty };
    case "place_road":
      return { type: "place_road_line", start: action.from, destination: action.to };
    case "proclaim_era":
      return state === undefined ? null : eraGameAction(state);
    case "none":
      return null;
    default:
      return assertNever(action);
  }
}
