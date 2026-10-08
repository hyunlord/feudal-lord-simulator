import { isBuildingConstructionSite } from '../economy/construction';
import type { GameState } from './engine.types';
import { walkKey } from './townAgency';
import { treasuryBalance } from '../ledger/ledger';
import { contextRecord } from './registryPetitionContextIdentity';
import type { Context } from './registryPetitionContextFacts';
/** Only a still-current, recorded agency judgement can substantiate competing project requests. */
export function competingDemand(state: GameState, kinds: readonly string[], offered?: unknown): readonly Context[] | null {
  const walk = state.agency?.lastWalk;
  const currentWalk = walk !== undefined && walk.tick <= state.tick && Math.floor(walk.tick / 1000) === Math.floor(state.tick / 1000)
    && walk.key === walkKey(state) && (walk.fundThreshold === null || treasuryBalance(state) < walk.fundThreshold);
  if (offered !== undefined) {
    if (!Array.isArray(offered) || offered.length !== kinds.length) return null;
    const records = offered.map((value: unknown) => contextRecord(value));
    if (records.some((record, index) => record === undefined || record.kind !== kinds[index]
      || typeof record.tx !== 'number' || typeof record.ty !== 'number' || !Number.isInteger(record.tx) || !Number.isInteger(record.ty)
      || !Array.isArray(record.needs) || !record.needs.some((need: unknown) => { const reason = contextRecord(need); return reason?.name === 'need' && typeof reason.value === 'number' && reason.value > 0; }))) return null;
    if (records.some(record => record !== undefined && (state.buildings.some(building => building.kind === record.kind && building.tx === record.tx && building.ty === record.ty)
      || state.constructionSites.some(site => isBuildingConstructionSite(site) && site.kind === record.kind && site.tx === record.tx && site.ty === record.ty)))) return null;
    if (currentWalk && walk !== undefined && kinds.some(kind => !walk.proposals.some(proposal => proposal.what === kind
      && proposal.reasons.some(reason => reason.name === 'need' && reason.value > 0)))) return null;
    return records.flatMap(record => record === undefined ? [] : [record]);
  }
  if (!currentWalk || walk === undefined) return null;
  const proposals = kinds.map(kind => walk.proposals.filter(proposal => proposal.what === kind
    && proposal.reasons.some(reason => reason.name === 'need' && reason.value > 0))
    .sort((a, b) => a.ty - b.ty || a.tx - b.tx)[0]);
  if (proposals.some(proposal => proposal === undefined)) return null;
  return proposals.flatMap(proposal => proposal === undefined ? [] : [{ kind: proposal.what, tx: proposal.tx, ty: proposal.ty,
    actor: proposal.actor, planner: proposal.planner, needs: proposal.reasons.filter(reason => reason.name === 'need').map(reason => ({ ...reason })) }]);
}
