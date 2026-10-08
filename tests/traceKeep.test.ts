/**
 * TRACE-KEEP (A5, the user's ruling 2026-10-09; renderer A's docs/requests/engine-slice-ends.md items 1 and 5): a big
 * decision stays in the thread to the end — the slice's end page opens 1300–1308 in its twentieth year and finds it
 * with what followed — while the small fold after ten years; LONGRUN-1's memory fold never folds a big decision's memory.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { LORD_SLICE_SCENARIO_ID } from "../src/content/lordSliceConfig";
import { decisionRemembers, traceInRange, yearReview } from "../src/engine/decisionReads";
import { advanceTrace, isBigDecision, TRACE_KEPT_TICKS, traceOf } from "../src/engine/decisionTrace";
import type { TracedDecision } from "../src/engine/decisionTrace.types";
import type { GameState } from "../src/engine/engine.types";
import type { HistoryRecord } from "../src/engine/history.types";
import { foldFactionMemories, memoryFoldable } from "../src/engine/memoryFold";
import { advanceTick } from "../src/engine/tick";
import { newGameState } from "../src/state/newGame";

const YEAR = 4_000;
const lordGame = (): GameState => { let state = newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed: 1 })!; for (let tick = 0; tick < 10; tick += 1) state = advanceTick(state); return state; };

/** Three decisions of 1300 (a big one of the lord's, a small setting of his, the steward's), what followed the big one, and who remembers each. */
function decided(): GameState {
  const base = lordGame();
  const decisions: TracedDecision[] = [
    { id: "h-900001", tick: 100, by: "lord", kind: "suit", source: "file_suit:claim-1", weights: ["rights"], targets: ["suit:suit-1"] },
    { id: "h-900002", tick: 200, by: "lord", kind: "policy", source: "set_estate_policy:growth", weights: [], targets: ["policy"] },
    { id: "h-900003", tick: 300, by: "steward", kind: "manor_petition", source: "manor_petition:pannage:granted", weights: [], targets: [] },
  ];
  const record = (id: string, tick: number, template: string, extra: Partial<HistoryRecord> = {}): HistoryRecord =>
    ({ id, tick, kind: template === "consequence" ? "event" : "decision", template, subject: { type: "town", id: "town" }, severity: 1, params: {}, ...extra }) as HistoryRecord;
  const records = [record("h-900001", 100, "decision.card"), record("h-900002", 200, "decision.card"), record("h-900003", 300, "decision.steward"),
    record("h-900004", 2_500, "consequence", { params: { key: "suit_turned", stage: "evidence" }, because: [{ decisionId: "h-900001", key: "suit_turned" }] })];
  const history = base.history!;
  const factions = base.factions!;
  return { ...base, trace: { decisions, acts: [] }, history: { ...history, records: [...history.records, ...records] },
    factions: { ...factions, factions: factions.factions.map(faction => faction.id !== "neighbour_1" ? faction : { ...faction, memory: [...faction.memory,
      { recordId: "h-900005", tick: 101, delta: -5, reason: "file_suit:claim-1", decisionId: "h-900001" },
      { recordId: "h-900006", tick: 201, delta: 2, reason: "set_estate_policy:growth", decisionId: "h-900002" },
      { recordId: "h-900007", tick: 900, delta: -1, reason: "decline:dues" }] }) } };
}

test("TRACE-KEEP: in the twentieth year the thread still holds 1300's big decision — the end page finds it with what followed and who remembers it; the small are counted", () => {
  const state = decided();
  const at20 = advanceTrace(state, { ...state, tick: 20 * YEAR });
  const ids = traceOf(at20).decisions.map(decision => decision.id);
  assert.deepEqual(ids, ["h-900001"], "the big stays, the small (older than ten years) go");
  assert.ok(20 * YEAR - 200 > TRACE_KEPT_TICKS);
  const review = yearReview(at20, 1300);
  assert.deepEqual(review.decisions.map(decision => [decision.decisionId, decision.weights]), [["h-900001", ["rights"]]]);
  assert.deepEqual(review.summarised, { lord: 1, steward: 1, lapsed: 0 });
  assert.deepEqual(traceInRange(at20, 0, 9 * YEAR).filter(row => row.decisionId === "h-900001").map(row => row.key).sort(), ["relation", "suit_turned"]);
  assert.deepEqual(decisionRemembers(at20, "h-900001").map(entry => [entry.actor, entry.delta]), [["neighbour_1", -5]]);
  // Within ten years, the small are still there.
  assert.equal(traceOf(advanceTrace(state, { ...state, tick: 5 * YEAR })).decisions.length, 3);
});

test("TRACE-KEEP: a big decision is the lord's, weighed and answered — a lapse, the steward's and a weightless setting are small", () => {
  const base = { by: "lord" as const, weights: ["land" as const] };
  assert.equal(isBigDecision(base), true);
  assert.equal(isBigDecision({ ...base, lapsed: true }), false);
  assert.equal(isBigDecision({ ...base, by: "steward" }), false);
  assert.equal(isBigDecision({ ...base, weights: [] }), false);
});

test("LONGRUN-1's memory fold (pinned now): a big decision's memories never fold; the small fold into one line per faction and year", () => {
  const state = decided();
  const faction = (at: GameState) => at.factions!.factions.find(entry => entry.id === "neighbour_1")!;
  const big = faction(state).memory.find(memory => memory.decisionId === "h-900001")!;
  assert.equal(memoryFoldable(state, big, Number.POSITIVE_INFINITY), false, "never, however old");
  const folded = foldFactionMemories(state, Number.POSITIVE_INFINITY);
  const memory = faction(folded).memory;
  assert.ok(memory.includes(big), "the big decision's memory stays as it was");
  assert.deepEqual(decisionRemembers(folded, "h-900001"), decisionRemembers(state, "h-900001"));
  assert.equal(memory.some(entry => entry.decisionId === "h-900002" || entry.reason === "decline:dues"), false, "the small folded");
  const before = faction(state).memory.filter(entry => entry !== big).reduce((sum, entry) => sum + entry.delta, 0);
  assert.equal(memory.filter(entry => entry !== big).reduce((sum, entry) => sum + entry.delta, 0), before, "their sum kept");
  // After the trace has pruned the small decisions, their memories still fold; the big's still do not.
  const at20 = advanceTrace(state, { ...state, tick: 20 * YEAR });
  assert.ok(faction(foldFactionMemories(at20, 20 * YEAR)).memory.includes(big));
  assert.equal(foldFactionMemories(folded, Number.POSITIVE_INFINITY), folded, "a folded line does not fold again");
});
