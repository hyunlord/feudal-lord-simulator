// The guardrail's seeds against the trunk's expected end states (decision RR30, seeds/trunk-hashes.json): one list, so a
// verdict never mixes "the same as the baseline" with "the same as the trunk". Prints same/different per seed and adds
// trunkHash to each row of the run's guardrail/summary.json. It judges nothing: a rule change that means to move the
// sandbox shows "different" until its accepted list update lands with its decision row.
// Usage (scripts/remote/tasks.sh guardrail): node scripts/guardrailTrunkHashes.mjs <run>/.remote/guardrail
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const TRUNK_HASHES = fileURLToPath(new URL("../seeds/trunk-hashes.json", import.meta.url));

const short = (sha) => (sha ? `${sha.slice(0, 8)}…` : "none");
const ticks = (tick) => (tick === null || tick === undefined ? "?" : tick.toLocaleString("en-US"));

/** rows: the guardrail summary rows ({ seed, finalStateSha256, tick }); list: seeds/trunk-hashes.json. */
export function compareTrunkHashes(rows, list) {
  return rows.map((row) => {
    const expected = list.seeds[String(row.seed)];
    if (expected === undefined) return { seed: row.seed, trunkHash: "not listed", line: `seed ${row.seed}: trunk hash not listed` };
    if (row.finalStateSha256 === expected.finalStateSha256) {
      return { seed: row.seed, trunkHash: "same", line: `seed ${row.seed}: trunk hash same (${short(expected.finalStateSha256)} tick ${ticks(expected.tick)})` };
    }
    return { seed: row.seed, trunkHash: "different",
      line: `seed ${row.seed}: trunk hash DIFFERENT — expected ${short(expected.finalStateSha256)} tick ${ticks(expected.tick)} (since ${expected.since}), ` +
        `this run ${short(row.finalStateSha256)} tick ${ticks(row.tick)}` };
  });
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dir = process.argv[2];
  if (dir === undefined) throw new RangeError("Usage: guardrailTrunkHashes.mjs <guardrail folder>");
  if (!existsSync(TRUNK_HASHES)) { console.log("trunk hashes: not compared (no seeds/trunk-hashes.json in this checkout)"); process.exit(0); }
  const list = JSON.parse(readFileSync(TRUNK_HASHES, "utf8"));
  const summaryPath = join(dir, "summary.json");
  const rows = JSON.parse(readFileSync(summaryPath, "utf8"));
  const results = compareTrunkHashes(rows, list);
  for (const result of results) console.log(result.line);
  const same = results.filter((result) => result.trunkHash === "same").length;
  const last = list.updates.at(-1);
  console.log(`trunk hashes: ${same}/${results.length} same (seeds/trunk-hashes.json, last update ${last.date} ${last.decision})`);
  writeFileSync(summaryPath, JSON.stringify(rows.map((row, i) => ({ ...row, trunkHash: results[i].trunkHash })), null, 2) + "\n");
}
