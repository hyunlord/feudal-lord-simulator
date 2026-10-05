import assert from 'node:assert/strict';
import test from 'node:test';
import baseline from './fixtures/field-texture-migration.json';
import { createArtRegistry } from '../src/render/art/artRegistry';
import { createFieldTextureArt, fieldTextureToken, type FieldTextureJoin } from '../src/render/art/fieldTextureArt';

// Synthetic selection aliases of actual existing PNGs: no new art or installation claim.
function fixture(sameSource = false) {
  const source = baseline.entries[0]; assert.ok(source);
  const entries = ['spring-a', 'spring-b'].map(id => ({ ...source, id, composition: { ...source.composition, wash: 'none' } }));
  return { ...baseline, entries: [...baseline.entries, ...entries], rules: [...baseline.rules, ...['a', 'b'].map(side => ({
    id: `spring-${side}-rule`, kind: 'ground-texture', slot: `field-ridge-season-${side}`, priority: 0,
    conditions: [{ op: 'eq', field: 'fieldState', value: 'ploughed' }, { op: 'eq', field: 'season', value: 'spring' }],
    variants: [{ assetId: sameSource ? 'spring-a' : `spring-${side}`, weight: 1 }], fallback: 'none',
  }))] };
}
const spring = { fieldState: 'ploughed', season: 'spring' } as const;
const winter = { fieldState: 'ploughed', season: 'winter' } as const;
function harness(sameSource = false) {
  const images: HTMLImageElement[] = [];
  const byId = new Map<string, HTMLImageElement>();
  const joined: string[][] = [];
  let failJoin: false | 'seasonal' | 'all' = false;
  let failureReason = 'scratch unavailable';
  const join: FieldTextureJoin = (pair, entry, report) => {
    joined.push(pair.map(image => image.alt));
    if (failJoin === 'all' || (failJoin === 'seasonal' && entry.composition.wash === 'none')) { report(failureReason); return null; }
    return Object.assign(Object.create(null), { width: 1024, height: 64, label: pair.map(image => image.alt).join('|') });
  };
  const registry = createArtRegistry([fixture(sameSource)]);
  const art = createFieldTextureArt(registry, { baseUrl: '/', createImage: () => {
    const image: HTMLImageElement = Object.assign(Object.create(null), { naturalWidth: 512, naturalHeight: 64, src: '', alt: '', onload: null, onerror: null, decode: () => Promise.resolve() });
    images.push(image); return image;
  } }, join);
  // Model zone preload scheduling: one lazy image owner, even with concurrent prepare and loadSettled calls.
  for (const entry of registry.entries()) {
    art.image(entry.id); const image = images.at(-1); assert.ok(image); image.alt = entry.id; byId.set(entry.id, image);
  }
  return { art, images, joined, fail(value: boolean | 'all', reason = 'scratch unavailable') { failJoin = value === true ? 'seasonal' : value; failureReason = reason; }, async ready(...ids: string[]) {
    for (const id of ids) { const image = byId.get(id); assert.ok(image); image.onload?.call(image, new Event('load')); await art.loadSettled(id); }
  }, missing(id: string) { const image = byId.get(id); assert.ok(image); image.onerror?.call(image, new Event('error')); } };
}
test('atomic fallback token stays stable until both seasonal sources and composition are ready', async () => {
  const h = harness(); const blank = h.art.prepare([spring]); assert.equal(fieldTextureToken(blank, spring), '');
  await h.ready('ridge_ploughed_a', 'ridge_ploughed_b');
  const fallback = h.art.prepare([spring]); assert.equal(fallback.get(spring)?.composition.wash, 'legacy-stage');
  assert.deepEqual(fallback.get(spring)?.sourceIds, ['ridge_ploughed_a', 'ridge_ploughed_b']);
  await h.ready('spring-a'); const half = h.art.prepare([spring]); assert.equal(fieldTextureToken(half, spring), fieldTextureToken(fallback, spring));
  await h.ready('spring-b'); h.fail(true);
  const failed = h.art.prepare([spring, spring]); assert.equal(fieldTextureToken(failed, spring), fieldTextureToken(fallback, spring));
  assert.equal(h.art.compositionFailures().length, 1);
  // Next frame preparation runs even when the previous chunk was cached; token/draw merely read their captured snapshot.
  h.fail(false); const recovered = h.art.prepare([spring]); const texture = recovered.get(spring); assert.ok(texture);
  assert.equal(texture.composition.wash, 'none'); assert.notEqual(texture.token, fieldTextureToken(fallback, spring));
  assert.equal(fieldTextureToken(failed, spring), fieldTextureToken(fallback, spring));
  const joins = h.joined.length; assert.equal(recovered.get(spring), texture); fieldTextureToken(recovered, spring); assert.equal(h.joined.length, joins);
  assert.equal(h.art.prepare([spring]).get(spring), texture); assert.equal(h.images.length, 6);
});
test('requested-season staging and actual turn share output identity; unrelated states stay empty', async () => {
  const h = harness(); await h.ready('ridge_ploughed_a', 'ridge_ploughed_b', 'spring-a', 'spring-b');
  const staged = h.art.prepare([winter, spring]); const turn = h.art.prepare([spring]);
  assert.equal(fieldTextureToken(staged, spring), fieldTextureToken(turn, spring));
  assert.notEqual(fieldTextureToken(staged, winter), fieldTextureToken(staged, spring));
  for (const fieldState of ['road', 'growing', 'fallow', 'harvested']) {
    const request = { fieldState, season: 'spring' } as const;
    assert.equal(h.art.resolve(request), null); assert.equal(fieldTextureToken(h.art.prepare([request]), request), '');
  }
});
test('A|A keeps ordered repeated source and missing seasonal images never retry requests', async () => {
  const h = harness(true); await h.ready('spring-a');
  const snapshot = h.art.prepare([spring]); assert.deepEqual(snapshot.get(spring)?.sourceIds, ['spring-a', 'spring-a']);
  assert.deepEqual(h.joined, [['spring-a', 'spring-a']]);
  const failed = harness(); await failed.ready('ridge_ploughed_a', 'ridge_ploughed_b', 'spring-a'); failed.missing('spring-b');
  const count = failed.images.length;
  for (let frame = 0; frame < 3; frame++) assert.equal(failed.art.prepare([spring]).get(spring)?.composition.wash, 'legacy-stage');
  assert.equal(failed.images.length, count); assert.equal(failed.joined.length, 1);
});
test('an empty field registry and absent Image settle without inventing ready textures', async () => {
  const empty = createFieldTextureArt(createArtRegistry([]), { baseUrl: '/', createImage: null });
  assert.equal(empty.resolve(spring), null); assert.equal(empty.prepare([spring]).get(spring), null);
  assert.equal((await empty.loadSettled('unknown')).status, 'unavailable');
  const unavailable = createFieldTextureArt(createArtRegistry([baseline]), { baseUrl: '/', createImage: null });
  assert.equal(unavailable.prepare([spring]).get(spring), null);
  assert.equal((await unavailable.loadSettled('ridge_ploughed_a')).status, 'unavailable');
});

test('base composition failure remains empty for a frame and recovers on the next preparation', async () => {
  const h = harness(); await h.ready('ridge_ploughed_a', 'ridge_ploughed_b'); h.fail('all');
  const failed = h.art.prepare([winter, spring]);
  assert.equal(failed.get(winter), null); assert.equal(failed.get(spring), null);
  assert.equal(h.joined.length, 1); assert.equal(h.art.compositionFailures().length, 1);
  h.fail(false); const recovered = h.art.prepare([winter]);
  assert.equal(recovered.get(winter)?.composition.wash, 'legacy-stage');
  assert.equal(fieldTextureToken(failed, winter), ''); assert.notEqual(fieldTextureToken(recovered, winter), '');
  assert.equal(h.joined.length, 2);
});

test('persistent composition failure retains one latest diagnostic per pair while retrying and recovering', async () => {
  const h = harness(); await h.ready('ridge_ploughed_a', 'ridge_ploughed_b'); h.fail('all');
  for (let frame = 0; frame < 100; frame++) assert.equal(h.art.prepare([winter]).get(winter), null);
  assert.equal(h.joined.length, 100); assert.equal(h.art.compositionFailures().length, 1);
  assert.equal(h.art.compositionFailures()[0]?.reason, 'scratch unavailable');
  h.fail('all', 'main unavailable'); h.art.prepare([winter]);
  assert.equal(h.art.compositionFailures().length, 1);
  assert.equal(h.art.compositionFailures()[0]?.reason, 'main unavailable');
  h.fail(false); assert.ok(h.art.prepare([winter]).get(winter));
  assert.equal(h.joined.length, 102); assert.equal(h.images.length, 6);
  assert.equal(h.art.compositionFailures().length, 1);
});
