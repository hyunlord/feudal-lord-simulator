/** HUD-MEDIAN (user 2026-10-02): the HUD area gate is the median of three runs per row (scripts/hudMedian.ts). */
import assert from "node:assert/strict";
import { test } from "node:test";
import { formatMedianRow, median, medianRows, type HudRow } from "../scripts/hudMedian";

const row = (state: string, percent: number, budget: number, view?: string): HudRow => ({ resolution: "1280x800", state, percent, budget, ...(view === undefined ? {} : { view }) });

test("the median is the middle run: one run over budget does not fail a row, two do", () => {
  assert.equal(median([6.7, 6.4, 6.5]), 6.5);
  assert.equal(median([1, 3]), 2);
  assert.equal(median([]), null);
  const rows = medianRows([
    [row("normal", 6.7, 6.5), row("zone", 8.6, 8.5, "armed"), row("build", 15.4, 15.5)],
    [row("normal", 6.4, 6.5), row("zone", 8.7, 8.5, "armed"), row("build", 15.3, 15.5)],
    [row("normal", 6.5, 6.5), row("zone", 8.3, 8.5, "armed"), row("build", 15.3, 15.5)],
  ]);
  assert.deepEqual(rows.map(entry => [entry.state, entry.view ?? "", entry.percents, entry.median, entry.pass]), [
    ["normal", "", [6.7, 6.4, 6.5], 6.5, true],
    ["zone", "armed", [8.6, 8.7, 8.3], 8.6, false],
    ["build", "", [15.4, 15.3, 15.3], 15.3, true],
  ]);
  assert.match(formatMedianRow(rows[1]!), /zone:armed .* 8\.6 .*8\.7 .*8\.3 → +8\.6 % \/ 8\.5 % OVER$/);
});

test("rows are grouped by resolution, state and view; a row a run did not measure fails", () => {
  const rows = medianRows([
    [row("selection", 17.2, 18), row("selection", 17.1, 18, "store"), { ...row("normal", 3.3, 6), resolution: "1920x1080" }],
    [row("selection", 17.2, 18), row("selection", 17.1, 18, "store")],
    [row("selection", 17.3, 18), row("selection", 17.0, 18, "store")],
  ], 3);
  assert.equal(rows.length, 3);
  assert.deepEqual(rows.map(entry => entry.pass), [true, true, false]);
  assert.deepEqual(rows[2]!.percents, [3.3]);
});
