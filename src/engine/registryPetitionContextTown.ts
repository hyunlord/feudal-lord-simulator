import { BUILDING_CONFIG_BY_KIND } from '../content/buildingConfig';
import { treasuryBalance } from '../ledger/ledger';
import { contextRecord, fixedSourceIds, type FixedContext } from './registryPetitionContextIdentity';
import { competingDemand } from './registryPetitionContextDemand';
import { stateCalendar } from './scenarioState';
import type { GameState } from './engine.types';
import { codepoint, livingResidents, snapshot, stock, type Context } from './registryPetitionContextFacts';
export function townPetitionContext(state: GameState, strategy: string, fixed?: FixedContext): Context | null {
  const agency = state.agency;
  if (agency === undefined) return null;
  const residents = livingResidents(state).filter(person => fixed === undefined || fixed.partyIds.includes(person.id));
  const trades = [...(state.trades?.households ?? [])].filter(trade => residents.some(item => item.householdId === trade.houseId))
    .sort((a, b) => codepoint(a.houseId, b.houseId));
  const artisan = residents.find(item => trades.some(trade => trade.houseId === item.householdId
    && ['carpenter', 'cooper', 'wheelwright'].includes(trade.tradeId)));
  const baker = residents.find(item => trades.some(trade => trade.houseId === item.householdId && trade.tradeId === 'baker'));
  const reeve = residents.find(item => item.tags.includes('reeve'));
  const steward = [...(state.persons?.people ?? [])].sort((a, b) => codepoint(a.id, b.id)).find(item => item.alive
    && item.leftYear === undefined && (fixed === undefined || fixed.partyIds.includes(item.id)) && item.householdId === 'manor' && item.role === 'steward' && stateCalendar(state).year - item.birthYear >= 16);
  const merchant = residents.find(item => item.classBand === 'merchant' || trades.some(trade => trade.houseId === item.householdId && trade.tradeId === 'merchant'));
  const market = [...state.buildings].sort((a, b) => codepoint(a.id, b.id)).find(item => item.kind === 'market' && (fixed === undefined || !['high_dues', 'pending_order', 'market_supply', 'market_storage'].includes(strategy) || item.id === fixed.subjectKey));
  const subsidy = (kind: string) => agency.subsidies.find(item => item.kind === kind)?.amount ?? 0;
  const support = (kinds: readonly string[]) => Object.fromEntries(kinds.map(kind => [kind, subsidy(kind)]));
  const parties = (houseIds: readonly string[]) => residents.filter(item => houseIds.includes(item.householdId)).map(item => item.id);
  const timberSites = state.constructionSites.filter(site => (fixed === undefined || strategy === 'shop_repair' && site.id === fixed.subjectKey
    || strategy !== 'shop_repair' && (fixedSourceIds(fixed, 'siteIds')?.includes(site.id) ?? true)) && (site.required.timber ?? 0) > (site.delivered.timber ?? 0));
  const timberNeed = timberSites.reduce((sum, site) => sum + (site.required.timber ?? 0) - (site.delivered.timber ?? 0), 0);
  if (strategy === 'high_dues') {
    return market === undefined || merchant === undefined || agency.duesPermille <= 1000 ? null
      : snapshot(market.id, [merchant.id], { duesPermille: agency.duesPermille }, { marketId: market.id, householdId: merchant.householdId });
  }
  if (strategy === 'pending_order') {
    const arrear = state.money?.arrears.find(item => item.amount > 0 && (fixed === undefined || JSON.stringify([item.tick, item.facility])
      === JSON.stringify([contextRecord(fixed.triggerEvidence.unpaidExpense)?.tick, contextRecord(fixed.triggerEvidence.unpaidExpense)?.facility])));
    if (market === undefined || merchant === undefined || (state.timberOrder ?? 0) <= 16 || arrear === undefined) return null;
    return snapshot(market.id, [merchant.id], { timberOrder: state.timberOrder }, { unpaidExpense: { ...arrear, facility: { ...arrear.facility } } });
  }
  if (strategy === 'logs_waiting') {
    const logs = stock(state, 'logs');
    if (artisan === undefined || logs <= 0 || timberNeed <= state.treasuryTimber + stock(state, 'timber')) return null;
    return snapshot(artisan.householdId, [artisan.id], { ...support(['sawmill', 'logging_camp']), timberOrder: state.timberOrder ?? 0 }, {
      logs, timberNeeded: timberNeed, siteIds: timberSites.map(item => item.id).sort(codepoint),
    });
  }
  if (strategy === 'paid_subsidy') {
    const receipt = [...agency.receipts].sort((a, b) => codepoint(a.id, b.id)).find(item => item.what === 'farmstead' && item.subsidy > 0 && (fixed === undefined || item.id === fixed.subjectKey));
    const payments = state.ledger?.entries.filter(item => item.account === 'cash' && item.tick >= (receipt?.tick ?? Infinity)) ?? [];
    if (steward === undefined || receipt === undefined || state.ledger?.rollups.some(item => item.account === 'cash' && item.periodEnd > receipt.tick)
      || subsidy('farmstead') <= 16 || payments.reduce((sum, item) => sum + item.amount, 0) >= 0) return null;
    return snapshot(receipt.id, [steward.id], { farmsteadSubsidy: subsidy('farmstead'), policy: agency.policy }, {
      receiptId: receipt.id, subsidyId: agency.subsidies.find(item => item.kind === 'farmstead')?.id, paid: receipt.subsidy, cashDelta: payments.reduce((sum, item) => sum + item.amount, 0), cashMovementIds: payments.map(item => item.id).sort(codepoint),
    });
  }
  if (strategy === 'replacement_trade') {
    const quit = [...(state.trades?.quits ?? [])].sort((a, b) => a.tick - b.tick || codepoint(a.houseId, b.houseId))
      .find(item => (fixed === undefined || JSON.stringify(item) === JSON.stringify(fixed.triggerEvidence.closed)) && trades.some(trade => trade.sinceTick > item.tick));
    const starter = trades.find(item => (fixed === undefined || item.houseId === fixed.subjectKey) && item.sinceTick > (quit?.tick ?? Infinity));
    if (market === undefined || quit === undefined || starter === undefined) return null;
    return snapshot(starter.houseId, parties([starter.houseId]), { duesPermille: agency.duesPermille, policy: agency.policy, ...support(['market']) }, {
      closed: { ...quit }, opened: { houseId: starter.houseId, tradeId: starter.tradeId, sinceTick: starter.sinceTick },
    });
  }
  if (strategy === 'new_artisan') {
    const record = [...(state.history?.records ?? [])].sort((a, b) => codepoint(a.id, b.id)).find(item =>
      (fixed === undefined || item.id === fixed.triggerEvidence.arrivalRecordId) && ['person.move_in', 'person.resettled', 'person.arrived'].includes(item.template) && item.tick <= state.tick && state.tick - item.tick <= 4000
      && residents.some(resident => resident.classBand === 'artisan' && (item.subject.type === 'person' && item.subject.id === resident.id
        || item.template !== 'person.arrived' && item.subject.type === 'household' && item.subject.id === resident.householdId
        || item.template !== 'person.arrived' && item.actors?.some(actor => actor.type === 'household' && actor.id === resident.householdId))));
    const newcomer = residents.find(resident => resident.classBand === 'artisan' && (record?.subject.id === resident.id
      || record?.template !== 'person.arrived' && record?.subject.id === resident.householdId || record?.template !== 'person.arrived' && record?.actors?.some(actor => actor.type === 'household' && actor.id === resident.householdId)));
    if (market === undefined || record === undefined || newcomer === undefined || merchant === undefined || merchant.id === newcomer.id) return null;
    return snapshot(newcomer.householdId, [newcomer.id, merchant.id], { duesPermille: agency.duesPermille, ...support(['market', 'malt_kiln']) }, { arrivalRecordId: record.id, arrivalTick: record.tick });
  }
  if (strategy === 'shop_repair') {
    const carpenter = residents.find(item => trades.some(trade => trade.houseId === item.householdId && trade.tradeId === 'carpenter'));
    const site = timberSites.find(item => 'rebuildOf' in item && item.rebuildOf !== undefined && trades.some(trade => trade.houseId === item.rebuildOf));
    if (carpenter === undefined || site === undefined || !('rebuildOf' in site) || site.rebuildOf === undefined) return null;
    return snapshot(site.id, [carpenter.id, ...parties([site.rebuildOf])], { timberOrder: state.timberOrder ?? 0, ...support(['sawmill']) }, {
      houseId: site.rebuildOf, timberRequired: site.required.timber, timberDelivered: site.delivered.timber ?? 0,
    });
  }
  if (strategy === 'unused_subsidy') {
    const amount = subsidy('market');
    const budget = Math.floor(treasuryBalance(state) / 4);
    const total = agency.subsidies.reduce((sum, item) => sum + item.amount, 0);
    if (merchant === undefined || amount <= 12 || total + 24 <= budget || total - amount + 24 > budget) return null;
    return snapshot('market:storehouse', [merchant.id], { ...support(['market', 'storehouse']) }, { subsidyId: agency.subsidies.find(item => item.kind === 'market')?.id, subsidyTotal: total, subsidyLimit: budget });
  }
  if (strategy === 'market_supply') {
    if (market === undefined || merchant === undefined || timberNeed === 0) return null;
    return snapshot(market.id, [merchant.id], { duesPermille: agency.duesPermille, timberOrder: state.timberOrder ?? 0, ...support(['market']) }, {
      marketId: market.id, timberNeeded: timberNeed, siteIds: timberSites.map(item => item.id).sort(codepoint),
    });
  }
  if (strategy === 'fields_storage') {
    const fields = state.buildings.filter(item => (item.kind === 'farmstead' || item.kind === 'wheat_farm') && (fixed === undefined || fixedSourceIds(fixed, 'fieldIds')?.includes(item.id)));
    const wheat = stock(state, 'wheat');
    const demand = competingDemand(state, ['farmstead', 'granary'], fixed?.triggerEvidence.demand);
    if (reeve === undefined || demand === null || fields.length === 0 || wheat === 0) return null;
    return snapshot('fields:storage', [reeve.id], { policy: agency.policy, ...support(['farmstead', 'granary']) }, {
      fieldIds: fields.map(item => item.id).sort(codepoint), wheat, demand,
    });
  }
  if (strategy === 'grain_water') {
    const dry = state.houses.filter(house => (fixed === undefined || fixedSourceIds(fixed, 'unwateredHouseIds')?.includes(house.buildingId)) && house.residents > 0 && !house.hasWater && residents.some(item => item.householdId === house.buildingId));
    const demand = competingDemand(state, ['mill', 'well'], fixed?.triggerEvidence.demand);
    if (baker === undefined || demand === null || dry.length === 0 || stock(state, 'wheat') <= 0) return null;
    return snapshot('grain:water', [baker.id, ...parties(dry.map(item => item.buildingId))], support(['mill', 'well']), {
      demand, wheat: stock(state, 'wheat'), unwateredHouseIds: dry.map(item => item.buildingId).sort(codepoint),
    });
  }
  if (strategy === 'malt_grain') {
    const brewer = trades.find(item => item.tradeId === 'brewer');
    const miller = trades.find(item => item.tradeId === 'miller');
    if (brewer === undefined || miller === undefined || stock(state, 'barley') <= 0 || stock(state, 'wheat') <= 0) return null;
    return snapshot('malt:grain', parties([brewer.houseId, miller.houseId]), support(['malt_kiln', 'mill']), {
      brewerHouseId: brewer.houseId, millerHouseId: miller.houseId, wheat: stock(state, 'wheat'), barley: stock(state, 'barley'),
    });
  }
  if (strategy === 'market_storage') {
    const full = state.buildings.filter(item => item.kind === 'storehouse' && (fixed === undefined || fixedSourceIds(fixed, 'fullStorehouseIds')?.includes(item.id))
      && Object.values(item.inventory).reduce((sum, amount) => sum + amount, 0) >= BUILDING_CONFIG_BY_KIND.storehouse.storageCapacity);
    const demand = competingDemand(state, ['market', 'storehouse'], fixed?.triggerEvidence.demand);
    const keeper = residents.find(item => full.some(store => item.tags.includes(`manager:${store.id}`))
      || trades.some(trade => trade.houseId === item.householdId && trade.tradeId === 'carter'));
    if (market === undefined || merchant === undefined || keeper === undefined || demand === null || full.length === 0) return null;
    return snapshot(market.id, [merchant.id, keeper.id], { timberOrder: state.timberOrder ?? 0, ...support(['market', 'storehouse']) }, {
      demand, marketId: market.id, fullStorehouseIds: full.map(item => item.id).sort(codepoint),
    });
  }
  return null;
}
