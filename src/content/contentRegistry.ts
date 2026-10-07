/**
 * EXT-1 (docs/design/ext-1-plan.md): the content registry — the kinds of things the game is made of, by family, as data:
 * buildings, resources, trades, factions and faction kinds. Code asks it whether an id is known (`has`), for an id's
 * definition (`get`, an error naming the family and the id when it is not), and for the ids (`ids`). Saves and packs are
 * checked against it when they load (`contentStateProblem`). Today the core pack fills it; EXT-3b's pack loader will
 * add a pack's kinds to it.
 */
import { BUILDING_CONFIG_BY_KIND, BUILDING_KINDS, type BuildingDefinition, type BuildingKind } from "./buildingConfig";
import { FACTION_DEF_BY_ID, FACTION_IDS, FACTION_KINDS, type FactionDef, type FactionId, type FactionKind } from "./factionConfig";
import { RESOURCE_CATALOG, RESOURCE_TYPES, type ResourceType } from "./resourceCatalog";
import { TRADE_BY_ID, TRADE_IDS, TRADES, type TradeDefinition, type TradeId } from "./trades";

export interface ContentFamily<Id extends string, Def> {
  /** The family's name, in errors. */
  readonly family: string;
  readonly ids: () => readonly Id[];
  readonly has: (id: unknown) => id is Id;
  /** The definition, or an error naming the family and the unknown id. */
  readonly get: (id: string) => Def;
}

function family<Id extends string, Def>(name: string, ids: readonly Id[], definition: (id: Id) => Def): ContentFamily<Id, Def> {
  const known: ReadonlySet<string> = new Set(ids);
  const has = (id: unknown): id is Id => typeof id === "string" && known.has(id);
  return {
    family: name, ids: () => ids, has,
    get: id => {
      if (!has(id)) throw new Error(`unknown ${name} id "${id}"`);
      return definition(id);
    },
  };
}

type ResourceEntry = (typeof RESOURCE_CATALOG)[number];
const RESOURCE_BY_ID: ReadonlyMap<string, ResourceEntry> = new Map(RESOURCE_CATALOG.map(entry => [entry.id, entry]));

export const CONTENT_REGISTRY = {
  building: family<BuildingKind, BuildingDefinition>("building", BUILDING_KINDS, id => BUILDING_CONFIG_BY_KIND[id]),
  resource: family<ResourceType, ResourceEntry>("resource", RESOURCE_TYPES, id => RESOURCE_BY_ID.get(id)!),
  trade: family<TradeId, TradeDefinition>("trade", TRADE_IDS, id => TRADE_BY_ID.get(id)!),
  faction: family<FactionId, FactionDef>("faction", FACTION_IDS, id => FACTION_DEF_BY_ID.get(id)!),
  factionKind: family<FactionKind, FactionKind>("faction kind", FACTION_KINDS, id => id),
} as const;

/**
 * EXT-1: the first content id in a save's state that the registry does not know, as a message naming where it lies
 * and what it is — or null. Building and construction-site kinds (a wall segment's own kinds aside), the resources
 * buildings hold, reserve and owe, trade households' trades, factions' ids and kinds.
 */
export function contentStateProblem(state: Readonly<Record<string, unknown>>): string | null {
  const { building, resource, trade, faction, factionKind } = CONTENT_REGISTRY;
  const records = (value: unknown): readonly Record<string, unknown>[] => Array.isArray(value) ? value.filter((entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null) : [];
  const resourceKeys = (value: unknown, where: string): string | null => {
    if (typeof value !== "object" || value === null) return null;
    for (const key of Object.keys(value)) if (!resource.has(key)) return `${where} names an unknown resource "${key}"`;
    return null;
  };
  for (const [index, entry] of records(state.buildings).entries()) {
    if (!building.has(entry.kind)) return `buildings[${index}] is an unknown building kind "${String(entry.kind)}"`;
    for (const part of ["inventory", "reserved", "stockReserved"]) {
      const problem = resourceKeys(entry[part], `buildings[${index}].${part}`);
      if (problem !== null) return problem;
    }
  }
  for (const [index, entry] of records(state.constructionSites).entries()) {
    if (entry.kind === "palisade_segment" || entry.kind === "stone_wall_segment") continue;
    if (!building.has(entry.kind)) return `constructionSites[${index}] is an unknown building kind "${String(entry.kind)}"`;
  }
  const trades = state.trades as { households?: unknown } | undefined;
  for (const [index, entry] of records(trades?.households).entries()) {
    if (!trade.has(entry.tradeId)) return `trades.households[${index}] has an unknown trade "${String(entry.tradeId)}"`;
  }
  const factions = state.factions as { factions?: unknown } | undefined;
  for (const [index, entry] of records(factions?.factions).entries()) {
    if (!faction.has(entry.id)) return `factions.factions[${index}] is an unknown faction "${String(entry.id)}"`;
    if (!factionKind.has(entry.kind)) return `factions.factions[${index}] has an unknown faction kind "${String(entry.kind)}"`;
  }
  return null;
}

/**
 * EXT-1: the definitions' references the registry does not know, as messages — a trade's condition naming an unknown
 * building or trade, a trade input naming an unknown resource. Empty for the core pack (a test pins it); EXT-3b's pack
 * loader reports a pack's the same way.
 */
export function contentDefinitionProblems(): readonly string[] {
  const { building, resource, trade } = CONTENT_REGISTRY;
  const problems: string[] = [];
  for (const definition of TRADES) {
    for (const kind of definition.condition.building ?? []) if (!building.has(kind)) problems.push(`trade ${definition.id}: condition names an unknown building "${kind}"`);
    for (const id of Object.keys(definition.condition.trades ?? {})) if (!trade.has(id)) problems.push(`trade ${definition.id}: condition names an unknown trade "${id}"`);
    for (const input of definition.inputs) if (input.kind === "resource" && !resource.has(input.resource)) problems.push(`trade ${definition.id}: input names an unknown resource "${input.resource}"`);
  }
  return problems;
}
