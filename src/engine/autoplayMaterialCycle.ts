import { materialEpoch } from './autoplayMaterialEpisode';
import type { MaterialActivity } from '../agents/materialActivity';
import type { TilePos } from '../agents/walker.types';
import type { AutoplayMaterialRecovery, MaterialCycle } from './autoplayMaterialTypes';
import type { GameState } from './engine.types';
export function materialPathKey(path: readonly TilePos[]): string { return path.map(tile => `${tile.tx},${tile.ty}`).join(';'); }
export function recordMaterialActivity(state: GameState, events: readonly MaterialActivity[]): GameState {
  let record = state.autoplayMaterialRecovery;
  if (record?.status === 'observing' && materialEpoch(state) === null) return state;
  for (const event of events) record = applyActivity(state, record, event);
  return record === undefined ? state : { ...state, autoplayMaterialRecovery: record };
}
function applyActivity(state: GameState, record: AutoplayMaterialRecovery | undefined, event: MaterialActivity): AutoplayMaterialRecovery | undefined {
  if (record === undefined || record.status === 'placed' || record.status === 'terminal') return record;
  const homeId = event.kind === 'dispatch' ? event.walker.homeBuildingId : event.homeId;
  if (record.status === 'observing_result') {
    if (homeId !== record.attemptSiteId) return record;
    if (event.kind === 'cancelled') return { ...record, deterioration: { ...record.deterioration, cancelledTransport: true } };
    if (event.kind === 'raw_home') return { ...record, rawArrived: record.rawArrived + event.amount };
    if (event.kind === 'wall_delivery' && event.wallId === record.wallId) return { ...record, wallDelivered: record.wallDelivered + event.amount };
    return record;
  }
  if (homeId !== record.incumbentId) return record;
  let cycle = record.cycle;
  if (event.kind === 'dispatch') {
    const walker = event.walker;
    if (walker.mission === 'fetch' && walker.reservation.resource === 'stone_raw' && walker.destination.kind === 'building') {
      const sourceId = walker.destination.buildingId;
      const source = state.buildings.find(building => building.id === sourceId);
      if (source?.kind !== 'storehouse') return record;
      cycle = { startedTick: event.tick, sourceId: source.id, fetchWalkerId: walker.id,
        rawPath: materialPathKey(walker.path), rawEdges: Math.max(0, walker.path.length - 1), roadRevision: state.roadRevision,
        rawArrived: 0, produced: 0, wallDelivered: 0, workingTicks: 0, haulNoInputTicks: 0 };
    } else if (cycle !== undefined && cycle.rawArrived > 0 && cycle.outputWalkerId === undefined
      && walker.mission === 'deliver' && walker.cargo?.resource === 'stone' && walker.destination.kind === 'construction_site') {
      const siteId = walker.destination.siteId;
      const site = state.constructionSites.find(site => site.id === siteId);
      if (site?.kind === 'stone_wall_segment' && site.wallId === record.wallId) cycle = { ...cycle, outputWalkerId: walker.id, outputEdges: Math.max(0, walker.path.length - 1) };
    }
  } else if (cycle !== undefined) {
    if (event.kind === 'cancelled' && (event.walkerId === cycle.fetchWalkerId || event.walkerId === cycle.outputWalkerId)) {
      const { cycle: _discard, completedCycle: _completed, ...rest } = record; return rest;
    }
    if (event.kind === 'raw_home' && event.walkerId === cycle.fetchWalkerId) cycle = { ...cycle, rawArrived: cycle.rawArrived + event.amount };
    if (event.kind === 'wall_delivery' && event.walkerId === cycle.outputWalkerId && event.wallId === record.wallId && cycle.produced > 0) {
      cycle = { ...cycle, wallDelivered: cycle.wallDelivered + event.amount, deliveredSiteId: event.siteId };
    }
    if (event.kind === 'physical_return' && event.walkerId === cycle.outputWalkerId && cycle.wallDelivered > 0) {
      const { cycle: _discard, ...rest } = record;
      return { ...rest, completedCycle: { ...cycle, returnedTick: event.tick } };
    }
  }
  return cycle === undefined ? record : { ...record, cycle };
}
export function recordMaterialProduction(record: AutoplayMaterialRecovery | undefined, buildingId: string, produced: boolean, working: boolean, hauling: boolean): AutoplayMaterialRecovery | undefined {
  if (record?.status === 'observing_result' && record.attemptSiteId === buildingId) return { ...record, produced: record.produced + Number(produced) };
  if (record?.status !== 'observing' || record.incumbentId !== buildingId || record.cycle === undefined) return record;
  const cycle: MaterialCycle = { ...record.cycle, workingTicks: record.cycle.workingTicks + Number(working),
    haulNoInputTicks: record.cycle.haulNoInputTicks + Number(hauling),
    produced: record.cycle.produced + Number(produced && record.cycle.rawArrived > 0) };
  return { ...record, cycle };
}
