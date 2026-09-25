import type { ResourceType } from "../content/resourceConfig";

// F0-V site plaque lines (the calendar arrival, the owed material, the blocker).
const MATERIAL = { wheat: "밀", bread: "빵", logs: "통나무", timber: "목재", stone_raw: "원석", stone: "석재", coin: "돈" } as const satisfies Record<ResourceType, string>;

export const CONSTRUCTION_PLAQUE_COPY = {
  arrival: (when: string) => `${when} 완공`,
  owed: (resource: ResourceType, delivered: number, required: number) => `${MATERIAL[resource]} ${delivered}/${required}`,
  blocker: { road: "길 끊김", materials: "창고에 자재 없음", workers: "일꾼 없음" },
  complete: "완공",
  blockerCount: (count: number) => `×${count}`,
} as const;
