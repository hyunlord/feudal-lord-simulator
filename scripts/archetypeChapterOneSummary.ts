// ARCH-1 gate ① table: the per-run files of `archetypeChapterOne.ts` (docs/verification/arch1/bot/*.json) as one summary.
//   tsx scripts/archetypeChapterOneSummary.ts [dir=docs/verification/arch1/bot] > summary.json
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const dir = resolve(process.argv[2] ?? "docs/verification/arch1/bot");
const runs = readdirSync(dir).filter(name => /-seed\d+\.json$/.test(name)).sort().map(name => JSON.parse(readFileSync(resolve(dir, name), "utf8")) as {
  archetypeId: string; seed: number; completed: boolean; chapterEndYear: number | null; stoppedBy: string;
  final: { population: number; abandoned: boolean } | null; famine: { arrivalTick: number; populationAtArrival: number | null; populationAtEnd: number | null } | null;
  yearly: { year: number; era: string }[]; elapsedSeconds: number;
});
const rows = runs.map(run => ({ archetypeId: run.archetypeId, seed: run.seed, completed: run.completed, chapterEndYear: run.chapterEndYear,
  marketTownYear: run.yearly.find(row => row.era !== "hamlet")?.year ?? null,
  famineYear: run.famine === null ? null : 1300 + Math.floor(run.famine.arrivalTick / 4000),
  famineKept: run.famine?.populationAtArrival ? Math.round((run.famine.populationAtEnd ?? 0) * 1000 / run.famine.populationAtArrival) : null,
  population: run.final?.population ?? null, stoppedBy: run.stoppedBy, elapsedSeconds: run.elapsedSeconds }));
process.stdout.write(`${JSON.stringify({ completed: rows.filter(row => row.completed).length, runs: rows.length, gate: ">= 13 of 15", rows }, null, 1)}\n`);
