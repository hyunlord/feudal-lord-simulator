import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import test from 'node:test';
import { canCoverRemainingServiceLots, searchBudgetedServicePlan } from '../src/engine/autoplayServiceBudget';
import { runAutoplaySearch } from '../src/engine/autoplaySearchBudget';
import { projectServiceAction } from '../src/engine/autoplayServiceSpaceRoutes';
import type { GameState } from '../src/engine/engine.types';

test('natural seed 3 house at 16,17 is proved impossible within unchanged search limits', () => {
  const state: GameState = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/service-space-capacity/seed3-108000.json.gz', import.meta.url))).toString());
  const projected = projectServiceAction(state, { kind: 'place_building', building: 'house', tx: 16, ty: 17 });
  const result = runAutoplaySearch(() => searchBudgetedServicePlan(projected));
  assert.equal(result.witness, null);
  assert.equal(result.complete, true);
});

const pad = (mask: bigint, ...occupied: string[]) => ({ mask, occupied: new Set(occupied) });

test('last-provider coverage rejects missing lots and accepts only complete coverage', () => {
  const candidates = [pad(0b011n, 'a'), pad(0b110n, 'b')];
  assert.equal(canCoverRemainingServiceLots(candidates, 0b111n, 1), false);
  assert.equal(canCoverRemainingServiceLots(candidates, 0b011n, 1), true);
  assert.equal(canCoverRemainingServiceLots(candidates, 0b111n, 0), false);
  assert.equal(canCoverRemainingServiceLots([], 0n, 0), true);
});

test('two remaining providers must cover every lot without overlapping footprints', () => {
  assert.equal(canCoverRemainingServiceLots([pad(0b011n, 'a'), pad(0b110n, 'b')], 0b111n, 2), true);
  assert.equal(canCoverRemainingServiceLots([pad(0b011n, 'shared'), pad(0b110n, 'shared')], 0b111n, 2), false);
  assert.equal(canCoverRemainingServiceLots([pad(0b011n, 'a'), pad(0b100n, 'b')], 0b1111n, 2), false);
  assert.equal(canCoverRemainingServiceLots([pad(0b011n, 'shared'), pad(0b110n, 'shared'), pad(0b110n, 'other')], 0b111n, 2), true);
});

test('coverage is only a necessary condition, and larger slot searches keep their existing validation', () => {
  assert.equal(canCoverRemainingServiceLots([pad(0b111n, 'a')], 0b111n, 1), true);
  assert.equal(canCoverRemainingServiceLots([], 0b111n, 3), true);
});
