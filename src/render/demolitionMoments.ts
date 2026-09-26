import type { Building } from "../content/buildingConfig";
import type { GameState } from "../engine/engine.types";
import { buildingFootprint } from "../geometry/buildingFootprint";
import { drawKitStage } from "./constructionKits";
import { presentationSpeed } from "./presentationSpeed";

// INSTALL-11 demolition = the kit in reverse: when a finished building leaves the state and nothing stands on its
// footprint (a demolition, not a merge of two houses into a pair lot or a rebuild), its family kit plays roof -> frame
// -> foundation -> plot over DEMOLITION_MS on the old footprint, then the ground is bare. At 5x (and faster) it is
// skipped, as the completion sequence is. Presentation memory only: the last buildings seen and the running
// sequences, keyed by building id; it restarts when the clock goes backwards (a new game or a loaded save).
export const DEMOLITION_MS = 1_200;
const FAST = 5;
let seen = new Map<string, Building>();
let lastTick = -1;
let running: { readonly building: Building; readonly startedMs: number }[] = [];

function covers(building: Building, tx: number, ty: number): boolean {
  const size = buildingFootprint(building);
  return tx >= building.tx && tx < building.tx + size.width && ty >= building.ty && ty < building.ty + size.height;
}

export function observeDemolitions(state: GameState, nowMs: number): void {
  if (state.tick < lastTick) { seen = new Map(); running = []; }
  lastTick = state.tick;
  const current = new Map(state.buildings.map(building => [building.id, building]));
  for (const [id, building] of seen) {
    if (current.has(id)) continue;
    const replaced = state.buildings.some(other => covers(other, building.tx, building.ty))
      || state.constructionSites.some(site => "tx" in site && site.tx === building.tx && site.ty === building.ty);
    if (!replaced && presentationSpeed() < FAST) running.push({ building, startedMs: nowMs });
  }
  seen = current;
  running = running.filter(entry => nowMs - entry.startedMs < DEMOLITION_MS);
}

/** The buildings whose reverse sequence is running (the evidence and tests read it). */
export function activeDemolitions(): readonly string[] { return running.map(entry => entry.building.id); }

/** The reverse stage (3 roof .. 0 plot) `ageMs` into a demolition. */
export function demolitionStage(ageMs: number): number {
  return Math.max(0, 3 - Math.floor(Math.min(0.999, ageMs / DEMOLITION_MS) * 4));
}

export function drawDemolitions(context: CanvasRenderingContext2D, nowMs: number): void {
  for (const { building, startedMs } of running) {
    const age = nowMs - startedMs;
    context.save();
    context.globalAlpha *= 1 - Math.max(0, age / DEMOLITION_MS - 0.75) * 4; // the last quarter fades to bare ground
    drawKitStage(context, { id: building.id, kind: building.kind, tx: building.tx, ty: building.ty, required: {}, delivered: {}, reserved: {},
      builderTicks: 0, requiredBuilderTicks: 1, assignedBuilders: 0, stall: "none", startedTick: 0 } as never, demolitionStage(age));
    context.restore();
  }
}
