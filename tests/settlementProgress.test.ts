import assert from "node:assert/strict";
import test from "node:test";
import { getSettlementView } from "../src/engine/settlementView";
import { updateSettlementProgress } from "../src/engine/settlementProgress";
import type { GameState } from "../src/engine/engine.types";
function state(population = 20): GameState {
  return { tick: 0, seed: 1, tiles: [], width: 1, height: 1, buildings: [], constructionSites: [], walkers: [], population, idleWorkers: 0, treasuryTimber: 0, treasuryCoin: 0, wallTick: 0, era: "hamlet", eraProclaimedTick: null, palisade: null, forestHarvests: [], nextConstructionOrdinal: 0, roadRevision: 0, pathCache: {}, houses: [{ buildingId: "home", level: 1, residents: population, hasWater: true, breadStock: 3, lastServicedTick: 0, unmetRequirementTicks: 0 }] };
}
function advance(input: GameState, count: number): GameState {
  let next = input;
  for (let i = 0; i < count; i += 1) next = updateSettlementProgress({ ...next, tick: next.tick + 1 });
  return next;
}
test("self-sufficiency latches at 600 observed supplied ticks", () => {
  const before = advance(state(), 599);
  assert.equal(before.settlement?.milestones.selfSufficient, null);
  const after = advance(before, 1);
  assert.equal(after.settlement?.milestones.selfSufficient, 600);
  assert.equal(updateSettlementProgress(after), after);
});

test("interrupted services reset the hold without losing an earned milestone", () => {
  const before = advance(state(), 599);
  const interrupted = advance({ ...before, houses: before.houses.map(house => ({ ...house, hasWater: false })) }, 1);
  assert.equal(interrupted.settlement?.selfSufficientTicks, 0);
  const recovered = advance({ ...interrupted, houses: state().houses }, 600);
  const fallen = advance({ ...recovered, population: 1, houses: recovered.houses.map(house => ({ ...house, breadStock: 0 })) }, 100);
  assert.equal(fallen.settlement?.milestones.selfSufficient, 1200);
});

test("90 percent counts occupied households together, excludes empty houses and grace", () => {
  const base = state();
  const house = base.houses[0];
  assert.ok(house);
  const houses = Array.from({ length: 10 }, (_, index) => ({ ...house, buildingId: `home-${index}`, residents: 2, breadStock: index < 9 ? 1 : 0, starvationGraceUntilTick: 999999 }));
  const boundary = advance({ ...base, houses: [...houses, { ...house, residents: 0, hasWater: false, breadStock: 0 }] }, 600);
  assert.equal(boundary.settlement?.milestones.selfSufficient, 600);
  const short = advance({ ...base, houses: houses.map((entry, index) => index === 0 ? { ...entry, hasWater: false } : entry) }, 600);
  assert.equal(short.settlement?.milestones.selfSufficient, null);
});

function withWall(input: GameState, material: "timber" | "stone" = "timber"): GameState {
  return { ...input, era: "palisade", population: 60, palisade: { id: "wall", polygon: [], gate: { x: 1, y: 1 }, segments: [{ id: "s1", order: 0, edgePath: [{ x: 0, y: 0 }, { x: 1, y: 0 }], tileCount: 1, completed: true, constructionSiteId: null, material }] } };
}

test("era proclamation does not count as completed wall; earned wall goal persists", () => {
  const base = withWall(advance(state(), 600));
  assert.ok(base.palisade);
  const pending = advance({ ...base, palisade: { ...base.palisade, segments: base.palisade.segments.map(segment => ({ ...segment, completed: false })) } }, 1);
  assert.equal(pending.settlement?.milestones.palisade, null);
  const finished = advance({ ...pending, palisade: base.palisade }, 1);
  assert.equal(finished.settlement?.milestones.palisade, 602);
  assert.equal(advance({ ...finished, palisade: null, population: 1 }, 1).settlement?.milestones.palisade, 602);
});

test("prosperity waits for actual stone replacement and 1200 uninterrupted ticks", () => {
  const base = withWall(advance(state(), 600));
  assert.ok(base.palisade);
  const replacing = advance({ ...base, era: "stone_town", population: 140, palisade: { ...base.palisade, segments: base.palisade.segments.map(segment => ({ ...segment, replacementConstructionSiteId: "replacement" })) } }, 1200);
  assert.equal(replacing.settlement?.prosperityTicks, 0);
  const stone = { ...replacing, palisade: { ...base.palisade, segments: base.palisade.segments.map(segment => ({ ...segment, material: "stone" as const })) } };
  const almost = advance(stone, 1199);
  assert.equal(almost.settlement?.outcome, "ongoing");
  const victory = advance(almost, 1);
  assert.equal(victory.settlement?.outcome, "victory");
  assert.equal(advance({ ...victory, population: 0, houses: [] }, 7000).settlement?.outcome, "victory");
});

test("food crisis warns at 300 ticks and recovery resets it immediately", () => {
  const base = state();
  const hungry = { ...base, houses: base.houses.map(house => ({ ...house, breadStock: 0, starvationGraceUntilTick: 999999 })) };
  assert.equal(getSettlementView(advance(hungry, 299)).crisis, "none");
  const crisis = advance(hungry, 300);
  assert.equal(getSettlementView(crisis).crisis, "food_shortage");
  assert.equal(getSettlementView(advance({ ...crisis, houses: base.houses }, 1)).crisis, "none");
});

test("abandonment requires settled history or housing, startup grace, then 600 empty ticks", () => {
  const empty = { ...state(0), houses: [] };
  assert.equal(advance(empty, 7000).settlement?.outcome, "ongoing");
  const emptyHouse = advance(state(0), 6000);
  assert.equal(emptyHouse.settlement?.emptyTicks, 0);
  const warning = advance(emptyHouse, 599);
  assert.equal(warning.settlement?.outcome, "ongoing");
  const terminal = advance(warning, 1);
  assert.equal(terminal.settlement?.outcome, "abandoned");
  const later = { ...terminal, tick: terminal.tick + 1, population: 10 };
  assert.equal(updateSettlementProgress(later), later);
});

test("population recovery clears empty timer and the view tracks the next goal", () => {
  const warning = advance({ ...state(0), tick: 6000 }, 599);
  const recovered = advance({ ...warning, population: 20, houses: state().houses }, 1);
  assert.equal(recovered.settlement?.emptyTicks, 0);
  assert.equal(getSettlementView(recovered).currentGoal?.id, "selfSufficient");
  assert.equal(getSettlementView(advance(recovered, 599)).currentGoal?.id, "palisade");
});

test("skipped clock ticks cannot prove unobserved continuous service", () => {
  const jumped = updateSettlementProgress({ ...state(), tick: 10000 });
  assert.equal(jumped.settlement?.selfSufficientTicks, 1);
  const repeated = updateSettlementProgress(jumped);
  assert.equal(repeated, jumped);
});

test("an observation gap restarts continuous hold instead of completing it", () => {
  const almost = advance(state(), 599);
  const afterGap = updateSettlementProgress({ ...almost, tick: 10000 });
  assert.equal(afterGap.settlement?.selfSufficientTicks, 1);
  assert.equal(afterGap.settlement?.milestones.selfSufficient, null);
});

test("prosperity hold resets when a single required service is lost", () => {
  const ready = { ...withWall(advance(state(), 600), "stone"), era: "stone_town" as const, population: 140 };
  const almost = advance(ready, 1199);
  const cut = advance({ ...almost, houses: almost.houses.map(house => ({ ...house, hasWater: false })) }, 1);
  assert.equal(cut.settlement?.prosperityTicks, 0);
  assert.equal(cut.settlement?.outcome, "ongoing");
});

test("demolishing the last home does not erase prior settlement history", () => {
  const established = advance(state(), 1);
  const evacuated = advance({ ...established, tick: 6000, population: 0, houses: [] }, 600);
  assert.equal(evacuated.settlement?.outcome, "abandoned");
});

test("progress reducer and presentation leave input state unchanged", () => {
  const input = state();
  const snapshot = structuredClone(input);
  const next = updateSettlementProgress(input);
  getSettlementView(next);
  assert.deepEqual(input, snapshot);
  assert.notEqual(next, input);
});
