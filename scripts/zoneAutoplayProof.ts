// Gate ③ of C1c (spec Z-15a): DevAutoPlayer in a town with burgage plots. Starts from the C1b seed-2 natural
// snapshot (tick 276,000, walled, 24 lots), paints the C1b plan's plot stroke along the curved road outside the
// wall through the reducer, then runs the real autoplay driver + advanceTick for <ticks>. Counts every placement
// the reducer refused (and repeats of the same refused placement), the zone refusals the autoplay caught before
// sending, and how many plots were empty before and are filled after. The lot cap is an argument because the
// snapshot already has the default policy's 24 lots.
// Usage: tsx scripts/zoneAutoplayProof.ts [ticks=24000] [maxHousingLots=32]
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import type { GameState } from "../src/engine/engine.types";
import { advanceTick } from "../src/engine/tick";
import { autoplayZoneRejections, resetAutoplayZoneRejections } from "../src/engine/autoplayZones";
import { housingLotCount } from "../src/population/housing";
import { gameReducer } from "../src/state/gameStore";
import { zonePaintAssessment } from "../src/zones/zoneEdits";
import { burgageParcels } from "../src/zones/zoneFillAgent";
import { zoneMismatches } from "../src/zones/zonePlacement";
import { createAutoplayTraceDriver, type AdvisorDiagnosticReceipt } from "./economyHarnessAutoplay";

const ROOT = fileURLToPath(new URL("../", import.meta.url));

export function zonedSeed2State(): GameState {
  const snapshot = JSON.parse(gunzipSync(readFileSync(resolve(ROOT, "docs/verification/c1b-zone-brush/seed2-natural-snapshot.json.gz"))).toString()) as GameState;
  const plan = JSON.parse(readFileSync(resolve(ROOT, "docs/verification/c1b-zone-brush/captures/plan.json"), "utf8")) as { readonly plotStroke: readonly (readonly [number, number])[] };
  const stroke = { tool: "brush" as const, radius: 2, points: plan.plotStroke.map(([x, y]) => ({ x: x + 0.5, y: y + 0.5 })) };
  const assessment = zonePaintAssessment(snapshot, "burgage", stroke);
  if (!assessment.ok) throw new Error(`plot stroke refused: ${assessment.reason}`);
  return gameReducer(snapshot, { type: "zone_paint", kind: "burgage", stroke: assessment.stroke });
}

export function zoneAutoplayProof(ticks: number, maxHousingLots: number) {
  let state = zonedSeed2State();
  const start = { tick: state.tick, lots: housingLotCount(state), houses: state.houses.length };
  const plots = (current: GameState) => {
    const parcels = burgageParcels(current);
    return { plots: parcels.length, empty: parcels.filter(parcel => parcel.buildingIds.length === 0).length,
      occupied: parcels.filter(parcel => parcel.buildingIds.length > 0).length };
  };
  const before = plots(state);
  const refused: { tick: number; action: string }[] = [];
  let applied = 0;
  let housesPlaced = 0;
  resetAutoplayZoneRejections();
  const driver = createAutoplayTraceDriver({ id: "c1c-zone-autoplay", source: "c1b-seed2-snapshot", policy: { maxHousingLots },
    onDiagnostic: (receipt: AdvisorDiagnosticReceipt) => {
      if (receipt.result === "rejected") refused.push({ tick: receipt.tick, action: JSON.stringify(receipt.advisorAction) });
      if (receipt.result === "applied") {
        applied += 1;
        if (receipt.gameActionType === "place_building" && JSON.stringify(receipt.advisorAction).includes('"house"')) housesPlaced += 1;
      }
    } });
  const end = state.tick + ticks;
  while (state.tick < end) state = advanceTick(driver.apply(state));
  const after = plots(state);
  const repeats = refused.filter((entry, index) => refused.slice(0, index).some(earlier => earlier.action === entry.action)).length;
  const mismatchedHouses = zoneMismatches(state).filter(mismatch => mismatch.kind === "house"
    && !(zonedSeed2State().buildings.some(building => building.id === mismatch.buildingId))).length;
  const result = {
    snapshot: "docs/verification/c1b-zone-brush/seed2-natural-snapshot.json.gz", ticks, maxHousingLots, start,
    end: { tick: state.tick, lots: housingLotCount(state), houses: state.houses.length },
    plotsBefore: before, plotsAfter: after, appliedActions: applied, housesPlaced,
    refusedPlacements: refused.length, repeatedRefusals: repeats, zoneRefusalsCaughtBeforeSending: autoplayZoneRejections(),
    newHousesOutsidePlots: mismatchedHouses,
  };
  return { ...result, passed: refused.length === 0 && repeats === 0 && after.empty < before.empty && mismatchedHouses === 0 };
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = zoneAutoplayProof(Number(process.argv[2] ?? 24_000), Number(process.argv[3] ?? 32));
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.passed) process.exitCode = 1;
}
