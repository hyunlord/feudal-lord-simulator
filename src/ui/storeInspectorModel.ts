import { BUILDING_CONFIG_BY_KIND, type BuildingKind } from "../content/buildingConfig";
import { STORABLE_RESOURCE_TYPES, type ResourceType } from "../content/resourceConfig";
import type { GameState } from "../engine/engine.types";
import { acceptsResource, storageUsage } from "../economy/storage";
import { constructionSiteDisplayName } from "../economy/constructionSiteAccessors";
import { STORE_INSPECTOR_COPY } from "./storeInspectorCopy.ko";
import { STORE_KINDS, weeklyStockChange, type StoreStockHistory } from "./storeStockHistory";

// UX-3R2 storage inspector (UX3R 6절, S-25): what the storehouse or granary holds and who draws on it. Read-only
// views of the rules (storageUsage, acceptsResource) and the presentation history (storeStockHistory).
export type StoreInspectorModel = Readonly<{
  buildingId: string;
  kind: BuildingKind;
  name: string;
  tile: { readonly tx: number; readonly ty: number };
  used: number;
  incoming: number;
  capacity: number;
  items: readonly { readonly resource: ResourceType; readonly name: string; readonly stored: number; readonly incoming: number; readonly week: string }[];
  users: readonly { readonly key: string; readonly text: string }[];
  distributors: number;
}>;

const MAX_USERS = 5;

export function isStoreKind(kind: string): boolean { return STORE_KINDS.has(kind); }

export function storeInspectorModel(state: GameState, buildingId: string, history: StoreStockHistory | null): StoreInspectorModel | null {
  const building = state.buildings.find(candidate => candidate.id === buildingId);
  if (building === undefined || !isStoreKind(building.kind)) return null;
  const usage = storageUsage(building);
  const items = STORABLE_RESOURCE_TYPES.filter(resource => acceptsResource(building.kind, resource)).map(resource => {
    const stored = Math.floor(building.inventory[resource] ?? 0);
    const week = history === null ? null : weeklyStockChange(history, building.id, resource, building.inventory, state.tick);
    return { resource, name: STORE_INSPECTOR_COPY.resource(resource), stored, incoming: Math.floor(building.reserved[resource] ?? 0), week: STORE_INSPECTOR_COPY.week(week) };
  });
  const nameOf = (id: string, kind: "building" | "site") => {
    if (kind === "site") { const site = state.constructionSites.find(candidate => candidate.id === id); return site === undefined ? null : STORE_INSPECTOR_COPY.site(constructionSiteDisplayName(site)); }
    const other = state.buildings.find(candidate => candidate.id === id);
    return other === undefined ? null : BUILDING_CONFIG_BY_KIND[other.kind].name;
  };
  const users = [...(history?.uses[building.id] ?? [])].sort((left, right) => right.tick - left.tick).flatMap(use => {
    const name = nameOf(use.otherId, use.otherKind);
    if (name === null) return [];
    const resource = STORE_INSPECTOR_COPY.resource(use.resource);
    return [{ key: `${use.otherId}:${use.resource}:${use.direction}`, text: use.direction === "out" ? STORE_INSPECTOR_COPY.userOut(name, resource) : STORE_INSPECTOR_COPY.userIn(name, resource) }];
  }).slice(0, MAX_USERS);
  return {
    buildingId: building.id, kind: building.kind, name: BUILDING_CONFIG_BY_KIND[building.kind].name, tile: { tx: building.tx, ty: building.ty },
    used: Math.floor(usage.used), incoming: Math.floor(usage.incoming), capacity: usage.capacity, items, users,
    distributors: state.walkers.filter(walker => walker.kind === "distributor" && walker.homeBuildingId === building.id).length,
  };
}
