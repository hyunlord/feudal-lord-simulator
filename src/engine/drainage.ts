/**
 * ARCH-1b (spec docs/design/map-archetypes.md MA-11): the fen's drainage works. The player chooses a tile of still water
 * (a mere, not the river's channel) on a fen; the works take that water's cells within two tiles of it (at most 5 × 5)
 * that are free of roads, if one of them lies on a bank. The timber is paid at the command; then men from what the
 * labour allocation left dig (`drainageDiggers`, after the field hands) until the work is done, and the cells become
 * meadow (`advanceDrainage`). A decision in the history ledger (`decision.drainage`), and a record when it is done.
 */
import { DRAINAGE_BALANCE as B } from "../content/drainageConfig";
import { PRESSURE_BALANCE } from "../content/balanceConfig";
import { placementSpendableResource } from "../world/placement";
import { isFlowingWater } from "../world/river";
import { stateArchetype } from "./archetype";
import type { GameState } from "./engine.types";
import { chargeRoadTimber } from "./roadPlacement";

export interface DrainageWork {
  readonly id: string;
  /** The cells to drain (tile indices, ascending). */
  readonly cells: readonly number[];
  readonly startedTick: number;
  readonly timber: number;
  readonly workNeeded: number;
  readonly workDone: number;
  /** The men digging this tick (for the render's diggers); absent when none. */
  readonly diggers?: number;
}

export interface DrainageState {
  readonly works: readonly DrainageWork[];
  /** The cells drained so far (tile indices, ascending) — the render's drained ground. */
  readonly drained: readonly number[];
}

export type DrainageRefusal = "not_fen" | "not_still_water" | "no_bank" | "busy" | "too_many_works" | "insufficient_timber";

export type DrainagePlan =
  | { readonly ok: true; readonly cells: readonly number[]; readonly timber: number; readonly workNeeded: number; readonly seasons: number }
  | { readonly ok: false; readonly reason: DrainageRefusal };

const NEIGHBOURS = [[0, -1], [1, 0], [0, 1], [-1, 0]] as const;

/** MA-11 API: what draining at (tx, ty) would take — its cells, timber, work and seasons at full diggers — or why not. */
export function drainagePlan(state: GameState, tx: number, ty: number): DrainagePlan {
  if (stateArchetype(state)?.terrain.kind !== "fen") return { ok: false, reason: "not_fen" };
  const { width, height } = state;
  const still = (x: number, y: number) => x >= 0 && y >= 0 && x < width && y < height
    && state.tiles[y * width + x]!.terrain === "water" && !state.tiles[y * width + x]!.hasRoad && !isFlowingWater(state, y * width + x);
  if (!still(tx, ty) || state.river === undefined) return { ok: false, reason: "not_still_water" };
  const works = state.drainage?.works ?? [];
  if (works.length >= B.maxWorks) return { ok: false, reason: "too_many_works" };
  const taken = new Set(works.flatMap(work => work.cells));
  // The mere's cells joined to the chosen one within the patch.
  const cells: number[] = [];
  const seen = new Set([ty * width + tx]);
  const queue = [ty * width + tx];
  for (let head = 0; head < queue.length; head += 1) {
    const index = queue[head]!;
    cells.push(index);
    const x = index % width, y = Math.floor(index / width);
    for (const [dx, dy] of NEIGHBOURS) {
      const nx = x + dx, ny = y + dy, next = ny * width + nx;
      if (Math.abs(nx - tx) > B.patchRadius || Math.abs(ny - ty) > B.patchRadius || seen.has(next) || !still(nx, ny)) continue;
      seen.add(next);
      queue.push(next);
    }
  }
  if (cells.some(cell => taken.has(cell))) return { ok: false, reason: "busy" };
  const onBank = cells.some(cell => NEIGHBOURS.some(([dx, dy]) => {
    const x = cell % width + dx, y = Math.floor(cell / width) + dy;
    return x >= 0 && y >= 0 && x < width && y < height && state.tiles[y * width + x]!.terrain === "grass";
  }));
  if (!onBank) return { ok: false, reason: "no_bank" };
  const timber = cells.length * B.timberPerCell;
  if (placementSpendableResource(state, "timber") < timber) return { ok: false, reason: "insufficient_timber" };
  const workNeeded = cells.length * B.workPerCell;
  return { ok: true, cells: cells.sort((a, b) => a - b), timber, workNeeded, seasons: Math.ceil(workNeeded / B.diggers / PRESSURE_BALANCE.seasonTicks) };
}

/** MA-11: the player's command — the works open and their timber is paid; unchanged when the plan refuses. */
export function startDrainage(state: GameState, tx: number, ty: number): GameState {
  const plan = drainagePlan(state, tx, ty);
  if (!plan.ok) return state;
  const drainage = state.drainage ?? { works: [], drained: [] };
  const work: DrainageWork = { id: `drainage-${state.tick}-${tx}-${ty}`, cells: plan.cells, startedTick: state.tick, timber: plan.timber,
    workNeeded: plan.workNeeded, workDone: 0 };
  return { ...state, ...chargeRoadTimber(state, plan.timber), drainage: { ...drainage, works: [...drainage.works, work] } };
}

/** MA-11 (LB-4, after the field hands): the men each open works takes from what is left, in the works' order. */
export function drainageDiggers(state: Pick<GameState, "drainage">, remaining: number): ReadonlyMap<string, number> {
  const diggers = new Map<string, number>();
  let left = Math.max(0, Math.floor(remaining));
  for (const work of state.drainage?.works ?? []) {
    const men = Math.min(left, B.diggers);
    if (men > 0) diggers.set(work.id, men);
    left -= men;
  }
  return diggers;
}

/** MA-11: one tick of the works — each gains its diggers' work; a finished one turns its cells to meadow. */
export function advanceDrainage(state: GameState, diggers: ReadonlyMap<string, number>): GameState {
  const drainage = state.drainage;
  if (drainage === undefined || drainage.works.length === 0) return state;
  const open: DrainageWork[] = [];
  const finished: DrainageWork[] = [];
  for (const work of drainage.works) {
    const men = diggers.get(work.id) ?? 0;
    const { diggers: _men, ...rest } = work;
    const next: DrainageWork = { ...rest, workDone: Math.min(work.workNeeded, work.workDone + men), ...(men > 0 ? { diggers: men } : {}) };
    (next.workDone >= next.workNeeded ? finished : open).push(next);
  }
  if (finished.length === 0) return { ...state, drainage: { ...drainage, works: open } };
  const dry = new Set(finished.flatMap(work => work.cells));
  return { ...state, tiles: state.tiles.map((tile, index) => dry.has(index) ? { ...tile, terrain: "grass" as const } : tile),
    drainage: { works: open, drained: [...new Set([...drainage.drained, ...dry])].sort((a, b) => a - b) } };
}

/** MA-11: the works finished between two states (for the history's record). */
export function finishedDrainage(before: Pick<GameState, "drainage">, after: Pick<GameState, "drainage">): readonly DrainageWork[] {
  const still = new Set((after.drainage?.works ?? []).map(work => work.id));
  return (before.drainage?.works ?? []).filter(work => !still.has(work.id));
}
