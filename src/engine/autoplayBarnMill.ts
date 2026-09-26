/**
 * F0-A bot recovery `barn_mill` (spec docs/design/autoplay-recovery.md AR-8, decision FP9): a mill beside a barn whose
 * wheat the mills cannot haul away fast enough.
 *
 * Guardrail run 1 seed 4 (F0-A, 224,171 → 1,200,000 ticks): two farmsteads at the town's edge held 600–990 wheat all
 * year while the nine mills in the centre sat at 0–1 wheat, their intake carts nearly always on the long road to those
 * barns. Bread came in bursts, homes lost their levels between deliveries (L4 13–16/24) and the food step read the
 * average supply as sufficient. A mill placed beside each backed-up barn lifted the stalled town to L4 22–24 (probe).
 *
 * The symptom, not the stock alone, triggers it (healthy towns also hold 800–990 wheat in a barn after the harvest
 * and starve their mills before it): at least `BOT_RECOVERY_MIN_HOUSES` lived-in homes below the level they had built,
 * half the mills with less wheat than one grinding, and a barn with `BARN_BACKLOG_WHEAT` or more and no mill within
 * `MILL_NEAR_BARN` road tiles (seed 4's edge barn had a mill 4 tiles away as the crow flies and far by road). The new
 * mill goes within `MILL_NEAR_BARN` tiles of the barn. One mill at a time; the mill cap does not apply (the mill moves
 * hauling, it adds no demand).
 */
import { BUILDING_CONFIG_BY_KIND, type Building } from "../content/buildingConfig";
import { isBuildingConstructionSite } from "../economy/construction";
import { houseBuiltLevel } from "../population/houseCondition";
import type { AutoplayAction } from "./autoplay.types";
import { BOT_RECOVERY_MIN_HOUSES, recordBotRecovery, type BotRecoveryCollector, type GapBuildAction } from "./autoplayBotRecovery";
import type { GameState } from "./engine.types";
import { resolveBuildingRoute } from "./routing";

/** Wheat in a barn that counts as a backlog (a third of a full farmstead's harvest). */
export const BARN_BACKLOG_WHEAT = 400;
/** A mill this close to a barn by road already serves it; a new one is placed this close (Manhattan) to the barn. */
export const MILL_NEAR_BARN = 6;
/** The new mill takes the nearest ring with a legal site. */
const MILL_SITE_RINGS = [2, 4, MILL_NEAR_BARN] as const;

const distance = (a: Pick<Building, "tx" | "ty">, b: Pick<Building, "tx" | "ty">): number => Math.abs(a.tx - b.tx) + Math.abs(a.ty - b.ty);

/** Barns backed up with no mill beside them while homes lose their levels and the mills starve; worst first. */
export function backedUpBarns(state: GameState): readonly Building[] {
  const mills = state.buildings.filter(building => building.kind === "mill");
  if (mills.length === 0) return [];
  const perGrind = BUILDING_CONFIG_BY_KIND.mill.production?.inputPerOutput ?? 2;
  if (mills.filter(mill => (mill.inventory.wheat ?? 0) < perGrind).length * 2 < mills.length) return [];
  const fallen = state.houses.filter(house => house.residents > 0 && houseBuiltLevel(house) > house.level).length;
  if (fallen < BOT_RECOVERY_MIN_HOUSES) return [];
  return state.buildings
    .filter(barn => barn.kind === "farmstead" && (barn.inventory.wheat ?? 0) >= BARN_BACKLOG_WHEAT
      && !mills.some(mill => {
        const path = resolveBuildingRoute(state, barn, mill).path;
        return path !== null && path.length - 1 <= MILL_NEAR_BARN;
      }))
    .sort((a, b) => (b.inventory.wheat ?? 0) - (a.inventory.wheat ?? 0) || a.id.localeCompare(b.id));
}

export function barnMillAction(state: GameState, build: GapBuildAction, collector?: BotRecoveryCollector): AutoplayAction {
  const none = { kind: "none" } as const;
  if (state.constructionSites.some(site => isBuildingConstructionSite(site) && site.kind === "mill")) return none;
  if (state.idleWorkers < BUILDING_CONFIG_BY_KIND.mill.workersRequired) return none;
  const barns = backedUpBarns(state);
  for (const barn of barns) {
    for (const ring of MILL_SITE_RINGS) {
      const action = build(state, "mill", coordinate => distance(coordinate, barn) <= ring);
      if (action.kind !== "none") {
        recordBotRecovery(collector, "barn_mill", [barn], action);
        return action;
      }
    }
  }
  if (barns.length > 0) recordBotRecovery(collector, "barn_mill", barns, none, "no_site");
  return none;
}
