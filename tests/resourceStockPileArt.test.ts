import assert from 'node:assert/strict';
import test from 'node:test';
import { ART_REGISTRY } from '../src/render/art/wave42Registry';

test('approved raw-log summer and winter paintings are registered with native pivot and uniform scale', () => {
  for (const variant of ['a', 'b']) for (const season of ['summer', 'winter']) {
    const entry = ART_REGISTRY.entry(`core-log-stack-${variant}-${season}`);
    assert.ok(entry, 'log painting must be reachable through the shared art registry');
    assert.equal(entry.kind, 'ground-prop');
    assert.ok('geometry' in entry);
    assert.deepEqual(entry.geometry.pivot, { x: 64, y: 108 });
    assert.equal(entry.geometry.scale, 0.3);
    assert.equal(entry.geometry.allowMirror, false);
  }
});

import type { Building } from '../src/content/buildingConfig';
import { createArtRegistry } from '../src/render/art/artRegistry';
import { createResourceStockPileArt } from '../src/render/art/resourceStockPileArt';
import { stockPileLayout } from '../src/render/stockPileLayout';
import { stateCalendar } from '../src/engine/scenarioState';

const home = (kind: Building['kind'] = 'logging_camp', logs = 5, id = 'logging-1'): Building => ({
  id, kind, tx: 10, ty: 12, workers: 3, inventory: { logs }, reserved: {}, stockReserved: {}, productionProgress: 0,
});
const summer = { seed: 4, tick: 1500 };
const winter = { ...summer, tick: 3500 };
const art = createResourceStockPileArt(ART_REGISTRY, { createImage: null, baseUrl: '/' });

test('only supported buildings with actual positive raw logs choose a pile', () => {
  assert.equal(stateCalendar(summer).season, 1);
  assert.equal(stateCalendar(winter).season, 3);
  for (const kind of ['logging_camp', 'sawmill'] as const) {
    assert.ok(art.select(summer, home(kind, 1)));
    assert.equal(art.select(summer, home(kind, 0)), null);
    assert.equal(art.select(summer, { ...home(kind), inventory: { timber: 20 } }), null);
  }
  assert.equal(art.select(summer, home('house')), null);
  assert.equal(art.select(summer, home('storehouse')), null);
});

test('ID chooses both authored variants reproducibly and keeps that variant across seasons and stock changes', () => {
  const seen = new Set<string>();
  for (let i = 0; i < 16; i++) {
    const building = home('logging_camp', 1, `logging-${i}`);
    const warm = art.select(summer, building), cold = art.select(winter, building);
    assert.ok(warm && cold);
    assert.equal(warm.season, 'summer'); assert.equal(cold.season, 'winter');
    assert.equal(warm.id.replace('-summer', ''), cold.id.replace('-winter', ''));
    assert.equal(art.select(summer, { ...building, inventory: { logs: 20 } })?.id, warm.id);
    assert.equal(art.select(summer, building)?.id, warm.id);
    seen.add(warm.id);
  }
  assert.equal(seen.size, 2);
  for (const tick of [500, 2500]) assert.equal(art.select({ ...summer, tick }, home())?.season, 'summer');
});

test('native pivot is placed on the existing door, with identical x/y scale', () => {
  const building = home(); const entry = art.select(summer, building); assert.ok(entry);
  const { door } = stockPileLayout(building);
  const placement = art.placement(entry.id, { at: door }); assert.ok(placement?.type === 'blit');
  assert.deepEqual(placement.sourceRect, { x: 0, y: 0, width: 128, height: 128 });
  assert.deepEqual(placement.targetRect, { x: door.x - 19.2, y: door.y - 32.4, width: 38.4, height: 38.4 });
});

test('no catalogue, browser-unavailable and failed image keep the prior no-extra-pile fallback', async () => {
  const context = { getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }), save() {}, restore() {}, drawImage: () => { throw new Error('no image must draw'); }, imageSmoothingEnabled: false };
  const empty = createResourceStockPileArt(createArtRegistry([]), { createImage: null, baseUrl: '/' });
  assert.equal(empty.draw(context, summer, home(), stockPileLayout(home()).door), false);
  assert.equal(art.draw(context, summer, home(), stockPileLayout(home()).door), false);
  const image: HTMLImageElement = Object.assign(Object.create(null), { src: '', onload: null, onerror: null, naturalWidth: 128, naturalHeight: 128, decode: () => Promise.resolve() });
  const failed = createResourceStockPileArt(ART_REGISTRY, { createImage: () => image, baseUrl: '/' });
  assert.equal(failed.draw(context, summer, home(), stockPileLayout(home()).door), false);
  image.onerror?.call(image, new Event('error'));
  const selected = failed.select(summer, home()); assert.ok(selected);
  assert.equal((await failed.loadSettled(selected.id)).status, 'missing');
  assert.equal(failed.draw(context, summer, home(), stockPileLayout(home()).door), false);
});

test('the shared adapter draws exactly one ready image at the declared anchor and zero images when stock empties', async () => {
  const image: HTMLImageElement = Object.assign(Object.create(null), { src: '', onload: null, onerror: null, naturalWidth: 128, naturalHeight: 128, decode: () => Promise.resolve() });
  const ready = createResourceStockPileArt(ART_REGISTRY, { createImage: () => image, baseUrl: '/' });
  const calls: unknown[][] = [];
  const context = { imageSmoothingEnabled: false, save() {}, restore() {}, drawImage: (...args: unknown[]) => { calls.push(args); }, getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }) };
  const building = home(), at = stockPileLayout(building).door;
  assert.equal(ready.draw(context, summer, building, at), false);
  image.onload?.call(image, new Event('load'));
  const selected = ready.select(summer, building); assert.ok(selected);
  assert.equal((await ready.loadSettled(selected.id)).status, 'ready');
  assert.equal(ready.draw(context, summer, building, at), true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.[0], image);
  assert.deepEqual(calls[0]?.slice(1, 5), [0, 0, 128, 128]);
  assert.equal(ready.draw(context, summer, home('logging_camp', 0), at), false);
  assert.equal(calls.length, 1);
});

test('selection never starts unrelated catalogue images, and a positive draw requests only its chosen stock picture', () => {
  const requested: string[] = [];
  const isolated = createResourceStockPileArt(ART_REGISTRY, { baseUrl: '/', createImage: () => {
    const image: HTMLImageElement = Object.assign(Object.create(null), { onload: null, onerror: null, naturalWidth: 128, naturalHeight: 128, decode: () => Promise.resolve() });
    Object.defineProperty(image, 'src', { set: (value: string) => { requested.push(value); } });
    return image;
  } });
  const context = { getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }), save() {}, restore() {}, drawImage() {}, imageSmoothingEnabled: false };
  assert.deepEqual(requested, []);
  assert.ok(isolated.select(summer, home()));
  assert.equal(isolated.draw(context, summer, home('house'), { x: 0, y: 0 }), false);
  assert.equal(isolated.draw(context, summer, home('sawmill', 0), { x: 0, y: 0 }), false);
  assert.deepEqual(requested, []);
  assert.equal(isolated.draw(context, summer, home(), { x: 0, y: 0 }), false);
  assert.equal(requested.length, 1);
  assert.match(requested[0] ?? '', /wave42\/regrowth\/log_stack_[ab]_summer.png$/);
});

import catalog from '../src/render/art/catalog.json';
import { checkCatalogFiles } from '../scripts/checkArtCatalog';
test('all four installed source canvases, pixels and hashes match their approved contract', () => {
  const bundle = catalog.find(candidate => candidate.bundleId === 'core-wave42-log-stockpiles'); assert.ok(bundle);
  const checked = checkCatalogFiles(process.cwd(), [bundle]);
  assert.equal(checked.length, 4);
  assert.ok(checked.every(row => row.errors.length === 0), JSON.stringify(checked));
});
