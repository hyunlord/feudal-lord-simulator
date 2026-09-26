import { DEARTH_REHEARSAL_EVENT_ID, GREAT_FAMINE_EVENT_ID } from "../content/eventConfig";
import type { GameState } from "../engine/engine.types";
import { history } from "../engine/history";
import type { HistoryRecord } from "../engine/history.types";
import type { SeasonLedger } from "../engine/season.types";
import { SEASON_LEDGER_COPY } from "./seasonLedgerCopy.ko";
import type { WAVE19_IMAGES } from "./wave19ArtManifest.generated";

// UI-4b: the season ledger card's three scenes are the season's three biggest changes, read from the F0-C2 history
// ledger (`history.query` over the closed season, severity 1 and up, weightiest first: eras and the chapter's end,
// then events, then milestones, big decisions and the ledger's own season lines, then what befell households), each
// drawn as its Wave 19 scene icon. One scene per icon (three burnt houses are one "fire" scene with its count).
// Forecasts (rumours, signs) are not changes and are left out. A quiet season with fewer than three fills the rest
// from the season's numbers (population, bread, wheat, timber, stone, money), weighted as UI-3 weighed them.
type Scene<K> = K extends `scene_${infer Id}` ? Id : never;
export type SeasonSceneId = Scene<keyof typeof WAVE19_IMAGES>;
export type SeasonScene = { readonly id: SeasonSceneId; readonly value: string | null };

const EVENT_SCENE = (defId: string): SeasonSceneId =>
  defId === GREAT_FAMINE_EVENT_ID ? "great_famine" : defId === DEARTH_REHEARSAL_EVENT_ID ? "poor_harvest" : "fire";
const FACILITY = new Set(["well", "granary", "mill", "farmstead", "sawmill", "quarry", "masonry"]);
const ERA_SCENE: Readonly<Record<string, SeasonSceneId>> = {
  saturation: "population_up", famine: "great_famine", war: "complete_defense", collapse: "population_down", specialisation: "market_busy",
};

/** The scene a ledger record shows (null: none, e.g. forecasts and everyday lines). */
export function recordScene(record: Pick<HistoryRecord, "template" | "params">): SeasonSceneId | null {
  const param = (key: string) => String(record.params?.[key] ?? "");
  const number = (key: string) => Number(record.params?.[key] ?? 0);
  switch (record.template) {
    case "era.entered": return ERA_SCENE[param("eraId")] ?? "charter";
    case "milestone.chapter_end": return "winter_survived";
    case "event.arrived": return EVENT_SCENE(param("defId"));
    case "event.recovered": return EVENT_SCENE(param("defId")) === "fire" ? "complete_house" : "winter_survived";
    case "milestone.first_building": {
      const building = param("building");
      return building === "market" ? "market_busy" : building === "chapel" || building === "church" ? "complete_public" : FACILITY.has(building) ? "complete_facility" : "complete_house";
    }
    case "milestone.market_town": case "decision.market_town": return "charter";
    case "milestone.stone_town": case "decision.stone_town": return "complete_defense";
    case "milestone.first_l4": case "decision.rebuild": return "complete_house";
    case "milestone.lots": return "household_arrival";
    case "decision.famine_response": return param("chosen") === "relief" ? "bread_reserve" : "great_famine";
    case "decision.petition_response": return param("chosen") === "refuse" ? "petition" : "charter";
    case "ledger.population": return number("percent") >= 0 ? "population_up" : "population_down";
    case "ledger.treasury_turn": return number("net") >= 0 ? "market_busy" : "market_quiet";
    case "ledger.departures": case "person.left": return "household_departure";
    case "person.burnt": return "fire";
    case "person.emptied": return "house_hungry";
    default: return null;
  }
}

/** The scene's number: the leading record's own, or how many households the season's records counted (burnt houses
 * under a fire scene however it was led, households that left or scattered). */
function recordValue(record: HistoryRecord, templates: ReadonlyMap<string, number>): string | null {
  const number = (key: string) => Number(record.params?.[key] ?? 0);
  const copy = SEASON_LEDGER_COPY;
  switch (record.template) {
    case "ledger.population": return copy.percent(copy.signed(number("percent")));
    case "ledger.treasury_turn": return copy.pence(copy.signed(Math.round(number("net"))));
    case "ledger.departures": return copy.households(number("count"));
    case "person.left": return copy.households(templates.get("person.left") ?? 1);
    case "person.emptied": return copy.households(templates.get("person.emptied") ?? 1);
    case "person.burnt": return copy.houses(templates.get("person.burnt") ?? 1);
    case "event.arrived": { const burnt = templates.get("person.burnt") ?? 0; return recordScene(record) === "fire" && burnt > 0 ? copy.houses(burnt) : null; }
    default: return null;
  }
}

/** How much a change of one unit weighs among the numbers (people count more than a sack; UI-3). */
const NUMBER_WEIGHT = { population: 10, bread: 1, wheat: 1, timber: 1, stone: 1, coin: 1 } as const;
function numberScenes(ledger: SeasonLedger): readonly (SeasonScene & { readonly weight: number })[] {
  const copy = SEASON_LEDGER_COPY; const scenes: (SeasonScene & { weight: number })[] = [];
  const add = (delta: number, key: keyof typeof NUMBER_WEIGHT, up: SeasonSceneId | null, down: SeasonSceneId | null) => {
    const id = delta > 0 ? up : delta < 0 ? down : null;
    if (id !== null) scenes.push({ id, value: key === "coin" ? copy.pence(copy.signed(Math.round(delta))) : copy.signed(Math.round(delta)), weight: Math.abs(delta) * NUMBER_WEIGHT[key] });
  };
  add(ledger.popDelta, "population", "population_up", "population_down");
  add(ledger.stockDelta.bread, "bread", "bread_reserve", "bread_shortage");
  add(ledger.stockDelta.wheat, "wheat", "bread_reserve", null);
  add(ledger.stockDelta.timber, "timber", null, "timber_shortage");
  add(ledger.stockDelta.stone, "stone", null, "stone_shortage");
  add(ledger.income - ledger.expense, "coin", "market_busy", "market_quiet");
  if (ledger.notableEvents.some(event => event.kind === "first_winter_warning")) scenes.push({ id: "hungry_gap", value: null, weight: 0.5 });
  return scenes.sort((a, b) => b.weight - a.weight);
}

export const SEASON_SCENES = 3;

/** The closed season's three scenes: its weightiest ledger records, then its numbers. */
export function seasonLedgerScenes(state: Pick<GameState, "history">, ledger: SeasonLedger, previous: SeasonLedger | undefined): readonly SeasonScene[] {
  // Records written when the season before closed carry its last tick: start after it.
  const from = previous === undefined ? ledger.startTick : previous.endTick + 1;
  const records = history.query(state, { severity: 1, range: { from, to: ledger.endTick } })
    .map(record => ({ record, id: recordScene(record) }))
    .filter((entry): entry is { record: HistoryRecord; id: SeasonSceneId } => entry.id !== null)
    .sort((a, b) => b.record.severity - a.record.severity || a.record.tick - b.record.tick);
  const templates = new Map<string, number>();
  for (const { record } of records) templates.set(record.template, (templates.get(record.template) ?? 0) + 1);
  const scenes: SeasonScene[] = [];
  const seen = new Set<SeasonSceneId>();
  for (const { record, id } of records) {
    if (seen.has(id)) continue;
    seen.add(id); scenes.push({ id, value: recordValue(record, templates) });
  }
  for (const scene of numberScenes(ledger)) if (!seen.has(scene.id)) { seen.add(scene.id); scenes.push({ id: scene.id, value: scene.value }); }
  return scenes.slice(0, SEASON_SCENES);
}
