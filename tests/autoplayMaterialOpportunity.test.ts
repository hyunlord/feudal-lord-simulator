import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { materialLegTicks, materialOpportunity } from '../src/engine/autoplayMaterialOpportunity';
import { hasArrivedAtPathEnd, stepWalkerAlongPath } from '../src/agents/movement';
import type { CarterWalker, TilePos } from '../src/agents/walker.types';
import { BALANCE } from '../src/content/balanceConfig';
import { materialPolicyTown } from './autoplayMaterialPolicyFixtures';

function actualTicks(path: readonly TilePos[]): number {
  const destination = { kind: 'building' as const, buildingId: 'test' };
  let walker: CarterWalker = { id: 'test', kind: 'carter', mission: 'deliver', phase: 'outbound', homeBuildingId: 'test', destination,
    path, position: path[0] ?? { tx: 0, ty: 0 }, pathIndex: 0, previousTile: null, cargo: null, spawnedTick: 0, cancellation: null,
    reservation: { destination, resource: 'stone', amount: 0, sourceStockClaim: null, homeCapacityClaim: null } };
  let ticks = 0;
  do { walker = stepWalkerAlongPath(walker, BALANCE.CARTER_SPEED); ticks++; } while (!hasArrivedAtPathEnd(walker));
  return ticks;
}

test('valid route duration equals actual stepping including residuals, turns, singleton and empty', () => {
  assert.equal(materialLegTicks([]), 1);
  for (const path of [
    [{ tx: 0, ty: 0 }],
    [{ tx: 0, ty: 0 }, { tx: 1, ty: 0 }, { tx: 0, ty: 0 }],
    [{ tx: 0, ty: 0 }, { tx: 0, ty: 1 }, { tx: 1, ty: 1 }, { tx: 1, ty: 0 }, { tx: 0, ty: 0 }],
  ]) assert.equal(materialLegTicks(path), actualTicks(path));
  for (const offset of [0, 32, 127, 1024]) {
    for (let length = 1; length <= 150; length++) {
      const path = Array.from({ length }, (_, i) => ({ tx: offset + i, ty: offset }));
      const turning = path.map((_, i) => ({ tx: offset + Math.min(i, 75), ty: offset + Math.max(0, i - 75) }));
      for (const route of [path, [...path].reverse(), turning, [...turning].reverse()]) {
        assert.equal(materialLegTicks(route), actualTicks(route));
      }
    }
  }
});

test('normal material opportunity retains its exact movement deadline', () => {
  const state = materialPolicyTown(), home = state.buildings.find(b => b.id === 'incumbent');
  assert.ok(home);
  assert.deepEqual(materialOpportunity(state, home, 'wall-a'), { sourceId: 'raw', activeSiteId: 'wall-a-segment-000-stone',
    admittedRaw: 8, rawLegTicks: 58, outputLegTicks: 116, workTicks: 180, alignmentTicks: 86, opportunityUntilTick: 1440 });
});

test('malformed cached public route fails closed without an unbounded synchronous loop', () => {
  const moduleUrl = new URL('../src/engine/autoplayMaterialOpportunity.ts', import.meta.url).href;
  const fixtureUrl = new URL('./autoplayMaterialPolicyFixtures.ts', import.meta.url).href;
  const portUrl = new URL('../src/engine/simulationPorts.ts', import.meta.url).href;
  const code = `import assert from 'node:assert/strict';
    import {materialOpportunity,materialLegTicks} from ${JSON.stringify(moduleUrl)};
    import {materialPolicyTown} from ${JSON.stringify(fixtureUrl)};
    import {createSimulationRoutePorts} from ${JSON.stringify(portUrl)};
    const state=materialPolicyTown(),home=state.buildings.find(b=>b.id==='incumbent');assert.ok(home);
    const routes=createSimulationRoutePorts(state),normal=routes.delivery.betweenBuildings(home.id,'raw');assert.ok(normal);
    const cache=routes.getPathCache(),key=Object.keys(cache).find(k=>k.endsWith(':pair:incumbent|raw'));assert.ok(key);
    const invalid=[{tx:1e300,ty:0},{tx:Infinity,ty:3},{tx:NaN,ty:3},{tx:3.5,ty:3},{tx:-1,ty:3}];
    for(const point of invalid){assert.equal(materialOpportunity({...state,pathCache:{...cache,[key]:[normal[0],point,normal.at(-1)]}},home,'wall-a'),null);}
    for(const path of [[{tx:0,ty:0},{tx:2,ty:0}],[{tx:0,ty:0},{tx:1,ty:1}],[{tx:0,ty:0},{tx:0,ty:0}],[{tx:1e300,ty:0}],
      [{tx:9007199254740990,ty:0},{tx:9007199254740991,ty:0}]])assert.equal(materialLegTicks(path),null);
    console.log('all malformed routes rejected');`;
  const child = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '--eval', code], { encoding: 'utf8', timeout: 3000 });
  assert.equal(child.error, undefined, child.error?.message);
  assert.equal(child.status, 0, child.stderr);
  assert.match(child.stdout, /all malformed routes rejected/);
});
