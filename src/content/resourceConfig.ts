export type ResourceType =
  | "wheat"
  | "bread"
  | "logs"
  | "timber"
  | "stone_raw"
  | "stone"
  | "barley"
  | "malt"
  | "ale"
  | "coin";

export type StorableResourceType = Exclude<ResourceType, "coin">;

export const RESOURCE_TYPES = [
  "wheat",
  "bread",
  "logs",
  "timber",
  "stone_raw",
  "stone",
  "barley",
  "malt",
  "ale",
  "coin",
] as const satisfies readonly ResourceType[];

export const STORABLE_RESOURCE_TYPES = [
  "wheat",
  "bread",
  "logs",
  "timber",
  "stone_raw",
  "stone",
  "barley",
  "malt",
  "ale",
] as const satisfies readonly StorableResourceType[];

export const STORAGE_KIND_BY_RESOURCE = {
  wheat: "granary",
  bread: "granary",
  logs: "storehouse",
  timber: "storehouse",
  stone_raw: "storehouse",
  stone: "storehouse",
  barley: "granary",
  malt: "granary",
  ale: "storehouse",
} as const satisfies Record<StorableResourceType, "granary" | "storehouse">;
