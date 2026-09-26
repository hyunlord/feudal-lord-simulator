/**
 * F0-C1 politics and chapter state (save v14, spec docs/design/flow-chapter-one.md FC-2…FC-5): petitions, rights, the
 * merchants' gauge, the player's decisions and the chapter's end with its chronicle page.
 */
import type { FamineResponseChoice, Petitioner, PetitionResponse } from "../content/chapterConfig";
import type { EventLosses } from "./events.types";

/** FC-3: a petition that came. `response` absent = still open. */
export interface PetitionRecord {
  readonly id: string;
  readonly defId: string;
  readonly petitioner: Petitioner;
  readonly arrivedTick: number;
  readonly response?: PetitionResponse | "expired";
  readonly respondedTick?: number;
  /** PERSON-0 PS-4 (save v16): the persons who bring the petition (2–3 household heads). */
  readonly petitionerIds?: readonly string[];
}

/** FC-4: one right the lord granted (one line of the rights list). */
export interface RightRecord {
  readonly id: string;
  readonly holder: Petitioner;
  readonly grantedTick: number;
  /** The petition it answered. */
  readonly petitionId: string;
  /** Stall fee under this right, permille of the usual fee. */
  readonly stallFeePermille: number;
}

/** FC-5: a decision the chronicle may quote. */
export type DecisionRecord =
  | { readonly kind: "famine_response"; readonly tick: number; readonly eventId: string; readonly choice: FamineResponseChoice }
  | { readonly kind: "petition_response"; readonly tick: number; readonly petitionId: string; readonly choice: PetitionResponse }
  | { readonly kind: "market_town"; readonly tick: number };

/** F0-C2 (HL-6): a decision the chronicle quotes, from the history ledger (its record, what was chosen and why). */
export interface ChronicleQuote {
  readonly recordId: string;
  readonly kind: string;
  readonly tick: number;
  readonly chosen: string;
  readonly alternatives: readonly string[];
  readonly predicted: Readonly<Record<string, number>>;
  readonly actual?: Readonly<Record<string, number>>;
}

/** FC-5: one page of the chronicle, written when a chapter ends — since F0-C2 edited from the history ledger (HL-6). */
export interface ChronicleEntry {
  readonly chapter: number;
  readonly fromYear: number;
  readonly toYear: number;
  /** The ledger's weightiest event and era records of the chapter (at most eight), in order, with what each cost. */
  readonly events: readonly { readonly recordId: string; readonly eventId: string; readonly defId: string; readonly year: number; readonly losses: EventLosses }[];
  /** The player's big decisions the page quotes (at most `CHAPTER_ONE.quotedDecisions`, the weightiest first). */
  readonly decisions: readonly ChronicleQuote[];
  readonly stats: {
    readonly populationStart: number;
    readonly populationEnd: number;
    readonly peakPopulation: number;
    readonly houses: number;
    readonly burntHouses: number;
    readonly departures: number;
    readonly harvestLost: number;
    readonly treasury: number;
    /** The famine's population at arrival and at its end. */
    readonly famine: { readonly year: number; readonly populationAtArrival: number; readonly populationAtEnd: number } | null;
  };
}

/** FC-5 API `chapterEnd`: the chapter the town finished. */
export interface ChapterEnd {
  readonly chapter: number;
  readonly tick: number;
  readonly chronicle: ChronicleEntry;
}

export interface PoliticsState {
  /** FC-3: the merchants' standing with the lord, 0–100. */
  readonly merchantGauge: number;
  readonly petitions: readonly PetitionRecord[];
  readonly rights: readonly RightRecord[];
  readonly decisions: readonly DecisionRecord[];
  /** FC-5: the chapter being played: its start and its peak population. */
  readonly chapter: { readonly number: number; readonly startTick: number; readonly populationStart: number; readonly peakPopulation: number };
  readonly chapterEnds: readonly ChapterEnd[];
}
