import { DECLINE_CAUSES, LORD_RIGHT_NAMES } from "../content/historyCopy.ko";
import type { GameState } from "../engine/engine.types";
import { lordHouse, lordRights, lordshipOf, lordTitle } from "../engine/lordshipState";
import { calendar, scenarioOf } from "../engine/scenarioState";
import { conscriptsAway, ringDefencePermille, warOf } from "../engine/war";
import { DECISION_COPY } from "./decisionCopy.ko";
import type { EmblemSpec } from "./heraldry/EmblemImage";
import { LORDSHIP_COPY } from "./lordshipCopy.ko";
import { lordHouseArms, lordHouseholdRows, type PersonRow } from "./persons/personModels";
import type { Wave14ImageId } from "./wave14Art";
import { SCENARIO_COPY } from "../content/scenario/scenarioCopy.ko";
// UI-9: revolt pressure shown on the rights tab (RG-8).
import { revoltPressureSection, type RevoltPressureSection } from "./chronicle/factionInfluenceModel";
import { BRIDGE_TOLLS_RIGHT_ID, MARKET_TOLLS_RIGHT_ID, REORGANISATION_BALANCE } from "../content/reorganisationConfig";

/** UI-9 (RG-9): the town's charter rights and the lord's right each takes from (the stall tax all, the tolls half). */
const CHARTER_PASSES: Readonly<Record<string, string>> = { [MARKET_TOLLS_RIGHT_ID]: "market", [BRIDGE_TOLLS_RIGHT_ID]: "tolls" };

/**
 * UI-6: the ledger drawer's rights tab (FAIL-3 FL-1…FL-8, F2-A): the ruling house (name, arms from its heraldry seed,
 * since when, the houses before), the title (and whether it is demoted), the three rights with who holds a lost one,
 * the rights the lord granted (FC-4), a decline under way, and in the war the Crown's favour, the men away and the
 * ring's defence. UI-7: the house's page also names its household — the lord's family and the steward, with portraits.
 */
const yearOfTick = (state: GameState, tick: number) => calendar(tick, scenarioOf(state).startYear).year;
// The mill right is the manor court's suit of mill (Wave 14 has no mill icon): the court icon.
const RIGHT_ICON: Readonly<Record<string, Wave14ImageId>> = { market: "icon_right_market", tolls: "icon_right_toll", mill: "icon_right_court" };

export type LordshipRightRow = Readonly<{ id: string; name: string; icon: Wave14ImageId; status: string; lost: boolean; present: boolean; since: string | null }>;
export type LordshipView = Readonly<{
  house: string; arms: EmblemSpec; armsLabel: string; pastHouses: string | null;
  /** UI-7: the lord's family, then the steward (`lordHouseholdRows`). */
  household: readonly PersonRow[];
  title: string; demoted: string | null;
  rights: readonly LordshipRightRow[];
  granted: readonly string[];
  decline: string | null;
  war: readonly string[];
  /** UI-9: RG-7 rights that moved to the town in ch4 (market_tolls, bridge_tolls from borough_charter). */
  rightsTransfer: readonly Readonly<{ id: string; line: string }>[];
  /** UI-9: RG-8 revolt pressure shown on the rights tab (null before chapter 4). */
  revoltPressure: RevoltPressureSection | null;
}>;

/** UI-6 (F2-A WR-3): the men away and when they come back (the population drawer's line), or null. */
export function menAwayLine(state: GameState): string | null {
  const men = conscriptsAway(state);
  const back = warOf(state)?.conscripts?.returnTick;
  if (men === 0 || back === undefined) return null;
  const when = calendar(back, scenarioOf(state).startYear);
  return LORDSHIP_COPY.awayUntil(men, when.year, SCENARIO_COPY.seasons[when.season as 0 | 1 | 2 | 3]);
}

export function lordshipView(state: GameState): LordshipView {
  const lordship = lordshipOf(state);
  const house = lordHouse(state);
  const title = lordTitle(state);
  const war = warOf(state);
  const defence = ringDefencePermille(state);
  const charter = (state.politics?.rights ?? []).filter(right => right.id in CHARTER_PASSES && right.holder === "townsfolk");
  const feeFarm = state.reorganisation?.chapterFiveStart?.feeFarm ?? (charter.length > 0 ? REORGANISATION_BALANCE.feeFarm : 0);
  return {
    house: LORDSHIP_COPY.house(house.name, house.order, yearOfTick(state, house.since)),
    arms: lordHouseArms(state), armsLabel: LORDSHIP_COPY.houseArms(house.name),
    household: lordHouseholdRows(state),
    pastHouses: lordship.pastHouses.length === 0 ? null : LORDSHIP_COPY.pastHouses(lordship.pastHouses.map(past => past.name)),
    title: LORDSHIP_COPY.title(title.rank), demoted: title.demoted && title.rank !== title.base ? LORDSHIP_COPY.demoted(title.base) : null,
    rights: lordRights(state).map(right => {
      // UI-9 (RG-9): the charter passed the market's stall tax (all) and half the tolls to the town.
      const passed = charter.find(entry => CHARTER_PASSES[entry.id] === right.id);
      return {
        id: right.id, name: LORD_RIGHT_NAMES[right.id] ?? right.id, icon: RIGHT_ICON[right.id] ?? "icon_right_court", present: right.present,
        lost: right.status !== "held" || passed !== undefined,
        status: passed !== undefined ? LORDSHIP_COPY.passedToTown(yearOfTick(state, passed.grantedTick), passed.id === BRIDGE_TOLLS_RIGHT_ID)
          : right.present || right.status !== "held" ? LORDSHIP_COPY.status[right.status] ?? right.status : LORDSHIP_COPY.absent,
        since: right.since === undefined ? null : LORDSHIP_COPY.since(yearOfTick(state, right.since)),
      };
    }),
    // UI-8: pass right.id so DECISION_COPY.right can distinguish commuted_rent from market-charter rights.
    // UI-9: the charter's rights are the transfer list's, not repeated here.
    granted: (state.politics?.rights ?? []).filter(right => !(right.id in CHARTER_PASSES))
      .map(right => DECISION_COPY.right(right.holder, right.stallFeePermille, right.id)),
    decline: lordship.decline === null ? null : LORDSHIP_COPY.decline(DECLINE_CAUSES[lordship.decline.cause] ?? lordship.decline.cause),
    // UI-9: RG-7 rights held by townsfolk (borough_charter grants market_tolls + bridge_tolls to "townsfolk").
    rightsTransfer: [...charter.map(r => ({ id: r.id, line: LORDSHIP_COPY.rightsTransferLine(r.id, yearOfTick(state, r.grantedTick)) })),
      ...(charter.length > 0 && feeFarm > 0 ? [{ id: "fee_farm", line: LORDSHIP_COPY.feeFarmLine(feeFarm) }] : [])],
    // UI-9: RG-8 revolt pressure on the rights tab (null before chapter 4).
    revoltPressure: revoltPressureSection(state),
    war: war === undefined ? [] : [LORDSHIP_COPY.favour(war.favour),
      ...(conscriptsAway(state) > 0 ? [LORDSHIP_COPY.away(conscriptsAway(state))] : []),
      ...(state.palisade === null ? [] : [LORDSHIP_COPY.defence(Math.round(defence / 10), defence > 0)])],
  };
}

