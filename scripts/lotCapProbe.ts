/**
 * LOT-CAP diagnosis (the user's ruling 2026-10-19): why the lord slice's town stops at 24 houses and its people at 528,
 * and why its palisade is slow — diagnosis only, nothing changed. The lord slice played by the lord bot (as
 * `growBlockProbe.ts`); for each season from `fromYear`:
 *  - the houses: count, the housing-lot cap (`LORD_MODE_POLICY.maxHousingLots`), house sites inside the wall still free
 *    (`interiorHouseSites`), levels, and what the houses below level 4 lack (`houseRequirementRows`);
 *  - the palisade: segments done of all, wall sites open, and the timber they still want;
 *  - the timber: held in stores, at sawmills, on carts; made at sawmills that season; delivered that season by the kind
 *    of site it went to (a site's timber still wanted falling); and where the logs lie (by the kind of holder);
 *  - the cloth buildings standing or begun (weaver's house, fulling mill, dyehouse, tenter yard) and the timber their
 *    building costs (the user's ruling 2026-10-19: does the palisade's timber go there?).
 * Usage: npx tsx scripts/lotCapProbe.ts <seed> <years> [fromYear] > out.json
 */
import type { CarterWalker } from "../src/agents/walker.types";
import { BUILDING_CONFIG_BY_KIND } from "../src/content/buildingConfig";
import { LORD_SLICE_SCENARIO_ID } from "../src/content/lordSliceConfig";
import { constructionDeliveryNeed } from "../src/economy/construction";
import { interiorHouseSites } from "../src/engine/autoplayInteriorPlots";
import type { GameState } from "../src/engine/engine.types";
import { lordBotCommands } from "../src/engine/lordBot";
import { stateCalendar } from "../src/engine/scenarioState";
import { advanceTick } from "../src/engine/tick";
import { LORD_MODE_POLICY } from "../src/engine/townAgency";
import { gameReducer } from "../src/state/gameStore";
import { newGameState } from "../src/state/newGame";
import { houseRequirementRows } from "./autoplayStallProbe";

const seed = Number(process.argv[2] ?? 1);
const years = Number(process.argv[3] ?? 20);
const inv = (holder: { readonly inventory?: Readonly<Record<string, number | undefined>> }, resource: string) => holder.inventory?.[resource] ?? 0;
const carts = (state: GameState) => state.walkers.filter((walker): walker is CarterWalker => walker.kind === "carter" && walker.cancellation === null);
const timberWanted = (state: GameState) => new Map(state.constructionSites.map(site => [site.id, { kind: site.kind, timber: constructionDeliveryNeed(site).timber ?? 0 }]));

let state = newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed }) as GameState;
const start = stateCalendar(state).year;
const fromYear = Number(process.argv[4] ?? start);
type Season = { year: number; season: number; made: number; delivered: Record<string, number>; end: unknown };
const seasons: Season[] = [];
let current: Season | null = null;
while (stateCalendar(state).year < start + years) {
  for (const { command } of lordBotCommands(state)) { const next = gameReducer(state, command); if (next !== state) state = next; }
  const before = state;
  const wantedBefore = timberWanted(before);
  state = advanceTick(state);
  const year = stateCalendar(state).year;
  if (year < fromYear) continue;
  if (current === null || state.tick % 1_000 === 1) {
    current = { year, season: Math.floor((state.tick % 4_000) / 1_000), made: 0, delivered: {}, end: null };
    seasons.push(current);
  }
  // Timber made: each sawmill's timber gained this tick plus what its new carts took out this tick.
  const oldCarts = new Set(before.walkers.map(walker => walker.id));
  for (const mill of state.buildings.filter(b => b.kind === "sawmill")) {
    const was = before.buildings.find(b => b.id === mill.id);
    const loaded = carts(state).filter(c => !oldCarts.has(c.id) && c.homeBuildingId === mill.id && c.reservation.resource === "timber" && c.mission === "deliver")
      .reduce((s, c) => s + c.reservation.amount, 0);
    current.made += Math.max(0, inv(mill, "timber") - (was === undefined ? 0 : inv(was, "timber")) + loaded);
  }
  // Timber delivered: a site's timber still wanted falling (or the site finished with timber still counted before).
  const wantedAfter = timberWanted(state);
  for (const [id, was] of wantedBefore) {
    const now = wantedAfter.get(id)?.timber ?? 0;
    if (was.timber > now && wantedAfter.has(id)) current.delivered[was.kind] = (current.delivered[was.kind] ?? 0) + (was.timber - now);
  }
  if (state.tick % 1_000 !== 0) continue;
  const levels: Record<number, number> = {};
  for (const house of state.houses) levels[house.level] = (levels[house.level] ?? 0) + 1;
  const lacks: Record<string, number> = {};
  for (const house of houseRequirementRows(state).filter(row => row.level < 4)) {
    for (const key of [!house.water ? "water" : null, !house.bread ? "bread" : null, house.market !== "served" ? `market:${house.market}` : null,
      house.church !== "served" ? `church:${house.church}` : null, house.protection === "outside" ? "outside_wall" : null]) if (key !== null) lacks[key] = (lacks[key] ?? 0) + 1;
  }
  const logsBy: Record<string, number> = {};
  for (const b of state.buildings) if (inv(b, "logs") > 0) logsBy[b.kind] = (logsBy[b.kind] ?? 0) + inv(b, "logs");
  const cartLogs = carts(state).filter(c => c.reservation.resource === "logs").reduce((s, c) => s + c.reservation.amount, 0);
  const wallSites = state.constructionSites.filter(site => site.kind === "palisade_segment");
  current.end = {
    population: state.population, era: state.era, houses: state.houses.length, lotCap: LORD_MODE_POLICY.maxHousingLots,
    interiorSitesFree: state.palisade === null ? null : interiorHouseSites(state).length, levels, lacks,
    palisade: state.palisade === null ? null : { done: state.palisade.segments.filter(s => s.completed).length, all: state.palisade.segments.length,
      openSites: wallSites.length, timberWanted: wallSites.reduce((s, site) => s + (constructionDeliveryNeed(site).timber ?? 0), 0) },
    otherSitesTimberWanted: state.constructionSites.filter(site => site.kind !== "palisade_segment").reduce((s, site) => s + (constructionDeliveryNeed(site).timber ?? 0), 0),
    timberIn: { stores: state.buildings.filter(b => b.kind === "storehouse").reduce((s, b) => s + inv(b, "timber"), 0),
      sawmills: state.buildings.filter(b => b.kind === "sawmill").reduce((s, b) => s + inv(b, "timber"), 0),
      carts: carts(state).filter(c => c.reservation.resource === "timber").reduce((s, c) => s + c.reservation.amount, 0) },
    logsBy, cartLogs,
    sawmills: state.buildings.filter(b => b.kind === "sawmill").map(b => `${b.workers}w:${inv(b, "logs")}l/${inv(b, "timber")}t`),
    camps: state.buildings.filter(b => b.kind === "logging_camp").length,
    cloth: Object.fromEntries((["weaver_house", "fulling_mill", "dyehouse", "tenter_yard"] as const).map(kind => {
      const built = state.buildings.filter(b => b.kind === kind).length;
      const begun = state.constructionSites.filter(site => site.kind === kind).length;
      return [kind, { built, begun, timber: (built + begun) * (BUILDING_CONFIG_BY_KIND[kind].buildCost.timber ?? 0) }];
    })),
  };
}
console.log(JSON.stringify({ seed, years, fromYear, seasons }, null, 1));
