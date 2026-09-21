import assert from 'node:assert/strict';
import test from 'node:test';
import { materialPolicyTown, observedMaterialTown } from './autoplayMaterialPolicyFixtures';
import { building } from './stoneWallConversionFixtures';
import { advanceTick } from '../src/engine/tick';
import { createConstructionSite } from '../src/economy/construction';
import { materialRecoveryAction } from '../src/engine/autoplayMaterialRecovery';
import type { GameState } from '../src/engine/engine.types';

test('Given a legacy state without telemetry When normal ticking starts observation Then incomplete evidence cannot place', () => {
  const next = advanceTick(materialPolicyTown());
  assert.equal(next.autoplayMaterialRecovery?.status, 'observing');
  assert.deepEqual(materialRecoveryAction(next), { kind: 'none' });
  for (const epoch of [null, -1, Number.NaN, next.tick + 1]) {
    const invalid = advanceTick({ ...materialPolicyTown(), eraProclaimedTick: epoch });
    assert.equal(invalid.autoplayMaterialRecovery, undefined);
  }
});

test('Given an unsupported recognizable spent save When its epoch is temporarily invalid Then state entry keeps it spent after restoration', () => {
  const base = materialPolicyTown();
  const imported: GameState = JSON.parse(JSON.stringify({ ...base, eraProclaimedTick: null,
    autoplayMaterialRecovery: { version: 99, status: 'placed', wallId: 'wall-a', epoch: 10, attemptSiteId: 'removed-masonry' } }));
  const invalid = advanceTick(imported);
  assert.equal(invalid.autoplayMaterialRecovery?.status, 'terminal');
  const restored = advanceTick({ ...invalid, eraProclaimedTick: 10 });
  assert.equal(restored.autoplayMaterialRecovery?.status, 'terminal');
  assert.deepEqual(materialRecoveryAction(restored), { kind: 'none' });
});

test('Given raw supply only at a quarry or committed pending workforce When evaluating recovery Then neither can justify a new masonry', () => {
  const state = observedMaterialTown();
  const quarry = building('quarry-only', 'quarry', 5, 0, { inventory: { stone_raw: 80 } });
  const noStoreRaw: GameState = { ...state,
    buildings: state.buildings.map(home => home.id === 'raw' ? quarry : home),
    tiles: state.tiles.map(tile => tile.buildingId === 'raw' ? { ...tile, buildingId: quarry.id } : tile), pathCache: {} };
  assert.deepEqual(materialRecoveryAction(noStoreRaw), { kind: 'none' });
  const pending = createConstructionSite({ ordinal: 99, kind: 'mill', tx: 7, ty: 2, startedTick: state.tick });
  const committed: GameState = { ...state, population: 16, constructionSites: [...state.constructionSites, pending] };
  assert.deepEqual(materialRecoveryAction(committed), { kind: 'none' });
});
