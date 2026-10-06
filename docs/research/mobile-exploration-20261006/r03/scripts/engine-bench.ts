import { strict as assert } from "node:assert";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { cpus, hostname, platform, release, totalmem } from "node:os";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import type { GameState } from "../../src/engine/engine.types";

const started = performance.now();
const deadline = started + 30_000;
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const study = realpathSync(resolve(root, "mobile-study"));
const requested = process.argv[2];
assert(requested !== undefined && process.argv.length === 3, "Provide exactly one new output JSON path under mobile-study");
const output = resolve(process.cwd(), requested);
assert(relative(study, output).startsWith(`records${sep}`) && output.endsWith(".json"), "Output must be mobile-study/records/*.json");
mkdirSync(dirname(output), { recursive: true });
const realParent = realpathSync(dirname(output));
const recordsRoot = resolve(study, "records");
assert(realParent === recordsRoot || realParent.startsWith(`${recordsRoot}${sep}`), "Output parent must remain inside study records");
assert(!existsSync(output), "Output file already exists; choose a new filename");

function withinBudget(): void {
  assert(performance.now() < deadline, "30-second cooperative deadline exceeded");
}

function census(state: GameState) {
  return {
    seed: state.seed, scenarioId: state.scenarioId, tick: state.tick, wallTick: state.wallTick,
    width: state.width, height: state.height, tiles: state.tiles.length,
    population: state.population, buildings: state.buildings.length, houses: state.houses.length,
    walkers: state.walkers.length, constructionSites: state.constructionSites.length,
    persons: state.persons?.people.length ?? 0, estates: state.estates?.estates.length ?? 0,
    claims: state.estates?.claims.length ?? 0, suits: state.estates?.suits.length ?? 0,
    negotiations: state.diplomacy?.negotiations.length ?? 0, promises: state.diplomacy?.promises.length ?? 0,
    agencyPresent: state.agency !== undefined, diplomacyPresent: state.diplomacy !== undefined,
    agencyReceipts: state.agency?.receipts.length ?? 0, abandoned: state.settlement?.outcome === "abandoned",
  };
}

function summary(samples: readonly number[]) {
  const sorted = [...samples].sort((a, b) => a - b);
  const quantile = (fraction: number) => sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)] ?? null;
  return { count: samples.length, meanMs: samples.length === 0 ? null : samples.reduce((a, b) => a + b, 0) / samples.length,
    p50Ms: quantile(0.5), p95Ms: quantile(0.95), maxMs: sorted.at(-1) ?? null, rawMs: samples };
}

const memoryBefore = process.memoryUsage();
const importStart = performance.now();
const [{ advanceTick }, { newGameState }, { encodeSave, decodeSave }, { AGENCY_WEEK_TICKS }, { BALANCE, PRESSURE_BALANCE }] = await Promise.all([
  import("../../src/engine/tick"), import("../../src/state/newGame"), import("../../src/save/saveCodec"),
  import("../../src/content/townAgencyConfig"), import("../../src/content/balanceConfig"),
]);
const importMs = performance.now() - importStart;
withinBudget();

function runCase(name: string, initial: GameState, initializationMs: number) {
  let state = initial;
  let stopped: string | null = null;
  const beforeMemory = process.memoryUsage();
  // Accumulators observe full-tick boundaries; reference changes are not proof of a specific rule firing.
  const activation = { townWeeklyEligible: 0, estateAnnualEligible: 0, suitSeasonEligible: 0,
    diplomacyPresentTicks: 0, agencyReferenceChanges: 0, estatesReferenceChanges: 0, diplomacyReferenceChanges: 0 };
  const step = (): number | null => {
    withinBudget();
    if (state.settlement?.outcome === "abandoned") { stopped = "abandoned"; return null; }
    const previous = state;
    const before = performance.now();
    state = advanceTick(previous);
    const elapsed = performance.now() - before;
    withinBudget();
    if (state.tick <= previous.tick) { stopped = "no_tick_progression"; return null; }
    if (state.agency !== undefined && state.tick > 0 && state.tick % AGENCY_WEEK_TICKS === 0) activation.townWeeklyEligible++;
    if ((previous.estates !== undefined || previous.agency !== undefined) && state.tick % BALANCE.TICKS_PER_YEAR === 0) activation.estateAnnualEligible++;
    if (previous.estates !== undefined && state.tick % PRESSURE_BALANCE.seasonTicks === 0) activation.suitSeasonEligible++;
    if (previous.diplomacy !== undefined) activation.diplomacyPresentTicks++;
    if (previous.agency !== state.agency) activation.agencyReferenceChanges++;
    if (previous.estates !== state.estates) activation.estatesReferenceChanges++;
    if (previous.diplomacy !== state.diplomacy) activation.diplomacyReferenceChanges++;
    return elapsed;
  };
  let warmupCompleted = 0;
  for (; warmupCompleted < 20; warmupCompleted++) if (step() === null) break;
  const measuredStart = census(state);
  const regular: number[] = [];
  if (stopped === null) for (let i = 0; i < 100; i++) {
    const elapsed = step(); if (elapsed === null) break; regular.push(elapsed);
  }
  const catchupStartTick = state.tick;
  const catchup: number[] = [];
  const catchupStarted = performance.now();
  // Catchup means the same full tick repeated at most 100 times, without time jumps or rule shortcuts.
  if (stopped === null) for (let i = 0; i < 100; i++) {
    const elapsed = step(); if (elapsed === null) break; catchup.push(elapsed);
  }
  const catchupWallMs = performance.now() - catchupStarted;
  assert.equal(state.tick - catchupStartTick, catchup.length, "Catchup must advance exactly one tick per call");
  const afterTicksMemory = process.memoryUsage();
  withinBudget();
  const timestamp = "2026-10-06T00:00:00.000Z";
  const saveStarted = performance.now();
  const encoded = encodeSave({ state, createdAt: timestamp, savedAt: timestamp });
  const encodeMs = performance.now() - saveStarted;
  withinBudget();
  const decodeStarted = performance.now();
  const decoded = decodeSave(encoded.bytes);
  const decodeMs = performance.now() - decodeStarted;
  withinBudget();
  assert.deepEqual(decoded.envelope.state, state, "Save roundtrip must preserve state");
  return { name, initializationMs, initial: census(initial), measuredStart, final: census(state), stopped,
    warmupCompleted, regular: summary(regular), catchup: { ...summary(catchup), wallMs: catchupWallMs, fromTick: catchupStartTick, toTick: state.tick },
    activationIncludingWarmup: activation, memory: { before: beforeMemory, afterTicks: afterTicksMemory, afterSave: process.memoryUsage() },
    save: { encodeMs, codecSerializeMs: encoded.saveSerializeMs, decodeMs, bytes: encoded.bytes.byteLength,
      roundtripEqual: true, schemaVersion: encoded.header.schemaVersion, sha256: createHash("sha256").update(encoded.bytes).digest("hex") } };
}

const results: ReturnType<typeof runCase>[] = [];
const fixturePath = resolve(root, "fixtures/perf-gate/ch4-1380.save.json.gz");
const initStarted = performance.now();
const opening = newGameState({ scenarioId: "core:lord_slice", seed: 1, mode: "lord" });
assert(opening !== null, "Known fixed-seed opening must exist");
results.push(runCase("opening-lord-seed1", opening, performance.now() - initStarted));
withinBudget();
const fixtureStarted = performance.now();
const fixtureBytes = readFileSync(fixturePath);
assert(fixtureBytes[0] === 0x1f && fixtureBytes[1] === 0x8b, "Mature fixture must be gzip bytes, not a Git LFS pointer");
const loaded = decodeSave(gunzipSync(fixtureBytes));
withinBudget();
results.push(runCase("mature-ch4-1380-unmodified", loaded.envelope.state, performance.now() - fixtureStarted));
withinBudget();
const report = {
  kind: "bounded-desktop-node-engine-screening", recordedAt: new Date().toISOString(),
  host: { hostname: hostname(), platform: platform(), release: release(), arch: process.arch,
    cpu: cpus()[0]?.model ?? "unknown", logicalCpus: cpus().length, totalMemoryBytes: totalmem(), node: process.version, versions: process.versions },
  checkout: { root, head: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8", timeout: 1000 }).trim() },
  limits: { cooperativeWallMs: 30_000, warmupPerCase: 20, measuredPerCase: 200, catchupIncludedInMeasured: true },
  startup: { dynamicEngineImportMs: importMs, memoryBefore, elapsedBeforeWriteMs: performance.now() - started },
  fixture: { path: relative(root, fixturePath), sha256: createHash("sha256").update(fixtureBytes).digest("hex"), migratedFrom: loaded.migratedFrom },
  cases: results,
  limitations: ["Desktop Node, not mobile hardware, browser, frame rate, battery, thermal or background lifecycle proof.",
    "30-second deadline is cooperative between synchronous operations; one blocked import/tick/save can overrun it.",
    "Short opening may not reach yearly estates, seasonal litigation, or active diplomacy. Eligibility and reference changes are observations, not isolated rule coverage.",
    "Both cases share one process and module caches; sequential order and warm caches affect timings. No renderer or input/UI work is timed.",
    "Mature fixture retains its own seed and mode; no synthetic lord modules are injected. Catchup is exactly repeated full ticks, not a production resume policy."],
};
withinBudget();
writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, { flag: "wx" });
console.log(output);
