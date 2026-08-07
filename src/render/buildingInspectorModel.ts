import { BUILDING_CONFIG_BY_KIND } from "../content/buildingConfig";
import type { ResourceType } from "../content/resourceConfig";
import type { GameState } from "../engine/engine.types";
import { buildingProblemCause } from "../ui/problemCauseModel";

export type BuildingInspectorModel = {
  readonly name: string;
  readonly purpose: string;
  readonly rows: readonly string[];
};

const HOUSE_NAMES = ["오두막", "농가", "시민가옥", "장원저택"] as const;
const PURPOSES = {
  house: "주민이 생활하고 성장하는 집",
  well: "주변 가구에 물을 공급",
  storehouse: "목재와 통나무를 보관",
  granary: "밀과 빵을 보관하고 배급",
  chapel: "마을의 시대 선포 조건을 채우는 예배당",
  wheat_farm: "일꾼이 밀을 재배",
  mill: "밀을 빵으로 가공",
  logging_camp: "숲에서 통나무를 생산",
  sawmill: "통나무를 목재로 가공",
} as const;
const RESOURCE_NAMES = {
  wheat: "밀",
  bread: "빵",
  logs: "통나무",
  timber: "목재",
} as const satisfies Record<ResourceType, string>;

export function buildingInspectorModel(
  state: GameState,
  buildingId: string,
): BuildingInspectorModel | null {
  const building = state.buildings.find((candidate) => candidate.id === buildingId);
  if (building === undefined) return null;
  const config = BUILDING_CONFIG_BY_KIND[building.kind];
  if (building.kind === "house") {
    const house = state.houses.find((candidate) => candidate.buildingId === building.id);
    const level = Math.max(0, Math.min(3, house?.level ?? 0));
    const breadService = house?.lastServicedTick === undefined || house.lastServicedTick === 0
      ? "빵 배급 전"
      : `마지막 빵 ${Math.max(0, state.tick - house.lastServicedTick)}틱 전`;
    return {
      name: HOUSE_NAMES[level] ?? HOUSE_NAMES[0],
      purpose: PURPOSES.house,
      rows: [
        `등급 ${level} · 주민 ${house?.residents ?? 0}명`,
        `물 ${house?.hasWater === true ? "있음" : "없음"}`,
        breadService,
      ],
    };
  }
  const stock = (Object.keys(RESOURCE_NAMES) as ResourceType[])
    .filter((resource) => (building.inventory[resource] ?? 0) > 0)
    .map((resource) => `${RESOURCE_NAMES[resource]} ${building.inventory[resource] ?? 0}`)
    .join(" · ") || "없음";
  const problemCause = buildingProblemCause(state, building.id);
  const rows = [
    ...(config.workersRequired > 0 ? [`일꾼 ${building.workers}/${config.workersRequired}`] : []),
    `재고 ${stock}`,
    ...(config.production === null
      ? []
      : [`생산 ${building.productionProgress}/${config.production.ticksPerOutput}`]),
    ...(problemCause === null
      ? []
      : [`원인: ${problemCause}`]),
  ];
  return { name: config.name, purpose: PURPOSES[building.kind], rows };
}
