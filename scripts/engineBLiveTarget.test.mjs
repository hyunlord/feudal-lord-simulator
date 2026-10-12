import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
const targetModule = await import(process.env.EB_TARGET_MODULE ?? './engineBLiveSpeedCapture.mjs');
const spec = JSON.parse(readFileSync(new URL('./engineBLiveTarget206.json', import.meta.url)));
const item = target => ({ name: `${target.entryId}-answer`, pair: { decisionId: target.answerId, source: `registry:${target.entryId}:${target.choiceId}` },
  checkpoint: { state: { tick: target.startTick }, record: { fileSha256: target.inputSha256 } } });
test('default target preserves the accepted005 input identity', () => {
  assert.equal(typeof targetModule.parseLiveTarget, 'function');
  const target = targetModule.parseLiveTarget();
  assert.equal(target.entryId, 'ck_evt_005'); assert.equal(target.answerId, 'h-002653'); assert.equal(target.startTick, 40015);
});
test('206 target selects its exact answer without accepting another choice or save', () => {
  assert.equal(typeof targetModule.selectLiveTarget, 'function');
  const target = targetModule.parseLiveTarget(spec), selected = item(target);
  assert.equal(targetModule.selectLiveTarget([item(targetModule.parseLiveTarget()), selected], target), selected);
  for (const invalid of [{ ...selected, pair: { ...selected.pair, source: 'registry:ck_evt_206:b' } },
    { ...selected, checkpoint: { ...selected.checkpoint, record: { fileSha256: '0'.repeat(64) } } },
    { ...selected, checkpoint: { ...selected.checkpoint, state: { tick: target.startTick + 1 } } }]) {
    assert.throws(() => targetModule.selectLiveTarget([invalid], target), /Wrong target answer/);
  }
});
test('invalid target fields and observation budget overrides fail closed', () => {
  assert.equal(typeof targetModule.parseLiveTarget, 'function');
  for (const invalid of [null, { ...spec, startTick: -1 }, { ...spec, answerId: 'bad' }, { ...spec, inputSha256: 'bad' },
    { ...spec, span: 99999 }, { ...spec, sourceRevision: '0'.repeat(40) }]) assert.throws(() => targetModule.parseLiveTarget(invalid), /Invalid live target/);
});
