import assert from 'node:assert/strict';
import test from 'node:test';
import { createStage3EconomyHarnessScenario } from '../scripts/economyHarnessStage3Scenario';
import { createGrowthOpening } from '../scripts/phase21OpeningTranslation';
import { computePalisadeProposalForState } from '../src/engine/palisadeFootprints';
import { computeReachablePalisadeProposalForState, previewPalisadeRouteAccess } from '../src/engine/palisadeRouteAccess';
import { proposalPredictionLines } from '../src/ui/wallPrediction';

test('draft route audit uses actual delivery paths before era requirements are met', () => {
  const state = createGrowthOpening(3).state;
  const proposal = computePalisadeProposalForState(state);
  assert.equal(proposal.ok, true);
  if (!proposal.ok) return;
  const access = previewPalisadeRouteAccess(state, proposal.path);
  assert.equal(access.projected.era, 'palisade');
  assert.equal(access.reachableSiteIds.length + access.unreachableSiteIds.length,
    access.projected.palisade?.segments.length);
});

test('isolated supply roads flag every unreachable segment before proclamation', () => {
  const prepared = createStage3EconomyHarnessScenario({ seed: 1 });
  const state = { ...prepared, tiles: prepared.tiles.map(tile => ({ ...tile, hasRoad: false })) };
  const proposal = computePalisadeProposalForState(state);
  assert.equal(proposal.ok, true);
  if (!proposal.ok) return;
  const access = previewPalisadeRouteAccess(state, proposal.path);
  assert.equal(access.unreachableSiteIds.length, access.projected.palisade?.segments.length);
  assert.ok(proposalPredictionLines(state, proposal.path).some(line =>
    line.id === 'no-route' && line.text.includes(`경로 없는 구간 ${access.unreachableSiteIds.length}`)));
  const preferred = computeReachablePalisadeProposalForState(state);
  assert.equal(preferred.ok, true);
  if (preferred.ok) assert.equal(preferred.perimeterSteps, proposal.perimeterSteps);
});
