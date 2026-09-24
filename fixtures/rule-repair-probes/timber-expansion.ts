// Probe: diagnose autoplay palisade-era stall (read-only). Runs headless autoplay (cadence 120, phase 0).
import { DEFAULT_GAME_STATE, gameReducer } from "../../src/state/gameStore";
import { advanceTick } from "../../src/engine/tick";
import { decideNextAction } from "../../src/engine/autoplay";
import { autoplayActionToGameAction } from "../../src/engine/autoplayActions";
import { evaluateEraRequirements } from "../../src/engine/era";
import { BUILDING_CONFIG_BY_KIND } from "../../src/content/buildingConfig";
import { buildingHasRequiredRoadAccess } from "../../src/engine/roadAccess";
import { getSettlementView } from "../../src/engine/settlementView";
import type { GameState } from "../../src/engine/engine.types";
const TICKS = Number(process.argv[2] ?? 100000);
let state: GameState = structuredClone(DEFAULT_GAME_STATE);
for (let i = 0; i < TICKS; i++) {
  if (state.tick % 120 === 0) {
    const a = decideNextAction(state);
    const g = autoplayActionToGameAction(a, state);
    if (g !== null) {
      const next = gameReducer(state, g);
      if (next.era !== state.era) console.log(`tick ${state.tick}: era ${state.era} -> ${next.era} via ${g.type}`);
      state = next;
    }
  }
  state = advanceTick(state);
}
console.log("tick", state.tick, "era", state.era, "eraProclaimedTick", state.eraProclaimedTick, "pop", state.population, "idle", state.idleWorkers);
console.log("req", JSON.stringify(evaluateEraRequirements(state).map(r => [r.key, r.current, r.target])));
console.log("goal", JSON.stringify(getSettlementView(state).currentGoal?.criteria));
console.log("segments", JSON.stringify(state.palisade?.segments.map(s => [s.id.slice(-3), s.completed, s.material, s.constructionSiteId !== null])));
console.log("sites", JSON.stringify(state.constructionSites.map(s => [s.id, s.kind, s.stall, s.required, s.delivered, s.builderTicks, s.assignedBuilders])));
for (const b of state.buildings.filter(b => ["quarry","masonry","storehouse","logging_camp","sawmill","market"].includes(b.kind)))
  console.log(b.id, b.kind, `(${b.tx},${b.ty})`, "workers", b.workers, "/", BUILDING_CONFIG_BY_KIND[b.kind].workersRequired, "road", buildingHasRequiredRoadAccess(state, b), "inv", JSON.stringify(b.inventory));
const byKind: Record<string, number> = {};
for (const b of state.buildings) byKind[b.kind] = (byKind[b.kind] ?? 0) + 1;
console.log("buildings", JSON.stringify(byKind));
console.log("next decision", JSON.stringify(decideNextAction(state)));
