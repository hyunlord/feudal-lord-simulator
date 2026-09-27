/**
 * FACTION-0 factions (save v21, spec docs/design/factions.md FX-1…FX-8): the powers around the town, each with a
 * leader (a person), a relation to the lord, a memory of what the lord did (history ledger records) and its own timeline.
 */
import type { FactionId, FactionKind } from "../content/factionConfig";
import type { Person } from "./persons.types";

/** FX-4: one thing the faction remembers — the ledger record that says what happened, and how the relation moved. */
export interface FactionMemory {
  readonly recordId: string;
  readonly tick: number;
  readonly delta: number;
  /** What moved it: `petition:<defId>:<answer>`, `famine:<choice>`, `decline:<cause>`, `restored`, `house_change`, `raid:held|breached`. */
  readonly reason: string;
}

/** FX-5: one line of the faction's own history (not the lord's doing): a leader's death and heir, a world event, its own affairs. */
export interface FactionTimelineEntry {
  readonly tick: number;
  readonly year: number;
  readonly kind: "leader" | "world" | "affair";
  /** `leader`: the new leader; `world`: `WORLD_EVENTS` id; `affair`: `FACTION_EVENTS` id. */
  readonly id: string;
  readonly personId?: string;
}

export interface FactionRecord {
  readonly id: FactionId;
  readonly kind: FactionKind;
  /** FX-1: the faction's name (proper noun: an earldom, a house, a see; a town house takes its leader's surname). */
  readonly name: string;
  /** FX-2: the leader (a person: the faction's own for outside factions, a household head for the town's). */
  readonly leaderId: string | null;
  readonly heraldrySeed: number;
  /** FX-4: −100…100. */
  readonly relation: number;
  readonly memory: readonly FactionMemory[];
  readonly timeline: readonly FactionTimelineEntry[];
}

export interface FactionState {
  readonly factions: readonly FactionRecord[];
  /** FX-2: the outside factions' people (leaders living and dead), ids `f-000001` in order. */
  readonly people: readonly Person[];
  readonly nextOrdinal: number;
}

/** FX-6 API `factions.list`: a faction with its open demands (petitions waiting) and its promises (rights, loans). */
export interface FactionView extends FactionRecord {
  readonly demands: readonly { readonly petitionId: string; readonly defId: string; readonly arrivedTick: number }[];
  readonly promises: readonly { readonly kind: "right" | "loan" | "instalment"; readonly id: string }[];
}
