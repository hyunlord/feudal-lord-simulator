import assert from 'node:assert/strict';
import test from 'node:test';
import { createGrowthOpening } from '../scripts/phase21OpeningTranslation';
import { createAutoplayTraceDriver } from '../scripts/economyHarnessAutoplay';
import { createConstructionSite } from '../src/economy/construction';
import { preservesAutoplayWallSpace } from '../src/engine/autoplayWallSpace';
import { advanceTick } from '../src/engine/tick';
import { palisadeFootprintsForState } from '../src/engine/palisadeFootprints';
import { computePalisadeProposal, validatePalisadeCandidate } from '../src/world/palisadeGeometry';

// Real translated terrain and ordinary engine construction, without grants or era gates.
test('Given a feasible hamlet When autoplay adds buildings Then completed and pending plots retain a validated wall proposal', () => {
  let state = createGrowthOpening(3).state;
  const driver = createAutoplayTraceDriver({ id: 'wall-space-regression', source: 'original seed 3', policy: { maxHousingLots: 24 } });
  const checkedKinds = new Set<string>();
  while (state.tick <= 6600) {
    const next = driver.apply(state);
    if (next !== state && next.constructionSites !== state.constructionSites) {
      const footprints = palisadeFootprintsForState(next);
      const proposal = computePalisadeProposal(next, footprints);
      assert.ok(proposal.ok, `tick ${state.tick}, ${JSON.stringify(driver.appliedActions.at(-1))}: ${proposal.ok ? '' : proposal.reason}`);
      assert.ok(validatePalisadeCandidate(next, proposal.path, footprints).ok);
      const action = driver.appliedActions.at(-1)?.advisorAction;
      if (action?.kind === 'place_building') checkedKinds.add(action.building);
    }
    state = advanceTick(next);
  }
  for (const kind of ['sawmill', 'wheat_farm', 'mill', 'chapel']) {
    assert.ok(checkedKinds.has(kind), `ordinary ${kind} construction must preserve a validated wall`);
  }
  const replacement = driver.appliedActions.find(action => action.advisorAction.kind === 'place_building' && action.advisorAction.building === 'mill')?.advisorAction;
  assert.ok(replacement?.kind === 'place_building', 'the bootstrap mill must use a buildable alternative');
  assert.notDeepEqual({ tx: replacement.tx, ty: replacement.ty }, { tx: 15, ty: 6 });
  assert.ok([...state.constructionSites, ...state.buildings].some(plot =>
    'tx' in plot && plot.tx === replacement.tx && plot.ty === replacement.ty));
});


test('Given a pending footprint When it replaces the same completed plot Then wall clearance still excludes the unsafe mill', () => {
  // Given: replay to immediately before the original loss of wall feasibility.
  let state = createGrowthOpening(3).state;
  const driver = createAutoplayTraceDriver({ id: 'pending-wall-space', source: 'original seed 3', policy: { maxHousingLots: 24 } });
  while (state.tick < 6600) state = advanceTick(driver.apply(state));
  const chapel = state.buildings.find(building => building.kind === 'chapel');
  assert.ok(chapel);
  const pending = { ...state, buildings: state.buildings.filter(building => building.id !== chapel.id),
    constructionSites: [...state.constructionSites, createConstructionSite({ ordinal: 900, kind: chapel.kind, tx: chapel.tx, ty: chapel.ty, startedTick: state.tick })] };
  // When / Then: no cached result from a different layout can omit construction.
  assert.equal(preservesAutoplayWallSpace(state, 'mill', { tx: 15, ty: 6 }), false);
  assert.equal(preservesAutoplayWallSpace(pending, 'mill', { tx: 15, ty: 6 }), false);
  assert.equal(preservesAutoplayWallSpace({ ...pending, era: 'palisade' }, 'mill', { tx: 15, ty: 6 }), true);
  const dry = { ...state, tiles: state.tiles.map(tile => ({ ...tile, terrain: 'grass' as const })) };
  assert.equal(preservesAutoplayWallSpace(dry, 'mill', { tx: 15, ty: 6 }), true, 'terrain changes invalidate a previously rejected candidate');
  assert.equal(preservesAutoplayWallSpace({ ...state, tick: state.tick + 120 }, 'mill', { tx: 15, ty: 6 }), false);
});

test('Given an already infeasible hamlet When the advisor considers growth Then this preservation rule does not freeze recovery', () => {
  const state = { ...createGrowthOpening(3).state, buildings: [], constructionSites: [] };
  assert.equal(preservesAutoplayWallSpace(state, 'house', { tx: 11, ty: 6 }), true);
});

test('Given a feasible living-core wall When an outlying sawmill clears it Then extraction stays buildable', () => {
  const state = createGrowthOpening(3).state;
  assert.equal(preservesAutoplayWallSpace(state, 'sawmill', { tx: 17, ty: 5 }), true);
});

test('Given connecting roads in the living core When a food plot fits Then road footprints do not obstruct the wall hull', () => {
  const state = createGrowthOpening(3).state;
  assert.equal(preservesAutoplayWallSpace(state, 'wheat_farm', { tx: 9, ty: 8 }), true);
});
