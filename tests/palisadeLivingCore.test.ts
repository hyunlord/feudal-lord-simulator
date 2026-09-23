import assert from 'node:assert/strict';
import test from 'node:test';
import { createGrowthOpening } from '../scripts/phase21OpeningTranslation';
import { computePalisadeProposalForState, palisadeCoreFootprintsForState, palisadeFootprintsForState } from '../src/engine/palisadeFootprints';
import { computePalisadeProposal, palisadePathHasBuildingClearance, validatePalisadeCandidate } from '../src/world/palisadeGeometry';

test('default wall encloses the living core while excluding the shoreline extraction branch', () => {
  // Given: seed 3 opens with a logging camp beyond the homes, storage and food network.
  const { state } = createGrowthOpening(3);
  const all = palisadeFootprintsForState(state);
  const core = palisadeCoreFootprintsForState(state);

  // When: the shared default proposal is built.
  const proposal = computePalisadeProposalForState(state);

  // Then: the outlying camp is not an anchor, every core plot is enclosed and
  // the wall remains clear of all existing structures, including that camp.
  assert.equal(core.some(footprint => footprint.id.startsWith('logging-camp-')), false);
  assert.equal(core.some(footprint => footprint.id.startsWith('core-road-')), true);
  assert.equal(proposal.ok, true, proposal.ok ? undefined : proposal.reason);
  if (!proposal.ok) return;
  const validation = validatePalisadeCandidate(state, proposal.path, all, core, 1);
  assert.equal(validation.ok, true, validation.ok ? undefined : validation.reason);
  assert.equal(palisadePathHasBuildingClearance(proposal.path, all), true);
});

test('two-tile margin gives a shorter proposal than the former all-building envelope in the same opening', () => {
  // Given: the same open-ground settlement with one remote timber camp is used for both proposals.
  const opening = createGrowthOpening(3).state;
  const state = {
    ...opening,
    tiles: opening.tiles.map(tile => ({ ...tile, terrain: 'grass' as const })),
    buildings: opening.buildings.map(building => building.kind === 'logging_camp'
      ? { ...building, tx: 35, ty: 6 } : building),
  };
  const all = palisadeFootprintsForState(state);
  const former = computePalisadeProposal(state, all);

  // When: the smaller living-core proposal replaces the old default.
  const current = computePalisadeProposalForState(state);

  // Then: it has a meaningful reduction without changing the input state.
  assert.equal(former.ok, true);
  assert.equal(current.ok, true);
  if (!former.ok || !current.ok) return;
  assert.ok(current.perimeterSteps < former.perimeterSteps, `${current.perimeterSteps} >= ${former.perimeterSteps}`);
  assert.equal(all.length, 8);
});

test('a manually widened wall cannot exclude a home merely because sixty percent of all plots fit', () => {
  const grid = { width: 24, height: 24, tiles: Array.from({ length: 24 * 24 }, (_, index) => ({
    tx: index % 24, ty: Math.floor(index / 24), terrain: 'grass' as const, buildingId: null, hasRoad: false,
  })) };
  const nearHome = { id: 'home-near', tx: 5, ty: 5, width: 1, height: 1 };
  const farHome = { id: 'home-far', tx: 15, ty: 15, width: 1, height: 1 };
  const camp = { id: 'timber-camp', tx: 7, ty: 7, width: 1, height: 1 };
  const path = [{ x: 3, y: 3 }, { x: 10, y: 3 }, { x: 10, y: 10 }, { x: 3, y: 10 }, { x: 3, y: 3 }];
  assert.equal(validatePalisadeCandidate(grid, path, [nearHome, farHome, camp]).ok, true);
  const protectedCore = validatePalisadeCandidate(grid, path, [nearHome, farHome, camp], [nearHome, farHome], 1);
  assert.deepEqual(protectedCore, { ok: false, reason: 'insufficient_enclosure' });
});
