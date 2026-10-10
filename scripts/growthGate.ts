// GROW-BLOCK-2a (the user's ruling 2026-10-10): the lord mode's growth gate — the lord's slice played by the lord's bot,
// seeds 1–10 for 60 years (`scripts/growBlockProbe.ts`), judged together. The sandbox guardrail cannot keep the lord
// mode's growth (GB-8, GB-12 and the like are lord mode's rules), so this runs on the trunk on its own schedule.
//   tsx scripts/growthGate.ts <dir with m-<seed>.json>      exit 0 pass, 1 fail
// Pass: no stall of more than ten years (population and palisade both unchanged, below the full town), every seed's
// highest population at the full town (768), the stumps' peak under STUMP_PEAK_MAX, no site laid out again where one was
// given up; the sites given up are counted by their reason (shown, not judged). Seeds a known task is still fixing are
// listed in KNOWN with that task, shown but not judged.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const GROWTH_GATE_SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
export const GROWTH_GATE_YEARS = 60;
const FULL_TOWN = 768;
/** The worst before GROW-BLOCK-2a was 886 (seed 7) and 865 (seed 1). */
export const STUMP_PEAK_MAX = 865;
/** Seeds a named task is fixing (remove the line when it lands). */
export const KNOWN: Readonly<Record<number, string>> = {
  3: "GROW-BLOCK-2b: fields cover the walled interior's house sites",
  9: "GROW-BLOCK-2b: no wall fits (the small rings cut 13 buildings off the roads)",
};

interface Probe { seed: number; maxPopulation: number; peakStumps: number; abandoned: number; replaced: number;
  stalls: readonly { from: number; to: number; population: number; fieldBound?: boolean }[];
  rows: readonly { abandonedBy: Readonly<Record<string, number>> }[] }

export function growthGate(dir: string) {
  const rows = GROWTH_GATE_SEEDS.map(seed => {
    const probe = JSON.parse(readFileSync(resolve(dir, `m-${seed}.json`), "utf8")) as Probe;
    const abandonedBy: Record<string, number> = {};
    for (const row of probe.rows) for (const [reason, count] of Object.entries(row.abandonedBy)) abandonedBy[reason] = (abandonedBy[reason] ?? 0) + count;
    const failures = [
      ...probe.stalls.map(stall => `stall ${stall.from}–${stall.to} at ${stall.population}${stall.fieldBound === true ? " (fields)" : ""}`),
      ...(probe.maxPopulation < FULL_TOWN ? [`highest population ${probe.maxPopulation} < ${FULL_TOWN}`] : []),
      ...(probe.peakStumps >= STUMP_PEAK_MAX ? [`stumps ${probe.peakStumps} ≥ ${STUMP_PEAK_MAX}`] : []),
      ...(probe.replaced > 0 ? [`${probe.replaced} site(s) laid out where one was given up`] : []),
    ];
    return { seed, known: KNOWN[seed] ?? null, failures, maxPopulation: probe.maxPopulation, peakStumps: probe.peakStumps, abandonedBy };
  });
  const judged = rows.filter(row => row.known === null);
  return { passed: judged.every(row => row.failures.length === 0), rows };
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [dir = "output/growth-gate"] = process.argv.slice(2);
  const result = growthGate(dir);
  for (const row of result.rows) {
    const verdict = row.failures.length === 0 ? "pass" : row.known !== null ? `known (${row.known})` : "FAIL";
    process.stdout.write(`seed ${row.seed}: ${verdict} — highest ${row.maxPopulation}, stumps ${row.peakStumps}, given up ${JSON.stringify(row.abandonedBy)}${row.failures.length > 0 ? ` — ${row.failures.join("; ")}` : ""}\n`);
  }
  process.stdout.write(`growth gate: ${result.passed ? "passed" : "FAILED"}\n`);
  process.exitCode = result.passed ? 0 : 1;
}
