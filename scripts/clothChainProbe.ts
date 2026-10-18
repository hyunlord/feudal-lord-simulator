/**
 * CLOTH-DIAG (the user's ruling 2026-10-18): why no yarn is made in lord mode — diagnosis only, nothing changed. The lord
 * slice played by the lord bot (as `growBlockProbe.ts`); at each year's start:
 *  - the bot's cloth step: `clothTime` (after chapter 3 in a campaign, from 1364 elsewhere — `autoplayCloth.ts`) and what
 *    `clothChainAction` would do now;
 *  - the wool: pasture cells (`pasture` zones), pastoral farms, fleece held;
 *  - the spinning: houses at the spinning level (CLOTH_BALANCE.spinFromLevel), houses spinning, yarn held;
 *  - the chain's buildings and who began them (the town's `agency.project_started` records: actor, planner);
 *  - at the end, the fulling mill's site refusals over the map (`autoplaySiteCheck`, the placement split by reason).
 * Usage: npx tsx scripts/clothChainProbe.ts <seed> <years> > out.json
 */
import { BUILDING_CONFIG_BY_KIND } from "../src/content/buildingConfig";
import { CLOTH_BALANCE } from "../src/content/clothConfig";
import { LORD_SLICE_SCENARIO_ID } from "../src/content/lordSliceConfig";
import { autoplayBuildAction, autoplaySiteCheck } from "../src/engine/autoplay";
import { clothChainAction, clothTime } from "../src/engine/autoplayCloth";
import { spinningSlot } from "../src/engine/cloth";
import type { GameState } from "../src/engine/engine.types";
import { lordBotCommands } from "../src/engine/lordBot";
import { stateCalendar } from "../src/engine/scenarioState";
import { advanceTick } from "../src/engine/tick";
import { gameReducer } from "../src/state/gameStore";
import { newGameState } from "../src/state/newGame";
import { canPlaceBuilding } from "../src/world/placement";
import { zonesOf } from "../src/zones/zoneEdits";

const seed = Number(process.argv[2] ?? 22);
const years = Number(process.argv[3] ?? 30);
const CHAIN = ["pastoral_farm", "weaver_house", "fulling_mill", "dyehouse", "tenter_yard"] as const;
const count = (state: GameState, kind: string) => state.buildings.filter(b => b.kind === kind).length;
const held = (state: GameState, resource: string) => state.buildings.reduce((s, b) => s + ((b.inventory as Record<string, number | undefined>)[resource] ?? 0), 0);

let state = newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed }) as GameState;
const start = stateCalendar(state).year;
const rows: unknown[] = [];
let lastYear = start - 1;
while (stateCalendar(state).year < start + years) {
  for (const { command } of lordBotCommands(state)) { const next = gameReducer(state, command); if (next !== state) state = next; }
  state = advanceTick(state);
  const year = stateCalendar(state).year;
  if (year === lastYear) continue;
  lastYear = year;
  const action = clothChainAction(state, autoplayBuildAction);
  rows.push({ year, era: state.era, clothTime: clothTime(state), botClothStep: action.kind === "none" ? "none" : JSON.stringify(action).slice(0, 80),
    pasture: zonesOf(state).filter(zone => zone.kind === "pasture").reduce((s, zone) => s + zone.membership.length, 0),
    fleece: held(state, "fleece"), yarn: held(state, "yarn"),
    housesAtSpinLevel: state.houses.filter(h => h.residents > 0 && h.level >= CLOTH_BALANCE.spinFromLevel).length,
    housesSpinning: state.houses.filter(h => spinningSlot(h) !== null).length,
    built: Object.fromEntries(CHAIN.map(kind => [kind, count(state, kind)])) });
}
const begun: Record<string, Record<string, number>> = {};
for (const record of state.history?.records ?? []) {
  if (record.template !== "agency.project_started") continue;
  const what = String(record.params?.what ?? "?");
  if (!(CHAIN as readonly string[]).includes(what)) continue;
  const by = `${record.params?.actor ?? "?"}/${record.params?.planner ?? "?"}`;
  (begun[what] ??= {})[by] = (begun[what]![by] ?? 0) + 1;
}
const fulling: Record<string, number> = {};
for (const tile of state.tiles) {
  let why: string = autoplaySiteCheck(state, "fulling_mill", tile) ?? "ok";
  if (why === "placement") { const placed = canPlaceBuilding(state, "fulling_mill", tile.tx, tile.ty); why = placed.ok ? "placement:zone_or_field" : `placement:${placed.reason}`; }
  fulling[why] = (fulling[why] ?? 0) + 1;
}
console.log(JSON.stringify({ seed, years, fullingNeeds: BUILDING_CONFIG_BY_KIND.fulling_mill.requiresAdjacentTerrain, spinFromLevel: CLOTH_BALANCE.spinFromLevel,
  rows, begun, fullingSiteRefusals: fulling, fullingBotStep: JSON.stringify(autoplayBuildAction(state, "fulling_mill")) }, null, 1));
