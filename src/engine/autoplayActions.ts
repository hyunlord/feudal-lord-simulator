import { BUILDING_CONFIG_BY_KIND } from "../content/buildingConfig";
import type { AutoplayAction } from "./autoplay";
import { canProclaimStoneTownEra } from "./era";
import type { GameState } from "./engine.types";
import type { GameAction } from "../state/gameStore.types";
import {
  computePalisadeProposal,
  validatePalisadeCandidate,
  type PalisadeFootprint,
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

function eraGameAction(state: GameState): GameAction | null {
  if (state.era === "stone_town") return null;
  if (state.era === "palisade") {
    return canProclaimStoneTownEra(state) ? { type: "confirm_stone_town_proclamation" } : null;
  }
  const footprints = palisadeFootprintsForState(state);
  const proposal = computePalisadeProposal(state, footprints);
  if (!proposal.ok) return null;
  const validation = validatePalisadeCandidate(state, proposal.path, footprints);
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
