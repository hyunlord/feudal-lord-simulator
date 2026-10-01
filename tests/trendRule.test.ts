import assert from "node:assert/strict";
import { test } from "node:test";
import { abVerdict, median, MIN_RUNS, suspect } from "../scripts/perf/trendRule";
import { t95 } from "../scripts/perf/pairedStats";
import { paired } from "../scripts/perf/perfAB";

test("a suspicion is a value outside the comparison runs' range widened by its width on each side", () => {
  assert.equal(suspect(10.9, [8, 9, 10]), "");        // range 8–10, widened 6–12
  assert.equal(suspect(12.1, [8, 9, 10]), "위");
  assert.equal(suspect(5.9, [8, 9, 10]), "아래");
  assert.equal(suspect(0.64, [0.59, 0.59, 0.59]), "위");   // no width: any change is a suspicion, the A-B settles it
  assert.equal(suspect(20, [8, 9]), "");               // fewer than MIN_RUNS comparison runs: nothing to judge by
  assert.equal(MIN_RUNS, 3);
  assert.equal(suspect(null, [8, 9, 10]), "");
});

test("same game code measured at another time is not suspected worse (DGX trend, big town 5x)", () => {
  // bfb0d430 has e6d08a6e's game code; GC per minute and canvases per second at two times.
  assert.equal(suspect(median([146.5, 123.8, 117.1]), [102.7, 105.7, 114.2]), "");
  assert.equal(suspect(median([1.91, 1.93, 1.71]), [1.62, 1.78, 1.56]), "");
  // a597617b has 8ebdcf5c's game code.
  assert.equal(suspect(median([102.5, 98.2, 109]), [107.5, 106.3, 108.5]), "아래");   // a suspicion the A-B settles
});

test("the page reads a confirmation's verdict per metric", () => {
  const record = { table: [{ key: "gcPerMin", verdict: "소음 안" }, { key: "heapAllocMBps", verdict: "나빠짐" }] };
  assert.equal(abVerdict(record, "gcPerMin"), "소음 안");
  assert.equal(abVerdict(record, "heapAllocMBps"), "나빠짐");
  assert.equal(abVerdict(record, "canvasPerSec"), null);
  assert.equal(abVerdict(null, "gcPerMin"), null);
  assert.equal(median([3, 1, 2]), 2); assert.equal(median([1, 2, 3, 4]), 2.5);
});

test("the A-B band is the 95 % band for that many pairs (Student's t), not ±2 SE", () => {
  assert.equal(t95(3), 3.182); assert.equal(t95(9), 2.262); assert.equal(t95(200), 1.96); assert.equal(t95(0), Infinity);
  // 5e214ef7 → 61d79e8e (same game code), big town canvases per second, four pairs: +3.2 %, inside the 95 % band.
  const result = paired([13.13, 13.06, 12.63, 12.92], [13.17, 13.35, 13.43, 13.42]);
  assert.equal(result.verdict, "소음 안");
  assert.ok(Math.abs(result.band - 3.182 * result.se) < 1e-9);
  // A record written with ±2 SE is judged again with t: the same numbers no longer confirm.
  assert.equal(abVerdict({ table: [{ key: "canvasPerSec", verdict: "나빠짐", diff: 0.407, band: 0.322, n: 4 }] }, "canvasPerSec"), "소음 안");
  // A real change stays confirmed (SMOOTH-2R, big town canvases per second −88 %).
  assert.equal(abVerdict({ table: [{ key: "canvasPerSec", verdict: "좋아짐", diff: -101.438, band: 6, n: 4 }] }, "canvasPerSec"), "좋아짐");
});
