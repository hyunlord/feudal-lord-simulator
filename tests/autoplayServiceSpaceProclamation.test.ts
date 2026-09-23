import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_GAME_STATE, gameReducer } from '../src/state/gameStore';
import type { GameState } from '../src/engine/engine.types';
import { decideNextAction } from '../src/engine/autoplay';
import { autoplayActionToGameAction } from '../src/engine/autoplayActions';
import { serviceCandidate, serviceFootprint, serviceTileKey } from '../src/engine/autoplayServiceSpaceRoutes';
import { preservesAutoplayServiceSpace } from '../src/engine/autoplayServiceSpace';
import { computePalisadeProposal, validatePalisadeCandidate } from '../src/world/palisadeGeometry';
import { palisadeFootprintsForState } from '../src/engine/palisadeFootprints';
import { confirmPalisadeProclamation } from '../src/engine/palisade';

function readyWithFuturePads(): GameState {
  const buildings = [serviceCandidate('house', { tx: 10, ty: 10 }, 'home'),
    serviceCandidate('storehouse', { tx: 8, ty: 10 }, 'source'),
    serviceCandidate('granary', { tx: 10, ty: 7 }, 'granary'),
    serviceCandidate('chapel', { tx: 8, ty: 7 }, 'chapel')];
  const pads = new Set([serviceCandidate('market', { tx: 14, ty: 9 }, 'future-market'),
    serviceCandidate('church', { tx: 14, ty: 12 }, 'future-church')].flatMap(provider => serviceFootprint(provider).map(serviceTileKey)));
  const owners = new Map(buildings.flatMap(building => serviceFootprint(building).map(tile => [serviceTileKey(tile), building.id] as const)));
  return { ...structuredClone(DEFAULT_GAME_STATE), width: 22, height: 22, buildings,
    houses: [{ buildingId: 'home', level: 3, residents: 60, hasWater: true, breadStock: 100, lastServicedTick: 0, unmetRequirementTicks: 0 }],
    population: 60, idleWorkers: 0, treasuryTimber: 500, constructionSites: [], palisade: null,
    tiles: Array.from({ length: 484 }, (_, index) => {
      const point = { tx: index % 22, ty: Math.floor(index / 22) };
      const buildingId = owners.get(serviceTileKey(point)) ?? null;
      return { ...point, terrain: 'grass', buildingId, hasRoad: buildingId === null && !pads.has(serviceTileKey(point)) };
    }) };
}

test('Given a ready town whose primary wall consumes future service pads When autoplay proclaims Then it commits another fully validated safe boundary', () => {
  const state = readyWithFuturePads();
  const primary = computePalisadeProposal(state, palisadeFootprintsForState(state));
  assert.ok(primary.ok);
  const unsafe = confirmPalisadeProclamation(state, primary.path);
  assert.notEqual(unsafe, state);
  assert.equal(preservesAutoplayServiceSpace(state, { kind: 'proclaim_era' }, unsafe), false);
  const action = decideNextAction(state, { maxHousingLots: 1 });
  assert.equal(action.kind, 'proclaim_era');
  const command = autoplayActionToGameAction(action, state);
  assert.ok(command);
  const next = gameReducer(state, command);
  assert.equal(next.era, 'palisade');
  assert.ok(next.palisade);
  assert.notDeepEqual(next.palisade.polygon, primary.path);
  assert.ok(validatePalisadeCandidate(state, next.palisade.polygon, palisadeFootprintsForState(state)).ok);
  assert.equal(preservesAutoplayServiceSpace(state, action, next), true);
});

test('Given a proposed safe alternative When occupancy changes before application Then the autoplay adapter revalidates the exact path', () => {
  const state = readyWithFuturePads();
  const action = decideNextAction(state, { maxHousingLots: 1 });
  assert.equal(action.kind, 'proclaim_era');
  if (action.kind !== 'proclaim_era') return;
  assert.ok(action.candidatePath);
  const edge = action.candidatePath[0];
  assert.ok(edge);
  const stale = { ...state, buildings: [...state.buildings, serviceCandidate('house', { tx: edge.x, ty: edge.y }, 'new-occupancy')] };
  assert.equal(autoplayActionToGameAction(action, stale), null);
});

test('Given optional proposal acceptance When all candidates are rejected Then exhaustion is explicit and ordinary manual/default proposals stay identical', () => {
  const state = readyWithFuturePads();
  const footprints = palisadeFootprintsForState(state);
  const ordinary = computePalisadeProposal(state, footprints);
  assert.deepEqual(computePalisadeProposal(state, footprints, () => true), ordinary);
  let inspected = 0;
  const exhausted = computePalisadeProposal(state, footprints, path => {
    inspected++;
    assert.ok(validatePalisadeCandidate(state, path, footprints).ok);
    return false;
  });
  assert.equal(exhausted.ok, false);
  if (exhausted.ok) return;
  assert.equal(exhausted.reason, 'rejected_candidate');
  assert.ok(exhausted.attemptedPath && exhausted.attemptedPath.length > 2,
    'the rejected proposal remains available for the editable failure preview');
  assert.ok(inspected > 1);
  assert.deepEqual(computePalisadeProposal(state, footprints), ordinary);
  assert.ok(ordinary.ok);
  const manual = gameReducer(state, { type: 'confirm_palisade_proclamation', candidatePath: ordinary.path });
  assert.equal(manual.era, 'palisade', 'manual proclamation remains unrestricted by the autoplay policy');
  assert.deepEqual(manual.palisade?.polygon, ordinary.path);
});
