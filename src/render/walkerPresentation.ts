import type { TilePos, Walker } from "../agents/walker.types";
import { currentRoadTile } from "../agents/movement";
import type { ResourceType } from "../content/resourceConfig";

export type WalkerPresentationDirection = "NE" | "SE" | "SW" | "NW";
export type WalkerPresentationRole = "builder" | "farmer" | "logger" | "carter";
export type WalkerGaitFrame = 0 | 1;

export const WALKER_PRESENTATION_ROLES = ["builder", "farmer", "logger", "carter"] as const satisfies readonly WalkerPresentationRole[];
export const WALKER_PRESENTATION_DIRECTIONS = ["NE", "SE", "SW", "NW"] as const satisfies readonly WalkerPresentationDirection[];
export const WALKER_PRESENTATION_GAIT_FRAMES = [0, 1] as const satisfies readonly WalkerGaitFrame[];

export type WalkerPresentation = {
  readonly role: WalkerPresentationRole;
  readonly direction: WalkerPresentationDirection;
  readonly gaitFrame: WalkerGaitFrame;
};

export function walkerPresentationFor(walker: Walker): WalkerPresentation {
  return {
    role: roleForWalker(walker),
    direction: directionForWalker(walker),
    gaitFrame: gaitFrameForWalker(walker),
  };
}

function roleForWalker(walker: Walker): WalkerPresentationRole {
  switch (walker.kind) {
    case "builder":
      return "builder";
    case "distributor":
      return resourceRole(walker.cargo?.resource ?? null);
    case "carter":
      return carterRole(walker);
    default:
      return assertNever(walker);
  }
}

function carterRole(walker: Extract<Walker, { readonly kind: "carter" }>): WalkerPresentationRole {
  const resource = walker.cargo?.resource ?? walker.reservation.resource;
  return resourceRole(resource);
}

function resourceRole(resource: ResourceType | null): WalkerPresentationRole {
  switch (resource) {
    case "wheat":
    case "bread":
      return "farmer";
    case "logs":
    case "timber":
      return "logger";
    case "stone_raw":
    case "stone":
    case "coin":
    case null:
      return "carter";
    default:
      return assertNever(resource);
  }
}

function directionForWalker(walker: Walker): WalkerPresentationDirection {
  const vector = movementVector(walker);
  if (vector === null) return "SE";
  if (Math.abs(vector.tx) >= Math.abs(vector.ty)) {
    return vector.tx >= 0 ? "SE" : "NW";
  }
  return vector.ty >= 0 ? "SW" : "NE";
}

function gaitFrameForWalker(walker: Walker): WalkerGaitFrame {
  const segmentStart = walker.path[walker.pathIndex] ?? walker.previousTile;
  const progress = segmentStart === undefined || segmentStart === null
    ? walker.position.tx + walker.position.ty
    : Math.abs(walker.position.tx - segmentStart.tx)
      + Math.abs(walker.position.ty - segmentStart.ty);
  const frame = Math.floor(Math.max(0, progress) * 2) % 2;
  switch (frame) {
    case 0:
    case 1:
      return frame;
    default:
      throw new Error(`Unhandled walker gait frame: ${frame}`);
  }
}

function movementVector(walker: Walker): TilePos | null {
  const next = currentRoadTile(walker);
  const targetVector = next === null ? null : delta(walker.position, next);
  if (hasMagnitude(targetVector)) return targetVector;
  const previousVector = walker.previousTile === null
    ? null
    : delta(walker.previousTile, walker.position);
  return hasMagnitude(previousVector) ? previousVector : null;
}

function delta(from: TilePos, to: TilePos): TilePos {
  return {
    tx: to.tx - from.tx,
    ty: to.ty - from.ty,
  };
}

function hasMagnitude(vector: TilePos | null): vector is TilePos {
  return vector !== null && (Math.abs(vector.tx) > 0.000_001 || Math.abs(vector.ty) > 0.000_001);
}

function assertNever(value: never): never {
  throw new Error(`Unhandled walker presentation variant: ${JSON.stringify(value)}`);
}
