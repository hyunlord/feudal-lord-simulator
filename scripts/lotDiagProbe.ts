/**
 * LOT-DIAG (the user's ruling 2026-10-22): why seeds 26 and 39 end with 21–23 houses under FOOD-P — diagnosis only.
 * The lord slice played by the lord bot; at each season's close:
 *  - houses (records and buildings), lots against the cap (`housingLotCount`, a merged house counts two), merged houses,
 *    abandoned and burnt houses, house sites begun, lived-in residents against the houses' capacity;
 *  - the housing step's gates (`housingAction`, `autoplay.ts`): lots at the cap, idle workers ≤ 6, population below the
 *    houses' capacity, bread under 20 or a dearth holding growth, a food site building (`hasPendingFoodChain`), a house
 *    site already open; the interior house sites left (`interiorHouseSites`);
 *  - each house that vanished since the last close: its tile and what stands there now;
 *  - with `watch=tx,ty`, the house there: level, built level, condition, what it lacks.
 * Usage: npx tsx scripts/lotDiagProbe.ts <seed> <years> [watch=tx,ty] > out.json
 */
import { HOUSING_CONFIG } from "../src/content/housingConfig";
import { LORD_SLICE_SCENARIO_ID } from "../src/content/lordSliceConfig";
import { isBuildingConstructionSite } from "../src/economy/construction";
import { hasPendingFoodChain } from "../src/engine/autoplayFood";
import { interiorHouseSites } from "../src/engine/autoplayInteriorPlots";
import { dearthHoldsGrowth } from "../src/engine/autoplayEvents";
import type { GameState } from "../src/engine/engine.types";
import { lordBotCommands } from "../src/engine/lordBot";
import { stateCalendar } from "../src/engine/scenarioState";
import { advanceTick } from "../src/engine/tick";
import { LORD_MODE_POLICY, townProposals } from "../src/engine/townAgency";
import { planningNeeds } from "../src/engine/autoplay";
import { derelictPermille } from "../src/engine/lordship";
import { houseLotArea } from "../src/geometry/buildingFootprint";
import { zoneRuleActive } from "../src/zones/zonePlacement";
import { zonesOf } from "../src/zones/zoneEdits";
import { houseBuiltLevel, houseCondition } from "../src/population/houseCondition";
import { housingLotCount } from "../src/population/housing";
import { gameReducer } from "../src/state/gameStore";
import { newGameState } from "../src/state/newGame";
import { houseRequirementRows } from "./autoplayStallProbe";

const seed = Number(process.argv[2] ?? 26);
const years = Number(process.argv[3] ?? 30);
const watchArg = process.argv.find(arg => arg.startsWith("watch="));
const watch = watchArg === undefined ? null : watchArg.slice(6).split(",").map(Number) as [number, number];

const capacity = (state: GameState) => state.houses.reduce((total, house) => total
  + (HOUSING_CONFIG.find(definition => definition.level === house.level)?.capacity ?? 0) * houseLotArea(state.buildings.find(b => b.id === house.buildingId)), 0);
const bread = (state: GameState) => state.buildings.reduce((s, b) => s + (b.inventory.bread ?? 0), 0) + state.houses.reduce((s, h) => s + h.breadStock, 0);

let state = newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed }) as GameState;
const start = stateCalendar(state).year;
const rows: unknown[] = [];
let known = new Map<string, { tx: number; ty: number }>();
const gateSeasons: Record<string, number> = {};
while (stateCalendar(state).year < start + years) {
  for (const { command } of lordBotCommands(state)) { const next = gameReducer(state, command); if (next !== state) state = next; }
  state = advanceTick(state);
  if (state.tick % 1_000 !== 0) continue;
  const calendar = stateCalendar(state);
  const homes = state.buildings.filter(b => b.kind === "house");
  const now = new Map(homes.map(b => [b.id, { tx: b.tx, ty: b.ty }]));
  const vanished = [...known].filter(([id]) => !now.has(id)).map(([id, at]) => {
    const tile = state.tiles.find(t => t.tx === at.tx && t.ty === at.ty);
    const there = tile?.buildingId === null || tile === undefined ? null : state.buildings.find(b => b.id === tile.buildingId) ?? null;
    const site = state.constructionSites.find(s => isBuildingConstructionSite(s) && s.tx === at.tx && s.ty === at.ty);
    return `${id}@${at.tx},${at.ty}→${there?.kind ?? (site !== undefined ? `site:${site.kind}` : tile?.hasRoad ? "road" : "empty")}`;
  });
  known = now;
  const lots = housingLotCount(state);
  const gates = {
    lotsAtCap: lots >= LORD_MODE_POLICY.maxHousingLots, idleLow: state.idleWorkers <= 6, belowCapacity: state.population < capacity(state),
    breadOrDearth: bread(state) < 20 || dearthHoldsGrowth(state), foodSiteBuilding: hasPendingFoodChain(state),
    houseSiteOpen: state.constructionSites.some(s => isBuildingConstructionSite(s) && s.kind === "house"),
  };
  for (const [key, on] of Object.entries(gates)) if (on && lots < LORD_MODE_POLICY.maxHousingLots) gateSeasons[key] = (gateSeasons[key] ?? 0) + 1;
  let watched: unknown = null;
  if (watch !== null) {
    const home = homes.find(b => b.tx === watch[0] && b.ty === watch[1]);
    const house = home === undefined ? undefined : state.houses.find(h => h.buildingId === home.id);
    const row = home === undefined ? undefined : houseRequirementRows(state).find(r => r.id === home.id);
    watched = house === undefined ? "none" : { level: house.level, built: houseBuiltLevel(house), condition: houseCondition(house), residents: house.residents,
      water: row?.water, bread: row?.bread, market: row?.market, church: row?.church, protection: row?.protection, merged: home?.houseLot ?? null };
  }
  rows.push({ year: calendar.year, season: Math.floor((state.tick % 4_000) / 1_000), era: state.era, population: state.population,
    houseRecords: state.houses.length, houseBuildings: homes.length, lots, merged: homes.filter(b => b.houseLot !== undefined).length,
    abandoned: state.houses.filter(h => h.abandonedTick !== undefined).length, burnt: state.houses.filter(h => h.burntTick !== undefined).length,
    houseSites: state.constructionSites.filter(s => isBuildingConstructionSite(s) && s.kind === "house").length,
    capacity: capacity(state), gates,
    // LOT-DIAG 2: the housing step's own hold (homesHeld: derelict houses at a fifth or more), the houses' conditions, and
    // whether a house is a planning need and a town proposal.
    derelictPermille: derelictPermille(state) ?? null,
    // LOT-DIAG 3: the housing step's other none — a burgage zone (houses only onto its plots, Z-15a) — and the zones.
    burgage: zoneRuleActive(state, "burgage"),
    zones: zonesOf(state).reduce((acc, zone) => { acc[zone.kind] = (acc[zone.kind] ?? 0) + zone.membership.length; return acc; }, {} as Record<string, number>),
    interiorByRoad: state.palisade === null ? null : interiorHouseSites(state).filter(site => state.tiles.find(t => t.tx === site.tx && t.ty === site.ty)?.terrain === "grass"
      && [[0, -1], [1, 0], [0, 1], [-1, 0]].some(([dx, dy]) => state.tiles.find(t => t.tx === site.tx + dx! && t.ty === site.ty + dy!)?.hasRoad === true)).length,
    conditions: state.houses.reduce((acc, h) => { const c = houseCondition(h); acc[c] = (acc[c] ?? 0) + 1; return acc; }, {} as Record<string, number>),
    houseNeed: planningNeeds(state, LORD_MODE_POLICY).filter(need => need.planner === "housing").length,
    houseProposal: (() => { const p = townProposals(state); const i = p.findIndex(x => x.what === "house"); return i < 0 ? null : `${i}/${p.length}:${p[i]!.actor}:${p[i]!.score}`; })(), interiorSites: state.palisade === null ? null : interiorHouseSites(state).length, vanished, watched });
}
console.log(JSON.stringify({ seed, years, gateSeasonsBelowCap: gateSeasons, rows }, null, 1));
