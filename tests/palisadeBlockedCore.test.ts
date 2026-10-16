import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { decodeSave } from '../src/save/saveCodec';
import { computePalisadeProposalForState, palisadeCoreFootprintsForState, palisadeFootprintsForState } from '../src/engine/palisadeFootprints';
import { confirmPalisadeProclamation } from '../src/engine/palisade';
import { validatePalisadeCandidate } from '../src/world/palisadeGeometry';
import { previewPalisadeRouteAccess } from '../src/engine/palisadeRouteAccess';
import { gameReducer } from '../src/state/gameStore';
import { preservesAutoplayServiceSpace } from '../src/engine/autoplayServiceSpace';
import { wallRoom } from '../src/engine/autoplayWallRoom';
import { LORD_MODE_POLICY } from '../src/engine/townAgency';
import { housingLotCount } from '../src/population/housing';

const inputs = [
  'fixtures/charter/seed9-1319.save.json.gz',
  'fixtures/charter/seed14-1315.save.json.gz',
  'fixtures/charter/seed14-1330.save.json.gz',
  'fixtures/charter/seed26-1330.save.json.gz',
  'fixtures/charter/seed30-1328.save.json.gz',
];
for (const input of inputs) test(`a blocked core can proclaim a wall without removing required plots: ${input}`, () => {
  // Given: the exact retained town, with no ticks, resources, buildings or requirements changed.
  const state = decodeSave(new Uint8Array(gunzipSync(readFileSync(input)))).envelope.state;
  const before = JSON.stringify(state);
  // When: the public search selects a path accepted by the actual proclamation.
  const proposal = computePalisadeProposalForState(state, path => {
    const projected = confirmPalisadeProclamation(state, path);
    if (projected === state || !preservesAutoplayServiceSpace(state, { kind: 'proclaim_era' }, projected)) return false;
    const remaining = LORD_MODE_POLICY.maxHousingLots - housingLotCount(state);
    if (remaining > 0 && !wallRoom(state, path, remaining).roomy) return false;
    const access = previewPalisadeRouteAccess(state, path);
    return access.unreachableSiteIds.length + access.unavailableSiteIds.length === 0;
  }, 8);
  // Then: every existing core remains protected and every footprint keeps its clearance.
  assert.equal(proposal.ok, true, proposal.ok ? undefined : proposal.reason);
  if (!proposal.ok) return;
  assert.equal(validatePalisadeCandidate(state, proposal.path, palisadeFootprintsForState(state),
    palisadeCoreFootprintsForState(state), 1, { waterReach: true }).ok, true);
  assert.equal(confirmPalisadeProclamation(state, proposal.path).era, 'palisade');
  assert.equal(gameReducer(state, { type: 'confirm_palisade_proclamation', candidatePath: proposal.path }).era, 'palisade');
  assert.equal(JSON.stringify(state), before);
});
