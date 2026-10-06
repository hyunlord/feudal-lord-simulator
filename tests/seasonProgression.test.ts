import assert from 'node:assert/strict';
import test from 'node:test';
import { storehouseSnowNow } from '../src/render/storehouseSnowArt';
import { resetSeasonBlendForTest } from '../src/render/seasonTransition';

test('a roof has not already accumulated full snow at the first winter tick', () => {
  // Given: a roof at the beginning of the actual calendar winter.
  resetSeasonBlendForTest();
  // When: its seasonal snow visibility is queried.
  const visible = storehouseSnowNow({ tick: 3000 }, { tx: 10, ty: 12 });
  // Then: its gradual accumulation has not started yet.
  assert.equal(visible, false);
});

import { calendarProgress } from '../src/render/calendarProgress';
import { roofSnowAlpha, treeProgression, parseProgressionProfiles } from '../src/render/seasonProgression';
import profiles from '../src/render/seasonProgression.json';

test('same saved tick and identity reconstruct snow without wall-clock or seen-season state', () => {
  const state = { tick: 3200 }; const roof = { id: 'roof-a', tx: 10, ty: 12 };
  const first = roofSnowAlpha(state, roof);
  resetSeasonBlendForTest();
  assert.equal(roofSnowAlpha(JSON.parse(JSON.stringify(state)), roof), first);
  assert.ok(first > 0 && first < 1);
});
test('neighbouring roofs vary but monotonically accumulate until full winter snow', () => {
  const roofs = Array.from({ length: 10 }, (_, i) => ({ id: `roof-${i}`, tx: i, ty: 8 }));
  assert.ok(new Set(roofs.map(roof => roofSnowAlpha({ tick: 3200 }, roof))).size > 1);
  for (const roof of roofs) {
    const values = [3000, 3200, 3400, 3600, 3800].map(tick => roofSnowAlpha({ tick }, roof));
    assert.equal(values[0], 0); assert.equal(values[4], 1);
    assert.deepEqual(values, [...values].sort((a, b) => a - b));
  }
});
test('tree identity creates mixed complete autumn paintings at the same actual tick', () => {
  const progress = calendarProgress({ tick: 2400 });
  const selected = Array.from({ length: 20 }, (_, i) => treeProgression(progress, `tree-${i}`));
  assert.deepEqual([...new Set(selected.map(x => x.season))].sort(), [1, 2]);
});
test('one malformed time window rejects the complete timing profile', () => {
  assert.equal(parseProgressionProfiles({ ...profiles, roofSnow: { start: 0.8, end: 0.2, jitter: 0 } }), null);
  assert.equal(parseProgressionProfiles({ ...profiles, treeBare: { start: 0, end: 0.6, jitter: 0 } }), null);
});
test('the first spring has no previous winter roof snow', () => {
  assert.equal(roofSnowAlpha({ tick: 1 }, { id: 'new', tx: 1, ty: 1 }), 0);
});
test('established roofs keep snow across the spring boundary then melt at distinct stable phases', () => {
  const roofs = Array.from({ length: 10 }, (_, i) => ({ id: `roof-${i}`, tx: i, ty: 8 }));
  for (const roof of roofs) {
    const values = [3999, 4000, 4050, 4100, 4200, 4250].map(tick => roofSnowAlpha({ tick }, roof));
    assert.equal(values[0], 1);
    assert.equal(values[1], 1);
    assert.equal(values.at(-1), 0);
    assert.deepEqual(values, [...values].sort((a, b) => b - a));
  }
  assert.ok(new Set(roofs.map(roof => roofSnowAlpha({ tick: 4100 }, roof))).size > 1);
});

import { drawTreeDescriptor } from '../src/render/drawTrees';
import { setSeasonArtForTest } from '../src/render/seasonArt';
import { recordingCanvas } from '../scripts/recordingCanvas';
import { SEMANTIC_PALETTE } from '../src/content/palette';

test('the actual tree consumer paints one complete snow variant at the same anchored foot', () => {
  // Given: loaded season artwork and one real tree descriptor, with a midwinter calendar.
  setSeasonArtForTest(key => {
    const image: HTMLImageElement = Object.create(null);
    Object.assign(image, { width: 96, height: 128, label: key });
    return image;
  });
  const target = recordingCanvas(1280, 800);
  const tree = { id: 'tree-oak-1', x: 320, y: 160, offsetX: 0, offsetY: 0, scale: 1,
    silhouette: 'broad', tone: SEMANTIC_PALETTE.forest, phase: 0, sortY: 160,
    anchorTx: 10, anchorTy: 0, spriteKey: 'tree_oak_large', flipX: false } as const;
  try {
    // When: drawing through the production tree consumer.
    drawTreeDescriptor(target.context, { tree, nowMs: 0, zoom: 1, spriteOptions: {},
      season: { season: 3, from: null, t: 1, calendar: calendarProgress({ tick: 3800 }) } });
    // Then: no crossfade/double-paint is introduced.
    assert.equal(target.canvas.ops.filter(op => op.startsWith('drawImage(')).length, 1);
    assert.ok(target.canvas.ops.some(op => op.includes('tree_oak_large_winter_snow')));
  } finally { setSeasonArtForTest(null); }
});

test('an unknown image reference rejects all profiles rather than inventing a second registry', () => {
  assert.equal(parseProgressionProfiles({ ...profiles, winterStages: { ...profiles.winterStages, tree_oak_large: { bare: 'missing', snow: null } } }), null);
});
test('winter stages reject incomplete, array and unknown-base contracts atomically', () => {
  for (const winterStages of [[], {}, { tree_oak_large: profiles.winterStages.tree_oak_large },
    { ...profiles.winterStages, ghost: { bare: null, snow: null } },
    { ...profiles.winterStages, tree_oak_large: { bare: null, snow: null } }]) {
    assert.equal(parseProgressionProfiles({ ...profiles, winterStages }), null);
  }
  assert.notEqual(parseProgressionProfiles(profiles), null);
});
test('the first spring tree never borrows a prior winter picture', () => {
  assert.deepEqual(treeProgression(calendarProgress({ tick: 1 }), 'tree-oak-1', true), { season: 0, snowy: false });
});

test('all roofs are fully accumulated by midwinter, including the reported 1305 save tick', () => {
  for (const tick of [3340, 23450]) for (let index = 0; index < 1000; index += 1) {
    assert.equal(roofSnowAlpha({ tick }, { id: `roof-${index}`, tx: index % 64, ty: Math.floor(index / 64) }), 1);
  }
});
test('leaf fall spans late autumn and early winter but every tree is bare before midwinter', () => {
  const identities = Array.from({ length: 1000 }, (_, index) => `tree-${index}`);
  const count = (tick: number) => identities.filter(id => treeProgression(calendarProgress({ tick }), id).season === 3).length;
  assert.equal(count(2800), 0);
  assert.ok(count(2920) > 0 && count(2920) < identities.length);
  assert.ok(count(3000) > count(2920) && count(3000) < identities.length);
  assert.equal(count(3080), identities.length);
  assert.equal(count(23450), identities.length);
  for (const id of identities) assert.equal(treeProgression(calendarProgress({ tick: 3340 }), id).snowy, true);
});
test('only leaf-fall may begin before the winter boundary and autumn colour precedes leaf-fall', () => {
  assert.notEqual(parseProgressionProfiles({ ...profiles, treeBare: { start: -0.12, end: 0.08, jitter: 0 } }), null);
  assert.equal(parseProgressionProfiles({ ...profiles, roofSnow: { start: -0.12, end: 0.3, jitter: 0 } }), null);
  assert.equal(parseProgressionProfiles({ ...profiles, treeBare: { start: -0.8, end: 0.08, jitter: 0 } }), null);
});
