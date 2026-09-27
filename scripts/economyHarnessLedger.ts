import type { Walker } from "../src/agents/walker.types";
import { RESOURCE_TYPES, type ResourceType } from "../src/content/resourceConfig";
import { emptyResourceTotals, type ResourceTotals } from "../src/content/resourceCatalog";
import type { GameState } from "../src/engine/engine.types";
import { sortedResources } from "./economyHarnessSerializer";

export type ResourceLedger = ResourceTotals;

function emptyLedger(): ResourceLedger {
  return emptyResourceTotals();
}

function addRecord(
  ledger: ResourceLedger,
  record: Partial<Record<ResourceType, number>>,
): ResourceLedger {
  const resources = sortedResources(record);
  return Object.fromEntries(RESOURCE_TYPES.map(resource => [resource, ledger[resource] + resources[resource]])) as ResourceLedger;
}

function addCargo(ledger: ResourceLedger, walkers: readonly Walker[]): ResourceLedger {
  return walkers.reduce((nextLedger, walker) => {
    if (walker.cargo === null) return nextLedger;
    return {
      ...nextLedger,
      [walker.cargo.resource]: nextLedger[walker.cargo.resource] + walker.cargo.amount,
    };
  }, ledger);
}

export function resourceLedger(state: GameState): ResourceLedger {
  const stocked = state.buildings.reduce(
    (ledger, building) => addRecord(ledger, building.inventory),
    emptyLedger(),
  );
  const siteDelivered = state.constructionSites.reduce(
    (ledger, site) => addRecord(ledger, site.delivered),
    stocked,
  );
  const physical = addCargo(siteDelivered, state.walkers);
  return {
    ...physical,
    timber: physical.timber + state.treasuryTimber,
  };
}

export function constructionCommitmentLedger(state: GameState): ResourceLedger {
  return state.constructionSites.reduce((ledger, site) => {
    const delivered = addRecord(ledger, site.delivered);
    return addRecord(delivered, site.reserved);
  }, emptyLedger());
}

export function hasImpossibleConstructionCommitment(state: GameState): boolean {
  const physical = resourceLedger(state);
  const committed = constructionCommitmentLedger(state);
  return (Object.keys(physical) as ResourceType[]).some(
    (resource) => committed[resource] > physical[resource],
  );
}
