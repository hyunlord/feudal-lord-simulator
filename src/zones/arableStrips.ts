/**
 * Arable strip states (spec Z-18), the read model the render session draws field strips from. Derived and
 * unsaved; the same state always gives the same strips.
 *
 * A zone's main axis is the longer side of its bounding box (`x` on a tie). Each map line along that axis
 * is cut into runs of consecutive member cells; every run is one strip. Until arable zones replace wheat
 * farm buildings (C1c-2, an open decision), a strip takes the state of the first wheat farm (by id) whose
 * footprint covers one of its cells, and lies fallow when none does.
 */
import { BUILDING_CONFIG_BY_KIND, operationSuspended, type Building } from "../content/buildingConfig";
import { isBuildingConstructionSite } from "../economy/construction";
import { productionOperation } from "../economy/production";
import type { GameState } from "../engine/engine.types";
import type { TileCoordinate } from "../geometry/tileGeometry";
import { cellCoordinate } from "./zoneRaster";
import type { Zone } from "./zone.types";

export type ArableStripState = "ploughed" | "seedling" | "growing" | "fallow";

export interface ArableStrip {
  /** `${zoneId}:${axis}${line}:${first cell along the axis}`, stable while the run keeps its start. */
  readonly id: string;
  readonly cells: readonly TileCoordinate[];
  readonly state: ArableStripState;
  /** The wheat farm the state was read from, if any. */
  readonly farmId: string | null;
}

export interface ArableStripLayout {
  readonly axis: "x" | "y";
  readonly strips: readonly ArableStrip[];
}

/** Growth stage of one wheat farm: its production progress in thirds; a full or idle farm reads as such. */
export function wheatFarmStripState(building: Building): ArableStripState {
  const definition = BUILDING_CONFIG_BY_KIND.wheat_farm;
  if (operationSuspended(building) || building.workers < definition.workersRequired) return "fallow";
  if (productionOperation(building, definition) === "output_full") return "growing";
  const ticks = definition.production?.ticksPerOutput ?? 1;
  const third = building.productionProgress * 3;
  return third >= ticks * 2 ? "growing" : third >= ticks ? "seedling" : "ploughed";
}

function mainAxis(cells: readonly TileCoordinate[]): "x" | "y" {
  const xs = cells.map(cell => cell.tx);
  const ys = cells.map(cell => cell.ty);
  return Math.max(...xs) - Math.min(...xs) >= Math.max(...ys) - Math.min(...ys) ? "x" : "y";
}

export function arableStripStates(zone: Zone, state: Pick<GameState, "width" | "buildings" | "constructionSites">): ArableStripLayout {
  const cells = zone.membership.map(index => cellCoordinate(state.width, index));
  const axis = cells.length === 0 ? "x" : mainAxis(cells);
  const farmAt = new Map<string, { readonly id: string; readonly state: ArableStripState }>();
  const cover = (tx: number, ty: number, id: string, stripState: ArableStripState) => {
    for (let dy = 0; dy < BUILDING_CONFIG_BY_KIND.wheat_farm.height; dy += 1) {
      for (let dx = 0; dx < BUILDING_CONFIG_BY_KIND.wheat_farm.width; dx += 1) {
        const key = `${tx + dx},${ty + dy}`;
        if (!farmAt.has(key)) farmAt.set(key, { id, state: stripState });
      }
    }
  };
  for (const farm of [...state.buildings].filter(building => building.kind === "wheat_farm").sort((a, b) => a.id.localeCompare(b.id))) {
    cover(farm.tx, farm.ty, farm.id, wheatFarmStripState(farm));
  }
  // A farm still being built is ploughed ground.
  for (const site of state.constructionSites.filter(isBuildingConstructionSite).filter(site => site.kind === "wheat_farm")
    .sort((a, b) => a.id.localeCompare(b.id))) cover(site.tx, site.ty, site.id, "ploughed");

  const lines = new Map<number, TileCoordinate[]>();
  for (const cell of cells) {
    const line = axis === "x" ? cell.ty : cell.tx;
    const list = lines.get(line) ?? [];
    list.push(cell);
    lines.set(line, list);
  }
  const strips: ArableStrip[] = [];
  for (const line of [...lines.keys()].sort((a, b) => a - b)) {
    const along = (cell: TileCoordinate) => axis === "x" ? cell.tx : cell.ty;
    const run: TileCoordinate[] = [];
    const flush = () => {
      if (run.length === 0) return;
      const farm = run.map(cell => farmAt.get(`${cell.tx},${cell.ty}`)).find(entry => entry !== undefined);
      strips.push({ id: `${zone.id}:${axis}${line}:${along(run[0]!)}`, cells: [...run], state: farm?.state ?? "fallow", farmId: farm?.id ?? null });
      run.length = 0;
    };
    for (const cell of [...lines.get(line)!].sort((a, b) => along(a) - along(b))) {
      const last = run[run.length - 1];
      if (last !== undefined && along(cell) !== along(last) + 1) flush();
      run.push(cell);
    }
    flush();
  }
  return { axis, strips };
}
