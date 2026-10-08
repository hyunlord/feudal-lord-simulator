/**
 * RECOVER-1 (spec docs/design/recovery.md): lord mode's recovery after a shock — the vacant houses (RC-2) take the
 * households the vacancies and the labour shortage pull in (RC-4), whatever the town's stored food; food then decides
 * whether they stay (RC-3, the FP-3 ladder on the household's own larder). Pure reads and one house update; the
 * ladder (`seasonPressure.ts`) calls these. Nothing here runs without `state.agency` (RC-1).
 */
import { BUILDING_CONFIG_BY_KIND } from "../content/buildingConfig";
import { PRESSURE_BALANCE } from "../content/balanceConfig";
import { LORD_INTAKE_CAPS, RECOVERY_BALANCE } from "../content/recoveryConfig";
import type { IntakeRules } from "../economy/storage";
import { houseBuiltLevel } from "../population/houseCondition";
import type { House } from "../population/population.types";
import type { GameState } from "./engine.types";
import type { Era } from "../content/eraConfig";
import { constructionDeliveryNeed, isWallConstructionSite } from "../economy/construction";

/** RC-1: the recovery rules are lord mode's. */
export function recoveryActive(state: Pick<GameState, "agency">): boolean {
  return state.agency !== undefined;
}

/** RC-6: lord mode's intake rules (the caps' lines); none elsewhere. DTR-19: a line holds from its era on. */
export const LORD_INTAKE_RULES: IntakeRules = { caps: LORD_INTAKE_CAPS.filter(line => line.fromEra === undefined) };
const ERA_ORDER: Readonly<Record<Era, number>> = { hamlet: 0, palisade: 1, stone_town: 2 };
const RULES_BY_ERA: Readonly<Record<Era, IntakeRules>> = {
  hamlet: { caps: LORD_INTAKE_CAPS.filter(line => line.fromEra === undefined || ERA_ORDER[line.fromEra] <= 0) },
  palisade: { caps: LORD_INTAKE_CAPS.filter(line => line.fromEra === undefined || ERA_ORDER[line.fromEra] <= 1) },
  stone_town: { caps: LORD_INTAKE_CAPS.filter(line => line.fromEra === undefined || ERA_ORDER[line.fromEra] <= 2) },
};
/** DTR-19: the wood's lines wait while a wall waits on timber (its reserve and deliveries need the stores whole). */
const WOOD: ReadonlySet<string> = new Set(["timber", "logs"]);
const WALL_BUILDING_RULES: Readonly<Record<Era, IntakeRules>> = {
  hamlet: { caps: RULES_BY_ERA.hamlet.caps!.filter(line => line.fromEra === undefined || !WOOD.has(line.resource)) },
  palisade: { caps: RULES_BY_ERA.palisade.caps!.filter(line => line.fromEra === undefined || !WOOD.has(line.resource)) },
  stone_town: { caps: RULES_BY_ERA.stone_town.caps!.filter(line => line.fromEra === undefined || !WOOD.has(line.resource)) },
};
export function lordIntakeRules(state: Pick<GameState, "agency"> & Partial<Pick<GameState, "era" | "constructionSites">>): IntakeRules | undefined {
  if (!recoveryActive(state)) return undefined;
  const era = state.era ?? "hamlet";
  const wallWaits = (state.constructionSites ?? []).some(site => isWallConstructionSite(site) && (constructionDeliveryNeed(site).timber ?? 0) > 0);
  return wallWaits ? WALL_BUILDING_RULES[era] : RULES_BY_ERA[era];
}

/** RC-4: the labour shortage, permille — the job slots left unfilled over the slots the town's buildings need. */
export function labourShortagePermille(state: Pick<GameState, "buildings">): number {
  let needed = 0;
  let missing = 0;
  for (const building of state.buildings) {
    const required = BUILDING_CONFIG_BY_KIND[building.kind].workersRequired;
    if (required <= 0) continue;
    needed += required;
    missing += Math.max(0, required - building.workers);
  }
  return needed === 0 ? 0 : Math.floor(missing * 1000 / needed);
}

/** RC-4: the season's pull, permille of the vacant houses. */
export function migrationPullPermille(state: Pick<GameState, "buildings">): number {
  return RECOVERY_BALANCE.pullBasePermille + Math.floor(RECOVERY_BALANCE.pullLabourPermille * labourShortagePermille(state) / 1000);
}

/**
 * RC-2: a house newcomers may take — standing, watered, not burnt, and emptied: abandoned a while, or once lived in
 * (built to level 1 or more) and now without residents. A new house that has never been lived in fills by growth.
 */
export function vacantForNewcomers(house: House, tick: number): boolean {
  if (!house.hasWater || house.burntTick !== undefined) return false;
  if (house.abandonedTick !== undefined) return tick - house.abandonedTick >= RECOVERY_BALANCE.abandonedWaitTicks;
  return house.residents <= 0 && house.leavingSinceTick === undefined && houseBuiltLevel(house) >= 1;
}

/**
 * RC-4: newcomer households due at this sample — the season's ⌈(vacant + arrived) × pull⌉ (at least one while a house
 * is vacant), spread evenly over the season's samples; `arrived` is the households that already came this season.
 */
export function newcomersDue(state: GameState, vacant: number, arrived: number, seasonStartTick: number): number {
  if (vacant <= 0) return 0;
  const season = PRESSURE_BALANCE.seasonTicks;
  const quota = Math.max(1, Math.ceil((vacant + arrived) * migrationPullPermille(state) / 1000));
  const samples = season / PRESSURE_BALANCE.sampleTicks;
  const elapsed = Math.min(samples, Math.floor((state.tick - seasonStartTick) / PRESSURE_BALANCE.sampleTicks) + 1);
  return Math.max(0, Math.min(vacant, Math.floor(quota * elapsed / samples) - arrived));
}

/** RC-3: a newcomer household in a house — a lot's worth of residents, a season's grace from starving, no pressure. */
export function settleNewcomers(house: House, residents: number, tick: number): House {
  const { abandonedTick: _abandoned, leavingSinceTick: _leaving, foodShortSinceTick: _short, ...rest } = house;
  return { ...rest, residents: Math.max(house.residents, residents), starvationGraceUntilTick: tick + RECOVERY_BALANCE.newcomerGraceTicks };
}
