import assert from 'node:assert/strict';
import test from 'node:test';
import { createStage3EconomyHarnessScenario } from '../scripts/economyHarnessStage3Scenario';
import { createGrowthOpening } from '../scripts/phase21OpeningTranslation';
import { computePalisadeProposalForState } from '../src/engine/palisadeFootprints';
import { computeReachablePalisadeProposalForState, previewPalisadeDraftRouteAccess, previewPalisadeRouteAccess } from '../src/engine/palisadeRouteAccess';
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
  assert.equal(access.provisional, false);
  assert.deepEqual(access.segments.map(segment => segment.siteId).sort(),
    access.projected.palisade?.segments.map(segment => segment.id).sort());
  assert.deepEqual(access.gates[0], access.projected.palisade?.gate);
});

test('given an open draft when previewed then its temporary segments use the actual delivery predicate', () => {
  const prepared = createStage3EconomyHarnessScenario({ seed: 1 });
  const draftPath = [{ x: 1, y: 1 }, { x: 5, y: 1 }];
  const connected = previewPalisadeDraftRouteAccess(prepared, draftPath);
  assert.equal(connected.provisional, true);
  assert.equal(connected.segments.length, 1);
  assert.equal(connected.segments[0]?.tileCount, 4);
  assert.equal(connected.gates.length, 0);
  assert.equal(previewPalisadeDraftRouteAccess({ ...prepared, tick: prepared.tick + 1 }, draftPath), connected);
  const isolated = previewPalisadeDraftRouteAccess({
    ...prepared, tiles: prepared.tiles.map(tile => ({ ...tile, hasRoad: false })),
  }, draftPath);
  assert.equal(isolated.provisional, true);
  assert.equal(isolated.segments[0]?.status, 'unreachable');
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

test('wall carrying supplies a segment disconnected from its own adjacent road', () => {
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
  const geometricAccess = previewPalisadeRouteAccess(state, geometric.path);
  assert.equal(geometricAccess.unreachableSiteIds.length, 0);
  assert.equal(geometricAccess.segments.filter(segment => segment.access === 'wall').length, 1);
  assert.ok(proposalPredictionLines(state, geometric.path).some(line =>
    line.id === 'wall-carry-access' && line.text.includes('벽을 따라 운반 1')));

  const supplied = computeReachablePalisadeProposalForState(state);
  assert.equal(supplied.ok, true);
  if (!supplied.ok) return;
  assert.deepEqual(supplied.path, geometric.path);
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
