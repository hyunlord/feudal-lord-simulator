// C1c-2 gates ③/④ evidence (F5, F6): migrate a v9 town with wheat farms to v10 and keep it running.
//   tsx scripts/arableMigrationProof.ts seed2 [ticks=24000]   the C1b seed-2 natural snapshot (21 farms), autoplay on
//   tsx scripts/arableMigrationProof.ts four-farms [ticks]    fixtures/saves/v9/four-farms.save.json, no autoplay
// Prints the migration summary, then the bread made / requested and the mill raw-wheat shortage per 2,400-tick
// window and in total. Writes nothing.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import type { GameState } from "../src/engine/engine.types";
import { foodEfficiencyMetrics } from "../src/engine/autoplayFoodEfficiency";
import { advanceTick } from "../src/engine/tick";
import { housingLotCount } from "../src/population/housing";
import { migrateStateV9ToV10 } from "../src/save/migrations/v9ToV10";
import { decodeSave } from "../src/save/saveCodec";
import { createAutoplayTraceDriver } from "./economyHarnessAutoplay";

const ROOT = fileURLToPath(new URL("../", import.meta.url));

export function arableMigrationProof(source: "seed2" | "four-farms", ticks: number) {
  const autoplay = source === "seed2";
  let state: GameState = source === "seed2"
    ? migrateStateV9ToV10(JSON.parse(gunzipSync(readFileSync(resolve(ROOT, "docs/verification/c1b-zone-brush/seed2-natural-snapshot.json.gz"))).toString()) as GameState)
    : decodeSave(new Uint8Array(readFileSync(resolve(ROOT, "fixtures/saves/v9/four-farms.save.json")))).envelope.state;
  const start = { tick: state.tick, population: state.population, lots: housingLotCount(state), l4: state.houses.filter(house => house.level === 4).length };
  const driver = autoplay ? createAutoplayTraceDriver({ id: "c1c2-migration", source, policy: { maxHousingLots: 24 } }) : null;
  const windows: Record<string, number>[] = [];
  const total = { breadProduced: 0, requestedBread: 0, rawStarvedTicks: 0, eligibleMillTicks: 0, wheatProduced: 0 };
  for (let tick = 1; tick <= ticks; tick += 1) {
    state = advanceTick(driver === null ? state : driver.apply(state));
    if (tick % 2400 !== 0) continue;
    const window = foodEfficiencyMetrics(state);
    for (const key of Object.keys(total) as (keyof typeof total)[]) total[key] += window[key];
    windows.push({ tick: state.tick, population: state.population, breadProduced: window.breadProduced, requestedBread: window.requestedBread,
      rawStarvedTicks: window.rawStarvedTicks, eligibleMillTicks: window.eligibleMillTicks, wheatProduced: window.wheatProduced });
  }
  return { source, autoplay, ticks, migration: state.arableMigration ?? null, start,
    end: { tick: state.tick, population: state.population, lots: housingLotCount(state), l4: state.houses.filter(house => house.level === 4).length,
      farmsteads: state.buildings.filter(building => building.kind === "farmstead").length,
      arableCells: (state.zones ?? []).filter(zone => zone.kind === "arable").reduce((sum, zone) => sum + zone.membership.length, 0) },
    total, breadRatio: total.requestedBread > 0 ? total.breadProduced / total.requestedBread : null,
    rawStarvationRatio: total.eligibleMillTicks > 0 ? total.rawStarvedTicks / total.eligibleMillTicks : null,
    minimumWindowBread: Math.min(...windows.map(window => window.breadProduced ?? 0)), windows };
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const source = process.argv[2] === "four-farms" ? "four-farms" : "seed2";
  process.stdout.write(`${JSON.stringify(arableMigrationProof(source, Number(process.argv[3] ?? 24000)), null, 2)}\n`);
}
