/**
 * FAIL-3 lordship accessors (spec docs/design/failure-ladder-campaign.md FL-1, FL-2, FL-7): the lord's house, the rights
 * still held and the title. Pure reads of the state; the ladder's steps are in `lordship.ts`.
 */
import { DEFAULT_PLAYER_HOUSE, LORD_HOUSE_NAMES, LORD_RIGHT_IDS, TITLE_RANKS, type LordRightId, type LordTitleRank } from "../content/lordshipConfig";
import type { GameState } from "./engine.types";
import type { LordHouse, LordRightHolder, LordshipState } from "./lordship.types";
import { hashSeed } from "./prng";
import { scenarioOf } from "./scenarioState";
import { builtGatePointIds } from "./tollCrossings";
import { lordPossesses, lordRightsLost } from "./estates";

/**
 * FL-7: a later house's name, by seed and order — never the name of the house before it. MANOR-1 (HOUSE-1): the first
 * house is the player's (`playerLordHouse`), not by seed.
 */
export function lordHouseName(seed: number, order: number, previous: string): string {
  const index = hashSeed(seed, `lord-house:${order}`) % LORD_HOUSE_NAMES.length;
  return LORD_HOUSE_NAMES[LORD_HOUSE_NAMES[index] === previous ? (index + 1) % LORD_HOUSE_NAMES.length : index]!;
}

/**
 * FL-7: a house's arms by seed and order — a later house's; the first house's are the player's default house's
 * (MANOR-1, HOUSE-1). A chosen house's arms are on the house itself (`lordHouseByOrder`).
 */
export function lordHouseHeraldrySeed(seed: number, order: number): number {
  return order === 1 ? armsHeraldrySeed(DEFAULT_PLAYER_HOUSE.arms) : hashSeed(seed, `lord-arms:${order}`);
}

/**
 * MANOR-1 (HOUSE-1): the seed the arms with this id are drawn from — the screens draw the player's arms (the house
 * chooser's and the lordship's alike) as `armsRecipe(armsHeraldrySeed(arms), MANOR_HOUSEHOLD)`.
 */
export function armsHeraldrySeed(arms: string): number {
  return hashSeed(0, `player-arms:${arms}`);
}

/** MANOR-1 (HOUSE-1): the player's house as the lord's first house — the new game's choice, "de Haverel" by default. */
export function playerLordHouse(house: { readonly name: string; readonly arms: string } = DEFAULT_PLAYER_HOUSE): LordHouse {
  return { order: 1, name: house.name, arms: house.arms, heraldrySeed: armsHeraldrySeed(house.arms), since: 0 };
}

/** The first house of a game whose lordship is not yet written: the player's default house (MANOR-1, HOUSE-1). */
export function firstLordHouse(_state: Pick<GameState, "seed">): LordHouse {
  return playerLordHouse();
}

/** The lordship, or the one a game opens with (the first house, every right held, no decline). */
export function lordshipOf(state: Pick<GameState, "lordship" | "seed">): LordshipState {
  return state.lordship ?? { house: firstLordHouse(state), pastHouses: [], titleDemoted: false, decline: null };
}

/** MANOR-1 API: the lord's house of this order (the ruling one or a past one), if the game has had it. */
export function lordHouseByOrder(state: Pick<GameState, "lordship" | "seed">, order: number): LordHouse | undefined {
  const lordship = lordshipOf(state);
  return [lordship.house, ...lordship.pastHouses].find(house => house.order === order);
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
