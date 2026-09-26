import { additionalRoadGates } from "./palisadeGates";
import { snapshotWallConstructionReserve } from "./constructionReserve";
import { palisadeCoreFootprintsForState, palisadeFootprintsForState } from "./palisadeFootprints";
import {
  constructionCancellationRefunds,
  createPalisadeConstructionSite,
  type PalisadeConstructionSite,
} from "../economy/construction";
import { canProclaimPalisadeEra } from "./era";
import type { GameState, PalisadeSegment } from "./engine.types";
import { getTile, type TileCoordinate } from "../world/grid";
import {
  isPointInsidePalisade,
  palisadePathEnclosesFootprints,
  palisadePerimeterSteps,
  validatePalisadeCandidate,
  type PalisadeFootprint,
  type PalisadePath,
  type TileEdgePoint,
} from "../world/palisadeGeometry";
import {
  PALISADE_SEGMENT_SITE_STEPS,
  palisadeRingPoints,
  palisadeStepPoints,
  segmentPalisadePathForConstruction,
  type PalisadeConstructionSegmentPath,
} from "./palisadeSegments";

export { segmentPalisadePathForConstruction } from "./palisadeSegments";

/** Timber a palisade step costs (the segment site's rate). */
const PALISADE_TIMBER_PER_STEP = createPalisadeConstructionSite({ id: "rate", wallId: "rate", segmentIndex: 0, gateDistance: 0, order: 0,
  path: [{ x: 0, y: 0 }, { x: 1, y: 0 }], startedTick: 0 }).required.timber ?? 0;

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
    gateDistance: site.gateDistance,
    edgePath: site.path,
    tileCount: palisadePerimeterSteps(site.path),
    completed: false,
    constructionSiteId: site.id,
    material: "timber",
    replacementConstructionSiteId: null,
  }));
}

export function confirmPalisadeProclamation(
  state: GameState,
  candidatePath: PalisadePath,
): GameState {
  if (!canProclaimPalisadeEra(state) || state.palisade !== null) return state;
  return projectPalisadeProclamation(state, candidatePath);
}

export function projectPalisadeProclamation(
  state: GameState,
  candidatePath: PalisadePath,
): GameState {
  if (state.era !== 'hamlet' || state.palisade !== null) return state;
  const footprints = palisadeFootprintsForState(state);
  const validation = validatePalisadeCandidate(state, candidatePath, footprints, palisadeCoreFootprintsForState(state), 1);
  if (!validation.ok) return state;
  const ring = palisadeRingPoints(validation.candidate.path);
  const gate = chooseGate(state, ring, settlementCenter(footprints));
  if (gate === null) return state;
  const wallId = wallIdForOrdinal(state.nextConstructionOrdinal);
  const additionalGates = additionalRoadGates(state, validation.candidate.path, gate.point);
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
      ...(additionalGates.length > 0 ? { additionalGates } : {}),
      segments: palisadeSegments(sites),
    },
    constructionSites: [...state.constructionSites, ...sites],
    wallConstructionReserve: snapshotWallConstructionReserve(state, sites, "timber"),
    nextConstructionOrdinal: state.nextConstructionOrdinal + 1,
  };
}

/**
 * WALL-2 (spec docs/design/wall-expansion.md WX-1…WX-6): an expansion proclaims a new ring that holds the old one.
 * Old segments that lie on the new ring stay as they are (built or not); old segments left inside the town are taken
 * down with their sites (timber delivered to them refunds as for a cancelled site); only the new ring's other steps become
 * construction sites, so the cost is the new length. The gate stays where it is if it is still on the ring. In the
 * stone town the new timber segments are replaced in stone as they complete, like every timber segment there.
 */
export type PalisadeExpansionPreview =
  | { readonly ok: true; readonly path: PalisadePath; readonly newSteps: number; readonly timber: number; readonly reusedSegmentIds: readonly string[];
    readonly removedSegmentIds: readonly string[]; readonly interiorBefore: number; readonly interiorAfter: number; readonly enclosedArableCells: readonly number[] }
  | { readonly ok: false; readonly reason: "no_palisade" | "invalid_path" | "not_containing" | "not_larger" | "no_gate" };

function stepKey(a: TileEdgePoint, b: TileEdgePoint): string {
  return a.x < b.x || (a.x === b.x && a.y < b.y) ? `${a.x},${a.y}|${b.x},${b.y}` : `${b.x},${b.y}|${a.x},${a.y}`;
}

function pathStepKeys(path: PalisadePath): string[] {
  const points = palisadeStepPoints(path);
  const keys: string[] = [];
  for (let index = 1; index < points.length; index += 1) keys.push(stepKey(points[index - 1]!, points[index]!));
  return keys;
}

function interiorCells(state: Pick<GameState, "width" | "height">, path: PalisadePath): Set<number> {
  const cells = new Set<number>();
  for (let ty = 0; ty < state.height; ty += 1) {
    for (let tx = 0; tx < state.width; tx += 1) if (isPointInsidePalisade({ x: tx + 0.5, y: ty + 0.5 }, path)) cells.add(ty * state.width + tx);
  }
  return cells;
}

/** WX-1: what an expansion to `path` would keep, take down and build (the render's preview; nothing changes). */
export function previewPalisadeExpansion(state: GameState, path: PalisadePath): PalisadeExpansionPreview {
  const palisade = state.palisade;
  if (palisade === null || (state.era !== "palisade" && state.era !== "stone_town")) return { ok: false, reason: "no_palisade" };
  // The new ring must clear every building and hold all the old wall held (a town may have built outside its wall).
  const footprints = palisadeFootprintsForState(state);
  const enclosed = footprints.filter(footprint => palisadePathEnclosesFootprints(palisade.polygon, [footprint]));
  const validation = validatePalisadeCandidate(state, path, footprints, enclosed, 1);
  if (!validation.ok) return { ok: false, reason: "invalid_path" };
  const candidate = validation.candidate.path;
  const before = interiorCells(state, palisade.polygon);
  const after = interiorCells(state, candidate);
  for (const cell of before) if (!after.has(cell)) return { ok: false, reason: "not_containing" };
  if (after.size <= before.size) return { ok: false, reason: "not_larger" };
  const ring = new Set(pathStepKeys(candidate));
  const reused = palisade.segments.filter(segment => pathStepKeys(segment.edgePath).every(key => ring.has(key)));
  const reusedKeys = new Set(reused.flatMap(segment => pathStepKeys(segment.edgePath)));
  const newSteps = [...ring].filter(key => !reusedKeys.has(key)).length;
  const arable = new Set((state.zones ?? []).filter(zone => zone.kind === "arable").flatMap(zone => zone.membership));
  return {
    ok: true, path: candidate, newSteps, timber: newSteps * PALISADE_TIMBER_PER_STEP,
    reusedSegmentIds: reused.map(segment => segment.id),
    removedSegmentIds: palisade.segments.filter(segment => !reused.includes(segment)).map(segment => segment.id),
    interiorBefore: before.size, interiorAfter: after.size,
    enclosedArableCells: [...after].filter(cell => !before.has(cell) && arable.has(cell)).sort((a, b) => a - b),
  };
}

/** WX-1 `expand_palisade`: proclaims the larger ring (see `previewPalisadeExpansion`); returns the state unchanged if it cannot. */
export function expandPalisade(state: GameState, path: PalisadePath): GameState {
  const preview = previewPalisadeExpansion(state, path);
  if (!preview.ok || state.palisade === null) return state;
  const palisade = state.palisade;
  const ring = palisadeRingPoints(preview.path);
  const gateIndex = ring.findIndex(point => point.x === palisade.gate.x && point.y === palisade.gate.y);
  const gate = gateIndex >= 0 ? { point: palisade.gate, stepIndex: gateIndex } : chooseGate(state, ring, settlementCenter(palisadeFootprintsForState(state)));
  if (gate === null) return state;
  const reusedIds = new Set(preview.reusedSegmentIds);
  const reused = palisade.segments.filter(segment => reusedIds.has(segment.id));
  const removed = palisade.segments.filter(segment => !reusedIds.has(segment.id));
  const reusedKeys = new Set(reused.flatMap(segment => pathStepKeys(segment.edgePath)));
  // The new ring from the gate, in runs of steps not already walled; each run cut into sites of four steps at most.
  const rotated = [...ring.slice(gate.stepIndex), ...ring.slice(0, gate.stepIndex), ring[gate.stepIndex]!];
  const runs: { readonly start: number; readonly points: TileEdgePoint[] }[] = [];
  let current: { start: number; points: TileEdgePoint[] } | null = null;
  for (let index = 1; index < rotated.length; index += 1) {
    const a = rotated[index - 1]!;
    const b = rotated[index]!;
    const fresh = !reusedKeys.has(stepKey(a, b));
    if (fresh && (current === null || current.points.length - 1 >= PALISADE_SEGMENT_SITE_STEPS)) {
      if (current !== null) runs.push(current);
      current = { start: index - 1, points: [a, b] };
    } else if (fresh && current !== null) current.points.push(b);
    else if (current !== null) { runs.push(current); current = null; }
  }
  if (current !== null) runs.push(current);
  const wallId = palisade.id;
  const ordinal = state.nextConstructionOrdinal;
  const firstOrder = palisade.segments.reduce((max, segment) => Math.max(max, segment.order), -1) + 1;
  const sites = runs.map((run, index) => createPalisadeConstructionSite({
    id: `${wallId}-x${String(ordinal).padStart(6, "0")}-segment-${String(index).padStart(3, "0")}`,
    wallId, segmentIndex: firstOrder + index, gateDistance: Math.min(run.start, ring.length - run.start), order: firstOrder + index,
    path: run.points, startedTick: state.tick,
  }));
  const removedSiteIds = new Set(removed.flatMap(segment => [segment.constructionSiteId, segment.replacementConstructionSiteId]).filter((id): id is string => typeof id === "string"));
  // Sites taken down refund as a cancelled site does (M-rule: 60 % of what was delivered).
  const refund = state.constructionSites.filter(site => removedSiteIds.has(site.id)).reduce((sum, site) => sum + (constructionCancellationRefunds(site).deliveredRefund.timber ?? 0), 0);
  const additionalGates = additionalRoadGates(state, preview.path, gate.point);
  return {
    ...state,
    treasuryTimber: state.treasuryTimber + refund,
    palisade: {
      id: wallId, polygon: preview.path, gate: gate.point, ...(additionalGates.length > 0 ? { additionalGates } : {}),
      segments: [...reused, ...palisadeSegments(sites)], expansion: { tick: state.tick, arableCells: preview.enclosedArableCells },
    },
    constructionSites: [...state.constructionSites.filter(site => !removedSiteIds.has(site.id)), ...sites],
    wallConstructionReserve: snapshotWallConstructionReserve(state, sites, "timber"),
    nextConstructionOrdinal: ordinal + 1,
  };
}
