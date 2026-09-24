import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_GAME_STATE } from '../src/state/gameStore';
import { timberExpansionKind } from '../src/engine/autoplayTimberRecovery';
import { BUILDING_CONFIG_BY_KIND } from '../src/content/buildingConfig';
import { createPalisadeConstructionSite } from '../src/economy/construction';

function shortageWithLogs(logs: readonly number[], store: { readonly logs: number; readonly reserved: number }) {
  const base = structuredClone(DEFAULT_GAME_STATE);
  const original = base.buildings[0];
  assert.ok(original);
  const sawmills = logs.map((amount, index) => ({ ...original, id: `sawmill-${index}`, kind: 'sawmill' as const,
    workers: BUILDING_CONFIG_BY_KIND.sawmill.workersRequired, inventory: { logs: amount }, reserved: {}, stockReserved: {} }));
  return { ...base, tick: 5000, idleWorkers: 20, treasuryTimber: 50,
    buildings: [...base.buildings.map(b => b.kind === 'storehouse'
      ? { ...b, inventory: { logs: store.logs }, stockReserved: { logs: store.reserved } } : b), ...sawmills],
    timberProductionWindow: { startTick: 2601, throughTick: 5000, produced: 12, productionTicks: [], expansionShortageSinceTick: 2500 },
    constructionSites: [createPalisadeConstructionSite({ id: 'test-wall', wallId: 'test', segmentIndex: 0, order: 0, gateDistance: 0,
      path: [{ x: 5, y: 5 }, { x: 9, y: 5 }], startedTick: 1000 })] };
}

test('R-T14 scattered sawmill inputs and reserved store logs do not justify another sawmill', () => {
  // Given eight unusable single-log inputs and a warehouse whose logs are already committed.
  const state = shortageWithLogs(Array.from({ length: 8 }, () => 1), { logs: 9, reserved: 9 });
  // When expansion evaluates the available input supply.
  const kind = timberExpansionKind(state);
  // Then it addresses raw supply instead of adding another unfed converter.
  assert.equal(kind, 'logging_camp');
});

test('R-T14 existing sawmill input is covered before a spare cart licenses conversion expansion', () => {
  // Given one empty converter and only one free cart at its source warehouse.
  const state = shortageWithLogs([0], { logs: 8, reserved: 0 });
  // When expansion evaluates input demand before the new converter.
  const kind = timberExpansionKind(state);
  // Then those logs are not all surplus to existing conversion.
  assert.equal(kind, 'logging_camp');
});

test('R-T14 one free cart after the existing production batch still permits a sawmill', () => {
  // Given source stock for one existing production batch and one additional cart.
  const state = shortageWithLogs([0], { logs: 10, reserved: 0 });
  // When expansion evaluates the surplus.
  const kind = timberExpansionKind(state);
  // Then conversion expansion remains possible without a facility ratio.
  assert.equal(kind, 'sawmill');
});

test('R-T14 incoming logs already cover the existing sawmill input deficit', () => {
  // Given an existing converter with its next production batch already on the way.
  const base = shortageWithLogs([0], { logs: 8, reserved: 0 });
  const state = { ...base, buildings: base.buildings.map(b => b.kind === 'sawmill' ? { ...b, reserved: { logs: 2 } } : b) };
  // When expansion considers the free source cart independently from committed delivery.
  const kind = timberExpansionKind(state);
  // Then the same existing input demand is not deducted twice.
  assert.equal(kind, 'sawmill');
});

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
