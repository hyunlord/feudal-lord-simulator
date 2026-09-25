import { BUILDING_CONFIG_BY_KIND } from "../content/buildingConfig";
import { LABOUR_BALANCE } from "../content/balanceConfig";
import type { GameState } from "../engine/engine.types";
import { householdLabour } from "../engine/householdLabour";
import { craftDefinition, householdSlots } from "../population/householdSlots";
import { farmsteadFieldNeed, idleLabourPermille, tendedCellsByFarmstead } from "../engine/labourDemand";
import type { CauseDetail } from "./causeRegistry";
import { buildingSource } from "../contracts";
import { HOUSEHOLD_LABOUR_COPY as LABOUR_COPY } from "./householdLabourCopy.ko";

/**
 * LB-6 and LB-8 detail rows for a house (`성인 3 · 방앗간 1 · 가내 1 · 일용 1`, `가내 생산: 없음`). The building
 * inspector (render session) appends these rows; LB-5/LB-7 rows for farmsteads and granaries likewise.
 */
export function householdLabourRows(state: GameState, buildingId: string): readonly string[] {
  const building = state.buildings.find(candidate => candidate.id === buildingId);
  if (building === undefined) return [];
  if (building.kind === "farmstead") {
    const need = farmsteadFieldNeed(tendedCellsByFarmstead(state).get(building.id) ?? 0, state.tick);
    return [LABOUR_COPY.farmsteadFieldHands(building.fieldHands ?? 0, need)];
  }
  if (building.kind === "granary") return (building.haulers ?? 0) > 0 ? [LABOUR_COPY.granaryHaulers(building.haulers ?? 0)] : [];
  const house = state.houses.find(candidate => candidate.buildingId === buildingId);
  if (house === undefined) return [];
  const share = householdLabour(state).get(buildingId);
  const parts = share === undefined || share.adults === 0 ? [LABOUR_COPY.noAdults] : [
    LABOUR_COPY.adults(share.adults),
    ...share.facilities.map(job => LABOUR_COPY.facility(BUILDING_CONFIG_BY_KIND[job.kind].name, job.workers)),
    ...(share.fieldHands > 0 ? [LABOUR_COPY.fieldHands(share.fieldHands)] : []),
    ...(share.dayLabour > 0 ? [LABOUR_COPY.dayLabour(share.dayLabour)] : []),
    ...(share.household > 0 ? [LABOUR_COPY.household(share.household)] : []),
    ...(share.idle > 0 ? [LABOUR_COPY.idle(share.idle)] : []),
  ];
  const products = householdSlots(house).flatMap(slot => {
    const craft = craftDefinition(slot.craftId);
    return craft === null ? [] : [craft.name];
  });
  return [parts.join(LABOUR_COPY.separator),
    products.length === 0 ? LABOUR_COPY.householdProductionNone : LABOUR_COPY.householdProduction(products.join(LABOUR_COPY.separator))];
}

/**
 * LB-9: the town's idle labour as a cause-registry entry. It reuses the `workers` id (the render session draws one
 * glyph per registry id; a dedicated `idle_labour` id is its hand-off). Sources are the houses with idle adults.
 */
export function idleLabourCause(state: GameState): CauseDetail | null {
  const idle = state.labour?.idle ?? 0;
  if (idle <= 0) return null;
  const houses = [...householdLabour(state).values()].filter(share => share.idle > 0).map(share => share.houseId);
  return {
    causeId: "workers", requirement: "production", reason: "idle_labour", label: LABOUR_COPY.idleLine(idle),
    sources: houses.map(buildingSource),
  };
}

/** LB-9: idle adults ÷ population above the A″ threshold (25%). */
export function idleLabourHighlighted(state: GameState): boolean {
  const permille = idleLabourPermille(state);
  return permille !== null && permille > LABOUR_BALANCE.idleHintPermille;
}
