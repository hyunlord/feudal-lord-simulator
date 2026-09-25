import type { Point } from './camera';
import type { CauseMarkerSeverity } from '../ui/causeRegistry';

export interface CauseMarker extends Point {
  readonly buildingIds: readonly string[];
  readonly causeId: string | null;
  /** ▲ block or ◆ warn for a cause; null for a promotion ring, which is progress rather than a cause. */
  readonly severity: CauseMarkerSeverity | null;
  /** The building's origin tile: zoomed out, markers cluster by tile cell. */
  readonly tile: { readonly tx: number; readonly ty: number };
  readonly progressFraction?: number;
}

/** Below this zoom (UX1) one marker per cell stands for every cause in it, labelled with the count. */
export const CAUSE_CLUSTER_BELOW_ZOOM = 0.8;
export const CAUSE_CLUSTER_CELL_TILES = 6;

/**
 * Zoomed out, the causes of each 6x6 tile cell merge into one marker at their mean position. It keeps the most urgent
 * member's cause and severity (the first ▲ by building id, else the first ◆) and every member's id for the hit target
 * and the count. Promotion rings drop out: at that scale they are too small to read and are not causes.
 */
export function groupCauseMarkers(markers: readonly CauseMarker[], zoom: number): readonly CauseMarker[] {
  if (zoom >= CAUSE_CLUSTER_BELOW_ZOOM) return markers;
  const ordered = markers.filter(marker => marker.severity !== null)
    .sort((a, b) => (a.buildingIds[0] ?? '').localeCompare(b.buildingIds[0] ?? ''));
  const cells = new Map<string, CauseMarker[]>();
  for (const marker of ordered) {
    const key = `${Math.floor(marker.tile.tx / CAUSE_CLUSTER_CELL_TILES)},${Math.floor(marker.tile.ty / CAUSE_CLUSTER_CELL_TILES)}`;
    const members = cells.get(key);
    if (members === undefined) cells.set(key, [marker]);
    else members.push(marker);
  }
  return [...cells.values()].map(members => {
    const lead = members.find(member => member.severity === 'block') ?? members[0]!;
    return { ...lead,
      x: members.reduce((sum, member) => sum + member.x, 0) / members.length,
      y: members.reduce((sum, member) => sum + member.y, 0) / members.length,
      buildingIds: members.flatMap(member => member.buildingIds).sort() };
  });
}

/** Tap radius around a cause icon in screen px: a 44 px target (B9, 13.1 rule 5), wider than the 30 px icon. */
export const CAUSE_MARKER_HIT_RADIUS_PX = 22;

/** The nearest marker within the tap radius; on a tie the one drawn last (on top). */
export function hitCauseMarker<T extends Point>(markers: readonly T[], point: Point, zoom: number): T | null {
  let best: T | null = null;
  let bestDistance = Infinity;
  for (const marker of markers) {
    const distance = Math.hypot(marker.x - point.x, marker.y - point.y) * zoom;
    if (distance <= CAUSE_MARKER_HIT_RADIUS_PX && distance <= bestDistance) { best = marker; bestDistance = distance; }
  }
  return best;
}
