// Gate ⑤ of B5+C1a: a zone-free growth run ends in the same state as the B2 guardrail run.
// Usage: tsx scripts/zoneFreeHashProof.ts <run directory with seed-N/final-state.json> [B2 guardrail record]
// The B2 record keeps finalStateSha256 = sha256 of the bytes of JSON.stringify(finalState). A v6 state
// carries two more keys (`zones: []`, `nextZoneOrdinal: 1`); the proof removes exactly those two after
// checking their values, re-serialises and compares. JSON.stringify(JSON.parse(x)) === x holds for
// JSON.stringify output, and the script checks that on the new run's own bytes as well.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");

interface GuardrailSeed {
  readonly seed: number;
  readonly finalTick: number;
  readonly victoryTick: number | null;
  readonly finalStateSha256: string;
}

export function zoneFreeHashProof(runDirectory: string, recordPath: string) {
  const record = JSON.parse(readFileSync(recordPath, "utf8")) as { readonly sourceCommit: string; readonly seeds: readonly GuardrailSeed[] };
  const seeds = record.seeds.map(expected => {
    const raw = readFileSync(resolve(runDirectory, `seed-${expected.seed}`, "final-state.json"), "utf8");
    const state = JSON.parse(raw) as Record<string, unknown>;
    const roundTrip = JSON.stringify(state) === raw;
    const zonesEmpty = Array.isArray(state.zones) && state.zones.length === 0 && state.nextZoneOrdinal === 1;
    const { zones: _zones, nextZoneOrdinal: _ordinal, ...zoneFree } = state;
    const strippedSha256 = sha256(JSON.stringify(zoneFree));
    return {
      seed: expected.seed,
      finalTick: state.tick,
      b2FinalTick: expected.finalTick,
      rawSha256: sha256(raw),
      strippedSha256,
      b2FinalStateSha256: expected.finalStateSha256,
      zonesEmpty,
      roundTrip,
      identical: roundTrip && zonesEmpty && strippedSha256 === expected.finalStateSha256 && state.tick === expected.finalTick,
    };
  });
  return { b2SourceCommit: record.sourceCommit, removedKeys: ["zones", "nextZoneOrdinal"], seeds, passed: seeds.every(seed => seed.identical) };
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const run = process.argv[2];
  if (run === undefined) throw new RangeError("Usage: zoneFreeHashProof.ts <run directory> [guardrail record]");
  const record = process.argv[3] ?? resolve(ROOT, "docs/verification/b2-scenario-era/guardrails-21caf65.json");
  const result = zoneFreeHashProof(run, record);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.passed) process.exitCode = 1;
}
