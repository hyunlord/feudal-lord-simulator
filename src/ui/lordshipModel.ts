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
  return {
    house: LORDSHIP_COPY.house(house.name, house.order, yearOfTick(state, house.since)),
    arms: lordHouseArms(state), armsLabel: LORDSHIP_COPY.houseArms(house.name),
    household: lordHouseholdRows(state),
    pastHouses: lordship.pastHouses.length === 0 ? null : LORDSHIP_COPY.pastHouses(lordship.pastHouses.map(past => past.name)),
    title: LORDSHIP_COPY.title(title.rank), demoted: title.demoted && title.rank !== title.base ? LORDSHIP_COPY.demoted(title.base) : null,
    rights: lordRights(state).map(right => ({
      id: right.id, name: LORD_RIGHT_NAMES[right.id] ?? right.id, icon: RIGHT_ICON[right.id] ?? "icon_right_court", present: right.present,
      lost: right.status !== "held", status: right.present || right.status !== "held" ? LORDSHIP_COPY.status[right.status] ?? right.status : LORDSHIP_COPY.absent,
      since: right.since === undefined ? null : LORDSHIP_COPY.since(yearOfTick(state, right.since)),
    })),
    granted: (state.politics?.rights ?? []).map(right => DECISION_COPY.right(right.holder, right.stallFeePermille)),
    decline: lordship.decline === null ? null : LORDSHIP_COPY.decline(DECLINE_CAUSES[lordship.decline.cause] ?? lordship.decline.cause),
    war: war === undefined ? [] : [LORDSHIP_COPY.favour(war.favour),
      ...(conscriptsAway(state) > 0 ? [LORDSHIP_COPY.away(conscriptsAway(state))] : []),
      ...(state.palisade === null ? [] : [LORDSHIP_COPY.defence(Math.round(defence / 10), defence > 0)])],
  };
}

