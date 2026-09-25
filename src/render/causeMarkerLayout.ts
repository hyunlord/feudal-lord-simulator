import type { Point } from './camera';

export interface CauseMarker extends Point {
  readonly buildingIds: readonly string[];
  readonly causeId: string | null;
  readonly risk: boolean;
  readonly progressFraction?: number;
}

export function groupCauseMarkers(markers: readonly CauseMarker[], zoom: number): readonly CauseMarker[] {
  if (zoom > 0.6) return markers;
  const ordered = [...markers].sort((a, b) => (a.buildingIds[0] ?? '').localeCompare(b.buildingIds[0] ?? ''));
  const visited = new Set<CauseMarker>();
  const groups: CauseMarker[] = [];
  for (const anchor of ordered) {
    if (visited.has(anchor)) continue;
    const members = [anchor];
    visited.add(anchor);
    if (anchor.causeId !== null) {
      for (const member of members) {
        for (const candidate of ordered) {
          if (visited.has(candidate) || candidate.causeId !== anchor.causeId
            || Math.hypot(member.x - candidate.x, member.y - candidate.y) * zoom > 36) continue;
          visited.add(candidate);
          members.push(candidate);
        }
      }
    }
    groups.push({ ...anchor, risk: members.some(member => member.risk),
      buildingIds: members.flatMap(member => member.buildingIds).sort() });
  }
  return groups;
}

/** Tap radius around a cause icon in screen px: a 44 px target (B9, 13.1 rule 5), wider than the 30 px icon. */
export const CAUSE_MARKER_HIT_RADIUS_PX = 22;

/** The nearest marker within the tap radius; on a tie the one drawn last (on top). */
export function hitCauseMarker(markers: readonly CauseMarker[], point: Point, zoom: number): CauseMarker | null {
  let best: CauseMarker | null = null;
  let bestDistance = Infinity;
  for (const marker of markers) {
    const distance = Math.hypot(marker.x - point.x, marker.y - point.y) * zoom;
    if (distance <= CAUSE_MARKER_HIT_RADIUS_PX && distance <= bestDistance) { best = marker; bestDistance = distance; }
  }
  return best;
}
