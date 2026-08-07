import { BUILDING_CONFIG_BY_KIND } from "../content/buildingConfig";
import {
  createPalisadeConstructionSite,
  type PalisadeConstructionSite,
} from "../economy/construction";
import { canProclaimPalisadeEra } from "./era";
import type { GameState, PalisadeSegment } from "./engine.types";
import { getTile, type TileCoordinate } from "../world/grid";
import {
  palisadePerimeterSteps,
  validatePalisadeCandidate,
  type PalisadeFootprint,
  type PalisadePath,
  type TileEdgePoint,
} from "../world/palisadeGeometry";
import {
  PALISADE_SEGMENT_SITE_STEPS,
  palisadeRingPoints,
  segmentPalisadePathForConstruction,
  type PalisadeConstructionSegmentPath,
} from "./palisadeSegments";

export { segmentPalisadePathForConstruction } from "./palisadeSegments";

type BoundaryGate = {
  readonly point: TileEdgePoint;
  readonly stepIndex: number;
};

type GateCandidate = {
  readonly point: TileEdgePoint;
  readonly score: number;
};

type SettlementCenter = {
  readonly x: number;
  readonly y: number;
};

type OrderedSegment = PalisadeConstructionSegmentPath & {
  readonly clockwiseDistance: number;
  readonly gateDistance: number;
};

function pointKey(point: TileEdgePoint): string {
  return `${point.x},${point.y}`;
}

function tileKey(tile: TileCoordinate): string {
  return `${tile.tx},${tile.ty}`;
}

function tileDistanceSquared(left: TileCoordinate, right: SettlementCenter): number {
  return (left.tx - right.x) ** 2 + (left.ty - right.y) ** 2;
}

function edgeDistanceSquared(left: TileEdgePoint, right: TileCoordinate | SettlementCenter): number {
  const rightX = "tx" in right ? right.tx : right.x;
  const rightY = "ty" in right ? right.ty : right.y;
  return (left.x - rightX) ** 2 + (left.y - rightY) ** 2;
}

function settlementFootprints(state: GameState): readonly PalisadeFootprint[] {
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

function settlementCenter(footprints: readonly PalisadeFootprint[]): SettlementCenter {
  const totals = footprints.reduce(
    (sum, footprint) => ({
      x: sum.x + footprint.tx + footprint.width / 2,
      y: sum.y + footprint.ty + footprint.height / 2,
    }),
    { x: 0, y: 0 },
  );
  return footprints.length === 0
    ? { x: 0, y: 0 }
    : { x: totals.x / footprints.length, y: totals.y / footprints.length };
}

function trafficScores(state: GameState): ReadonlyMap<string, number> {
  const scores = new Map<string, number>();
  for (const walker of state.walkers) {
    if (walker.kind === "builder") continue;
    for (const tile of walker.path.slice(walker.pathIndex)) {
      const key = tileKey(tile);
      scores.set(key, (scores.get(key) ?? 0) + 1);
    }
  }
  return scores;
}

function roadTiles(state: GameState): readonly TileCoordinate[] {
  return state.tiles
    .filter((tile) => tile.hasRoad)
    .map((tile) => ({ tx: tile.tx, ty: tile.ty }))
    .sort((left, right) => (left.ty === right.ty ? left.tx - right.tx : left.ty - right.ty));
}

function crossedGateCandidates(
  state: GameState,
  ring: readonly TileEdgePoint[],
  scores: ReadonlyMap<string, number>,
): readonly GateCandidate[] {
  const candidates = new Map<string, GateCandidate>();
  for (const point of ring) {
    const road = { tx: point.x, ty: point.y };
    const tile = getTile(state, road);
    if (tile?.hasRoad !== true) continue;
    candidates.set(pointKey(point), { point, score: scores.get(tileKey(road)) ?? 0 });
  }
  return [...candidates.values()];
}

function bestTrafficRoad(
  roads: readonly TileCoordinate[],
  scores: ReadonlyMap<string, number>,
  center: SettlementCenter,
): TileCoordinate | null {
  return [...roads].sort((left, right) => {
    const scoreDelta = (scores.get(tileKey(right)) ?? 0) - (scores.get(tileKey(left)) ?? 0);
    if (scoreDelta !== 0) return scoreDelta;
    const distanceDelta = tileDistanceSquared(left, center) - tileDistanceSquared(right, center);
    return distanceDelta !== 0 ? distanceDelta : left.ty === right.ty ? left.tx - right.tx : left.ty - right.ty;
  })[0] ?? null;
}

function nearestRingPoint(
  ring: readonly TileEdgePoint[],
  target: TileCoordinate | SettlementCenter,
): TileEdgePoint {
  return [...ring].sort((left, right) => {
    const distanceDelta = edgeDistanceSquared(left, target) - edgeDistanceSquared(right, target);
    return distanceDelta !== 0 ? distanceDelta : left.y === right.y ? left.x - right.x : left.y - right.y;
  })[0] ?? { x: 0, y: 0 };
}

function chooseGate(state: GameState, ring: readonly TileEdgePoint[], center: SettlementCenter): BoundaryGate | null {
  const scores = trafficScores(state);
  const crossed = crossedGateCandidates(state, ring, scores);
  const roads = roadTiles(state);
  const target =
    crossed.length > 0
      ? [...crossed].sort((left, right) => {
          const scoreDelta = right.score - left.score;
          if (scoreDelta !== 0) return scoreDelta;
          const distanceDelta = edgeDistanceSquared(left.point, center) - edgeDistanceSquared(right.point, center);
          return distanceDelta !== 0 ? distanceDelta : left.point.y === right.point.y ? left.point.x - right.point.x : left.point.y - right.point.y;
        })[0]?.point
      : nearestRingPoint(ring, bestTrafficRoad(roads, scores, center) ?? center);
  if (target === undefined) return null;
  const stepIndex = ring.findIndex((point) => point.x === target.x && point.y === target.y);
  return stepIndex < 0 ? null : { point: target, stepIndex };
}

function orderedSegments(path: PalisadePath, gate: BoundaryGate): readonly OrderedSegment[] {
  const ring = palisadeRingPoints(path);
  if (ring.length === 0) return [];
  const rotated = [...ring.slice(gate.stepIndex), ...ring.slice(0, gate.stepIndex), ring[gate.stepIndex]].filter(
    (point): point is TileEdgePoint => point !== undefined,
  );
  const clockwise = segmentPalisadePathForConstruction(rotated).map((segment, index) => {
    const clockwiseDistance = index * PALISADE_SEGMENT_SITE_STEPS;
    const counterDistance = Math.max(0, ring.length - clockwiseDistance);
    return {
      ...segment,
      clockwiseDistance,
      gateDistance: Math.min(clockwiseDistance, counterDistance),
    };
  });
  return [...clockwise].sort((left, right) => {
    const distanceDelta = left.gateDistance - right.gateDistance;
    if (distanceDelta !== 0) return distanceDelta;
    return left.clockwiseDistance - right.clockwiseDistance;
  });
}

function wallIdForOrdinal(ordinal: number): string {
  return `palisade-${String(ordinal).padStart(6, "0")}`;
}

function createWallSites(
  wallId: string,
  segments: readonly OrderedSegment[],
  startedTick: number,
): readonly PalisadeConstructionSite[] {
  return segments.map((segment, order) =>
    createPalisadeConstructionSite({
      id: `${wallId}-segment-${String(order).padStart(3, "0")}`,
      wallId,
      segmentIndex: order,
      gateDistance: segment.gateDistance,
      order,
      path: segment.path,
      startedTick,
    }),
  );
}

function palisadeSegments(sites: readonly PalisadeConstructionSite[]): readonly PalisadeSegment[] {
  return sites.map((site) => ({
    id: site.id,
    order: site.order,
    edgePath: site.path,
    tileCount: palisadePerimeterSteps(site.path),
    completed: false,
    constructionSiteId: site.id,
  }));
}

export function confirmPalisadeProclamation(
  state: GameState,
  candidatePath: PalisadePath,
): GameState {
  if (!canProclaimPalisadeEra(state) || state.palisade !== null) return state;
  const footprints = settlementFootprints(state);
  const validation = validatePalisadeCandidate(state, candidatePath, footprints);
  if (!validation.ok) return state;
  const ring = palisadeRingPoints(validation.candidate.path);
  const gate = chooseGate(state, ring, settlementCenter(footprints));
  if (gate === null) return state;
  const wallId = wallIdForOrdinal(state.nextConstructionOrdinal);
  const wallSegments = orderedSegments(validation.candidate.path, gate);
  const sites = createWallSites(wallId, wallSegments, state.tick);

  return {
    ...state,
    era: "palisade",
    eraProclaimedTick: state.tick,
    palisade: {
      id: wallId,
      polygon: validation.candidate.path,
      gate: gate.point,
      segments: palisadeSegments(sites),
    },
    constructionSites: [...state.constructionSites, ...sites],
    nextConstructionOrdinal: state.nextConstructionOrdinal + 1,
  };
}
