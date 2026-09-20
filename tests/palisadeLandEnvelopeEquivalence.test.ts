import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import type { PalisadeFootprint, PalisadePath } from '../src/world/palisadeGeometry';
import { palisadeLandEnvelopes } from '../src/world/palisadeLandEnvelope';
import type { TileCoordinate } from '../src/world/grid';

type Fixture = {
  readonly seed: number;
  readonly width: number;
  readonly height: number;
  readonly water: readonly TileCoordinate[];
  readonly footprints: readonly PalisadeFootprint[];
  readonly margin: number;
  readonly paths: readonly PalisadePath[];
};
// Exact outputs captured from the pre-optimization algorithm, including loop order.
const fixtures: readonly Fixture[] = JSON.parse(readFileSync(new URL('./fixtures/palisadeLandEnvelopeEquivalence.json', import.meta.url), 'utf8'));
for (const fixture of fixtures) test(`Given baseline envelope case ${fixture.seed} When filling dry gaps Then paths and ordering stay identical`, () => {
  const water = new Set(fixture.water.map(tile => `${tile.tx},${tile.ty}`));
  const grid = { width: fixture.width, height: fixture.height,
    tiles: Array.from({ length: fixture.width * fixture.height }, (_, index) => {
      const tx = index % fixture.width; const ty = Math.floor(index / fixture.width);
      return { tx, ty, terrain: water.has(`${tx},${ty}`) ? 'water' as const : 'grass' as const, hasRoad: false, buildingId: null };
    }) };
  assert.deepEqual(palisadeLandEnvelopes(grid, fixture.footprints, fixture.margin), fixture.paths);
});
