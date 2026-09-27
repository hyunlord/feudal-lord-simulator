import { MONEY_LABEL } from "./moneyCopy.ko";
import type { ResourceType } from "./resourceCatalog";

export type ResourceCopy = {
  readonly name: string;
  /** What one unit is counted in. */
  readonly unit: string;
  /** One line on where it comes from and what it is for. */
  readonly short: string;
};

/** RES-REG: the name, unit and one line of every good, one line each (the list is `resourceCatalog.ts`). */
export const RESOURCE_COPY = {
  wheat: { name: "밀", unit: "자루", short: "밀밭에서 거둔 곡식 · 방앗간이 빵으로 빻습니다" },
  bread: { name: "빵", unit: "덩이", short: "곡창이 집집에 나누는 식량" },
  logs: { name: "통나무", unit: "토막", short: "벌목소가 벤 나무 · 제재소가 목재로 켭니다" },
  timber: { name: "목재", unit: "단", short: "켠 나무 · 건물과 목책을 짓습니다" },
  stone_raw: { name: "원석", unit: "덩이", short: "채석장에서 캔 돌 · 석공소가 다듬습니다" },
  stone: { name: "석재", unit: "덩이", short: "다듬은 돌 · 돌집과 석벽을 짓습니다" },
  coin: { name: MONEY_LABEL, unit: "페니", short: "장부에 남는 영지의 돈" },
} as const satisfies { readonly [K in ResourceType]: ResourceCopy };

export function resourceName(resource: ResourceType): string {
  return RESOURCE_COPY[resource].name;
}
