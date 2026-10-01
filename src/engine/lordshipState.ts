/**
 * FAIL-3 lordship accessors (spec docs/design/failure-ladder-campaign.md FL-1, FL-2, FL-7): the lord's house, the rights
 * still held and the title. Pure reads of the state; the ladder's steps are in `lordship.ts`.
 */
import { LORD_HOUSE_NAMES, LORD_RIGHT_IDS, TITLE_RANKS, type LordRightId, type LordTitleRank } from "../content/lordshipConfig";
import type { GameState } from "./engine.types";
import type { LordHouse, LordRightHolder, LordshipState } from "./lordship.types";
import { hashSeed } from "./prng";
import { scenarioOf } from "./scenarioState";
import { builtGatePointIds } from "./tollCrossings";
import { lordPossesses, lordRightsLost } from "./estates";

/** FL-7: the house's name, by seed and order (a new house never takes the name of the one before it). */
export function lordHouseName(seed: number, order: number): string {
  const index = hashSeed(seed, `lord-house:${order}`) % LORD_HOUSE_NAMES.length;
  const previous = order > 1 ? LORD_HOUSE_NAMES.indexOf(lordHouseName(seed, order - 1) as (typeof LORD_HOUSE_NAMES)[number]) : -1;
  return LORD_HOUSE_NAMES[index === previous ? (index + 1) % LORD_HOUSE_NAMES.length : index]!;
}

/** FL-7: the first house's arms are the game seed's (as the screens drew them before FAIL-3); a later house's its own. */
export function lordHouseHeraldrySeed(seed: number, order: number): number {
  return order === 1 ? seed : hashSeed(seed, `lord-arms:${order}`);
}

export function firstLordHouse(state: Pick<GameState, "seed">): LordHouse {
  return { order: 1, name: lordHouseName(state.seed, 1), heraldrySeed: lordHouseHeraldrySeed(state.seed, 1), since: 0 };
}

/** The lordship, or the one a game opens with (the first house, every right held, no decline). */
export function lordshipOf(state: Pick<GameState, "lordship" | "seed">): LordshipState {
  return state.lordship ?? { house: firstLordHouse(state), pastHouses: [], titleDemoted: false, decline: null };
}

/** FL-7 API: the ruling house (name, arms seed, since). */
export function lordHouse(state: Pick<GameState, "lordship" | "seed">): LordHouse {
  return lordshipOf(state).house;
}

/** FL-1: the lord still collects the right's income (a right lost to the overlord or the merchants does not pay) —
 * LM-E2 (ES-3): the lord possesses the home estate's piece (the title may stay the lord's without it). */
export function rightHeld(state: Pick<GameState, "estates">, id: LordRightId): boolean {
  return lordPossesses(state, id);
}

/** FL-1: the town has the right to collect: a market standing, a built gate, the mill monopoly with a mill. */
export function rightPresent(state: GameState, id: LordRightId): boolean {
  switch (id) {
    case "market": return state.buildings.some(building => building.kind === "market");
    case "tolls": return builtGatePointIds(state.palisade).length > 0;
    case "mill": return scenarioOf(state).economyRules.millMonopoly && state.buildings.some(building => building.kind === "mill");
  }
}

export interface LordRightView {
  readonly id: LordRightId;
  /** The town has it at all (else nothing to hold or lose). */
  readonly present: boolean;
  readonly status: "held" | "suspended" | "seized";
  readonly by?: LordRightHolder;
  readonly since?: number;
}

/** FL-1 API: the lord's three rights and their standing. */
export function lordRights(state: GameState): readonly LordRightView[] {
  const lost = lordRightsLost(state);
  return LORD_RIGHT_IDS.map(id => {
    const right = lost.find(entry => entry.id === id);
    return right === undefined ? { id, present: rightPresent(state, id), status: "held" as const }
      : { id, present: rightPresent(state, id), status: right.status, by: right.by as LordRightHolder, since: right.since };
  });
}

/** FL-2 API: the title the era gives (`base`) and the one the lord is called by now (one lower while demoted). */
export function lordTitle(state: Pick<GameState, "era" | "lordship" | "seed">): { readonly rank: LordTitleRank; readonly base: LordTitleRank; readonly demoted: boolean } {
  const base: LordTitleRank = state.era === "stone_town" ? "borough" : state.era === "palisade" ? "market" : "manor";
  const demoted = lordshipOf(state).titleDemoted;
  const index = TITLE_RANKS.indexOf(base);
  return { base, rank: demoted ? TITLE_RANKS[Math.max(0, index - 1)]! : base, demoted };
}
