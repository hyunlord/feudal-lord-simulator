import { storageOverflowCause } from '../ui/storageOverflowModel';
import { durationLabel } from "../ui/gameTimeCopy.ko";
import { BUILDING_CONFIG_BY_KIND, type Building } from "../content/buildingConfig";
import { buildingFootprint } from "../geometry/buildingFootprint";
import { RESOURCE_TYPES, type ResourceType } from "../content/resourceConfig";
import type { GameState } from "../engine/engine.types";
import { houseBuiltLevel, houseCondition, houseConditionLabel } from "../population/houseCondition";
import { providerServiceRows } from "../ui/serviceDiagnosisModel";
import { buildingProblemCause } from "../ui/problemCauseModel";
import { storageUsage } from '../economy/storage';
import { resourceName } from "../content/resourceCatalog.ko";
import { BUILDING_INSPECTOR_COPY } from "./buildingInspectorCopy.ko";
import { buildingCopy } from "../content/buildingCatalog.ko";

export type BuildingInspectorModel = {
  readonly kind: Building["kind"];
  readonly name: string;
  readonly purpose: string;
  readonly rows: readonly string[];
  /** INSTALL-3: the goods the building holds (the stock row's items), for the card to draw with their icons. */
  readonly stock?: readonly { readonly resource: ResourceType; readonly amount: number }[];
  /** INSTALL-3: the stock row as it stands in `rows` (the card draws it from `stock` instead). */
  readonly stockRow?: string;
};

const HOUSE_NAMES = BUILDING_INSPECTOR_COPY.houseNames;
// BLD-REG: a building's purpose line (AGENTS.md rule 18) is its catalog line (`buildingCatalog.ko.ts` `inspector`).

export function buildingInspectorModel(
  state: GameState,
  buildingId: string,
): BuildingInspectorModel | null {
  const building = state.buildings.find((candidate) => candidate.id === buildingId);
  if (building === undefined) return null;
  const config = BUILDING_CONFIG_BY_KIND[building.kind];
  if (building.kind === "house") {
    const house = state.houses.find((candidate) => candidate.buildingId === building.id);
    const level = Math.max(0, Math.min(4, house?.level ?? 0));
    const builtLevel = house === undefined ? level : houseBuiltLevel(house);
    const condition = house === undefined ? "maintained" : houseCondition(house);
    const breadService = house?.lastServicedTick === undefined || house.lastServicedTick === 0
      ? BUILDING_INSPECTOR_COPY.beforeBread
      : BUILDING_INSPECTOR_COPY.lastBread(durationLabel(state.tick - house.lastServicedTick));
    return {
      kind: building.kind,
      name: `${HOUSE_NAMES[builtLevel] ?? HOUSE_NAMES[0]}${building.houseLot === undefined ? "" : BUILDING_INSPECTOR_COPY.mergedHouseSuffix}`,
      purpose: buildingCopy("house").inspector,
      rows: [
        BUILDING_INSPECTOR_COPY.houseLevel(level, house?.residents ?? 0),
        BUILDING_INSPECTOR_COPY.builtStage(builtLevel, houseConditionLabel(condition)),
        BUILDING_INSPECTOR_COPY.lot(buildingFootprint(building).width, buildingFootprint(building).height),
        BUILDING_INSPECTOR_COPY.water(house?.hasWater === true),
        breadService,
      ],
    };
  }
  const held = (RESOURCE_TYPES).filter((resource) => (building.inventory[resource] ?? 0) > 0)
    .map(resource => ({ resource, amount: building.inventory[resource] ?? 0 }));
  const stock = held.map(({ resource, amount }) => BUILDING_INSPECTOR_COPY.stockItem(resourceName(resource), amount))
    .join(" · ") || BUILDING_INSPECTOR_COPY.none;
  const problemCause = buildingProblemCause(state, building.id);
  const usage = building.kind === 'storehouse' || building.kind === 'granary' ? storageUsage(building) : null;
  const overflow = storageOverflowCause(building);
  const rows = [
    ...(overflow === null ? [] : [overflow.label]),
    ...(usage === null ? [] : [
      BUILDING_INSPECTOR_COPY.storageTotal(usage.used, usage.incoming, usage.capacity),
      ...usage.byResource.map(item => BUILDING_INSPECTOR_COPY.storageItem(resourceName(item.resource), item.stored, item.incoming, usage.capacity)),
    ]),
    ...providerServiceRows(state, building),
    ...(config.workersRequired > 0 ? [BUILDING_INSPECTOR_COPY.workers(building.workers, config.workersRequired)] : []),
    BUILDING_INSPECTOR_COPY.stock(stock),
    ...(config.production === null
      ? []
      : [BUILDING_INSPECTOR_COPY.production(building.productionProgress, config.production.ticksPerOutput)]),
    ...(problemCause === null
      ? []
      : [BUILDING_INSPECTOR_COPY.cause(problemCause)]),
  ];
  return { kind: building.kind, name: config.name, purpose: buildingCopy(building.kind).inspector, rows, stock: held, stockRow: BUILDING_INSPECTOR_COPY.stock(stock) };
}
