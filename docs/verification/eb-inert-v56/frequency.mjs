import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';

const [root] = process.argv.slice(2);
assert.ok(root, 'A finished cohort directory is required');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const read = file => {
  const bytes = readFileSync(file);
  return { file, sha256: sha(bytes), data: JSON.parse(file.endsWith('.gz') ? gunzipSync(bytes) : bytes) };
};
const baseline = read('docs/verification/eb-tlink-four-categories/official-71bc336/report.json.gz');
const standing = read('docs/verification/eb-inert-standing/official-125/categories.json.gz');
const current = read(join(root, 'categories.json'));
const count = (report, seed) => {
  const rows = report.answers.filter(row => seed === null || row.seed === seed);
  const counts = new Map();
  for (const row of rows) {
    const source = row.source.replace(/^(audit:(?:tolerate|replace):)[^:]+$/, '$1*')
      .replace(/^(steward_punished:)[^:]+$/, '$1*');
    counts.set(source, (counts.get(source) ?? 0) + 1);
  }
  assert.equal([...counts.values()].reduce((a, b) => a + b, 0), rows.length);
  return counts;
};
const tables = [null, 1, 2, 3].map(seed => {
  const a = count(baseline.data, seed), b = count(standing.data, seed), c = count(current.data, seed);
  const rows = [...new Set([...a.keys(), ...b.keys(), ...c.keys()])].sort().map(source => ({ source,
    baseline: a.get(source) ?? 0, standing: b.get(source) ?? 0, integrated: c.get(source) ?? 0,
    deltaBaseline: (c.get(source) ?? 0) - (a.get(source) ?? 0), deltaStanding: (c.get(source) ?? 0) - (b.get(source) ?? 0) }));
  return { seed, rows, petitions: rows.filter(row => /^(estate_petition|manor_petition|petition):/.test(row.source)) };
});
const replacementAnswers = [];
for (const seed of [1, 2, 3]) {
  const directory = join(root, 'capture', `seed-${seed}`);
  const manifest = read(join(directory, 'manifest.json')).data;
  assert.equal(manifest.commandStreamMatched, true);
  assert.equal(manifest.fullFinalStateMatched, true);
  for (const pin of manifest.files) {
    const capture = read(join(directory, pin.file));
    assert.equal(capture.sha256, pin.sha256);
    const row = capture.data;
    if (row.command.type !== 'answer_estate_petition') continue;
    const petitions = row.before.stewardship?.petitions ?? [];
    const petition = petitions.find(item => item.id === row.command.petitionId);
    assert.ok(petition, 'Answered petition missing from before state');
    const preceding = petitions.find(item => item.kind === 'charter_request' && item.precedent === true
      && item.decidedBy === 'steward' && item.status === 'refused' && item.amount === 0
      && item.estateId === petition.estateId && item.tick === petition.tick);
    if (preceding) replacementAnswers.push({ seed, answerId: row.historyId, answerTick: row.tick,
      petitionId: petition.id, kind: petition.kind, estateId: petition.estateId, creationTick: petition.tick,
      precedingPetitionId: preceding.id, captureFile: capture.file, captureSha256: capture.sha256 });
  }
}
writeFileSync(join(root, 'frequency-detail.json'), `${JSON.stringify({
  sources: [baseline, standing, current].map(({ file, sha256 }) => ({ file, sha256 })),
  tables, replacementAnswers,
  limitations: ['Independent cohorts also differ in growth rules; aggregate changes are not a controlled causal estimate.',
    'Replacement evidence covers captured lord answers, not a census of all steward-handled seasonal petitions.'],
}, null, 2)}\n`, { flag: 'wx' });
