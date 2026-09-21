import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnCarters, stepCarters } from '../src/agents/delivery';
import { createDeliveryInventoryPort, createSimulationRoutePorts } from '../src/engine/simulationPorts';
import { building, state as makeState } from './stoneWallConversionFixtures';
function sharedAccess() {
  const buildings = [building('raw', 'storehouse', 0, 0, { inventory: { stone_raw: 8 } }), building('masonry', 'masonry', 3, 1, { workers: 3 })];
  return makeState({ width: 6, height: 4, buildings, houses: [], walkers: [], palisade: null, constructionSites: [],
    tiles: Array.from({ length: 24 }, (_, n) => { const tx = n % 6, ty = Math.floor(n / 6); return { tx, ty, terrain: 'grass' as const,
      hasRoad: tx === 2 && ty === 1, buildingId: tx < 2 && ty < 2 ? 'raw' : tx === 3 && ty === 1 ? 'masonry' : null }; }) });
}
test('Given actual shared road access When singleton fetch and return execute Then raw home arrival is a separate physical step and observation leaves resources identical', () => {
  const state = sharedAccess(), ports = createSimulationRoutePorts(state), events: unknown[] = [];
  assert.deepEqual(ports.delivery.betweenBuildings('masonry', 'raw'), [{ tx: 2, ty: 1 }]);
  const input = { tick: 101, buildings: state.buildings, walkers: state.walkers, inventory: createDeliveryInventoryPort(), routes: ports.delivery, materialActivity: (event: unknown) => events.push(event) };
  const spawned = spawnCarters(input);
  const { materialActivity: _observe, ...disabled } = input;
  assert.deepEqual(spawned, spawnCarters(disabled));
  const picked = stepCarters({ ...input, ...spawned, tick: 102 });
  assert.equal(picked.walkers.length, 1);
  const returned = stepCarters({ ...input, ...picked, tick: 103 });
  assert.equal(returned.walkers.length, 0);
  assert.equal(returned.buildings.find(b => b.id === 'masonry')?.inventory.stone_raw, 8);
  assert.ok(events.some(event => typeof event === 'object' && event !== null && 'kind' in event && event.kind === 'raw_home'));
});

test('Given fresh masonry telemetry When ordinary ticks fetch, produce and supply a wall Then the completed cycle includes the physical output return', async () => {
  const { advanceTick } = await import('../src/engine/tick');
  const { stoneSite, palisade, palisadeSegment } = await import('./stoneWallConversionFixtures');
  const base = sharedAccess();
  let state = makeState({ ...base, era: 'stone_town', eraProclaimedTick: 10,
    palisade: palisade([palisadeSegment(0, { edgePath: [{ x: 3, y: 3 }, { x: 4, y: 3 }] })]),
    buildings: [...base.buildings, building('home-a', 'house', 5, 0)],
    houses: makeState().houses.map(house => ({ ...house, breadStock: 500 })),
    constructionSites: [stoneSite(0, { path: [{ x: 3, y: 3 }, { x: 4, y: 3 }] })],
    tiles: base.tiles.map(tile => ({ ...tile, hasRoad: tile.hasRoad || tile.ty === 2 && (tile.tx === 2 || tile.tx === 3),
      buildingId: tile.tx === 5 && tile.ty === 0 ? 'home-a' : tile.buildingId })) });
  for (let i = 0; i < 300; i++) {
    state = advanceTick(state);
    if (state.autoplayMaterialRecovery?.status === 'observing' && state.autoplayMaterialRecovery.completedCycle !== undefined) break;
  }
  const record = state.autoplayMaterialRecovery;
  assert.equal(record?.status, 'observing');
  assert.ok(record?.status === 'observing' && record.completedCycle);
  assert.ok(record.completedCycle.rawArrived > 0 && record.completedCycle.produced > 0 && record.completedCycle.wallDelivered > 0);
  assert.equal(record.completedCycle.returnedTick, state.tick);
});

test('Given the actual movement helper When deriving singleton and bent road durations Then count whole movement substeps and preserve the one-step singleton phase', async () => {
  const { materialLegTicks } = await import('../src/engine/autoplayMaterialOpportunity');
  assert.equal(materialLegTicks([{ tx: 2, ty: 1 }]), 1);
  assert.equal(materialLegTicks([{ tx: 2, ty: 1 }, { tx: 3, ty: 1 }]), 8);
  assert.equal(materialLegTicks([{ tx: 2, ty: 1 }, { tx: 3, ty: 1 }, { tx: 3, ty: 2 }]), 15);
});
