/**
 * Arable strip states (spec Z-18 and AF-2…AF-11), the read model the render session draws field strips from.
 * Derived from the saved field records (`arableFields`, v10) and the calendar; the same state gives the same
 * strips. Strip ids match the records: `${zoneId}:${axis}${line}:${first cell along the axis}`.
 */
import { ARABLE_CONFIG } from "../content/arableConfig";
import type { GameState } from "../engine/engine.types";
import type { TileCoordinate } from "../geometry/tileGeometry";
import type { ArableStage, ArableStripRecord } from "./arable.types";
import { arableLayouts, reconcileArableFields, stripSeasonYield, stripTending, stripYield, zoneMainAxis } from "./arableFields";
import type { ArableCauseKey } from "./arableCopy.ko";
import { grainReserveOutlook } from "./arableOutlook";
import type { Zone } from "./zone.types";

/** The C1c four-state view, kept for the render session's existing field art. */
export type ArableStripState = "ploughed" | "seedling" | "growing" | "fallow";

export interface ArableStrip {
  readonly id: string;
  readonly cells: readonly TileCoordinate[];
  readonly crop: "wheat";
  readonly stage: ArableStage;
  /** Tick the strip entered `stage`. */
  readonly stageTick: number;
  readonly state: ArableStripState;
  /** Wheat the strip should give at its next harvest (ripe: what it will give; otherwise a full season). */
  readonly yieldEstimate: number;
  /** Cells on the field edge (0.75 yield each, AF-6). */
  readonly headlandCells: number;
  /** The farmstead that tends it, if any (AF-8). */
  readonly farmsteadId: string | null;
  /** Why the strip is not moving, if it is held up (AF-11). */
  readonly cause: ArableCauseKey | null;
}

export interface ArableStripLayout {
  readonly axis: "x" | "y";
  readonly strips: readonly ArableStrip[];
}

const LEGACY_STATE: Readonly<Record<ArableStage, ArableStripState>> = {
  fallow: "fallow", ploughed: "ploughed", sown: "seedling", growing: "growing", ripe: "growing", harvested: "fallow",
};

export function stripCause(state: GameState, record: ArableStripRecord, tending: { status: string; farmsteadId: string | null } | undefined): ArableCauseKey | null {
  if (tending === undefined || tending.status === "no_farmstead") return "no_farmstead";
  if (tending.status === "farmstead_no_road") return "farmstead_no_road";
  const farmstead = state.buildings.find(building => building.id === tending.farmsteadId);
  const needsWork = record.stage === "ripe" || record.stage === "fallow" || record.stage === "ploughed";
  if (needsWork && (farmstead === undefined || farmstead.workers === 0)) return "no_labour";
  if (record.stage === "ripe") {
    const full = farmstead !== undefined && record.work >= record.cells * ARABLE_CONFIG.workPerCell.harvest;
    return full ? "barn_full" : "harvest_waiting";
  }
  return null;
}

export function arableStripStates(zone: Zone, state: GameState): ArableStripLayout {
  const layouts = arableLayouts(state);
  const layout = layouts.find(entry => entry.zoneId === zone.id);
  if (layout === undefined) return { axis: zoneMainAxis(zone, state.width), strips: [] };
  const fields = reconcileArableFields(state, layouts);
  const records = new Map((fields.find(field => field.zoneId === zone.id)?.strips ?? []).map(record => [record.id, record]));
  const tending = stripTending(state, layouts);
  return {
    axis: layout.axis,
    strips: layout.strips.map(strip => {
      const record = records.get(strip.id)!;
      const assigned = tending.get(strip.id);
      return {
        id: strip.id, cells: strip.cells, crop: record.crop, stage: record.stage, stageTick: record.stageTick,
        state: LEGACY_STATE[record.stage],
        yieldEstimate: record.stage === "ripe" ? stripYield(strip, record, record.completionPermille ?? 1000) : stripSeasonYield(strip, record.fertilityPermille),
        headlandCells: strip.headlandCells,
        farmsteadId: assigned?.farmsteadId ?? null,
        cause: stripCause(state, record, assigned),
      };
    }),
  };
}

/** AF-11 for a farmstead's inspector and map marker: no field, the first held-up strip's cause, or a short reserve. */
export function farmsteadCause(state: GameState, farmsteadId: string): ArableCauseKey | "no_field" | null {
  const layouts = arableLayouts(state);
  const tending = stripTending(state, layouts);
  const fields = reconcileArableFields(state, layouts);
  const records = new Map(fields.flatMap(field => field.strips).map(record => [record.id, record]));
  let tended = 0;
  for (const layout of layouts) {
    for (const strip of layout.strips) {
      const assigned = tending.get(strip.id);
      if (assigned?.farmsteadId !== farmsteadId) continue;
      tended += 1;
      const record = records.get(strip.id);
      const cause = record === undefined ? null : stripCause(state, record, assigned);
      if (cause !== null) return cause;
    }
  }
  if (tended === 0) return "no_field";
  return grainReserveOutlook(state).short ? "reserve_short" : null;
}
