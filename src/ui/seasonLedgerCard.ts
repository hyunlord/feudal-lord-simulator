import { PRESSURE_COPY } from "../content/pressureCopy.ko";
import { EVENT_DEF_BY_ID, GREAT_FAMINE_EVENT_ID } from "../content/eventConfig";
import { SEASON_STOCK_KEYS, type NextObjectiveHint, type SeasonLedger } from "../engine/season.types";
import type { GameState } from "../engine/engine.types";
import { scenarioOf } from "../engine/scenarioState";
import type { BuildCategory } from "./buildMenuPresentation";
import { SEASON_LEDGER_COPY } from "./seasonLedgerCopy.ko";
import { seasonLedgerScenes, type SeasonSceneId } from "./seasonLedgerScenes";
import { resourceName } from "../content/resourceCatalog.ko";
import { DECLINE_CAUSES, LORD_RIGHT_NAMES } from "../content/historyCopy.ko";
import { conscriptsAway } from "../engine/war";
import { LORDSHIP_COPY } from "./lordshipCopy.ko";
import { RESOURCE_TYPES, type ResourceType } from "../content/resourceConfig";
import { resourceEntry } from "../content/resourceCatalog";
import { economyStockTotals } from "./ledgerModel";
import { seasonAleCause } from "./houseAleModel";
import { brewingSlot } from "../engine/ale";

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
  /**
   * INSTALL-3: the ale chain's goods held now (barley, malt, ale: the season ledger records no deltas for them) — in the
   * stores, on the carts and, for ale, in the households' brewing slots — each drawn with its icon; empty when none.
   */
  drink: readonly { readonly resource: ResourceType; readonly name: string; readonly amount: number }[];
  drinkLine: string | null;
}>;

/** INSTALL-3: the goods of the ale chain (the catalog's Wave 3 chain cells), in the catalog's order. */
const ALE_CHAIN = RESOURCE_TYPES.filter(resource => resourceEntry(resource).chainCell !== undefined);

/** A card state with the whole world (the game's own) reads the stores and the houses; the tests' bare ledgers do not. */
const isWorld = (state: object): state is GameState => "buildings" in state && "houses" in state && "tiles" in state && "walkers" in state;

const HINT_CATEGORY: Readonly<Record<Exclude<NextObjectiveHint, null>, BuildCategory>> = {
  food_reserve: "storage", harvest_reserve: "trade", resettle: "storage", dearth_reserve: "storage", fire_break: "living", rebuild: "living", resettled_food: "storage",
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
    case "residents_starved": return copy.residents_starved(event.count);
    case "event_rumour": return copy.event_rumour(eventName(event.defId));
    case "event_sign": return copy.event_sign(eventName(event.defId));
    case "event_arrived": return copy.event_arrived(eventName(event.defId));
    case "event_recovered": return copy.event_recovered(eventName(event.defId));
  }
}

/** FIX-4 E11: a food hint names what the town lacks (arable cells, a barn, a mill); the old line only said "fill the granary". */
function hintText(ledger: SeasonLedger): string {
  const hint = ledger.nextObjectiveHint!;
  const needs = ledger.foodNeeds;
  if (hint === "resettled_food" && ledger.resettledFood !== undefined) return PRESSURE_COPY.resettledFood(ledger.resettledFood.season);
  if ((hint !== "food_reserve" && hint !== "harvest_reserve") || needs === undefined) return SEASON_LEDGER_COPY.hints[hint];
  const parts = [
    ...(needs.arableCells > 0 ? [SEASON_LEDGER_COPY.needs.arableCells(needs.arableCells)] : []),
    ...(needs.farmstead ? [SEASON_LEDGER_COPY.needs.farmstead] : []),
    ...(needs.mill ? [SEASON_LEDGER_COPY.needs.mill] : []),
  ];
  return parts.length === 0 ? SEASON_LEDGER_COPY.needs.harvest : SEASON_LEDGER_COPY.needs.line(parts);
}

/** Scenes that say the season went badly: with any of them (or fewer people) it was no quiet season. */
const TROUBLE: ReadonlySet<SeasonSceneId> = new Set(["population_down", "household_departure", "house_hungry", "bread_shortage", "timber_shortage",
  "stone_shortage", "construction_blocked", "fire", "poor_harvest", "great_famine", "market_quiet", "hungry_gap"]);

export function seasonLedgerCardModel(state: Pick<GameState, "seasons" | "scenarioId" | "history"> & Partial<Pick<GameState, "buildings" | "war">>): SeasonLedgerCardModel | null {
  const history = state.seasons?.history ?? [];
  const ledger = history.at(-1);
  if (ledger === undefined) return null;
  const before = history.at(-2);
  const year = ledger.year;
  const scenes = seasonLedgerScenes(state, ledger, before).map(scene => ({ ...scene, name: SEASON_LEDGER_COPY.scene[scene.id] }));
  const population = SEASON_LEDGER_COPY.population(ledger.popDelta) + (before === undefined ? "" : ` ${SEASON_LEDGER_COPY.versus(before.popDelta)}`);
  const stock = SEASON_STOCK_KEYS.map(key => SEASON_LEDGER_COPY.stock(resourceName(key), Math.round(ledger.stockDelta[key]))).join(" · ");
  // UI-6: the lordship's fall in the season (FAIL-3: a decline begun, a house changed) and the men away at war (F2-A).
  const lordship = ledger.lordship;
  const away = state.war === undefined ? 0 : conscriptsAway({ war: state.war });
  const events = [...ledger.notableEvents.map(event => eventLine(state, event)),
    ...(lordship?.declined === undefined ? [] : [LORDSHIP_COPY.seasonDeclined(DECLINE_CAUSES[lordship.declined.cause] ?? lordship.declined.cause,
      lordship.declined.right === null ? null : LORD_RIGHT_NAMES[lordship.declined.right] ?? lordship.declined.right, lordship.declined.by === "overlord")]),
    ...(lordship?.houseChanged === undefined ? [] : [LORDSHIP_COPY.seasonHouse(lordship.houseChanged.withdrew, lordship.houseChanged.arrived)]),
    ...(away > 0 ? [LORDSHIP_COPY.seasonAway(away)] : []),
    // INSTALL-3 (AL-6): the houses whose rise waits longer for want of ale, as the card opens.
    ...(isWorld(state) && seasonAleCause(state) !== null ? [seasonAleCause(state)!] : [])];
  const totals = isWorld(state) ? economyStockTotals(state) : null;
  // Ale is brewed and kept in the households' first slot (AL-4), not in the stores: those casks count too.
  const brewed = isWorld(state) ? state.houses.reduce((sum, house) => sum + (brewingSlot(house)?.stock.ale ?? 0), 0) : 0;
  const drink = totals === null ? [] : ALE_CHAIN.map(resource => ({ resource, name: resourceName(resource),
    amount: Math.floor(totals[resource] + (resource === "ale" ? brewed : 0)) }));
  const held = drink.some(item => item.amount > 0);
  return {
    key: `${ledger.year}:${ledger.season}`,
    title: SEASON_LEDGER_COPY.title(year, ledger.season),
    scenes,
    scenesLine: SEASON_LEDGER_COPY.scenesLine(scenes.map(scene => scene.value === null ? scene.name : `${scene.name} ${scene.value}`)),
    lines: [SEASON_LEDGER_COPY.money(Math.round(ledger.income), Math.round(ledger.expense)), population, stock],
    // UX-0b: "큰 일 없이 지나간 계절입니다" only for a calm season (the audit read it beside "인구 줄음 −62%").
    events: events.length > 0 ? events : ledger.popDelta < 0 ? [SEASON_LEDGER_COPY.populationFell(-ledger.popDelta)]
      : scenes.some(scene => TROUBLE.has(scene.id)) ? [] : [SEASON_LEDGER_COPY.quiet],
    hint: ledger.nextObjectiveHint === null ? null : { text: hintText(ledger), category: HINT_CATEGORY[ledger.nextObjectiveHint] },
    drink: held ? drink : [],
    drinkLine: held ? SEASON_LEDGER_COPY.heldNow(drink.map(item => SEASON_LEDGER_COPY.held(item.name, item.amount))) : null,
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
