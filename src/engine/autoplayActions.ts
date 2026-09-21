import { confirmPalisadeProclamation } from './palisade';
import { preservesAutoplayServiceSpace } from './autoplayServiceSpace';
import type { PalisadePath } from '../world/palisadeGeometry';
import { palisadeFootprintsForState } from "./palisadeFootprints";
import type { AutoplayAction } from "./autoplay";
import { canProclaimStoneTownEra } from "./era";
import type { GameState } from "./engine.types";
import type { GameAction } from "../state/gameStore.types";
import {
  computePalisadeProposal,
  validatePalisadeCandidate,
} from "../world/palisadeGeometry";

function assertNever(value: never): never {
  throw new Error(`Unhandled autoplay action: ${JSON.stringify(value)}`);
}

function eraGameAction(state: GameState, candidatePath?: PalisadePath): GameAction | null {
  if (state.era === "stone_town") return null;
  if (state.era === "palisade") {
    return canProclaimStoneTownEra(state) ? { type: "confirm_stone_town_proclamation" } : null;
  }
  const footprints = palisadeFootprintsForState(state);
  const proposal = candidatePath === undefined ? computePalisadeProposal(state, footprints) : { ok: true, path: candidatePath };
  if (!proposal.ok) return null;
  const validation = validatePalisadeCandidate(state, proposal.path, footprints);
  if (candidatePath !== undefined && validation.ok) {
    const projected = confirmPalisadeProclamation(state, validation.candidate.path);
    if (projected === state || !preservesAutoplayServiceSpace(state, { kind: 'proclaim_era' }, projected)) return null;
  }
  return validation.ok
    ? { type: "confirm_palisade_proclamation", candidatePath: validation.candidate.path }
    : null;
}

export function autoplayActionToGameAction(action: AutoplayAction, state?: GameState): GameAction | null {
  switch (action.kind) {
    case "place_building":
      return {
        type: "place_building",
        kind: action.building,
        tx: action.tx,
        ty: action.ty,
        ...(
          action.building === "granary" || action.building === "mill" || action.building === "wheat_farm"
            ? { autoplayFoodObservation: true }
            : {}
        ),
      };
    case "place_road":
      return { type: "place_road_line", start: action.from, destination: action.to };
    case "proclaim_era":
      return state === undefined ? null : eraGameAction(state, action.candidatePath);
    case "none":
      return null;
    default:
      return assertNever(action);
  }
}
