import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import catalog from '../src/render/art/catalog.json';
import registration from '../src/render/walkerPilot2.registration.json';
import type { ArtBundle, ArtEntry, ArtRule, WalkerBodyEntry } from '../src/render/art/artContract';
import { ART_REGISTRY } from '../src/render/art/wave42Registry';
import { ArtRegistryError, ArtRegistryStore, createArtRegistry } from '../src/render/art/artRegistry';
import { createWalkerArt } from '../src/render/art/walkerArt';
import { createArtAdapters } from '../src/render/art/artAdapters';
import { walkerSheetManifest, walkerPropDirections } from '../src/render/walkerArtManifest';
import { walkerSheetManifest as legacySheets, walkerPropManifest as legacyProps } from '../src/render/walkerSheetManifest.generated';
import { checkCatalogFiles } from '../scripts/checkArtCatalog';

const bundle = catalog.find(candidate => candidate.bundleId === 'walker-pilot2');
const entries = ART_REGISTRY.entries().filter(entry => entry.kind === 'walker-body' || entry.kind === 'walker-held-prop');
const body = entries.find((entry): entry is WalkerBodyEntry => entry.kind === 'walker-body');
assert.ok(body);
const registeredBody = body;
function ruleFor(entry: ArtEntry): ArtRule {
  assert.ok(entry.kind === 'walker-body' || entry.kind === 'walker-held-prop');
  return { id: `select-${entry.id}`, kind: entry.kind, slot: entry.kind, priority: 0,
    conditions: entry.kind === 'walker-body' ? [{ op: 'eq', field: 'bodyId', value: entry.id }]
      : [{ op: 'eq', field: 'propId', value: entry.propId }, { op: 'eq', field: 'facing', value: entry.direction }],
    variants: [{ assetId: entry.id, weight: 1 }], fallback: 'none' };
}
const typedBundle: ArtBundle = { schemaVersion: 1, bundleId: 'walker-contract-fixture', packId: 'core', entries, rules: entries.map(ruleFor) };
const withBody = (next: WalkerBodyEntry): ArtBundle => ({ ...typedBundle, entries: entries.map(entry => entry.id === next.id ? next : entry) });

test('Given the approved walker20 When the public catalog loads Then every runtime image has explicit core ownership and a usable selector', () => {
  assert.ok(bundle, 'walker20 must enter the common catalog');
  assert.equal(bundle.packId, 'core');
  assert.equal(registration.packId, 'core');
  assert.equal(bundle.entries.length, 20);
  const files = checkCatalogFiles(fileURLToPath(new URL('../', import.meta.url)), [bundle]);
  assert.equal(files.length, 20);
  assert.deepEqual(files.filter(file => !file.samePixels || file.errors.length), []);
  const art = createWalkerArt(ART_REGISTRY);
  assert.equal(art.bodies.filter(entry => entry.provenance.inboxFile.includes("walker-pilot2/")).length, 4);
  assert.equal(art.props.filter(entry => entry.provenance.inboxFile.includes("walker-pilot2/")).length, 16);
  for (const entry of entries) {
    assert.equal(createArtAdapters(ART_REGISTRY, { baseUrl: '/', createImage: null }).placement(entry.id, { at: { x: 0, y: 0 } })?.type, 'walker-composition-source');
    assert.equal(createArtAdapters(ART_REGISTRY, { baseUrl: '/', createImage: null }).image(entry.id), null, 'unloaded art cannot pretend to be ready');
    const bytes = readFileSync(new URL(`../public/${entry.image.url}`, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.provenance.runtimeSha256);
    assert.equal(entry.provenance.sourceSha256, entry.provenance.runtimeSha256);
    assert.deepEqual(bytes, readFileSync(new URL(`../${entry.provenance.inboxFile}`, import.meta.url)));
  }
});

test('Given the final source registration When the common registry feeds the compositor Then all32 cells and16 grips remain unchanged', () => {
  assert.equal(legacySheets.some(sheet => sheet.url.startsWith('assets/walker-pilot2/')), false);
  assert.equal(Object.keys(legacyProps).some(id => id.startsWith('pilot2_')), false);
  for (const source of registration.sheets) {
    assert.deepEqual(walkerSheetManifest.find(sheet => sheet.id === source.id), source);
  }
  for (const [id, directions] of Object.entries(registration.props)) {
    for (const direction of ['NE', 'SE', 'SW', 'NW'] as const) {
      assert.deepEqual(walkerPropDirections(id)[direction], { scale: 0.65, ...directions[direction] });
    }
  }
});

test('Given a non-core pack When identical contracts use the public selector Then the same compositor adapter consumes them without core exceptions', () => {
  const core = createWalkerArt(createArtRegistry([typedBundle]));
  const mod = createWalkerArt(createArtRegistry([{ ...typedBundle, bundleId: 'wardrobe', packId: 'wardrobe' }]));
  assert.deepEqual(mod.bodies, core.bodies);
  assert.deepEqual(mod.props, core.props);
  assert.equal(mod.body('missing'), null);
  assert.equal(mod.prop('missing', 'NE'), null);
});

test('Given open prop identities When an inherited object key is requested Then it remains an unknown prop', () => {
  assert.throws(() => walkerPropDirections('constructor'), /Unknown walker prop/);
});

const invalid: readonly { readonly name: string; readonly bundle: unknown }[] = [
  { name: 'missing consumer selectors', bundle: { ...typedBundle, rules: [] } },
  { name: 'misdirected consumer selectors', bundle: { ...typedBundle, rules: typedBundle.rules.map(rule => ({ ...rule, conditions: [{ op: 'eq', field: rule.kind === 'walker-body' ? 'bodyId' : 'propId', value: 'absent' }] })) } },
  { name: 'missing pack ownership', bundle: { schemaVersion: 1, bundleId: typedBundle.bundleId, entries, rules: typedBundle.rules } },
  { name: 'empty pack identity', bundle: { ...typedBundle, packId: '' } },
  { name: 'duplicate entry identity', bundle: { ...typedBundle, entries: [...entries, registeredBody] } },
  { name: 'duplicate variant refs', bundle: { ...typedBundle, rules: typedBundle.rules.map(rule => ({ ...rule, variants: [...rule.variants, ...rule.variants] })) } },
  { name: 'missing variant ref', bundle: { ...typedBundle, rules: [{ ...ruleFor(registeredBody), variants: [{ assetId: 'absent', weight: 1 }] }] } },
  { name: 'out of cell hand', bundle: withBody({ ...registeredBody, registration: { ...registeredBody.registration, frames: registeredBody.registration.frames.map(frame => ({ ...frame, hands: { ...frame.hands, right: { x: 74, y: 20 } } })) } }) },
  { name: 'wrong frame height', bundle: withBody({ ...registeredBody, registration: { ...registeredBody.registration, frames: registeredBody.registration.frames.map(frame => ({ ...frame, figureHeight: 80 })) } }) },
  { name: 'overflowing normalized frame', bundle: withBody({ ...registeredBody, registration: { ...registeredBody.registration, frames: registeredBody.registration.frames.map(frame => ({ ...frame, figureHeight: Number.MIN_VALUE })) } }) },
  { name: 'duplicate body cell', bundle: withBody({ ...registeredBody, registration: { ...registeredBody.registration, frames: registeredBody.registration.frames.map(frame => ({ ...frame, gaitFrame: 0 })) } }) },
  { name: 'missing prop family', bundle: withBody({ ...registeredBody, registration: { ...registeredBody.registration, propVariants: [{ slot: 'elder', propId: 'absent' }] } }) },
  { name: 'duplicate prop slots', bundle: withBody({ ...registeredBody, registration: { ...registeredBody.registration, propVariants: [...registeredBody.registration.propVariants, ...registeredBody.registration.propVariants] } }) },
  { name: 'duplicate prop directions', bundle: { ...typedBundle, entries: entries.map(entry => entry.kind === 'walker-held-prop' ? { ...entry, direction: 'NE' } : entry) } },
  { name: 'out of canvas prop bounds', bundle: { ...typedBundle, entries: entries.map(entry => entry.kind === 'walker-held-prop' ? { ...entry, opaqueBounds: { x: 0, y: 0, width: 33, height: 32 } } : entry) } },
  { name: 'inconsistent directional scale', bundle: { ...typedBundle, entries: entries.map(entry => entry.kind === 'walker-held-prop' && entry.direction === 'NE' ? { ...entry, scale: 99 } : entry) } },
];
for (const fixture of invalid) test(`Given a working registry When a bundle has ${fixture.name} Then atomic rejection preserves the previous walker selection`, () => {
  const store = new ArtRegistryStore([typedBundle]);
  const previous = store.registry;
  assert.throws(() => store.replace([fixture.bundle]), ArtRegistryError);
  assert.equal(store.registry, previous);
  assert.deepEqual(createWalkerArt(store.registry).body(registeredBody.id), registeredBody);
});
