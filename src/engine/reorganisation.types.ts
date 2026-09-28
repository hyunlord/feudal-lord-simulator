/**
 * F4-A chapter 4's reorganisation (save v27, spec docs/design/chapter-four-reorganisation.md RG-*): what the town of
 * 1362–1400 asked for and what the lord answered. Steps that happened are saved with their tick; the rest derive.
 */
import type { PetitionResponse } from "../content/chapterConfig";

/** RG-5: the guild — founded when the lord grants it, its head a town household head (a person). */
export interface GuildRecord {
  readonly foundedTick: number;
  readonly headId: string | null;
}

/** RG-8: the rumour of 1381 — the pressure it found and whether the collectors were chased. */
export interface RebellionRecord {
  readonly tick: number;
  readonly pressure: number;
  readonly outcome: "chased" | "quiet";
}

/** RG-9: the state chapter 5 begins from. */
export interface ChapterFiveStart {
  readonly charter: "partial" | "refused" | "calendar";
  readonly rights: readonly string[];
  readonly feeFarm: number;
  /** The town's backlash against a refused charter, 0–100 (0 when granted). */
  readonly backlash: number;
  readonly guild: GuildRecord | null;
  readonly influence: Readonly<Record<string, number>>;
}

export interface ReorganisationState {
  /** RG-1: the season start the sequence began at (absolute tick). */
  readonly startTick: number;
  /** RG-1: the steps that came (absolute ticks). */
  readonly wageCompetitionTick?: number;
  readonly textileStreetTick?: number;
  readonly alehouseBoomTick?: number;
  readonly surgeTick?: number;
  readonly warningTick?: number;
  readonly autonomyTick?: number;
  /** RG-5…RG-9: the answers, by petition id (an unanswered one: `expired`). */
  readonly answers: Readonly<Partial<Record<string, PetitionResponse | "expired">>>;
  /** RG-4: the factions' influence at the last season start, 0–100. */
  readonly influence: Readonly<Record<string, number>>;
  /** RG-4: finished cloth sold, the last four seasons (oldest first), and this season so far. */
  readonly clothSeasons: readonly number[];
  readonly clothSeason: number;
  /** The treasury's cloth income (seal, toll, fulling) since the start. */
  readonly clothIncome: number;
  readonly clothSold: number;
  readonly guild?: GuildRecord;
  /** RG-6: the poll tax collected (the lord's share, pennies) and the collections taken. */
  readonly pollTax: number;
  readonly collections: number;
  readonly rebellion?: RebellionRecord;
  /** RG-8: the tick until which the tenants withhold their rent (the court rolls burnt). */
  readonly rentWithheldUntil?: number;
  /** RG-2 / RG-5: households gone to the neighbours' wages, weavers gone to a guild town. */
  readonly wageLeavers: number;
  readonly weaverLeavers: number;
  /** RG-5: the season the refused guild's weavers went. */
  readonly weaversLeftTick?: number;
  /** RG-10: the chapter's end (campaign) or the sequence's (sandbox); chapter 5's start. */
  readonly endedTick?: number;
  readonly chapterFiveStart?: ChapterFiveStart;
}

/** RG-1 API `reorganisationForecast`: the sequence's steps and their state. */
export type ReorganisationStepId = "wage_competition" | "textile_street" | "alehouse_boom" | "petitions_surge" | "guild_demand" | "cloth_or_grain"
  | "overlord_warning" | "poll_tax" | "rebellion_rumour" | "autonomy_request" | "end";
export interface ReorganisationStep {
  readonly id: ReorganisationStepId;
  /** The tick it came or is due (null: waiting on the town — the textile street, the alehouses, the earl's warning). */
  readonly tick: number | null;
  readonly state: "ahead" | "now" | "done";
}

/** RG-8 API `revoltPressure`: the pressure and its causes (one line each). */
export interface RevoltPressure {
  readonly total: number;
  readonly causes: readonly { readonly id: string; readonly pressure: number }[];
}
