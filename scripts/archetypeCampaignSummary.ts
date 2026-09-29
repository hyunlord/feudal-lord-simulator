// ARCH-1b comparison table (MA-12): the per-run files of `archetypeCampaign.ts` (docs/verification/arch1b/campaign/*.json)
// as one summary — by land and seed, and each land's mean — the ending, people, treasury, raid losses, pestilence's dead.
//   tsx scripts/archetypeCampaignSummary.ts [dir=docs/verification/arch1b/campaign] > summary.json
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

type Run = { archetypeId: string; seed: number; coastal: boolean; campaignEnded: boolean; ending: string | null;
  chapterEnds: { chapter: number; year: number }[]; final: { population: number; peakPopulation: number; treasury: number; l4: number; abandoned: boolean };
  raid: { burntHouses: number; looted: number; coin: number } | null;
  plague: { populationAtArrival: number; deathPermille: number; dead: number; second: { dead: number } | null } | null };
const dir = resolve(process.argv[2] ?? "docs/verification/arch1b/campaign");
const runs = readdirSync(dir).filter(name => /-seed\d+\.json$/.test(name)).sort()
  .map(name => readFileSync(resolve(dir, name), "utf8")).filter(text => text.trim() !== "").map(text => JSON.parse(text) as Run);
const rows = runs.map(run => ({ archetypeId: run.archetypeId, seed: run.seed, ended: run.campaignEnded, ending: run.ending,
  chapterOneYear: run.chapterEnds.find(end => end.chapter === 1)?.year ?? null,
  population: run.final.population, peakPopulation: run.final.peakPopulation, l4: run.final.l4, treasury: run.final.treasury,
  raidHouses: run.raid?.burntHouses ?? null, raidLooted: run.raid?.looted ?? null, raidCoin: run.raid?.coin ?? null,
  plagueDeathPermille: run.plague?.deathPermille ?? null, plagueDead: run.plague?.dead ?? null, secondPlagueDead: run.plague?.second?.dead ?? null }));
const lands = [...new Set(rows.map(row => row.archetypeId))];
const mean = (values: readonly (number | null)[]) => { const known = values.filter((value): value is number => value !== null);
  return known.length === 0 ? null : Math.round(known.reduce((sum, value) => sum + value, 0) / known.length); };
const byLand = lands.map(id => { const own = rows.filter(row => row.archetypeId === id);
  return { archetypeId: id, runs: own.length, ended: own.filter(row => row.ended).length, endings: own.map(row => row.ending),
    population: mean(own.map(row => row.population)), l4: mean(own.map(row => row.l4)), treasury: mean(own.map(row => row.treasury)),
    raidHouses: mean(own.map(row => row.raidHouses)), raidCoin: mean(own.map(row => row.raidCoin)),
    plagueDeathPermille: mean(own.map(row => row.plagueDeathPermille)), plagueDead: mean(own.map(row => row.plagueDead)) }; });
process.stdout.write(`${JSON.stringify({ runs: rows.length, byLand, rows }, null, 1)}\n`);
