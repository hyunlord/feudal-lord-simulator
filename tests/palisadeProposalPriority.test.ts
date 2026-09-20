import assert from 'node:assert/strict';
import test from 'node:test';
import { createGrowthOpening } from '../scripts/phase21OpeningTranslation';
import { palisadeFootprintsForState } from '../src/engine/palisadeFootprints';
import { computePalisadeProposal, validatePalisadeCandidate } from '../src/world/palisadeGeometry';

function grownOpening() {
  const state = createGrowthOpening(3).state;
  const footprints = [...palisadeFootprintsForState(state),
    { id: 'construction-site-000001', tx: 11, ty: 4, width: 1, height: 1 },
    { id: 'construction-site-000002', tx: 9, ty: 8, width: 2, height: 2 },
    { id: 'construction-site-000003', tx: 9, ty: 5, width: 1, height: 1 },
    { id: 'construction-site-000004', tx: 12, ty: 6, width: 1, height: 1 }];
  return { state, footprints };
}

test('Given a shore outlier after growth When omission search is prioritized Then every footprint still participates in validation and ordering is deterministic', () => {
  const { state, footprints } = grownOpening();
  const proposal = computePalisadeProposal(state, footprints);
  assert.ok(proposal.ok);
  assert.ok(validatePalisadeCandidate(state, proposal.path, footprints).ok);
  assert.deepEqual(computePalisadeProposal(state, [...footprints].reverse()), proposal);
});

test('Given the observed blocking mill When all omission candidates fail Then priority does not hide the full-validation failure', () => {
  const { state, footprints } = grownOpening();
  const blocked = [...footprints, { id: 'next-mill', tx: 15, ty: 6, width: 1, height: 1 }];
  const proposal = computePalisadeProposal(state, blocked);
  assert.equal(proposal.ok, false);
  assert.deepEqual(computePalisadeProposal(state, [...blocked].reverse()), proposal);
});
