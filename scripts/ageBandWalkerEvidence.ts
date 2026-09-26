// INSTALL-5c child / elder walkers: one calendar year of V2's C3 seed 2 city (the MOVE-1 evidence scene), sampled every
// SAMPLE_TICKS ticks (advanceTick only, no input). At each sample:
//  - every child walker is a companion (`occupation child_companion`) standing COMPANION_OFFSET tiles from an adult of
//    the same trip (id prefix) and wears a child body; no child walks alone;
//  - every elder member on a trip wears an elder body; adults keep their occupation bands;
//  - counts of residents, companions, elders and the sheets they wear.
// Writes <outDir>/age-band-walkers.json and the first market-day sample with a companion on the MOVE-1 street screen
// (scene/marketday-children.json.gz) for the captures.
//   tsx scripts/ageBandWalkerEvidence.ts [outDir=docs/verification/install5c]
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { advanceTick } from "../src/engine/tick";
import { walkerLook, walkerSheet } from "../src/render/walkerLook";
import { withResidentWalkers } from "../src/state/residentWalkerState";
import { isMarketDay, isResidentWalker } from "../src/ui/residentTrips";
import { loadSeed2City } from "./walkerLookEvidence";
import { onScreen } from "./residentTripEvidence";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const SAMPLE_TICKS = 50;
const YEAR = 4_000;

function run(outDir: string) {
  let state = loadSeed2City();
  const sheets = new Map<string, number>();
  const failures: string[] = [];
  let samples = 0, residents = 0, companions = 0, elders = 0, adults = 0;
  let scene: unknown = null;
  let sceneChild: { readonly tx: number; readonly ty: number; readonly id: string } | null = null;
  for (let step = 1; step <= YEAR; step += 1) {
    state = advanceTick(state);
    if (step % SAMPLE_TICKS !== 0) continue;
    samples += 1;
    const display = withResidentWalkers(state);
    const walking = display.walkers.filter(isResidentWalker);
    const byId = new Map(walking.map(walker => [walker.id, walker]));
    residents += walking.length;
    for (const walker of walking) {
      const look = walkerLook(display, walker);
      const band = walkerSheet(look.sheetId).classBand;
      if (walker.resident.ageBand === "child") {
        companions += 1;
        sheets.set(look.sheetId, (sheets.get(look.sheetId) ?? 0) + 1);
        const adult = byId.get(walker.id.slice(0, -":child".length));
        if (!walker.id.endsWith(":child") || walker.resident.occupation !== "child_companion") failures.push(`${state.tick} ${walker.id}: a child not a companion`);
        else if (adult === undefined) failures.push(`${state.tick} ${walker.id}: companion without its adult`);
        else if (Math.abs(Math.hypot(walker.position.tx - adult.position.tx, walker.position.ty - adult.position.ty) - 0.3) > 1e-6) failures.push(`${state.tick} ${walker.id}: not beside its adult`);
        if (band !== "child") failures.push(`${state.tick} ${walker.id}: child in a ${band} body`);
      } else if (walker.resident.ageBand === "elder") {
        elders += 1;
        sheets.set(look.sheetId, (sheets.get(look.sheetId) ?? 0) + 1);
        if (band !== "elder") failures.push(`${state.tick} ${walker.id}: elder in a ${band} body`);
      } else {
        adults += 1;
        if (band === "child" || band === "elder") failures.push(`${state.tick} ${walker.id}: adult in a ${band} body`);
      }
    }
    const child = walking.find(walker => walker.resident.ageBand === "child" && onScreen(walker.position));
    if (scene === null && isMarketDay(state.tick) && child !== undefined) { scene = state; sceneChild = { ...child.position, id: child.id }; }
  }
  const result = { scene: "docs/verification/c3-labour/repro-seed2-348000.json.gz, one year, advanceTick only", sceneChild, sampleTicks: SAMPLE_TICKS, samples,
    residents, adults, companions, elders, sheets: Object.fromEntries([...sheets].sort((a, b) => b[1] - a[1])), failures: failures.slice(0, 20), failureCount: failures.length };
  mkdirSync(join(outDir, "scene"), { recursive: true });
  writeFileSync(join(outDir, "age-band-walkers.json"), JSON.stringify(result, null, 1) + "\n");
  if (scene !== null) writeFileSync(join(outDir, "scene/marketday-children.json.gz"), gzipSync(JSON.stringify(scene)));
  console.log(JSON.stringify({ ...result, sheets: Object.keys(result.sheets).length, scene: scene !== null }));
}

run(resolve(ROOT, process.argv[2] ?? "docs/verification/install5c"));
