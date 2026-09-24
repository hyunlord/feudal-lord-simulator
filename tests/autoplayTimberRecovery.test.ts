import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_GAME_STATE } from '../src/state/gameStore';
import { timberExpansionKind } from '../src/engine/autoplayTimberRecovery';
import { BUILDING_CONFIG_BY_KIND } from '../src/content/buildingConfig';
import { createPalisadeConstructionSite } from '../src/economy/construction';

test('R-T14 sustained wall demand expands milling when existing stores hold unused logs', () => {
  // Given an observed timber shortage while a wall still absorbs output.
  const base = structuredClone(DEFAULT_GAME_STATE);
  const original = base.buildings[0];
  assert.ok(original);
  const sawmill = { ...original, id: 'test-sawmill', kind: 'sawmill' as const,
    workers: BUILDING_CONFIG_BY_KIND.sawmill.workersRequired, inventory: {} };
  const state = { ...base, tick: 5000, idleWorkers: 20, treasuryTimber: 50,
    buildings: [...base.buildings.map(b => b.kind === 'storehouse' ? { ...b, inventory: { logs: 80 } } : b), sawmill],
    timberProductionWindow: { startTick: 2601, throughTick: 5000, produced: 12, productionTicks: [], expansionShortageSinceTick: 2500 },
    constructionSites: [createPalisadeConstructionSite({ id:'test-wall', wallId:'test', segmentIndex:0, order:0, gateDistance:0, path:[{x:5,y:5},{x:9,y:5}], startedTick:1000 })] };
  // When the bot evaluates the actual material bottleneck.
  const kind = timberExpansionKind(state);
  // Then it adds conversion capacity rather than more raw wood or waiting forever.
  assert.equal(kind, 'sawmill');
});

test('the timber shortage clock resets when material becomes sufficient', async () => {
  // Given a real wall shortage, initially without any fabricated history.
  const { recordTimberExpansionShortage, TIMBER_EXPANSION_OBSERVATION_TICKS } = await import('../src/engine/autoplayTimberRecovery');
  const base = structuredClone(DEFAULT_GAME_STATE);
  const state = { ...base, tick: 100, treasuryTimber: 10,
    timberProductionWindow: { startTick: 0, throughTick: 100, produced: 0, productionTicks: [] },
    buildings: base.buildings.map(b => ({ ...b, inventory: {} })),
    constructionSites: [createPalisadeConstructionSite({ id:'test-wall', wallId:'test', segmentIndex:0, order:0, gateDistance:0, path:[{x:5,y:5},{x:9,y:5}], startedTick:100 })] };
  // When the continuous evidence opens and then the shortage clears.
  const observed = recordTimberExpansionShortage(state);
  const reset = recordTimberExpansionShortage({ ...observed, tick: 100 + TIMBER_EXPANSION_OBSERVATION_TICKS, treasuryTimber: 120 });
  // Then waiting time is not inherited by a later, separate shortage.
  assert.ok(observed.timberProductionWindow && 'expansionShortageSinceTick' in observed.timberProductionWindow);
  assert.equal(observed.timberProductionWindow.expansionShortageSinceTick, 100);
  assert.ok(reset.timberProductionWindow && !('expansionShortageSinceTick' in reset.timberProductionWindow));
});
