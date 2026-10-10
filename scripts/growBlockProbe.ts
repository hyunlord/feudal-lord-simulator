// GROW-BLOCK gate (the user's ruling 2026-10-09): the lord's slice played by the lord-mode bot for 125 years; each year
// the town's size and wall, and the woods (stumps standing, trees felled that year, the wood in store, the camps and
// sawmills). The summary: the highest population (the gate: past 528), the first palisade, and every stall — ten years
// or more with the population and the wall both unchanged below the lord mode's full town (24 lots at level 4, 768), and
// whether the walled town's house sites had all run out under its fields through it (GROW-BLOCK-2's count).
//   tsx scripts/growBlockProbe.ts <seed> [years] [saveDir] > out.json   (saveDir: saves a season and five years after the
//   market charter, and at the end — seed<n>-charter-season-<year>, seed<n>-charter-5y-<year>, seed<n>-final-<year>;
//   [saveYears], comma-separated: also at the first tick of each — seed<n>-year-<year>)
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { BUILDING_CONFIG_BY_KIND } from "../src/content/buildingConfig";
import { LORD_SLICE_SCENARIO_ID } from "../src/content/lordSliceConfig";
import { isBuildingConstructionSite } from "../src/economy/construction";
import type { GameState } from "../src/engine/engine.types";
import { interiorHouseSites } from "../src/engine/autoplayInteriorPlots";
import { autoplayCanPlace } from "../src/engine/autoplayZones";
import { treeStage } from "../src/engine/land";
import { constructionDeliveryNeed } from "../src/economy/construction";
import { evaluateEraRequirements } from "../src/engine/era";
import { houseRequirementRows } from "./autoplayStallProbe";
import { lordBotCommands } from "../src/engine/lordBot";
import { stateCalendar } from "../src/engine/scenarioState";
import { advanceTick } from "../src/engine/tick";
import { LORD_MODE_POLICY } from "../src/engine/townAgency";
import { encodeSave } from "../src/save/saveCodec";
import { gameReducer } from "../src/state/gameStore";
import { newGameState } from "../src/state/newGame";
import { zonesOf } from "../src/zones/zoneEdits";

const YEAR = 4_000;
const FULL_TOWN = 768;

/** GROW-BLOCK-2: the house sites inside the wall — how many, how many on a field (arable zone), how many the bot can build. */
function interior(state: GameState) {
  if (state.palisade === null || state.palisade === undefined) return null;
  const sites = interiorHouseSites(state);
  const { width, height } = BUILDING_CONFIG_BY_KIND.house;
  const fields = new Set(zonesOf(state).filter(zone => zone.kind === "arable").flatMap(zone => zone.membership));
  const onField = (tx: number, ty: number) => {
    for (let dy = 0; dy < height; dy += 1) for (let dx = 0; dx < width; dx += 1) if (fields.has((ty + dy) * state.width + tx + dx)) return true;
    return false;
  };
  const placeable = sites.filter(site => autoplayCanPlace(state, "house", site.tx, site.ty, "later"));
  return { sites: sites.length, onFields: sites.filter(site => onField(site.tx, site.ty)).length, placeable: placeable.length,
    placeableOffField: placeable.filter(site => !onField(site.tx, site.ty)).length, lotsNeeded: Math.max(0, LORD_MODE_POLICY.maxHousingLots - state.houses.length) };
}

/**
 * What a stalled town waits for (the user's split of "other", 2026-10-10): the next era's unmet conditions, the houses
 * below level 4 and what each lacks (water, bread, a market or church serving it, the wall's protection), and the open
 * building sites with their stall and the materials they still want.
 */
function waiting(state: GameState) {
  const unmet = evaluateEraRequirements(state).filter(requirement => !requirement.met).map(requirement => `${requirement.key}:${requirement.current}/${requirement.target}`);
  const below = houseRequirementRows(state).filter(house => house.level < 4);
  const lacks: Record<string, number> = {};
  for (const house of below) {
    const missing = [!house.water ? "water" : null, !house.bread ? "bread" : null, house.market !== "served" ? `market:${house.market}` : null,
      house.church !== "served" ? `church:${house.church}` : null, house.protection === "outside" ? "outside_wall" : null].filter(entry => entry !== null);
    for (const key of missing) lacks[key!] = (lacks[key!] ?? 0) + 1;
  }
  const sites = state.constructionSites.filter(isBuildingConstructionSite).map(site => {
    const need = Object.entries(constructionDeliveryNeed(site)).filter(([, amount]) => (amount ?? 0) > 0).map(([resource, amount]) => `${resource}${amount}`).join("+");
    return `${site.kind}:${site.stall ?? "none"}${need === "" ? "" : `:${need}`}`;
  });
  return { unmet, belowL4: below.length, lacks, sites };
}

function row(state: GameState, year: number) {
  const kinds: Record<string, number> = {};
  for (const building of state.buildings) kinds[building.kind] = (kinds[building.kind] ?? 0) + 1;
  let timber = 0; let logs = 0;
  for (const building of state.buildings) {
    const held = building as { readonly stock?: Readonly<Record<string, number>>; readonly inventory?: Readonly<Record<string, number>> };
    const stock = held.inventory ?? held.stock ?? {};
    timber += stock.timber ?? 0; logs += stock.logs ?? 0;
  }
  const harvests = state.forestHarvests ?? [];
  return { year, population: state.population, era: state.era, palisade: state.palisade?.polygon.length ?? 0, houses: state.houses.length,
    buildings: state.buildings.length, camps: kinds.logging_camp ?? 0, sawmills: kinds.sawmill ?? 0, quarry: kinds.quarry ?? 0, church: kinds.church ?? 0,
    stumps: harvests.filter(harvest => treeStage(harvest, state.tick) === "stump").length,
    felled: harvests.filter(harvest => harvest.harvestedAtTick > state.tick - YEAR).length, timber, logs,
    abandoned: state.agency?.abandonedSites?.length ?? 0, charterFailures: state.agency?.charterWallFailure?.attempts ?? 0, interior: interior(state), waiting: waiting(state) };
}

/** Renderer A's state bundle and the next Astra play (2026-10-10): saves a season after the market charter, some years on, and at the end. */
const SAVE_AFTER_CHARTER = { season: 1_000, years: 5 * YEAR } as const;

function writeState(dir: string, name: string, state: GameState) {
  mkdirSync(dir, { recursive: true });
  const now = new Date().toISOString();
  writeFileSync(`${dir}/${name}.save.json`, encodeSave({ state, createdAt: now, savedAt: now }).bytes);
}

export function growBlockProbe(seed: number, years = 125, saveDir?: string, saveYears: ReadonlySet<number> = new Set()) {
  let state = newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed }) as GameState;
  const start = stateCalendar(state).year;
  const rows: (ReturnType<typeof row> & { abandonedBy: Record<string, number>; replaced: number })[] = [];
  let lastYear = start;
  // GB-4/GB-5: the sites given up this year by their reason, and a site laid out again where one was given up.
  const seenSites = new Set<string>();
  const seenAbandoned = new Set<string>();
  const abandonedSpots: { kind: string; tx: number; ty: number }[] = [];
  let abandonedBy: Record<string, number> = {};
  let replaced = 0;
  let charterTick: number | null = null;
  const saved = new Set<string>();
  const saveOnce = (name: string) => { const key = name === "year" ? `year-${stateCalendar(state).year}` : name;
    if (saveDir !== undefined && !saved.has(key)) { saved.add(key); writeState(saveDir, `seed${seed}-${name}-${stateCalendar(state).year}`, state); } };
  while (stateCalendar(state).year < start + years) {
    for (const { command } of lordBotCommands(state)) { const next = gameReducer(state, command); if (next !== state) state = next; }
    state = advanceTick(state);
    if (charterTick === null && state.era !== "hamlet") charterTick = state.tick;
    if (charterTick !== null && state.tick - charterTick === SAVE_AFTER_CHARTER.season) saveOnce("charter-season");
    if (charterTick !== null && state.tick - charterTick === SAVE_AFTER_CHARTER.years) saveOnce("charter-5y");
    // The years asked for (a stall's middle, for engine B's handoff): the first tick of each.
    if (saveYears.has(stateCalendar(state).year)) saveOnce(`year`);
    for (const entry of state.agency?.abandonedSites ?? []) if (!seenAbandoned.has(entry.id)) {
      seenAbandoned.add(entry.id); abandonedSpots.push(entry); abandonedBy[entry.reason] = (abandonedBy[entry.reason] ?? 0) + 1;
    }
    for (const site of state.constructionSites) if (!seenSites.has(site.id)) {
      seenSites.add(site.id);
      if (isBuildingConstructionSite(site) && abandonedSpots.some(spot => spot.kind === site.kind && spot.tx === site.tx && spot.ty === site.ty)) replaced += 1;
    }
    const year = stateCalendar(state).year;
    if (year !== lastYear) { lastYear = year; rows.push({ ...row(state, year), abandonedBy, replaced }); abandonedBy = {}; replaced = 0; }
  }
  saveOnce("final");
  const stalls: { from: number; to: number; population: number; palisade: number; fieldBound: boolean; interior: ReturnType<typeof interior> }[] = [];
  let runStart = 0;
  for (let index = 1; index <= rows.length; index += 1) {
    const same = index < rows.length && rows[index]!.population === rows[runStart]!.population && rows[index]!.palisade === rows[runStart]!.palisade;
    if (same) continue;
    const first = rows[runStart]!, last = rows[index - 1]!;
    // GROW-BLOCK-2: a stall is the fields' when, all through it, house sites inside the wall lie on fields and those off
    // the fields the bot can build are fewer than the lots still to build.
    const run = rows.slice(runStart, index);
    const fieldBound = run.every(entry => entry.interior !== null && entry.interior.onFields > 0 && entry.interior.placeableOffField < entry.interior.lotsNeeded);
    if (last.year - first.year >= 10 && first.population < FULL_TOWN) stalls.push({ from: first.year, to: last.year, population: first.population, palisade: first.palisade, fieldBound,
      interior: last.interior });
    runStart = index;
  }
  return { seed, years, maxPopulation: Math.max(...rows.map(entry => entry.population)), firstPalisade: rows.find(entry => entry.palisade > 0)?.year ?? null,
    stalls, peakStumps: Math.max(...rows.map(entry => entry.stumps)), abandoned: rows.reduce((sum, entry) => sum + Object.values(entry.abandonedBy).reduce((a, b) => a + b, 0), 0),
    replaced: rows.reduce((sum, entry) => sum + entry.replaced, 0), rows };
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [seed = "1", years = "125", saveDir, saveYears = ""] = process.argv.slice(2);
  const asked = new Set(saveYears.split(",").filter(entry => entry !== "").map(Number));
  process.stdout.write(`${JSON.stringify(growBlockProbe(Number(seed), Number(years), saveDir, asked))}\n`);
}
