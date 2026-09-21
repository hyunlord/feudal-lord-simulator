import assert from 'node:assert/strict';
import test from 'node:test';
import { advanceTick } from '../src/engine/tick';
import { gameReducer } from '../src/state/gameStore';
import { materialRecoveryAction } from '../src/engine/autoplayMaterialRecovery';
import { createConstructionSite } from '../src/economy/construction';
import { completeEligibleConstruction } from '../src/engine/constructionLifecycle';
import { confirmStoneTownProclamation } from '../src/engine/era';
import { palisade, palisadeSegment, state as baseState, timberSite } from './stoneWallConversionFixtures';
import { materialTown, syntheticCycle, syntheticScore } from './autoplayMaterialFixtures';
import type { GameState } from '../src/engine/engine.types';
test('Given a normally completed pending masonry fixture When ticking production and delivery Then deadline starts at actual completion and remains fixed through route revisions', () => {
  const base = materialTown();
  const site = createConstructionSite({ ordinal: 9, kind: 'masonry', tx: 3, ty: 1, startedTick: 20 });
  let state: GameState = { ...base, constructionSites: [...base.constructionSites, { ...site, delivered: { timber: 45 }, builderTicks: site.requiredBuilderTicks - 1 }],
    tiles: base.tiles.map(tile => tile.tx === site.tx && tile.ty === site.ty ? { ...tile, buildingId: site.id } : tile),
    autoplayMaterialRecovery: { version: 1, status: 'placed', wallId: 'wall-a', epoch: 10, attemptSiteId: site.id,
      placedTick: 20, baseline: syntheticCycle, score: syntheticScore } };
  state = advanceTick(state);
  const record = state.autoplayMaterialRecovery;
  assert.ok(record?.status === 'observing_result');
  assert.equal(record.completedTick, state.tick);
  const deadline = record.opportunity.opportunityUntilTick;
  assert.ok(deadline > state.tick && record.opportunity.workTicks === 180);
  state = advanceTick({ ...state, roadRevision: state.roadRevision + 1 });
  assert.ok(state.autoplayMaterialRecovery?.status === 'observing_result');
  assert.equal(state.autoplayMaterialRecovery.opportunity.opportunityUntilTick, deadline);
  while (state.tick < deadline) state = advanceTick(state);
  assert.ok(state.autoplayMaterialRecovery?.status === 'terminal');
  assert.equal(state.autoplayMaterialRecovery.outcome, 'credited_delivery');
  assert.ok(state.autoplayMaterialRecovery.produced > 0 && state.autoplayMaterialRecovery.wallDelivered > 0);
  assert.deepEqual(materialRecoveryAction(state), { kind: 'none' });
});
test('Given a spent cancelled facility When ordinary cancellation and a JSON round trip run Then it remains spent', () => {
  const base = materialTown(), site = createConstructionSite({ ordinal: 9, kind: 'masonry', tx: 3, ty: 1, startedTick: 20 });
  const state: GameState = { ...base, constructionSites: [...base.constructionSites, site],
    autoplayMaterialRecovery: { version: 1, status: 'placed', wallId: 'wall-a', epoch: 10, attemptSiteId: site.id,
      placedTick: 20, baseline: syntheticCycle, score: syntheticScore } };
  const cancelled = gameReducer(state, { type: 'cancel_construction', siteId: site.id });
  assert.equal(cancelled.autoplayMaterialRecovery?.status, 'terminal');
  const restored: GameState = JSON.parse(JSON.stringify(cancelled));
  assert.deepEqual(materialRecoveryAction(advanceTick(restored)), { kind: 'none' });
});
test('Given real stone proclamation with late timber work When the initial stone queue disappears and later timber completes Then a spent wall epoch survives the empty interval and new site timestamp', () => {
  const timber = timberSite(1);
  const proclaimed = confirmStoneTownProclamation(baseState({ constructionSites: [timber], palisade: palisade([
    palisadeSegment(0), palisadeSegment(1, { completed: false, constructionSiteId: timber.id }),
  ]) }));
  assert.equal(proclaimed.era, 'stone_town'); assert.equal(proclaimed.eraProclaimedTick, 100);
  const completed = completeEligibleConstruction({ ...proclaimed, tick: proclaimed.tick + 60, wallTick: proclaimed.wallTick + 60,
    constructionSites: proclaimed.constructionSites.map(site => site.kind === 'stone_wall_segment'
      ? { ...site, delivered: { stone: 25 }, builderTicks: site.requiredBuilderTicks } : site),
    autoplayMaterialRecovery: { version: 1, status: 'terminal', wallId: 'wall-a', epoch: 100, attemptSiteId: 'spent-masonry',
      outcome: 'ineffective', terminationTick: 100, rawArrived: 0, produced: 0, wallDelivered: 0 } });
  assert.equal(completed.constructionSites.filter(site => site.kind === 'stone_wall_segment').length, 0);
  let interval: GameState = JSON.parse(JSON.stringify(completed));
  interval = advanceTick(interval);
  assert.equal(interval.autoplayMaterialRecovery?.status, 'terminal');
  const late = completeEligibleConstruction({ ...interval, tick: interval.tick + 5,
    constructionSites: interval.constructionSites.map(site => ({ ...site, delivered: { timber: 15 }, builderTicks: site.requiredBuilderTicks })) });
  const replacement = late.constructionSites.find(site => site.kind === 'stone_wall_segment'); assert.ok(replacement);
  assert.ok(replacement.startedTick > proclaimed.tick);
  const observed = advanceTick(late);
  assert.equal(observed.autoplayMaterialRecovery?.epoch, 100);
  assert.equal(observed.autoplayMaterialRecovery?.status, 'terminal');
  assert.deepEqual(materialRecoveryAction(observed), { kind: 'none' });
});

test('Given a spent result with orphan wall sites When actual wall is removed Then demand closes without credit and never rearms when that wall returns', () => {
  const base = materialTown();
  const spent: GameState = { ...base, autoplayMaterialRecovery: { version: 1, status: 'observing_result', wallId: 'wall-a', epoch: 10,
    attemptSiteId: 'masonry', placedTick: 20, baseline: syntheticCycle, score: syntheticScore, completedTick: 90,
    opportunity: { sourceId: 'raw', activeSiteId: base.constructionSites[0]?.id ?? '', admittedRaw: 8, rawLegTicks: 100,
      outputLegTicks: 100, workTicks: 180, alignmentTicks: 1, opportunityUntilTick: 1000 }, rawArrived: 8, produced: 4, wallDelivered: 4 } };
  const removed = advanceTick({ ...spent, palisade: null });
  assert.ok(removed.autoplayMaterialRecovery?.status === 'terminal');
  assert.equal(removed.autoplayMaterialRecovery.outcome, 'demand_closed');
  const restored = advanceTick({ ...removed, palisade: base.palisade });
  assert.equal(restored.autoplayMaterialRecovery?.status, 'terminal');
  assert.deepEqual(materialRecoveryAction(restored), { kind: 'none' });
});

test('Given result observation When later transport is cancelled and staffing and routes fail Then bounded reasons survive restoration and the fixed terminal deadline', () => {
  const base = materialTown();
  let state: GameState = { ...base, autoplayMaterialRecovery: { version: 1, status: 'observing_result', wallId: 'wall-a', epoch: 10,
    attemptSiteId: 'masonry', placedTick: 20, baseline: syntheticCycle, score: syntheticScore, completedTick: 90,
    opportunity: { sourceId: 'raw', activeSiteId: base.constructionSites[0]?.id ?? '', admittedRaw: 8, rawLegTicks: 100,
      outputLegTicks: 100, workTicks: 180, alignmentTicks: 1, opportunityUntilTick: 240 }, rawArrived: 0, produced: 0, wallDelivered: 0 } };
  state = advanceTick(state);
  assert.ok(state.walkers.some(w => w.kind === 'carter' && w.homeBuildingId === 'masonry'));
  state = advanceTick({ ...state, population: 0, tiles: state.tiles.map(tile => ({ ...tile, hasRoad: false })), roadRevision: state.roadRevision + 1, pathCache: {} });
  assert.ok(state.autoplayMaterialRecovery?.status === 'observing_result');
  assert.deepEqual(state.autoplayMaterialRecovery.deterioration, { cancelledTransport: true, routeUnavailable: true, understaffed: true });
  state = JSON.parse(JSON.stringify(state));
  while (state.tick < 240) state = advanceTick(state);
  assert.ok(state.autoplayMaterialRecovery?.status === 'terminal');
  assert.equal(state.autoplayMaterialRecovery.terminationTick, 240);
  assert.equal(state.autoplayMaterialRecovery.outcome, 'ineffective');
  assert.deepEqual(state.autoplayMaterialRecovery.deterioration, { cancelledTransport: true, routeUnavailable: true, understaffed: true });
});
