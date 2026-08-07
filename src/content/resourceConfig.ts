export type ResourceType =
  | "wheat"
  | "bread"
  | "logs"
  | "timber"
  | "stone_raw"
  | "stone"
  | "coin";

export type StorableResourceType = Exclude<ResourceType, "coin">;

export const RESOURCE_TYPES = [
  "wheat",
  "bread",
  "logs",
  "timber",
  "stone_raw",
  "stone",
  "coin",
] as const satisfies readonly ResourceType[];

export const STORABLE_RESOURCE_TYPES = [
  "wheat",
  "bread",
  "logs",
  "timber",
  "stone_raw",
  "stone",
] as const satisfies readonly StorableResourceType[];

export const STORAGE_KIND_BY_RESOURCE = {
  wheat: "granary",
  bread: "granary",
  logs: "storehouse",
  timber: "storehouse",
  stone_raw: "storehouse",
  stone: "storehouse",
} as const satisfies Record<StorableResourceType, "granary" | "storehouse">;
