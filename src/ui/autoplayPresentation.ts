import { BUILDING_CONFIG_BY_KIND } from "../content/buildingConfig";
import type { AutoplayAction } from "../engine/autoplay";
import { autoplayActionToGameAction } from "../engine/autoplayActions";
import type { GameState } from "../engine/engine.types";
import type { GameAction } from "../state/gameStore.types";
import type { TileCoordinate } from "../world/grid";
import { roadLine } from "../world/roadGraph";
import { createPlacementFeedback, type PlacementFeedback } from "../render/placementFeedback";

export { autoplayActionToGameAction } from "../engine/autoplayActions";

export const AUTOPLAY_PULSE_EVENT = "feudal-lord-simulator:autoplay-pulse";
export const AUTOPLAY_TICK_CADENCE = 120;
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
    case "proclaim_era":
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
    case "proclaim_era":
      return "다음: 시대 선포";
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
    case "proclaim_era":
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
