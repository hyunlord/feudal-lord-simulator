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
  barley: { name: "보리", unit: "자루", short: "보리 밭에서 거둔 곡식 · 엿기름 가마가 엿기름으로 말립니다" },
  malt: { name: "엿기름", unit: "자루", short: "싹 틔워 말린 보리 · 집집의 아낙이 에일로 빚습니다" },
  ale: { name: "에일", unit: "통", short: "홉 없이 빚은 술 · 에일집이 팔고 집집이 마십니다" },
  fleece: { name: "양털", unit: "뭉치", short: "목축 농장이 초여름에 깎은 털 · 집집의 아낙이 실로 잣습니다" },
  yarn: { name: "실", unit: "타래", short: "물레로 자은 털실 · 직조공이 베로 짭니다" },
  raw_cloth: { name: "생베", unit: "필", short: "베틀에서 갓 짠 모직 · 축융 방앗간이 두드려 다집니다" },
  fulled_cloth: { name: "축융한 베", unit: "필", short: "물레방아 망치로 다진 모직 · 염색집이 물들입니다" },
  dyes: { name: "염료", unit: "짐", short: "대청·꼭두서니·목서초 · 장거리 상인이 들여옵니다" },
  dyed_cloth: { name: "물들인 베", unit: "필", short: "염색집에서 물들인 모직 · 텐터 틀에서 펴 말립니다" },
  finished_cloth: { name: "완성 직물", unit: "필", short: "펴 말려 다듬은 모직 · 시장에서 장거리 상인에게 팝니다" },
  coin: { name: MONEY_LABEL, unit: "페니", short: "장부에 남는 영지의 돈" },
} as const satisfies { readonly [K in ResourceType]: ResourceCopy };

export function resourceName(resource: ResourceType): string {
  return RESOURCE_COPY[resource].name;
}
