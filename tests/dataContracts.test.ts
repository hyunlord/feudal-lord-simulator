import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  EffectRegistry,
  SOURCE_REF_TYPES,
  buildingSource,
  isSourceRef,
  refKey,
  tileRefId,
  type AppliedEffect,
  type EffectSpec,
} from "../src/contracts";
import { appendMarketSales } from "../src/engine/coinLedger";
import type { GameState } from "../src/engine/engine.types";
import { decodeSave, jsonSafetyIssues } from "../src/save/saveCodec";
import { firstBlocker, buildingCauseSnapshot } from "../src/ui/houseProgressModel";
import { predictionCheck } from "../src/ui/predictionRegistry";
import { buildingPlacementPrediction } from "../src/ui/placementPrediction";
import { PREDICTION_SEVERITY_TONE, toPredictionLine } from "../src/ui/predictionTypes";
import { proposalPredictionLines } from "../src/ui/wallPrediction";

const SPECS: readonly EffectSpec[] = [
  { kind: "modifier", stat: "wheat_yield", op: "mul", value: 0.8 },
  { kind: "rule", rule: "market_day", value: "thursday" },
  { kind: "permission", tag: "mill_suit", allowed: true },
  { kind: "resource_flow", category: "rent", from: { kind: "building", id: "house-1" }, to: { kind: "actor", id: "lord" } },
  { kind: "event_weight", eventId: "harvest_failure", multiplier: 1.5 },
];

function effect(id: string, target: AppliedEffect["target"], startedAt: number, expiresAt?: number, spec = SPECS[0]!): AppliedEffect {
  return { id, source: { type: "policy", id: "assize-of-bread" }, target, spec, startedAt, ...(expiresAt === undefined ? {} : { expiresAt }) };
}

const fixture = (name: string): GameState =>
  decodeSave(readFileSync(`fixtures/saves/v4/${name}.save.json`)).envelope.state as GameState;

test("SourceRef has exactly the ten contract types and validates plain JSON refs", () => {
  assert.deepEqual([...SOURCE_REF_TYPES], ["building", "zone", "policy", "event", "scenario", "trade", "right", "instrument", "actor", "claim"]);
  for (const type of SOURCE_REF_TYPES) assert.equal(isSourceRef({ type, id: "x" }), true);
  assert.equal(isSourceRef({ type: "building", id: "b", detail: "rule-2" }), true);
  assert.equal(isSourceRef({ type: "guild", id: "x" }), false);
  assert.equal(isSourceRef({ type: "building", id: "" }), false);
  assert.equal(isSourceRef({ type: "building", id: "b", detail: 3 }), false);
  assert.equal(refKey({ type: "right", id: "market-charter", detail: "toll" }), "right:market-charter#toll");
  assert.equal(refKey({ kind: "tile", id: tileRefId(4, 7) }), "tile:4,7");
});

test("effect registry returns active effects for a target in registration order", () => {
  const registry = new EffectRegistry();
  const house = { kind: "building", id: "house-1" } as const;
  registry.register(effect("b", house, 10, 20));
  registry.register(effect("a", house, 0));
  registry.register(effect("c", { kind: "building", id: "house-2" }, 0));
  registry.register(effect("d", { kind: "settlement", id: "settlement" }, 5, 6));
  assert.deepEqual(registry.forTarget(house, 9).map(e => e.id), ["a"]);
  assert.deepEqual(registry.forTarget(house, 10).map(e => e.id), ["b", "a"], "startedAt is inclusive");
  assert.deepEqual(registry.forTarget(house, 20).map(e => e.id), ["a"], "expiresAt is exclusive");
  assert.deepEqual(registry.forTarget({ kind: "zone", id: "house-1" }, 10), [], "kind is part of target identity");
  assert.deepEqual(registry.active(5).map(e => e.id), ["a", "c", "d"]);
  assert.throws(() => registry.register(effect("a", house, 0)), /already registered/);
  assert.throws(() => registry.register(effect("n", house, Number.NaN)), /finite/);
});

test("effect registry expiry removes only effects whose end tick has passed", () => {
  const registry = new EffectRegistry();
  const target = { kind: "tile", id: tileRefId(3, 3) } as const;
  registry.register(effect("short", target, 0, 5));
  registry.register(effect("open", target, 0));
  registry.register(effect("long", target, 0, 50));
  assert.deepEqual(registry.expire(4).map(e => e.id), []);
  assert.deepEqual(registry.expire(5).map(e => e.id), ["short"]);
  assert.equal(registry.size, 2);
  assert.deepEqual(registry.forTarget(target, 10).map(e => e.id), ["open", "long"]);
  registry.register(effect("short", target, 60, 70));
  assert.deepEqual(registry.expire(1000).map(e => e.id), ["long", "short"]);
  assert.deepEqual(registry.active(1000).map(e => e.id), ["open"]);
});

test("effect registry is deterministic and its serialized form is stable JSON", () => {
  const build = () => {
    const registry = new EffectRegistry();
    SPECS.forEach((spec, index) => registry.register(effect(`e${index}`, { kind: "building", id: `b${index % 2}` }, index, index % 2 === 0 ? index + 10 : undefined, spec)));
    return registry;
  };
  const first = JSON.stringify(build());
  assert.equal(JSON.stringify(build()), first, "same registrations in the same order serialize identically");
  const parsed = JSON.parse(first) as AppliedEffect[];
  assert.deepEqual(jsonSafetyIssues(parsed), []);
  const restored = EffectRegistry.fromJSON(parsed);
  assert.equal(JSON.stringify(restored), first, "fromJSON(toJSON) round-trips byte-for-byte");
  assert.deepEqual(restored.forTarget({ kind: "building", id: "b0" }, 4).map(e => e.id), build().forTarget({ kind: "building", id: "b0" }, 4).map(e => e.id));
  assert.equal(parsed.length, 5);
  assert.deepEqual(parsed.map(e => e.spec.kind), ["modifier", "rule", "permission", "resource_flow", "event_weight"]);
});

test("cause entries carry the diagnosed building as their SourceRef, including firstBlocker", () => {
  for (const name of ["population-176", "palisade-construction", "timber-shortage"]) {
    const state = fixture(name);
    let checked = 0;
    for (const [buildingId, cause] of buildingCauseSnapshot(state)) {
      if (cause.blocker === null) continue;
      assert.deepEqual(cause.blocker.sources, [buildingSource(buildingId)], `${name} ${buildingId}`);
      checked += 1;
    }
    for (const house of state.houses) {
      const blocker = firstBlocker(house, state);
      if (blocker === null) continue;
      assert.deepEqual(blocker.sources, [buildingSource(house.buildingId)]);
      assert.equal(blocker.sources.every(isSourceRef), true);
      checked += 1;
    }
    assert.ok(checked > 0, `${name} exercises at least one cause`);
  }
});

test("market sale income records its selling market as a SourceRef with the unchanged saved shape", () => {
  const entries = appendMarketSales(undefined, 100, [{ marketId: "market-1", coin: 3 }, { marketId: "market-2", coin: 0 }]);
  assert.deepEqual(entries, [{ tick: 100, amount: 3, kind: "income", source: "market_sale", sourceRefs: [{ type: "building", id: "market-1" }] }]);
  assert.equal(entries[0]?.sourceRefs.every(isSourceRef), true);
});

test("prediction lines use the contract severity and map back to the original presentation keys", () => {
  assert.deepEqual(predictionCheck("road", "도로 연결", true), { id: "road", severity: "ok", text: "도로 연결", sources: [] });
  assert.deepEqual(predictionCheck("road", "도로 연결", false, "(운영에 불필요)"), { id: "road", severity: "block", text: "도로 연결 (운영에 불필요)", sources: [] });
  assert.deepEqual(PREDICTION_SEVERITY_TONE, { info: "neutral", ok: "positive", warn: "warning", block: "negative" });
  for (const [tone, severity] of [["neutral", "info"], ["positive", "ok"], ["warning", "warn"], ["negative", "block"]] as const) {
    assert.deepEqual(toPredictionLine({ id: "x", tone, text: "t" }), { id: "x", severity, text: "t", sources: [] });
  }
  const state = fixture("population-176");
  const lines = buildingPlacementPrediction(state, "market", { tx: 20, ty: 20 }).lines.map(toPredictionLine);
  assert.ok(lines.length > 0);
  assert.equal(lines.every(line => line.sources.every(isSourceRef)), true);
  assert.deepEqual(jsonSafetyIssues(lines), []);
  const wall = proposalPredictionLines(fixture("new-game"), [{ x: 40, y: 36 }, { x: 50, y: 36 }, { x: 50, y: 46 }, { x: 40, y: 46 }, { x: 40, y: 36 }]);
  assert.ok(wall.some(line => line.severity === "warn" || line.severity === "ok"));
});
