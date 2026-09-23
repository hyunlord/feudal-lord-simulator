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

test('proposal chooses a fully supplied perimeter over an unreachable geometric default', () => {
  const prepared = createStage3EconomyHarnessScenario({ seed: 1 });
  const state = {
    ...prepared,
    tiles: prepared.tiles.map(tile => ({
      ...tile,
      hasRoad: tile.hasRoad && !(tile.tx >= 6 && tile.tx <= 9 && tile.ty <= 1),
    })),
  };
  const geometric = computePalisadeProposalForState(state);
  assert.equal(geometric.ok, true);
  if (!geometric.ok) return;
  assert.equal(previewPalisadeRouteAccess(state, geometric.path).unreachableSiteIds.length, 1);

  const supplied = computeReachablePalisadeProposalForState(state);
  assert.equal(supplied.ok, true);
  if (!supplied.ok) return;
  assert.notDeepEqual(supplied.path, geometric.path);
  const access = previewPalisadeRouteAccess(state, supplied.path);
  assert.equal(access.unreachableSiteIds.length, 0);
  assert.equal(access.unavailableSiteIds.length, 0);
  assert.equal(access.reachableSiteIds.length, access.projected.palisade?.segments.length);
});

test('an empty timber supply is reported separately from a missing route', () => {
  const prepared = createStage3EconomyHarnessScenario({ seed: 1 });
  const state = {
    ...prepared,
    treasuryTimber: 0,
    buildings: prepared.buildings.map(building => ({ ...building, inventory: {}, reserved: {}, stockReserved: {} })),
  };
  const proposal = computePalisadeProposalForState(state);
  assert.equal(proposal.ok, true);
  if (!proposal.ok) return;
  const access = previewPalisadeRouteAccess(state, proposal.path);
  assert.equal(access.reachableSiteIds.length, 0);
  assert.equal(access.unreachableSiteIds.length, 0);
  assert.equal(access.unavailableSiteIds.length, access.projected.palisade?.segments.length);
  assert.ok(proposalPredictionLines(state, proposal.path).some(line =>
    line.id === 'no-source' && line.text.includes('자재 공급처 없음')));
});
