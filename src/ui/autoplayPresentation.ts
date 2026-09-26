import { BUILDING_CONFIG_BY_KIND } from "../content/buildingConfig";
import type { AutoplayAction } from "../engine/autoplay";
import { autoplayActionToGameAction } from "../engine/autoplayActions";
import type { GameState } from "../engine/engine.types";
import type { GameAction } from "../state/gameStore.types";
import type { TileCoordinate } from "../world/grid";
import { roadLine } from "../world/roadGraph";
import { createPlacementFeedback, type PlacementFeedback } from "../render/placementFeedback";
import { AUTOPLAY_FAMINE_RESPONSE_LABEL, AUTOPLAY_PAINT_ARABLE_LABEL, AUTOPLAY_PETITION_RESPONSE_LABEL, AUTOPLAY_REBUILD_HOUSE_LABEL, AUTOPLAY_RELOCATE_HOUSE_LABEL, AUTOPLAY_RESERVE_RECOVERY_LABEL } from './autoplayCopy.ko';

export { autoplayActionToGameAction } from "../engine/autoplayActions";

export const AUTOPLAY_PULSE_EVENT = "feudal-lord-simulator:autoplay-pulse";
export { AUTOPLAY_TICK_CADENCE } from "../engine/autoplay.types";
import { AUTOPLAY_TICK_CADENCE } from "../engine/autoplay.types";
export const AUTOPLAY_COMMIT_DELAY_MS = 240;

export type AutoplayPulseEvent = CustomEvent<PlacementFeedback>;

function assertNever(value: never): never {
  throw new Error(`Unhandled autoplay action: ${JSON.stringify(value)}`);
}

export function canRunAutoplayAtTick(input: {
  readonly enabled: boolean;
  readonly currentTick: number;
  readonly lastActionTick: number;
  readonly pending?: boolean;
}): boolean {
  return input.enabled &&
    !input.pending &&
    input.currentTick - input.lastActionTick >= AUTOPLAY_TICK_CADENCE;
}

export function autoplayActionPulseTile(action: AutoplayAction): TileCoordinate | null {
  switch (action.kind) {
    case "place_building":
      return { tx: action.tx, ty: action.ty };
    case "place_road":
      return action.to;
    case "paint_zone":
      return action.stroke.points[0] === undefined ? null : { tx: Math.floor(action.stroke.points[0].x), ty: Math.floor(action.stroke.points[0].y) };
    case "proclaim_era":
    case "set_wall_construction_priority":
    case "demolish_house":
    case "rebuild_house":
    case "famine_response":
    case "petition_response":
    case "none":
      return null;
    default:
      return assertNever(action);
  }
}

export function autoplayActionLabel(action: AutoplayAction): string {
  switch (action.kind) {
    case "place_building":
      return `다음: ${BUILDING_CONFIG_BY_KIND[action.building].name} 건설`;
    case "place_road":
      return "다음: 길 연결";
    case "paint_zone":
      return AUTOPLAY_PAINT_ARABLE_LABEL;
    case "proclaim_era":
      return "다음: 시대 선포";
    case "set_wall_construction_priority":
      return AUTOPLAY_RESERVE_RECOVERY_LABEL;
    case "demolish_house":
      return AUTOPLAY_RELOCATE_HOUSE_LABEL;
    case "rebuild_house":
      return AUTOPLAY_REBUILD_HOUSE_LABEL;
    case "famine_response":
      return AUTOPLAY_FAMINE_RESPONSE_LABEL;
    case "petition_response":
      return AUTOPLAY_PETITION_RESPONSE_LABEL;
    case "none":
      return "다음: 대기";
    default:
      return assertNever(action);
  }
}

export function presentThenScheduleAutoplayAction(input: {
  readonly action: AutoplayAction;
  readonly state: GameState;
  readonly publishPulse: () => void;
  readonly schedule: (commit: () => void, delayMs: number) => () => void;
  readonly beforeDispatch?: () => void;
  readonly dispatch: (action: GameAction) => void;
}): (() => void) | null {
  const gameAction = autoplayActionToGameAction(input.action, input.state);
  if (gameAction === null) return null;
  input.publishPulse();
  return input.schedule(() => {
    input.beforeDispatch?.();
    input.dispatch(gameAction);
  }, AUTOPLAY_COMMIT_DELAY_MS);
}

export function autoplayActionFeedback(action: AutoplayAction, nowMs: number): PlacementFeedback | null {
  switch (action.kind) {
    case "place_building":
      return createPlacementFeedback({
        kind: "success",
        message: autoplayActionLabel(action),
        anchor: { kind: "tile", tile: { tx: action.tx, ty: action.ty } },
        nowMs,
      });
    case "place_road":
      return createPlacementFeedback({
        kind: "success",
        message: autoplayActionLabel(action),
        anchor: { kind: "path", path: roadLine(action.from, action.to) },
        nowMs,
      });
    case "paint_zone":
    case "proclaim_era":
    case "set_wall_construction_priority":
    case "demolish_house":
    case "rebuild_house":
    case "famine_response":
    case "petition_response":
    case "none":
      return null;
    default:
      return assertNever(action);
  }
}

export function publishAutoplayPulse(action: AutoplayAction, target: Window, nowMs: number): void {
  const feedback = autoplayActionFeedback(action, nowMs);
  if (feedback === null) return;
  target.dispatchEvent(new CustomEvent(AUTOPLAY_PULSE_EVENT, { detail: feedback }));
}
