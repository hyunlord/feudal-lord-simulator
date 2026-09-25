// Captures fixtures/saves/v9/four-farms.save.json (C1c-2 migration gate F5): autoplay seed 2 from the growth opening,
// first tick with exactly four finished wheat farms and no farm construction site.
// Needs the wheat farm rules, so it runs in a worktree of trunk d823005 (v9), not on v10 code:
//   git worktree add /tmp/old d823005 && cd /tmp/old && npx tsx scripts/captureWheatFarmFixture.ts 2 four-farms.save.json
import { writeFileSync } from "node:fs";
import { runPhase19NaturalGrowth } from "./phase19NaturalGrowth";
import { encodeSave } from "../src/save/saveCodec";
import type { GameState } from "../src/engine/engine.types";
let captured: GameState | null = null;
class Done extends Error {}
try {
  runPhase19NaturalGrowth({ targetLots: 24, maxTicks: 200000, seed: Number(process.argv[2] ?? 2), onTick: state => {
    const farms = state.buildings.filter(b => b.kind === "wheat_farm").length;
    const sites = state.constructionSites.filter(s => s.kind === "wheat_farm").length;
    if (captured === null && farms === 4 && sites === 0) { captured = structuredClone(state); throw new Done(); }
  } });
} catch (error) { if (!(error instanceof Done)) throw error; }
if (captured === null) throw new Error("no four-farm state");
const state = captured as GameState;
const encoded = encodeSave({ state, createdAt: "2026-09-25T00:00:00.000Z", savedAt: "2026-09-25T00:00:00.000Z" });
writeFileSync(process.argv[3]!, encoded.bytes);
console.log(JSON.stringify({ tick: state.tick, population: state.population, houses: state.houses.length, farms: 4 }));
