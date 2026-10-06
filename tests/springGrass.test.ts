import assert from 'node:assert/strict';
import test from 'node:test';
import { MAP_ARCHETYPE_IDS, RIVERSIDE_ARCHETYPE_ID } from '../src/content/scenario/archetypes';
import { riversideSpringGrass, springGrassChunkToken } from '../src/render/springGrass';
import { SPRING_WORLD_ART } from '../src/render/art/springWorldArt';
import { ART_REGISTRY } from '../src/render/art/wave42Registry';
import { isSpringWorldEntry } from '../src/render/art/springWorldValidation';

const legacy = { scenarioId: 'core:campaign_market_town' };

test('spring grass belongs to the riverside, including legacy saves resolved through their scenario', () => {
  assert.equal(riversideSpringGrass(legacy, 0), true);
  assert.equal(riversideSpringGrass({ ...legacy, archetypeId: RIVERSIDE_ARCHETYPE_ID }, 0), true);
});

test('other lands and non-spring seasons keep their existing ground pictures', () => {
  for (const archetypeId of MAP_ARCHETYPE_IDS.filter(id => id !== RIVERSIDE_ARCHETYPE_ID)) {
    assert.equal(riversideSpringGrass({ ...legacy, archetypeId }, 0), false, archetypeId);
  }
  for (const season of [1, 2, 3] as const) assert.equal(riversideSpringGrass(legacy, season), false);
  assert.equal(riversideSpringGrass(undefined, 0), false);
});

test('riverside spring chunk changes its key once the optional source is decoded', () => {
  const entry = ART_REGISTRY.entries().filter(isSpringWorldEntry).find(value => value.role === 'riverside-grass');
  assert.ok(entry);
  const original = SPRING_WORLD_ART.select;
  try {
    SPRING_WORLD_ART.select = () => null;
    const loading = springGrassChunkToken(legacy, 0);
    SPRING_WORLD_ART.select = () => entry;
    const ready = springGrassChunkToken(legacy, 0);
    assert.notEqual(loading, ready);
    assert.equal(ready, springGrassChunkToken(legacy, 0));
    assert.equal(springGrassChunkToken(legacy, 1), '');
    const otherLand = MAP_ARCHETYPE_IDS.find(id => id !== RIVERSIDE_ARCHETYPE_ID);
    assert.ok(otherLand);
    assert.equal(springGrassChunkToken({ ...legacy, archetypeId: otherLand }, 0), '');
  } finally { SPRING_WORLD_ART.select = original; }
});
