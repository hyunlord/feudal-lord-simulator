import { BUILDING_CONFIG_BY_KIND, type Building, type BuildingKind } from "../../../content/buildingConfig";
import { isStorableResource, STORAGE_KIND_BY_RESOURCE, type ResourceType } from "../../../content/resourceConfig";
import type { GameState } from "../../../engine/engine.types";
import { IN_TRANSIT_CAUSE_MARK } from "../../alertStackModel";
import type { CauseDetail } from "../../causeRegistry";
import type { ConstructionAccessModel } from "../../constructionAccessModel";
import type { StuckRow } from "../../hud/stuckStockView";
import { lordAdvice, type TownNeed } from "./lordAdvice";

// DEC-CARD A1: the inspector's "조치" in lord mode. The sandbox's lines ("곡창을 하나 더 지으세요", "도로를 이어 주세요")
// ask the player to build; here each cause names what the town lacks (the same cause switch as inspectorModel's) and
// the line is the lord's (lordAdvice: what the town is doing about it, then his lever). A cause the lord meets the same
// way in both modes (a paused workshop, unpaid upkeep, goods on their way) keeps its line: null.

const building = (kind: BuildingKind): TownNeed => ({ kind: "building", building: kind });
const ROAD: TownNeed = { kind: "road" };
const HOUSES: TownNeed = { kind: "houses" };
/** The producer the town lacks for a missing input (inspectorCopy's `produceInput` names the same three). */
const PRODUCER: Partial<Record<ResourceType, BuildingKind>> = { wheat: "farmstead", logs: "logging_camp", stone_raw: "quarry" };

function service(requirement: "water" | "market" | "church", reason: string): TownNeed | null {
  if (reason === "unreachable") return ROAD;
  if (reason !== "missing" && reason !== "outside" && reason !== "capacity") return null;
  return building(requirement === "water" ? "well" : requirement === "market" ? "market" : "chapel");
}

/** What the town lacks for a blocking cause, or null when the cause's own line is the lord's too. */
function blockerNeed(state: GameState, target: Building, blocker: CauseDetail): TownNeed | null {
  if (blocker.reason === "understaffed") return HOUSES;
  switch (blocker.requirement) {
    case "water": case "market": case "church": return service(blocker.requirement, blocker.reason);
    case "bread":
      return blocker.reason === "no_granary" || blocker.reason === "delivery_range" ? building("granary")
        : blocker.reason === "granary_empty" ? building("mill") : blocker.reason === "road_disconnected" ? ROAD : null;
    case "granary": return building("granary");
    case "protected": return null;
    case "production": {
      if (blocker.reason === "storage_overflow" || blocker.reason === "output_full") return building("storehouse");
      if (blocker.reason === "no_road") return ROAD;
      if (blocker.reason !== "no_input" || blocker.label.includes(IN_TRANSIT_CAUSE_MARK)) return null;
      const input = BUILDING_CONFIG_BY_KIND[target.kind].production?.input ?? null;
      if (input === null) return null;
      if (state.buildings.some(candidate => (candidate.inventory[input] ?? 0) > 0)) return ROAD;
      const producer = PRODUCER[input];
      return producer === undefined ? null : building(producer);
    }
  }
}

/** The lord's lines for a blocking cause, or null to keep the cause's own line. */
export function lordBlockerActions(state: GameState, target: Building, blocker: CauseDetail): readonly string[] | null {
  if (blocker.reason === "paused" || blocker.reason === "upkeep_unpaid") return null;
  const need = blockerNeed(state, target, blocker);
  return need === null ? null : lordAdvice(state, need);
}

/** The lord's lines for a pile that cannot leave: the road it lacks, or the store that takes the good. */
export function lordPileActions(state: GameState, row: StuckRow): readonly string[] {
  if (row.reason === "no_road") return lordAdvice(state, ROAD);
  const store = isStorableResource(row.good) ? STORAGE_KIND_BY_RESOURCE[row.good] : row.store?.kind ?? row.kind;
  return lordAdvice(state, building(store));
}

/** The lord's lines for a construction site's cause, or null to keep the cause's own line. */
export function lordSiteActions(state: GameState, access: ConstructionAccessModel): readonly string[] | null {
  switch (access.cause) {
    case "road_disconnected": case "no_route": case "wall_blocked": return lordAdvice(state, ROAD);
    case "no_workers": return lordAdvice(state, HOUSES);
    default: return null;
  }
}
