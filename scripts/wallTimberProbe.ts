// GROW-BLOCK-2a ③⑥: what sets the pace of a palisade waiting on timber — every production window from the market
// charter until the wall's sites are done: the wall timber still wanted, the camps and sawmills (and how many are
// staffed), logs and timber in the stores, the timber made in the window, idle hands, the reserve deadlock, and what BT6
// and S8-F1 would add. Lord mode, the lord's bot.
//   tsx scripts/wallTimberProbe.ts <seed> [years] > out.json
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { BUILDING_CONFIG_BY_KIND } from "../src/content/buildingConfig";
import { LORD_SLICE_SCENARIO_ID } from "../src/content/lordSliceConfig";
import { constructionDeliveryNeed, isWallConstructionSite } from "../src/economy/construction";
import { timberDemandExpansionKind } from "../src/engine/autoplayTimberDemand";
import { timberExpansionKind } from "../src/engine/autoplayTimberRecovery";
import type { GameState } from "../src/engine/engine.types";
import { lordBotCommands } from "../src/engine/lordBot";
import { reserveDeadlock } from "../src/engine/reserveDeadlock";
import { stateCalendar } from "../src/engine/scenarioState";
import { advanceTick } from "../src/engine/tick";
import { gameReducer } from "../src/state/gameStore";
import { newGameState } from "../src/state/newGame";

const WINDOW = 2_400;

function sample(state: GameState) {
  const wall = state.constructionSites.filter(isWallConstructionSite);
  const of = (kind: "logging_camp" | "sawmill") => state.buildings.filter(building => building.kind === kind);
  const staffed = (kind: "logging_camp" | "sawmill") => of(kind).filter(building => building.workers >= BUILDING_CONFIG_BY_KIND[kind].workersRequired).length;
  const held = (resource: "logs" | "timber") => state.buildings.reduce((sum, building) => sum + (building.inventory[resource] ?? 0), 0);
  return { tick: state.tick, year: stateCalendar(state).year, wallSites: wall.length,
    wallTimber: wall.reduce((sum, site) => sum + (constructionDeliveryNeed(site).timber ?? 0), 0),
    stalls: wall.reduce((counts: Record<string, number>, site) => (counts[site.stall ?? "none"] = (counts[site.stall ?? "none"] ?? 0) + 1, counts), {}),
    camps: of("logging_camp").length, campsStaffed: staffed("logging_camp"), sawmills: of("sawmill").length, sawmillsStaffed: staffed("sawmill"),
    logs: held("logs"), timber: held("timber"), made: state.timberProductionWindow?.produced ?? null, idle: state.idleWorkers,
    deadlock: reserveDeadlock(state)?.blockedResource ?? null, bt6: timberDemandExpansionKind(state), s8f1: timberExpansionKind(state),
    population: state.population };
}

export function wallTimberProbe(seed: number, years = 40) {
  let state = newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed }) as GameState;
  const start = stateCalendar(state).year;
  const rows: ReturnType<typeof sample>[] = [];
  let charter: number | null = null;
  let done: number | null = null;
  while (stateCalendar(state).year < start + years && done === null) {
    for (const { command } of lordBotCommands(state)) { const next = gameReducer(state, command); if (next !== state) state = next; }
    state = advanceTick(state);
    if (charter === null && state.era !== "hamlet") charter = state.tick;
    if (charter !== null && (state.tick - charter) % WINDOW === 0) {
      const row = sample(state);
      rows.push(row);
      if (row.wallSites === 0 && state.tick - charter > WINDOW) done = state.tick;
    }
  }
  return { seed, charterTick: charter, charterYear: charter === null ? null : stateCalendar({ ...state, tick: charter }).year,
    wallDoneTick: done, wallYears: charter === null || done === null ? null : (done - charter) / 4_000, rows };
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [seed = "1", years = "40"] = process.argv.slice(2);
  process.stdout.write(`${JSON.stringify(wallTimberProbe(Number(seed), Number(years)))}\n`);
}
