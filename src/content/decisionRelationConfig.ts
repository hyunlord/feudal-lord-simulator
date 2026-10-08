/**
 * DEC-TRACE §3 (docs/design/dec-trace.md, A6): a decision costs or wins a faction's mind — the side the lord took is
 * remembered (lord mode only). The registry's event: its sender is pleased by the most the lord gave of the choices and
 * displeased by the least. A subsidy: the faction its
 * kind serves. The estate policy: the factions it favours or burdens.
 */
import type { EstatePolicy } from "../engine/townAgency.types";

export const DECISION_RELATION = {
  /** The registry event's sender: the most given of its choices, the least given (the choices between move nothing). */
  registrySide: 6,
  // The merchant houses and the stall dues: DUES-REL (`duesMindConfig.ts`) — the fee as it stands, not its changes.
  /** The faction a subsidy's kind serves: set or raised (+), withdrawn (−). */
  subsidy: 3,
  /** The defendant's house, when the lord sues it or enforces a judgment on it. */
  suitFiled: 5,
  enforcement: 5,
  /** DTR-23: the plaintiff house, when the lord settles with it (paid off, or yielded), holds on against it, or guards against its men. */
  concordPaid: 5,
  concordYielded: 10,
  heldAgainst: 5,
  guarded: 2,
} as const;

/** The neighbour factions by their estates (the third neighbour's house is no faction: its mind is the diplomacy's). */
export const NEIGHBOUR_FACTION_BY_ESTATE: Readonly<Record<string, string>> = { "estate-neighbour-1": "neighbour_1", "estate-neighbour-2": "neighbour_2" };

/** The faction a subsidy's building kind serves (the rest serve the town). */
export const SUBSIDY_FACTION: Readonly<Record<string, string>> = {
  chapel: "bishop",
  church: "bishop",
  market: "merchant_house_1",
  storehouse: "merchant_house_1",
};

/** The factions an estate policy favours or burdens. */
export const POLICY_RELATION: Readonly<Record<EstatePolicy, Readonly<Record<string, number>>>> = {
  growth: { commons: 3 },
  revenue: { commons: -3, merchant_house_1: 2 },
  stability: { town: 3 },
  defence: { overlord: 3, commons: -2 },
};
