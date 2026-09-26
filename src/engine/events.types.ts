/**
 * F0-B events (spec docs/design/flow-events.md): the saved event state (save v13). The schedule and the weather are
 * derived from the seed and never saved; what is saved is what happened — arrivals, fires burning, losses.
 */
import type { EventKind, WeatherKind } from "../content/eventConfig";

/** EV-2: the forecast ladder's stages. `rumour` and `sign` come before arrival and are derived, not saved. */
export type EventStage = "rumour" | "sign" | "arrival" | "recovery" | "done";

export interface EventLosses {
  /** Houses burnt (fire). */
  readonly burntHouses: number;
  /** Households that left (failure ladder stage 2) while the event was arriving or recovering. */
  readonly departures: number;
  /** Wheat the harvest lost to the event (dearth). */
  readonly harvestLost: number;
}

/** One event that arrived (saved). `id` is `<defId>@<season index>`, the season it was placed on. */
export interface EventRecord {
  readonly id: string;
  readonly defId: string;
  readonly kind: EventKind;
  /** Absolute season index (tick ÷ 1,000) the event was placed on. */
  readonly season: number;
  readonly arrivalTick: number;
  /** The arrival ended (the last fire out; the next harvest after a dearth). Absent while arriving. */
  readonly endTick?: number;
  /** Recovery ends here; `done` from then on. Absent while arriving. */
  readonly recoveryUntilTick?: number;
  /** Fire: the house that caught first. */
  readonly originBuildingId?: string;
  readonly losses: EventLosses;
}

/** A house on fire (saved while it burns). */
export interface BurningHouse {
  readonly buildingId: string;
  readonly eventId: string;
  readonly ignitedTick: number;
  /** Tick it burns out and becomes `burnt`. */
  readonly outTick: number;
  /** Its household draws water from a well: they douse it (shorter burn). */
  readonly doused: boolean;
}

export interface EventState {
  /** Events that arrived, oldest first (all of them: a chapter has only a handful). */
  readonly records: readonly EventRecord[];
  /** Scheduled fires whose planned summer passed without their conditions (never ignited). */
  readonly missed?: readonly string[];
  readonly burning: readonly BurningHouse[];
}

/** EV-2 API: one line of `eventForecast`. */
export interface EventForecastEntry {
  readonly id: string;
  readonly defId: string;
  readonly kind: EventKind;
  readonly stage: EventStage;
  /** Planned (rumour/sign) or actual (arrival and later) arrival tick. */
  readonly arrivalTick: number;
  /** Calendar year and season of arrival. */
  readonly year: number;
  readonly season: number;
}

/** EV-3 API: the weather now and its effect numbers. */
export interface WeatherReport {
  readonly kind: WeatherKind;
  /** The season this weather belongs to (absolute index). */
  readonly seasonIndex: number;
}

/** EV-9: what the season ledger records about an event. */
export type EventSeasonEvent =
  | { readonly kind: "event_rumour"; readonly eventId: string; readonly defId: string }
  | { readonly kind: "event_sign"; readonly eventId: string; readonly defId: string }
  | { readonly kind: "event_arrived"; readonly eventId: string; readonly defId: string }
  | { readonly kind: "event_recovered"; readonly eventId: string; readonly defId: string; readonly losses: EventLosses };
