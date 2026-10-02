import type { TilePos, Walker } from "../agents/walker.types";
import { currentRoadTile } from "../agents/movement";
import type { ResourceType } from "../content/resourceConfig";
import { resourceEntry } from "../content/resourceCatalog";

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

/** The farmer and the logger have their own look; a quarryman, the coin collector and an empty hand wear the carter's. */
function resourceRole(resource: ResourceType | null): WalkerPresentationRole {
  const carrier = resource === null ? null : resourceEntry(resource).carrier;
  return carrier === "farmer" || carrier === "logger" ? carrier : "carter";
}

function directionForWalker(walker: Walker): WalkerPresentationDirection {
  const vector = movementVector(walker);
  if (vector === null) return "SE";
  if (Math.abs(vector.tx) >= Math.abs(vector.ty)) {
    return vector.tx >= 0 ? "SE" : "NW";
  }
  return vector.ty >= 0 ? "SW" : "NE";
}

/**
 * NAT-4 QA-026: the step's rise. The walker sheets' two gait rows (walkers-v2, Wave 3) draw the same leg forward, so a
 * walk alternating them reads as one stride sliding along. Until the sheets have the opposite stride, the body rises
 * on gait frame 1 (the passing beat) by WALKER_STEP_LIFT of the figure's height — about 1 px at zoom 1 — rounded to
 * whole device pixels (`deviceScale`: device px per world px) so the figure stays crisp; twice a tile at the
 * walk's pace (gaitFrameForWalker). The feet's cart, shadow and cargo stay on the ground. World px.
 */
export const WALKER_STEP_LIFT = 0.06;
export function walkerStepLift(gaitFrame: WalkerGaitFrame, figurePx: number, deviceScale: number): number {
  if (gaitFrame === 0 || !(deviceScale > 0)) return 0;
  return Math.max(1, Math.round(WALKER_STEP_LIFT * figurePx * deviceScale)) / deviceScale;
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
