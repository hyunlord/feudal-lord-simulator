import assert from 'node:assert/strict';
import test from 'node:test';
import { advanceTick } from '../src/engine/tick';
import { materialTown } from './autoplayMaterialFixtures';
import type { GameState } from '../src/engine/engine.types';
function pipeline(longOutput: boolean): GameState {
  const base = materialTown(40);
  return { ...base, palisade: base.palisade === null ? null : { ...base.palisade, segments: base.palisade.segments.map(segment => longOutput ? { ...segment, edgePath: [{ x: 20, y: 3 }, { x: 21, y: 3 }] } : segment) }, buildings: base.buildings.map(home => home.kind === 'masonry' ? { ...home, inventory: { stone: 5 } } : home),
    constructionSites: base.constructionSites.map(site => site.kind === 'stone_wall_segment' && longOutput
      ? { ...site, path: [{ x: 20, y: 3 }, { x: 21, y: 3 }] } : site) };
}
test('Given old output stock at raw arrival When actual new production occurs while output travels before acceptance Then ordinary cycle qualifies only after its physical return', () => {
  let state = pipeline(true), sawDispatchBeforeProduction = false, sawProductionBeforeAcceptance = false;
  for (let i = 0; i < 1400; i++) {
    state = advanceTick(state);
    const record = state.autoplayMaterialRecovery; assert.ok(record?.status === 'observing');
    const outbound = state.walkers.some(w => w.kind === 'carter' && w.homeBuildingId === 'masonry' && w.mission === 'deliver' && w.phase === 'outbound');
    if (outbound && record.cycle?.produced === 0) sawDispatchBeforeProduction = true;
    if (outbound && (record.cycle?.produced ?? 0) > 0 && (record.cycle?.wallDelivered ?? 0) === 0) sawProductionBeforeAcceptance = true;
    if (record.completedCycle !== undefined) {
      assert.ok(sawDispatchBeforeProduction && sawProductionBeforeAcceptance);
      assert.ok(record.completedCycle.rawArrived > 0 && record.completedCycle.produced > 0 && record.completedCycle.wallDelivered === 5);
      assert.equal(record.completedCycle.returnedTick, state.tick);
      return;
    }
  }
  assert.fail('Actual production-before-acceptance pipeline never completed observation');
});
test('Given a short output trip that accepts old stock before any new production When production occurs later Then earlier acceptance cannot be credited retroactively', () => {
  let state = pipeline(false), sawAcceptance = false;
  for (let i = 0; i < 1200; i++) {
    state = advanceTick(state);
    const record = state.autoplayMaterialRecovery; assert.ok(record?.status === 'observing');
    if ((state.constructionSites[0]?.delivered.stone ?? 0) > 0 && record.cycle?.produced === 0) {
      sawAcceptance = true;
      assert.equal(record.cycle.wallDelivered, 0);
      assert.equal(record.completedCycle, undefined);
    }
    if (sawAcceptance && (record.cycle?.produced ?? 0) > 0) {
      assert.equal(record.cycle?.wallDelivered, 0);
      assert.equal(record.completedCycle, undefined);
      return;
    }
  }
  assert.fail('Fixture did not exercise production after earlier acceptance');
});
