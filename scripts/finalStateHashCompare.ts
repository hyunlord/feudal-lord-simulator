// Compares each seed's final growth state with a recorded guardrail run, byte for byte (sha256 of the
// final-state.json bytes, which efficientGrowthRun writes as JSON.stringify(state)). Used by C1c gate ④:
// the zone-free seeds must end exactly where the C2 guardrail run ended.
// Usage: tsx scripts/finalStateHashCompare.ts <runDirectory> <record.json with seeds.{n}.finalStateSha256>
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function finalStateHashCompare(runDirectory: string, recordPath: string) {
  const record = JSON.parse(readFileSync(recordPath, "utf8")) as { readonly commit?: string; readonly seeds: Record<string, { readonly finalStateSha256: string; readonly victoryTick: number | null }> };
  const seeds = Object.entries(record.seeds).map(([seed, expected]) => {
    const raw = readFileSync(resolve(runDirectory, `seed-${seed}`, "final-state.json"));
    const summary = JSON.parse(readFileSync(resolve(runDirectory, `seed-${seed}`, "summary.json"), "utf8")) as { readonly victoryTick: number | null; readonly guardrail: { readonly status: string } };
    const sha256 = createHash("sha256").update(raw).digest("hex");
    const state = JSON.parse(raw.toString()) as { readonly tick: number; readonly zones?: readonly unknown[]; readonly zoneUndo?: unknown };
    return { seed: Number(seed), finalTick: state.tick, sha256, expected: expected.finalStateSha256, identical: sha256 === expected.finalStateSha256,
      victoryTick: summary.victoryTick, expectedVictoryTick: expected.victoryTick, guardrail: summary.guardrail.status,
      zones: state.zones?.length ?? 0, zoneUndo: state.zoneUndo !== undefined };
  });
  return { recordCommit: record.commit ?? null, seeds, passed: seeds.every(seed => seed.identical) };
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [run, recordPath] = process.argv.slice(2);
  if (run === undefined || recordPath === undefined) throw new RangeError("Usage: finalStateHashCompare.ts <runDirectory> <record.json>");
  const result = finalStateHashCompare(run, recordPath);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.passed) process.exitCode = 1;
}
