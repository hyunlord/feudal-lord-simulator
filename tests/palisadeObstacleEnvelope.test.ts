import assert from 'node:assert/strict';
import test from 'node:test';
import { palisadeObstacleEnvelopes } from '../src/world/palisadeObstacleEnvelope';
import { palisadePathHasBuildingClearance, palisadePathEnclosesFootprints, validatePalisadeCandidate } from '../src/world/palisadeGeometry';
import type { Grid } from '../src/world/grid';

const grid: Grid = { width: 24, height: 24, tiles: Array.from({ length: 576 }, (_, index) => ({
  tx: index % 24, ty: Math.floor(index / 24), terrain: 'grass', hasRoad: false, buildingId: null,
})) };
const core = [{ id: 'core', tx: 8, ty: 8, width: 3, height: 3 }];

test('a boundary obstacle is cleared locally without pulling in a remote obstacle', () => {
  const near = { id: 'manor-house-near', tx: 11, ty: 8, width: 3, height: 3 };
  const far = { id: 'farmstead-far', tx: 20, ty: 20, width: 2, height: 2 };
  const all = [...core, near, far];
  const paths = palisadeObstacleEnvelopes(grid, core, all, 1);
  const path = paths.find(candidate => validatePalisadeCandidate(grid, candidate, all, core, 1).ok);
  assert.ok(path);
  assert.equal(palisadePathHasBuildingClearance(path, all), true);
  assert.equal(palisadePathEnclosesFootprints(path, core), true);
  assert.equal(palisadePathEnclosesFootprints(path, [far]), false);
  assert.equal(palisadeObstacleEnvelopes(grid, core, [], 1).some(candidate =>
    validatePalisadeCandidate(grid, candidate, all, core, 1).ok), false);
  assert.deepEqual(palisadeObstacleEnvelopes(grid, [...core].reverse(), [...all].reverse(), 1), paths);
});

test('an obstacle outside the core boundary changes no candidate coordinates', () => {
  const far = { id: 'manor-house-far', tx: 20, ty: 20, width: 2, height: 2 };
  assert.deepEqual(palisadeObstacleEnvelopes(grid, core, [...core, far], 1), palisadeObstacleEnvelopes(grid, core, core, 1));
});
