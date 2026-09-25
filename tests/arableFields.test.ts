import assert from "node:assert/strict";
import test from "node:test";

import { ARABLE_CONFIG } from "../src/content/arableConfig";
import type { GameState } from "../src/engine/engine.types";
import type { ArableStage } from "../src/zones/arable.types";
import { arableLayouts, inYearTick } from "../src/zones/arableFields";
import { arableStripStates } from "../src/zones/arableStrips";
import { zonesOf } from "../src/zones/zoneEdits";
import { farmsteadAt, fieldWorld, rectangle, runFields } from "./helpers/arableWorld";

function stripsOf(state: GameState) {
  return arableStripStates(zonesOf(state)[0]!, state).strips;
}

function barnWheat(state: GameState): number {
  return state.buildings.find(building => building.kind === "farmstead")?.inventory.wheat ?? 0;
}

test("F1 a 12-cell field and a farmstead: stages follow the seasons for a year and the harvest is 12 × base × headland", () => {
  const start = fieldWorld();
  const layout = arableLayouts(start)[0]!;
  assert.equal(layout.axis, "x", "a 4×3 field lies along x");
  assert.deepEqual(layout.strips.map(strip => strip.cells.length), [4, 4, 4]);
  // 10 of the 12 cells touch the zone edge; only (7,10) and (8,10) are inner.
  assert.equal(layout.strips.reduce((sum, strip) => sum + strip.headlandCells, 0), 10);

  const history = new Map<string, { stage: ArableStage; tick: number }[]>();
  const end = runFields(start, ARABLE_CONFIG.fieldWorkFrom + 400, state => {
    for (const strip of stripsOf(state)) {
      const list = history.get(strip.id) ?? [];
      if (list.at(-1)?.stage !== strip.stage) list.push({ stage: strip.stage, tick: state.tick });
      history.set(strip.id, list);
    }
  });
  assert.equal(history.size, 3);
  for (const [id, stages] of history) {
    assert.deepEqual(stages.map(entry => entry.stage).slice(0, 8), ["fallow", "ploughed", "sown", "growing", "ripe", "harvested", "fallow", "ploughed"], id);
    const at = (stage: ArableStage, index = 0) => stages.filter(entry => entry.stage === stage)[index]!.tick;
    assert.ok(at("sown") < ARABLE_CONFIG.fieldWorkUntil, "sown in spring");
    assert.equal(at("growing") - at("sown"), ARABLE_CONFIG.growingAt);
    assert.equal(at("ripe") - at("sown"), ARABLE_CONFIG.growTicks, "ripe after 1,500 growing ticks, in summer");
    assert.ok(at("ripe") >= 1000 && at("harvested") < ARABLE_CONFIG.winterFrom, "harvested before winter");
    assert.equal(at("fallow", 1), ARABLE_CONFIG.winterFrom, "fallow when winter comes");
    assert.ok(at("ploughed", 1) > ARABLE_CONFIG.fieldWorkFrom, "ploughing starts again in late winter");
  }
  // 12 × base × headland: the edge rows are 4 × 0.75, the middle row 2 × 0.75 + 2 × 1.
  const base = ARABLE_CONFIG.baseYieldPerCell;
  const expected = Math.floor(3000 * base / 1000) + Math.floor(3500 * base / 1000) + Math.floor(3000 * base / 1000);
  // 12 cells × base × (9.5 / 12 average headland weight) = 323; each strip rounds down on its own.
  assert.equal(expected, 323);
  assert.equal(barnWheat(end), expected);
  assert.equal(end.arableFields?.[0]?.harvestedWheat, expected);
  assert.equal(end.arableFields?.[0]?.lostWheat, 0);
});

test("F2 without a farmstead the field stays fallow and says 헛간 없음", () => {
  const end = runFields(fieldWorld({ farmstead: null }), 2000);
  const strips = stripsOf(end);
  assert.ok(strips.length > 0);
  for (const strip of strips) {
    assert.equal(strip.stage, "fallow");
    assert.equal(strip.farmsteadId, null);
    assert.equal(strip.cause, "no_farmstead");
  }
});

test("F3 a farmstead with no workers holds every strip and says 일손 부족(경작)", () => {
  const end = runFields(fieldWorld({ farmstead: farmsteadAt(10, 10, 0) }), 2000);
  for (const strip of stripsOf(end)) {
    assert.equal(strip.stage, "fallow");
    assert.equal(strip.farmsteadId, "farmstead-10-10");
    assert.equal(strip.cause, "no_labour");
  }
  assert.equal(barnWheat(end), 0);
});

test("F4 a headland cell yields 0.75 of an inner cell", () => {
  // A 3×3 field: one inner cell (8,10), eight edge cells. Rows along x: 3 + 3 + 3.
  const state = fieldWorld({ field: rectangle(7, 9, 10, 12) });
  const [top, middle] = arableLayouts(state)[0]!.strips;
  assert.equal(top!.headlandCells, 3);
  assert.equal(middle!.headlandCells, 2);
  const cellWeight = (strip: typeof top) => strip!.weightPermille - (strip!.headlandCells * ARABLE_CONFIG.headlandPermille);
  assert.equal(cellWeight(middle), 1000, "the inner cell weighs 1000‰");
  assert.equal(top!.weightPermille / top!.headlandCells, 750, "each headland cell weighs 750‰");
  assert.equal(ARABLE_CONFIG.headlandPermille / 1000, 0.75);
  const end = runFields(state, 2600);
  const base = ARABLE_CONFIG.baseYieldPerCell;
  assert.equal(barnWheat(end), Math.floor(2250 * base / 1000) * 2 + Math.floor(2500 * base / 1000));
});

test("AF-4 a late sowing ripens short: at mid-autumn every crop still growing is ripe with what it grew", () => {
  // Field created in early summer (tick 1000): sown around 1100, forced ripe at 2500 with ~1400/1500 grown.
  const end = runFields(fieldWorld({ tick: 1000 }), 1600);
  const fields = end.arableFields![0]!;
  const full = Math.floor(3000 * ARABLE_CONFIG.baseYieldPerCell / 1000) * 2 + Math.floor(3500 * ARABLE_CONFIG.baseYieldPerCell / 1000);
  assert.ok(fields.harvestedWheat > 0 && fields.harvestedWheat < full, `late sowing gives less (${fields.harvestedWheat} < ${full})`);
  assert.ok(inYearTick(end.tick) < ARABLE_CONFIG.winterFrom);
});
