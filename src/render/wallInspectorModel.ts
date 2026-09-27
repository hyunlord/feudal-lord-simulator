import type { GameState } from "../engine/engine.types";
import { ringDefencePermille } from "../engine/war";
import { WALL_INSPECTOR_COPY } from "./wallInspectorCopy.ko";

// UI-6: what a wall is worth against a raid (WR-5). A finished segment's card (selected on the map like a building)
// names the segment and shows the ring's defence: `ringDefencePermille` as a percent, 0 while a gap remains (a segment
// not yet built). A wall construction site's card takes the same defence as one row (`ringDefenceRow`).
export type WallInspectorModel = {
  readonly segmentId: string;
  readonly name: string;
  readonly purpose: string;
  readonly rows: readonly string[];
};

type RingDefence = { readonly percent: number; readonly gaps: number; readonly segments: number };

function ringDefence(state: Pick<GameState, "palisade">): RingDefence {
  const segments = state.palisade?.segments ?? [];
  return { percent: Math.round(ringDefencePermille(state) / 10), gaps: segments.filter(segment => !segment.completed).length, segments: segments.length };
}

/** The ring's defence as a sentence (the wall card's row). */
export function ringDefenceLine(state: Pick<GameState, "palisade">): string {
  const defence = ringDefence(state);
  if (defence.segments === 0) return WALL_INSPECTOR_COPY.defenceNone;
  return defence.gaps > 0 ? WALL_INSPECTOR_COPY.defenceOpen(defence.gaps) : WALL_INSPECTOR_COPY.defenceClosed(defence.percent);
}

/** The ring's defence as a label / value row (a wall construction site's card). Null without a ring. */
export function ringDefenceRow(state: Pick<GameState, "palisade">): { readonly label: string; readonly value: string } | null {
  const defence = ringDefence(state);
  if (defence.segments === 0) return null;
  return { label: WALL_INSPECTOR_COPY.defenceTerm,
    value: defence.gaps > 0 ? WALL_INSPECTOR_COPY.defenceValueOpen(defence.gaps) : WALL_INSPECTOR_COPY.defenceValueClosed(defence.percent) };
}

export function wallInspectorModel(state: Pick<GameState, "palisade">, segmentId: string): WallInspectorModel | null {
  const segments = state.palisade?.segments ?? [];
  const segment = segments.find(candidate => candidate.id === segmentId);
  if (segment === undefined) return null;
  const replacing = segment.replacementConstructionSiteId != null;
  return {
    segmentId,
    name: WALL_INSPECTOR_COPY.name(segment.material === "stone"),
    purpose: WALL_INSPECTOR_COPY.purpose,
    rows: [
      WALL_INSPECTOR_COPY.segments(segments.filter(candidate => candidate.completed).length, segments.length),
      ...(replacing ? [WALL_INSPECTOR_COPY.replacing] : []),
      ringDefenceLine(state),
    ],
  };
}
