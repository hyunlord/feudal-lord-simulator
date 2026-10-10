// GROW-BLOCK-2a (the user's split, 2026-10-10): each stall of a growBlockProbe run with its cause and what the town
// waited for. Causes: the wall not found (a deadlock: no palisade, failed searches), the wall's build waiting ten years
// or more (from wallTimberProbe), fields (the walled lots under fields), else "other" with its sub-cause from `waiting`
// (the next era's unmet conditions, houses below L4 and what they lack, the open sites and their materials).
//   node scripts/growthStallCauses.mjs <dir with m-<seed>.json> [dir with w-<seed>.json]
import { existsSync, readdirSync, readFileSync } from "node:fs";

const [growDir, wallDir] = process.argv.slice(2);
const files = readdirSync(growDir).filter(name => /^m-\d+\.json$/.test(name)).sort((a, b) => parseInt(a.slice(2)) - parseInt(b.slice(2)));
for (const name of files) {
  const run = JSON.parse(readFileSync(`${growDir}/${name}`, "utf8"));
  const wallFile = wallDir === undefined ? null : `${wallDir}/w-${run.seed}.json`;
  const wall = wallFile !== null && existsSync(wallFile) ? JSON.parse(readFileSync(wallFile, "utf8")) : null;
  for (const stall of run.stalls) {
    const rows = run.rows.filter(row => row.year >= stall.from && row.year <= stall.to);
    const mid = rows[Math.floor(rows.length / 2)];
    let cause;
    if (stall.fieldBound) cause = "fields";
    else if (rows.every(row => row.palisade === 0)) cause = Math.max(...rows.map(row => row.charterFailures ?? 0)) > 0 ? "wall not found (deadlock)" : "other (hamlet, no failed search)";
    else if (wall !== null && (wall.wallYears === null || wall.wallYears > 10)) cause = "wall build waiting 10+ years";
    else cause = "other (after the wall)";
    const waiting = mid.waiting ?? null;
    process.stdout.write(`seed ${run.seed} ${stall.from}–${stall.to} at ${stall.population}: ${cause} — era ${mid.era}, houses ${mid.houses}, failures ${mid.charterFailures ?? 0}`
      + (waiting === null ? "" : `; unmet ${JSON.stringify(waiting.unmet)}, below L4 ${waiting.belowL4} ${JSON.stringify(waiting.lacks)}, sites ${JSON.stringify(waiting.sites.slice(0, 4))}`)
      + (mid.interior === null || mid.interior === undefined ? "" : `; walled lots ${JSON.stringify(mid.interior)}`) + "\n");
  }
}
