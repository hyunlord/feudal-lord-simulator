import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_GAME_STATE } from '../src/state/gameStore';
import type { GameState } from '../src/engine/engine.types';
import type { Building } from '../src/content/buildingConfig';
import { buildingFootprint } from '../src/geometry/buildingFootprint';
import { computePalisadeProposalForState, palisadeCoreBuildingFootprintsForState, palisadeCoreFootprintsForState, palisadeFootprintsForState } from '../src/engine/palisadeFootprints';
import { palisadeObstacleEnvelopes } from '../src/world/palisadeObstacleEnvelope';
import { pathHasWaterReach, validatePalisadeCandidate } from '../src/world/palisadeGeometry';

test('a valid dry obstacle detour precedes a shorter wet obstacle detour', () => {
  const buildings: Building[] = [
    { id: 'store', kind: 'storehouse', tx: 8, ty: 8, workers: 0, inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0 },
    { id: 'manor-house-near', kind: 'manor_house', tx: 10, ty: 8, workers: 0, inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0 },
  ];
  const state: GameState = { ...DEFAULT_GAME_STATE, width: 24, height: 24, buildings, constructionSites: [],
    tiles: Array.from({ length: 576 }, (_, index) => {
      const tx = index % 24, ty = Math.floor(index / 24);
      const occupant = buildings.find(building => {
        const footprint = buildingFootprint(building);
        return tx >= building.tx && tx < building.tx + footprint.width && ty >= building.ty && ty < building.ty + footprint.height;
      });
      return { tx, ty, terrain: tx === 11 && (ty === 6 || ty === 7) ? 'water' : 'grass', hasRoad: false, buildingId: occupant?.id ?? null };
    }) };
  const anchors = palisadeCoreBuildingFootprintsForState(state), core = palisadeCoreFootprintsForState(state);
  const all = palisadeFootprintsForState(state);
  const candidates = (waterReach: boolean) => [1, 2, 3].flatMap(clearance => [1, 2, 3].flatMap(margin =>
    palisadeObstacleEnvelopes(state, anchors, all, margin, waterReach, clearance).flatMap(path => {
      const result = validatePalisadeCandidate(state, path, all, core, 1, { waterReach });
      return result.ok && pathHasWaterReach(state, result.candidate.path) === waterReach ? [result.candidate] : [];
    })));
  const dry = candidates(false).sort((a, b) => a.perimeterSteps - b.perimeterSteps)[0];
  const wet = candidates(true).sort((a, b) => a.perimeterSteps - b.perimeterSteps)[0];
  assert.ok(dry, 'fixture needs a fully valid dry fallback');
  assert.ok(wet, 'fixture needs a fully valid wet fallback');
  assert.ok(wet.perimeterSteps < dry.perimeterSteps, 'a global shortest-first merge would prefer the wet path');
  const dryKey = JSON.stringify(dry.path), wetKey = JSON.stringify(wet.path);
  const selected = computePalisadeProposalForState(state, path => [dryKey, wetKey].includes(JSON.stringify(path)));
  assert.ok(selected.ok);
  assert.deepEqual(selected.path, dry.path);
});
