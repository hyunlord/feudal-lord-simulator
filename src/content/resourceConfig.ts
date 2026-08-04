export type ResourceType = "wheat" | "bread" | "logs" | "timber";

export const RESOURCE_TYPES = [
  "wheat",
  "bread",
  "logs",
  "timber",
] as const satisfies readonly ResourceType[];

export const STORAGE_KIND_BY_RESOURCE = {
  wheat: "granary",
  bread: "granary",
  logs: "storehouse",
  timber: "storehouse",
} as const satisfies Record<ResourceType, "granary" | "storehouse">;
