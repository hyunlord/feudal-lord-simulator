import { EVENT_DEF_BY_ID, GREAT_FAMINE_EVENT_ID } from "../content/eventConfig";
import { SEASON_STOCK_KEYS, type NextObjectiveHint, type SeasonLedger } from "../engine/season.types";
import type { GameState } from "../engine/engine.types";
import { scenarioOf } from "../engine/scenarioState";
import type { BuildCategory } from "./buildMenuPresentation";
import { SEASON_LEDGER_COPY } from "./seasonLedgerCopy.ko";
import { seasonLedgerScenes, type SeasonSceneId } from "./seasonLedgerScenes";

// UI-3 season ledger card (FP-1): the latest closed season, its three biggest changes as the scroll's three scenes
// (UI-4b: from the history ledger, as Wave 19 scene icons, seasonLedgerScenes.ts), money, population and stock beside
// the season before, what happened, and the engine's next objective as a button that opens the build drawer.
export type SeasonLedgerCardModel = Readonly<{
  key: string;
  title: string;
  scenes: readonly { readonly id: SeasonSceneId; readonly name: string; readonly value: string | null }[];
  scenesLine: string;
  lines: readonly string[];
  events: readonly string[];
  hint: { readonly text: string; readonly category: BuildCategory } | null;
}>;

const HINT_CATEGORY: Readonly<Record<Exclude<NextObjectiveHint, null>, BuildCategory>> = {
  food_reserve: "storage", harvest_reserve: "trade", resettle: "storage", dearth_reserve: "storage", fire_break: "living", rebuild: "living",
};

function eventName(defId: string): string {
  if (defId === GREAT_FAMINE_EVENT_ID) return SEASON_LEDGER_COPY.eventNames.great_famine;
  return SEASON_LEDGER_COPY.eventNames[EVENT_DEF_BY_ID.get(defId)?.kind ?? "fire"];
}

function eventLine(state: Pick<GameState, "scenarioId">, event: SeasonLedger["notableEvents"][number]): string {
  const copy = SEASON_LEDGER_COPY.events;
  switch (event.kind) {
    case "households_leaving": return copy.households_leaving(event.count);
    case "households_abandoned": return copy.households_abandoned(event.count);
    case "households_resettled": return copy.households_resettled(event.count);
    case "era_entered": return copy.era_entered(scenarioOf(state).eras.find(era => era.id === event.eraId)?.name ?? event.eraId, event.forced);
    case "first_winter_warning": return copy.first_winter_warning;
    case "event_rumour": return copy.event_rumour(eventName(event.defId));
    case "event_sign": return copy.event_sign(eventName(event.defId));
    case "event_arrived": return copy.event_arrived(eventName(event.defId));
    case "event_recovered": return copy.event_recovered(eventName(event.defId));
  }
}

export function seasonLedgerCardModel(state: Pick<GameState, "seasons" | "scenarioId" | "history">): SeasonLedgerCardModel | null {
  const history = state.seasons?.history ?? [];
  const ledger = history.at(-1);
  if (ledger === undefined) return null;
  const before = history.at(-2);
  const year = ledger.year;
  const scenes = seasonLedgerScenes(state, ledger, before).map(scene => ({ ...scene, name: SEASON_LEDGER_COPY.scene[scene.id] }));
  const population = SEASON_LEDGER_COPY.population(ledger.popDelta) + (before === undefined ? "" : ` ${SEASON_LEDGER_COPY.versus(before.popDelta)}`);
  const stock = SEASON_STOCK_KEYS.map(key => SEASON_LEDGER_COPY.stock(SEASON_LEDGER_COPY.stockNames[key], Math.round(ledger.stockDelta[key]))).join(" · ");
  const events = ledger.notableEvents.map(event => eventLine(state, event));
  return {
    key: `${ledger.year}:${ledger.season}`,
    title: SEASON_LEDGER_COPY.title(year, ledger.season),
    scenes,
    scenesLine: SEASON_LEDGER_COPY.scenesLine(scenes.map(scene => scene.value === null ? scene.name : `${scene.name} ${scene.value}`)),
    lines: [SEASON_LEDGER_COPY.money(Math.round(ledger.income), Math.round(ledger.expense)), population, stock],
    events: events.length === 0 ? [SEASON_LEDGER_COPY.quiet] : events,
    hint: ledger.nextObjectiveHint === null ? null : { text: SEASON_LEDGER_COPY.hints[ledger.nextObjectiveHint], category: HINT_CATEGORY[ledger.nextObjectiveHint] },
  };
}

/**
 * UI-4b: exactly one more season closed since the last one seen (the card opens), from the ends of the last two
 * closed seasons. Not the count of closed seasons: the engine keeps eight, so after two years the count stands still.
 * A load or a jump (the season before the new one is not the one last seen) opens nothing.
 */
export function seasonJustClosed(previousEnd: number | null, lastEnd: number | null, priorEnd: number | null): boolean {
  return lastEnd !== null && lastEnd !== previousEnd && priorEnd === previousEnd;
}
