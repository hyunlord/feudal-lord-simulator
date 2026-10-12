// Input identity only: observation budget and engine provenance remain fixed by the capture harness.
const DEFAULT_TARGET = Object.freeze({
  entryId: 'ck_evt_005', choiceId: 'c', answerId: 'h-002653', startTick: 40015,
  inputSha256: '7c01f32f3e48e5cd18229838c322385cb6b48edc6247b5027f19e287b1b31b16',
  manifestSha256: 'e4615d5a01c18d7b6adba9f3eec12c570f0ab14041266e947305674c04e2b93d',
});
export function parseLiveTarget(value = DEFAULT_TARGET) {
  const keys = Object.keys(DEFAULT_TARGET);
  if (value === null || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).length !== keys.length || !keys.every(key => Object.hasOwn(value, key))
    || typeof value.entryId !== 'string' || !/^ck_evt_\d{3}$/.test(value.entryId)
    || typeof value.choiceId !== 'string' || !/^[a-z][a-z0-9_]*$/.test(value.choiceId)
    || typeof value.answerId !== 'string' || !/^h-\d+$/.test(value.answerId)
    || !Number.isSafeInteger(value.startTick) || value.startTick < 0 || value.startTick > Number.MAX_SAFE_INTEGER - 3000
    || !['inputSha256', 'manifestSha256'].every(key => typeof value[key] === 'string' && /^[a-f0-9]{64}$/.test(value[key]))) {
    throw new Error('Invalid live target');
  }
  return Object.freeze({ ...value });
}
export function selectLiveTarget(cases, target) {
  const matches = cases.filter(row => row.name === `${target.entryId}-answer`);
  const item = matches[0];
  if (matches.length !== 1 || item?.pair.decisionId !== target.answerId
    || item.pair.source !== `registry:${target.entryId}:${target.choiceId}`
    || item.checkpoint.state.tick !== target.startTick || item.checkpoint.record.fileSha256 !== target.inputSha256) {
    throw new Error('Wrong target answer');
  }
  return item;
}
