/**
 * WALL-SHARE diagnosis (the user's ruling 2026-10-19): why seed 1's palisade got no timber for years after its charter
 * while the stores held some — diagnosis only, nothing changed. The lord slice played by the lord bot; every 50 ticks
 * from `fromYear` while palisade sites are open, the construction delivery's view of the wall (`spawnSiteDelivery`):
 *  - the charter wait (`charterTimberContext`: the next charter building's timber kept in stock, the wall's share of the
 *    rest, a wanted supplier's keep) and the reserve's floors (a quarter of the stock at the proclamation);
 *  - at each timber source, the timber held and what the wall may take (`wallDeliveryAvailable`);
 *  - whether an ordinary site wanted timber then — ordinary sites are served before walls (`nearestWallCandidate`),
 *    one site delivery a tick;
 *  - the season's timber delivered by site kind.
 * Each sample is put in one class: the wall could take timber and ordinary sites wanted none / ordinary sites first /
 * the wall's allowance 0 (by keep, floor or share) / no timber held.
 * Usage: npx tsx scripts/wallShareProbe.ts <seed> <years> [fromYear] > out.json
 */
import { charterTimberContext } from "../src/agents/deliveryConstruction";
import { LORD_SLICE_SCENARIO_ID } from "../src/content/lordSliceConfig";
import { wallDeliveryAvailable } from "../src/domain/wallReserve";
import { constructionDeliveryNeed, isBuildingConstructionSite } from "../src/economy/construction";
import type { GameState } from "../src/engine/engine.types";
import { lordBotCommands } from "../src/engine/lordBot";
import { stateCalendar } from "../src/engine/scenarioState";
import { createDeliveryInventoryPort } from "../src/engine/simulationPorts";
import { advanceTick } from "../src/engine/tick";
import { gameReducer } from "../src/state/gameStore";
import { newGameState } from "../src/state/newGame";

const seed = Number(process.argv[2] ?? 1);
const years = Number(process.argv[3] ?? 16);
const inventory = createDeliveryInventoryPort();
const timberWanted = (state: GameState) => new Map(state.constructionSites.map(site => [site.id, { kind: site.kind, timber: constructionDeliveryNeed(site).timber ?? 0 }]));

let state = newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed }) as GameState;
const start = stateCalendar(state).year;
const fromYear = Number(process.argv[4] ?? start);
type Season = { year: number; season: number; samples: number; classes: Record<string, number>; delivered: Record<string, number>; ordinaryKinds: Record<string, number>; example: unknown };
const seasons: Season[] = [];
let current: Season | null = null;
while (stateCalendar(state).year < start + years) {
  for (const { command } of lordBotCommands(state)) { const next = gameReducer(state, command); if (next !== state) state = next; }
  const before = timberWanted(state);
  state = advanceTick(state);
  const year = stateCalendar(state).year;
  if (year < fromYear) continue;
  if (current === null || state.tick % 1_000 === 1) {
    current = { year, season: Math.floor((state.tick % 4_000) / 1_000), samples: 0, classes: {}, delivered: {}, ordinaryKinds: {}, example: null };
    seasons.push(current);
  }
  const after = timberWanted(state);
  for (const [id, was] of before) { const now = after.get(id)?.timber ?? 0; if (was.timber > now && after.has(id)) current.delivered[was.kind] = (current.delivered[was.kind] ?? 0) + was.timber - now; }
  const walls = state.constructionSites.filter(site => site.kind === "palisade_segment" && (constructionDeliveryNeed(site).timber ?? 0) > 0);
  if (state.tick % 50 !== 0 || walls.length === 0) continue;
  current.samples += 1;
  const ctx = charterTimberContext({ buildings: state.buildings, constructionSites: state.constructionSites, inventory, treasuryTimber: state.treasuryTimber, lordSupply: state.agency !== undefined });
  const sources = state.buildings.map(b => ({ id: b.id, kind: b.kind, held: inventory.availableStock(b, "timber") })).filter(s => s.held > 0);
  const held = sources.reduce((s, x) => s + x.held, 0);
  const priority = state.wallConstructionPriority ?? "balanced";
  const wallMay = sources.reduce((s, x) => s + wallDeliveryAvailable(state.wallConstructionReserve, priority, x.id, "timber", x.held, ctx), 0);
  const ordinary = state.constructionSites.filter(site => isBuildingConstructionSite(site) && (constructionDeliveryNeed(site).timber ?? 0) > 0);
  for (const site of ordinary) current.ordinaryKinds[site.kind] = (current.ordinaryKinds[site.kind] ?? 0) + 1;
  const floors = state.wallConstructionReserve?.resource === "timber" ? state.wallConstructionReserve.sources.reduce((s, x) => s + x.floor, 0) : 0;
  let why: string;
  if (held === 0) why = "no_timber_held";
  else if (wallMay > 0 && ordinary.length > 0) why = "ordinary_sites_first";
  else if (wallMay > 0) why = "wall_could_take";
  else why = `wall_allowance_0:${ctx.wait.keep >= held ? "keep>=held" : floors >= held ? "floor>=held" : "share"}`;
  current.classes[why] = (current.classes[why] ?? 0) + 1;
  current.example ??= { tick: state.tick, held, wallMay, keep: ctx.wait.keep, sharePermille: ctx.wait.wallSharePermille, supplierKeep: ctx.supplierKeep, floors, priority,
    ordinary: ordinary.map(site => `${site.kind}:${constructionDeliveryNeed(site).timber}`), charterNext: ["market", "church"].find(kind => !state.buildings.some(b => b.kind === kind)) ?? null };
}
console.log(JSON.stringify({ seed, years, fromYear, seasons: seasons.filter(s => s.samples > 0 || Object.keys(s.delivered).length > 0) }, null, 1));
