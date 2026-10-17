/**
 * VIS-1 judgement (LS1-9 follow-up, the user 2026-10-16): the rail read off the harness's told log tells a flicker — the
 * rail changes and is its very set again within ten ticks — apart from the results chip pushed off and from a chip seen
 * again after a year (render-VIS-ls19-5ade799: six such flickers counted as pushes).
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { railReport } from "../scripts/visibleChangeRail.mjs";

let at = 0;
const add = (tick: number, id: string) => ({ tick, at: (at += 10), cls: "event-chip ui-btn", text: id, id });
const gone = (tick: number, id: string) => ({ tick, at: (at += 10), cls: "event-chip ui-btn", text: "", id, gone: true });
// One commit: its entries within 5 ms of each other.
const commit = <T extends { at: number }>(entries: readonly T[]): T[] => { const start = entries[0]!.at; return entries.map((entry, index) => ({ ...entry, at: start + index })); };

test("a rail that changes and is its very set again within ten ticks is a flicker: no push, no chip seen again", () => {
  const told = [
    ...commit([add(100, "old:a")]),
    ...commit([gone(200, "old:a")]),
    ...commit([add(4100, "results:1301"), add(4100, "plain:b")]),
    // The stale start: the rail as it stood at tick 100 for eight ticks, then its own set again.
    ...commit([gone(5000, "results:1301"), gone(5000, "plain:b"), add(5000, "old:a")]),
    ...commit([gone(5008, "old:a"), add(5008, "results:1301"), add(5008, "plain:b")]),
  ];
  const report = railReport(told);
  assert.equal(report.flickers, 1);
  assert.deepEqual([report.flickerList[0]!.tick, report.flickerList[0]!.back], [5000, 5008]);
  assert.equal(report.seenAgainAfterAYear, 0, "old:a back for a flicker is not a chip seen again");
  assert.equal(report.resultsPushedByPlain, 0);
});

test("the year's results chip pushed off by a plain chip, for good, is counted; by a held chip apart", () => {
  const told = [
    ...commit([add(4100, "results:1301"), add(4100, "plain:a"), add(4100, "plain:b")]),
    ...commit([gone(4500, "results:1301"), add(4500, "plain:c")]),
    ...commit([add(4600, "results:1301"), gone(4600, "plain:a")]),
    ...commit([gone(4900, "results:1301"), add(4900, "registry:offer")]),
  ];
  const report = railReport(told);
  assert.equal(report.flickers, 0);
  assert.equal(report.resultsPushedByPlain, 1);
  assert.equal(report.resultsPushedByHeld, 1);
});

test("a chip off the rail for more than a year and back for good is a chip seen again; a town request is counted apart", () => {
  const told = [...commit([add(100, "plain:a")]), ...commit([gone(300, "plain:a")]), ...commit([add(6000, "plain:a")]),
    ...commit([add(6100, "lord-request:order_timber")]), ...commit([gone(6200, "lord-request:order_timber")]), ...commit([add(11000, "lord-request:order_timber")])];
  const report = railReport(told);
  assert.equal(report.seenAgainAfterAYear, 1);
  assert.equal(report.townRequestsSeenAgain, 1, "the same kind's request remade under its id (v1.1 §7 item 7)");
});
