import { LABOUR_BALANCE, PRESSURE_BALANCE } from "./balanceConfig";
import type { BuildingKind } from "./buildingConfig";
import type { StorableResourceType } from "./resourceConfig";
import type { Era } from "./eraConfig";

/**
 * RECOVER-1 (spec docs/design/recovery.md RC-2..RC-4): lord mode's recovery — vacant houses and the labour shortage
 * pull households in from the countryside; food decides whether they stay. Game estimates, tuned by the 125-year runs.
 */
export const RECOVERY_BALANCE = {
  /** RC-4: the share of the vacant houses a season's migrants take, permille, before the labour shortage. */
  pullBasePermille: 150,
  /** RC-4: the labour shortage adds this much at a shortage of every job slot (scaled by the shortage's share). */
  pullLabourPermille: 350,
  /** RC-3: a newcomer household does not starve this long after it moves in (one season). */
  newcomerGraceTicks: PRESSURE_BALANCE.seasonTicks,
  /** RC-2: an abandoned house stands empty at least this long before newcomers take it (the family just left). */
  abandonedWaitTicks: PRESSURE_BALANCE.resettleAfterTicks,
} as const;

/**
 * RECOVER-1 (RC-6, the user's decision 2026-10-06; data, not code — EXT principle): in lord mode a store keeps room for
 * other goods — each line caps one resource's share of one kind of store. The core reads the lines, never the words.
 * Today: barley fills at most 40 % of a granary (the rest is bread's and wheat's); the rest of the barley waits in its
 * barn or the carters sell it at a market.
 */
export interface IntakeCap {
  readonly store: BuildingKind;
  readonly resource: StorableResourceType;
  /** The resource may fill at most this share of the store, permille. */
  readonly permille: number;
  /** DTR-19: the line holds from this era on (absent: always). */
  readonly fromEra?: Era;
}
/**
 * DTR-19 (STORE-1, the user's instruction 2026-10-08): from the palisade on, timber and logs together fill at most half
 * a storehouse (35 % and 15 %) and stone_raw its own half — one material no longer takes the stores, stone keeps its
 * room, and the wood beyond waits at the camps and sawmills, where the carters sell what lies above the town's reserve
 * (TR-7 b). In the hamlet the charter's timber (250, DTR-13) needs the stores whole.
 */
export const LORD_INTAKE_CAPS: readonly IntakeCap[] = [
  { store: "granary", resource: "barley", permille: 400 },
  { store: "storehouse", resource: "timber", permille: 350, fromEra: "palisade" },
  { store: "storehouse", resource: "logs", permille: 150, fromEra: "palisade" },
  { store: "storehouse", resource: "stone_raw", permille: 500, fromEra: "palisade" },
];

/**
 * RECOVER-1 (RC-5, B2; data, not code): in lord mode the short side pulls. Each chain names a converter, its input,
 * where the input lies in bulk (its sources) and the stores that pass it on. A converter reorders its input at what it
 * uses during a round trip to the nearest input (× the margin), never below the chain's floor; a round trip longer than
 * one cart's load lasts sends more intake carts at once, up to the cap. The carters' spare loads bring the input from a
 * source to the converters under their reorder point and the stores under their target. Game estimates.
 */
export interface InputPullChain {
  readonly converter: BuildingKind;
  readonly input: StorableResourceType;
  /** The reorder point never falls below this (the converter's old fixed target). */
  readonly minReorder: number;
  readonly sources: readonly BuildingKind[];
  readonly stores: readonly { readonly kind: BuildingKind; readonly target: number }[];
}
export const INPUT_PULL = {
  /** Reorder point = round-trip ticks × input per tick × this, permille. */
  marginPermille: 1500,
  /** Intake carts one converter may have out at once. */
  maxIntakeCarts: 3,
  chains: [
    { converter: "mill", input: "wheat", minReorder: LABOUR_BALANCE.millWheatTarget, sources: ["farmstead"], stores: [{ kind: "granary", target: 40 }] },
  ] satisfies readonly InputPullChain[] as readonly InputPullChain[],
} as const;
