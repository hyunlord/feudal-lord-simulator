/**
 * FAIL-3 lordship state (save v19, spec docs/design/failure-ladder-campaign.md FL-*): the lord's house, the rights the
 * lord has lost, the title's demotion and the decline (the failure ladder's third rung). Absent = the first house, every
 * right held, no decline (v18 saves).
 */
import type { LordRightId } from "../content/lordshipConfig";

/** FL-4: who holds a lost right — the overlord in custody (breach-based suspension) or the merchant elite (seizure). */
export type LordRightHolder = "overlord" | "merchants";

/** FL-1: a right the lord has lost. */
export interface LostRight {
  readonly id: LordRightId;
  readonly status: "suspended" | "seized";
  readonly by: LordRightHolder;
  readonly since: number;
}

/** FL-7: one of the lord's houses. */
export interface LordHouse {
  /** 1 = the house the game opens with. */
  readonly order: number;
  /** An English surname (`LORD_HOUSE_NAMES`). */
  readonly name: string;
  /** The seed of the house's arms (the first house's is the game seed). */
  readonly heraldrySeed: number;
  readonly since: number;
  /** The tick it withdrew (past houses only). */
  readonly until?: number;
}

/** FL-3: the decline (stage 3). */
export interface DeclineState {
  readonly since: number;
  /** FIX-5 (FL-13, FL-14): or the town lost most of its people, or all of them. */
  readonly cause: "derelict" | "arrears" | "depopulated" | "empty";
  /** The right lost when the decline began (none if the lord held none). */
  readonly lost: LordRightId | null;
  readonly by: LordRightHolder;
  /** FL-6: a restoration petition may come from this tick (after a refusal, a year later). */
  readonly petitionFrom?: number;
}

export interface LordshipState {
  readonly house: LordHouse;
  readonly pastHouses: readonly LordHouse[];
  readonly lostRights: readonly LostRight[];
  readonly titleDemoted: boolean;
  /** FL-6: after a haggled restoration the title returns at this tick. */
  readonly titleReturnsTick?: number;
  readonly decline: DeclineState | null;
  /** FIX-11: a lord under 21 is in wardship until they come of age; guardianId null means overlord wardship. */
  readonly wardship?: { readonly guardianId: string | null; readonly since: number };
}
