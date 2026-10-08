import assert from 'node:assert/strict';
import test from 'node:test';
import { withChapterPetitionAdapter } from '../scripts/registryContextAdapters';

test('chapter adapters lift only implemented filters and retain unknown blockers', () => {
  // Given a chapter petition with both implemented and unknown requirements.
  for (const [id, filters] of [
    ['ck_evt_057', ['church_near_market', 'new_petition_definition_057']],
    ['ck_evt_058', ['new_petition_definition_058']],
  ] as const) {
    const entry = { id, unsupportedFilters: [...filters, 'future_requirement'].map(id => ({ id })),
      recurrence: { contextFields: ['bound.estateId'] }, dedup: { semanticFields: ['bound.instanceId'] } };
    // When the implemented lifecycle adapter is applied.
    const adapted = withChapterPetitionAdapter(entry);
    // Then unrelated blockers survive and identity is the actual bound petition.
    assert.deepEqual(adapted.unsupportedFilters, [{ id: 'future_requirement' }]);
    assert.deepEqual(adapted.recurrence?.contextFields, ['bound.chapterPetition.id']);
    assert.deepEqual(adapted.dedup?.semanticFields, ['bound.chapterPetition.id']);
    assert.equal(entry.unsupportedFilters.length, filters.length + 1);
  }
});

test('chapter adapters leave every other entry unchanged', () => {
  // Given a different entry that happens to name the same missing capability.
  const entry = { id: 'ck_evt_064', unsupportedFilters: [{ id: 'new_petition_definition_058' }] };
  // When adapting an entry outside this module's ownership.
  const adapted = withChapterPetitionAdapter(entry);
  // Then no unrelated filter or object is rewritten.
  assert.equal(adapted, entry);
});
