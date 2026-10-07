import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { decodeSave } from '../src/save/saveCodec';
import { purveyorEpisodes } from '../src/render/purveyorPresentation';
import { ART_REGISTRY } from '../src/render/art/wave42Registry';
import { createArtRegistry } from '../src/render/art/artRegistry';
import catalog from '../src/render/art/catalog.json';

const state = decodeSave(new Uint8Array(gunzipSync(readFileSync('docs/qa/round02/repro/saves/chapter2-war1340.json.gz')))).envelope.state;
test('an actual purchase creates a deterministic road-side presentation without changing the archived save', () => {
  const before = JSON.stringify(state);
  const episodes = purveyorEpisodes(state);
  assert.equal(episodes.length, 1);
  assert.equal(episodes[0]?.id, 'purveyor:ledger-002062');
  assert.deepEqual(purveyorEpisodes(structuredClone(state)), episodes);
  assert.equal(JSON.stringify(state), before);
  for (const episode of episodes) {
    assert.ok(state.tiles.some(tile => tile.hasRoad && tile.tx === episode.logical.tx && tile.ty === episode.logical.ty));
    assert.ok(state.walkers.every(walker => Math.hypot(walker.position.tx - episode.foot.tx, walker.position.ty - episode.foot.ty) >= .5));
  }
});
test('absence, expired/future/negative receipt and deleted granary do not invent a purchaser', () => {
  const { ledger: _ledger, ...withoutLedger } = state;
  assert.deepEqual(purveyorEpisodes(withoutLedger), []);
  assert.deepEqual(purveyorEpisodes({ ...state, tick: 160250 }), []);
  assert.deepEqual(purveyorEpisodes({ ...state, tick: 159999 }), []);
  assert.deepEqual(purveyorEpisodes({ ...state, buildings: state.buildings.filter(b => b.id !== 'construction-site-000024') }), []);
  assert.ok(state.ledger);
  assert.deepEqual(purveyorEpisodes({ ...state, ledger: { ...state.ledger, entries: state.ledger.entries.map(e => ({ ...e, amount: -Math.abs(e.amount) })) } }), []);
});
test('all five originals enter the registry with eight original hand restoration frames', () => {
  const bundle = catalog.find(b => b.bundleId === 'core-wave17-purveyor');
  assert.ok(bundle); assert.equal(bundle.entries.length, 5);
  const body = ART_REGISTRY.entry('wk_royal_purveyor');
  assert.ok(body?.kind === 'walker-body'); assert.equal(body.registration.frames.length, 8);
  for (const frame of body.registration.frames) {
    assert.equal(frame.heldAttachment?.propId, 'wave17_ledger');
    assert.equal(frame.heldAttachment?.restoreHandSize, 3);
  }
  for (const entry of bundle.entries) assert.deepEqual(readFileSync(`public/${entry.image.url}`), readFileSync(entry.provenance.inboxFile));
  const broken = structuredClone(bundle);
  const registered = broken.entries.find(e => e.kind === 'walker-body');
  assert.ok(registered && 'registration' in registered && registered.registration); registered.registration.frames.pop();
  assert.throws(() => createArtRegistry([broken]));
});
test('receipt actor/account and safe road access are required; latest per granary wins', () => {
  assert.ok(state.ledger);
  const receipt = state.ledger.entries.find(e => e.id === 'ledger-002062'); assert.ok(receipt);
  for (const entry of [
    { ...receipt, account: 'in_kind' as const },
    { ...receipt, sourceRefs: [{ type: 'building' as const, id: 'construction-site-000024' }] as const },
  ]) assert.deepEqual(purveyorEpisodes({ ...state, ledger: { ...state.ledger, entries: [entry] } }), []);
  const latest = { ...receipt, id: 'newer-receipt', tick: receipt.tick + 1 };
  const result = purveyorEpisodes({ ...state, ledger: { ...state.ledger, entries: [latest, receipt] } });
  assert.equal(result.length, 1); assert.equal(result[0]?.receiptId, latest.id);
  assert.deepEqual(purveyorEpisodes({ ...state, tiles: state.tiles.map(t => ({ ...t, hasRoad: false })) }), []);
});
test('source registration retains original feet and all eight specific hand grips', () => {
  const body = ART_REGISTRY.entry('wk_royal_purveyor'); assert.ok(body?.kind === 'walker-body');
  const expected = [[61,32],[23,36],[26,31],[17,35],[61,32],[23,36],[26,32],[17,35]];
  for (const [i,frame] of body.registration.frames.entries()) {
    assert.deepEqual([frame.heldAttachment?.grip.x,frame.heldAttachment?.grip.y], expected[i]);
    assert.equal(frame.figureHeight,68);
  }
});
test('invalid authored grip and incomplete directional prop family reject the whole candidate registry', () => {
  const bundle = catalog.find(b => b.bundleId === 'core-wave17-purveyor'); assert.ok(bundle);
  const body = ART_REGISTRY.entry('wk_royal_purveyor'); assert.ok(body?.kind === 'walker-body');
  const bad = { ...body, registration: { ...body.registration, frames: body.registration.frames.map(frame => ({
    ...frame, heldAttachment: { propId: 'wave17_ledger', grip: { x: 0, y: 32 }, restoreHandSize: 3 },
  })) } };
  assert.throws(() => createArtRegistry([{ ...bundle, entries: bundle.entries.map(e => e.id === body.id ? bad : e) }]));
  assert.throws(() => createArtRegistry([{ ...bundle, entries: bundle.entries.filter(e => e.id !== 'held_ledger_nw') }]));
});
