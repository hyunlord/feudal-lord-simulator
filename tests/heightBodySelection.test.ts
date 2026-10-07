import { assetUrlForBase } from '../src/render/worldAssets';
import { selectedLegacyHouseUrl } from '../src/render/historicalHouseAssets';
import assert from 'node:assert/strict';
import test from 'node:test';
import type { ArtBundle, BuildingBodyEntry } from '../src/render/art/artContract';
import { createArtRegistry } from '../src/render/art/artRegistry';
import { createContractHouseArt } from '../src/render/art/contractHouseArt';
import { DEFAULT_GAME_STATE } from '../src/state/gameStore';
import { tileToScreen, TILE_H } from '../src/render/iso';
import { BALANCE } from '../src/content/balanceConfig';

const building = DEFAULT_GAME_STATE.buildings.find(entry => entry.kind === 'house');
assert.ok(building);
const body: BuildingBodyEntry = {
  id: 'registered-body', kind: 'building-body', image: { url: 'assets/test/registered.png', width: 153, height: 153 },
  provenance: { inboxFile: 'assets-inbox/test/registered.png', sourceSha256: 'a'.repeat(64), runtimeSha256: 'b'.repeat(64) },
  geometry: { pivot: { x: 77.35406698564593, y: 139.57894736842104 }, scale: 0.49957049486461247, allowMirror: false },
  buildingKinds: ['house'], levels: [0], variantId: 'registered',
};
const legacyUrl = 'assets/buildings/historical-houses/house_l0-v3.png';
const bundle: ArtBundle = { schemaVersion: 1, bundleId: 'registered-test', entries: [body], rules: [{
  id: 'registered-rule', kind: 'building-body', slot: 'house-body', priority: 0,
  conditions: [{ op: 'eq', field: 'legacyBodyUrl', value: legacyUrl }],
  variants: [{ assetId: body.id, weight: 1 }], fallback: 'none',
}] };
const input = { state: DEFAULT_GAME_STATE, building, level: 0, legacyBodyUrl: legacyUrl };

test('only the already selected legacy body receives its registered replacement', () => {
  const art = createContractHouseArt(createArtRegistry([bundle]));
  const before = JSON.stringify(input.state);
  assert.equal(art.select(input)?.id, body.id);
  assert.equal(art.select({ ...input, legacyBodyUrl: 'assets/wave26/house/house_l0_c.png' }), null);
  assert.equal(art.select({ ...input, legacyBodyUrl: 'assets/buildings/variants-wave2/house_l0_garden-v1.png' }), null);
  assert.equal(art.select({ state: input.state, building, level: 0 }), null);
  assert.equal(JSON.stringify(input.state), before);
});

test('a lower-priority legacy replacement cannot take over the existing era contract', () => {
  const era: ArtBundle = { ...bundle, bundleId: 'era-test', entries: [{ ...body, id: 'era-body' }], rules: [{
    id: 'era-rule', kind: 'building-body', slot: 'house-body', priority: 10,
    conditions: [{ op: 'range', field: 'calendarYear', min: 1350 }],
    variants: [{ assetId: 'era-body', weight: 1 }], fallback: 'none',
  }] };
  const art = createContractHouseArt(createArtRegistry([bundle, era]));
  assert.equal(art.select({ ...input, state: { ...input.state, tick: 50 * BALANCE.TICKS_PER_YEAR } })?.id, 'era-body');
});

for (const layer of ['fresh', 'weathered'] as const) {
  test(`registered ${layer} uses the existing house age policy and atomic loader`, () => {
    const house = DEFAULT_GAME_STATE.houses.find(entry => entry.buildingId === building.id);
    assert.ok(house);
    const layered: ArtBundle = { ...bundle, entries: [...bundle.entries, {
      id: layer, kind: 'state-overlay', image: body.image, provenance: body.provenance, geometry: body.geometry,
      targetBodyIds: [body.id], layer, transform: 'inherit-body', order: 0,
    }], rules: [...bundle.rules, { id: `${layer}-rule`, kind: 'state-overlay', slot: `house-${layer}`, priority: 0,
      conditions: [{ op: 'eq', field: 'bodyId', value: body.id }], variants: [{ assetId: layer, weight: 1 }], fallback: 'none' }] };
    const requested: HTMLImageElement[] = [];
    const art = createContractHouseArt(createArtRegistry([layered]), { baseUrl: '/', createImage: () => {
      const image: HTMLImageElement = Object.create(null);
      Object.assign(image, { naturalWidth: 153, naturalHeight: 153 }); requested.push(image); return image;
    } });
    const state = { ...DEFAULT_GAME_STATE, tick: 0, houses: [{ ...house,
      residents: layer === 'fresh' ? 0 : 4, ...(layer === 'weathered' ? { foodShortSinceTick: 0 } : {}) }] };
    assert.equal(art.ready({ ...input, state }), false);
    assert.equal(requested.length, 2, 'the selected age layer must load with the body');
    assert.ok(requested.some(image => image.src.endsWith('registered.png')));
  });
}

test('a registered roof point follows the full body crop and waits for that body', async () => {
  const registered: ArtBundle = { ...bundle, entries: [{ ...body, roofRidge: { x: 82, y: 28 } }] };
  const images: HTMLImageElement[] = [];
  const art = createContractHouseArt(createArtRegistry([registered]), { baseUrl: '/', createImage: () => {
    const image: HTMLImageElement = Object.create(null);
    Object.assign(image, { naturalWidth: 153, naturalHeight: 153, decode: () => Promise.resolve() }); images.push(image); return image;
  } });
  assert.equal(art.roofPoint(input), null);
  const image = images[0]; assert.ok(image);
  image.onload?.call(image, new Event('load')); await Promise.resolve();
  const point = art.roofPoint(input); assert.ok(point);
  const center = tileToScreen(building.tx, building.ty);
  assert.equal(point.x, center.sx + (82 - body.geometry.pivot.x) * body.geometry.scale);
  assert.equal(point.y, center.sy + TILE_H / 2 + (28 - body.geometry.pivot.y) * body.geometry.scale);
});

test('roof registration outside its body canvas is rejected', () => {
  assert.throws(() => createArtRegistry([{ ...bundle, entries: [{ ...body, roofRidge: { x: 154, y: 28 } }] }]), /Roof ridge/);
});

test('base house selection uses its canonical URL rather than the deployment-prefixed preload URL', () => {
  assert.equal(selectedLegacyHouseUrl(building, 0), legacyUrl);
});

for (const base of ['/', '/game/']) test('canonical base-house selection ignores loader prefix '+base, () => {
  const logical = selectedLegacyHouseUrl(building, 0); assert.equal(logical, legacyUrl); assert.ok(logical);
  assert.equal(assetUrlForBase(legacyUrl, base), base + legacyUrl);
  const art = createContractHouseArt(createArtRegistry([bundle]));
  assert.equal(art.select({ ...input, legacyBodyUrl: logical })?.id, body.id);
});
