/** LM-E9 (spec docs/design/registry.md ER-3·ER-4·ER-7·ER-9·ER-12, save v47): the registry's state in lord mode. */

/** ER-3/ER-4: one occurrence of an entry — offered, then answered, lapsed, or invalidated. */
export interface RegistryOccurrence {
  /** `registry:<entry id>:<bound id>:<season index>`. */
  readonly id: string;
  readonly entryId: string;
  /** The real instance it is bound to (an estate, an audit, a suit), or "" for none. */
  readonly boundId: string;
  readonly offeredTick: number;
  readonly deadline: number;
  readonly status: "offered" | "answered" | "lapsed" | "invalid";
  readonly choiceId?: string;
  readonly settledTick?: number;
  /** ER-3: why it came — the conditions that held and the draw. */
  readonly receipt: { readonly draw: number; readonly chancePermille: number; readonly conditions: readonly string[] };
}

/** ER-7 (NE03): a remission or an instalment plan with its term. */
export interface RegistryTerm {
  readonly id: string;
  readonly kind: "remission" | "installments";
  /** What it is on: "market_dues", "rent", or a debt's label. */
  readonly what: string;
  readonly amountPerYear: number;
  readonly years: number;
  readonly startTick: number;
  readonly endTick: number;
  /** The occurrence that set it. */
  readonly source: string;
  /** Years already settled (a payment made or a remission taken). */
  readonly settledYears: number;
  /** A dues remission: the dues to restore at the term's end (permille). */
  readonly restore?: number;
  readonly status: "running" | "ended";
}

/** ER-9: the player's house — its name and arms (lord mode's new game). */
export interface LordHouse {
  readonly name: string;
  readonly arms: string;
}

export interface RegistryState {
  readonly occurrences: readonly RegistryOccurrence[];
  readonly terms: readonly RegistryTerm[];
  readonly nextTerm: number;
  readonly house: LordHouse;
}
