import type { BuildingKind } from "../content/buildingConfig";

// Player-facing copy of the onboarding world targets ("여기에 … 지으세요" markers).
export const ONBOARDING_WORLD_GUIDANCE_COPY = {
  roadTarget: "여기에 길을 놓으세요",
  roadExtensionTarget: "여기에 길을 이어주세요",
} as const;

export const ONBOARDING_BUILDING_TARGET_LABELS = {
  house: "여기에 오두막을 지으세요",
  well: "여기에 우물을 지으세요",
  storehouse: "여기에 창고를 지으세요",
  granary: "여기에 곡창을 지으세요",
  chapel: "여기에 예배당을 지으세요",
  wheat_farm: "여기에 밀밭을 지으세요",
  farmstead: "여기에 헛간을 지으세요",
  mill: "여기에 방앗간을 지으세요",
  logging_camp: "여기에 벌목소를 지으세요",
  sawmill: "여기에 제재소를 지으세요",
  quarry: "여기에 채석장을 지으세요",
  masonry: "여기에 석공소를 지으세요",
  market: "여기에 시장을 지으세요",
  church: "여기에 교회를 지으세요",
  keep: "여기에 성채를 지으세요",
} as const satisfies Readonly<Record<BuildingKind, string>>;
