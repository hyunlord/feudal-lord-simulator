// LM-E5 (spec docs/design/living-growth.md LG-6): the gate's runs — a lord-mode riverside town from a new game on a seed,
// the same choices in every run (the chapters' answers as the bot gives them, the estate policy left at growth, no
// subsidy), to a year: what town it became (people, houses, buildings by kind, where they stand), how its actors chose
// (receipts drawn below the best), what the land did (footpaths, fallow, felled trees by stage), and the final state's
// hash (the same seed replayed must give the same bytes).
//   tsx scripts/livingGrowthRuns.ts <seed> [lastYear=1320] > run.json
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { autoplayActionToGameAction } from "../src/engine/autoplayActions";
import { chapterDecisionAction } from "../src/engine/autoplayEvents";
import { landOf, treeStage } from "../src/engine/land";
import { stateCalendar } from "../src/engine/scenarioState";
import { advanceTick } from "../src/engine/tick";
import { actorTemperament } from "../src/engine/townAgency";
import { gameReducer } from "../src/state/gameStore";
import { newGameState } from "../src/state/newGame";

export function livingGrowthRun(seed: number, lastYear = 1320) {
  const started = Date.now();
  let state = newGameState({ scenarioId: "core:campaign_market_town", seed, mode: "lord" });
  if (state === null) throw new Error(`seed ${seed} has no game`);
  while (stateCalendar(state).year <= lastYear) {
    const answer = chapterDecisionAction(state, "relief", "accept", "pay");
    const action = answer === null ? null : autoplayActionToGameAction(answer, state);
    if (action !== null) state = gameReducer(state, action);
    state = advanceTick(state);
    if (state.settlement?.outcome === "abandoned") break;
  }
  const receipts = state.agency?.receipts ?? [];
  const kinds: Record<string, number> = {};
  for (const building of state.buildings) kinds[building.kind] = (kinds[building.kind] ?? 0) + 1;
  const stages: Record<string, number> = {};
  for (const harvest of state.forestHarvests ?? []) stages[treeStage(harvest, state.tick)] = (stages[treeStage(harvest, state.tick)] ?? 0) + 1;
  const land = landOf(state);
  return {
    seed, lastYear, finalYear: stateCalendar(state).year, tick: state.tick,
    water: state.tiles.filter(tile => tile.terrain === "water").length, forest: state.tiles.filter(tile => tile.terrain === "forest").length,
    population: state.population, houses: state.houses.length, buildings: kinds,
    layout: createHash("sha256").update(JSON.stringify(state.buildings.map(building => [building.kind, building.tx, building.ty]))).digest("hex").slice(0, 16),
    temperaments: Object.fromEntries((state.agency?.actors ?? []).map(actor => [actor.kind, actorTemperament(state, actor.kind)])),
    receipts: receipts.length, drawnBelowBest: receipts.filter(receipt => (receipt.chance?.project.place ?? 1) > 1 || (receipt.chance?.site?.place ?? 1) > 1).length,
    land: { footpaths: land.footpaths.length, fallow: land.fallow.length, felled: stages },
    finalStateSha256: createHash("sha256").update(JSON.stringify(state)).digest("hex"),
    elapsedSeconds: Math.round((Date.now() - started) / 1000),
  };
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [seed, lastYear] = process.argv.slice(2);
  process.stdout.write(`${JSON.stringify(livingGrowthRun(Number(seed ?? 1), lastYear === undefined ? 1320 : Number(lastYear)), null, 1)}\n`);
}
