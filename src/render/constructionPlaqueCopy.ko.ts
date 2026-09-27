import type { ResourceType } from "../content/resourceConfig";
import { resourceName } from "../content/resourceCatalog.ko";

// F0-V site plaque lines (the calendar arrival, the owed material, the blocker).

export const CONSTRUCTION_PLAQUE_COPY = {
  arrival: (when: string) => `${when} 완공`,
  owed: (resource: ResourceType, delivered: number, required: number) => `${resourceName(resource)} ${delivered}/${required}`,
  blocker: { road: "길 끊김", materials: "창고에 자재 없음", workers: "일꾼 없음" },
  complete: "완공",
  blockerCount: (count: number) => `×${count}`,
} as const;
