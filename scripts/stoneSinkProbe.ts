/**
 * STONE-SINK (the user's ruling 2026-10-20): after their fifth storehouse seeds 23, 32 and 33 filled the stores again by
 * 1324 — where should the dressed stone go and why does it not — diagnosis only, nothing changed. The lord slice played
 * by the lord bot; at each season's end from the stone town on:
 *  - where the stone and the raw stone lie (storehouses, masonries, carts, building sites) and what fills the storehouses;
 *  - the stone's uses: the stone wall's replacement segments (`confirmStoneTownProclamation`, 25 each — done, open, the
 *    stone they still want), the other building sites wanting stone (the church 60, the keep 150), the churches and keeps
 *    built and begun, whether the keep is open and its builder (`LORD_PUBLIC_WORKS`: the lord's, no town proposal);
 *  - the carters' carry-out (`haulStuckStock` TR-7 (b)): a market, carters, the stone the stuck-stock list names
 *    (`stuckStock`, reason) and the stone above the town's reserve (`carryOutReserve`);
 *  - the masonries: staffed, holding a full output (the stone they cannot send).
 * Usage: npx tsx scripts/stoneSinkProbe.ts <seed> <years> > out.json
 */
import { BUILDING_CONFIG_BY_KIND } from "../src/content/buildingConfig";
import { LORD_SLICE_SCENARIO_ID } from "../src/content/lordSliceConfig";
import { TRADE_BALANCE } from "../src/content/trades";
import { constructionDeliveryNeed, isBuildingConstructionSite } from "../src/economy/construction";
import type { GameState } from "../src/engine/engine.types";
import { lordBotCommands } from "../src/engine/lordBot";
import { stateCalendar } from "../src/engine/scenarioState";
import { stuckStock } from "../src/engine/stuckStock";
import { advanceTick } from "../src/engine/tick";
import { townProposals } from "../src/engine/townAgency";
import { gameReducer } from "../src/state/gameStore";
import { newGameState } from "../src/state/newGame";
import { isBuildingOpen } from "../src/world/placement";

const seed = Number(process.argv[2] ?? 32);
const years = Number(process.argv[3] ?? 30);
const sum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0);

let state = newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed }) as GameState;
const start = stateCalendar(state).year;
const rows: unknown[] = [];
let stoneTownYear: number | null = null;
while (stateCalendar(state).year < start + years) {
  for (const { command } of lordBotCommands(state)) { const next = gameReducer(state, command); if (next !== state) state = next; }
  state = advanceTick(state);
  if (state.era !== "stone_town" || state.tick % 1_000 !== 0) continue;
  const calendar = stateCalendar(state);
  stoneTownYear ??= calendar.year;
  const stores = state.buildings.filter(b => b.kind === "storehouse");
  const contents: Record<string, number> = {};
  for (const store of stores) for (const [good, amount] of Object.entries(store.inventory)) if ((amount ?? 0) > 0) contents[good] = (contents[good] ?? 0) + amount!;
  const carts = state.walkers.reduce((acc, walker) => {
    const cargo = (walker as { cargo?: { resource?: string; amount?: number } }).cargo;
    if (cargo?.resource === "stone" || cargo?.resource === "stone_raw") acc[cargo.resource] = (acc[cargo.resource] ?? 0) + (cargo.amount ?? 0);
    return acc;
  }, {} as Record<string, number>);
  const masonries = state.buildings.filter(b => b.kind === "masonry");
  const wallSites = state.constructionSites.filter(site => site.kind === "stone_wall_segment");
  const segments = state.palisade?.segments ?? [];
  const otherStoneSites = state.constructionSites.filter(site => site.kind !== "stone_wall_segment" && (site.required.stone ?? 0) > 0)
    .map(site => `${site.kind}:${site.delivered.stone ?? 0}/${site.required.stone}`);
  const begun = (kind: string) => state.constructionSites.filter(site => isBuildingConstructionSite(site) && site.kind === kind).length;
  const built = (kind: string) => state.buildings.filter(b => b.kind === kind).length;
  const stuck = stuckStock(state).filter(entry => entry.resource === "stone" || entry.resource === "stone_raw")
    .map(entry => `${entry.resource}:${entry.reason}:${entry.amount}`);
  const stoneHeld = sum(state.buildings.map(b => Math.max(0, b.inventory.stone ?? 0)));
  rows.push({
    year: calendar.year, season: Math.floor((state.tick % 4_000) / 1_000), population: state.population,
    storehouses: { count: stores.length, held: sum(Object.values(contents)), capacity: stores.length * BUILDING_CONFIG_BY_KIND.storehouse.storageCapacity, contents },
    stone: { inBuildings: stoneHeld, inStores: contents.stone ?? 0, inMasonries: sum(masonries.map(b => b.inventory.stone ?? 0)), carts,
      rawInBuildings: sum(state.buildings.map(b => Math.max(0, b.inventory.stone_raw ?? 0))) },
    stoneWall: { segments: segments.length, stoneDone: segments.filter(s => s.completed && s.material === "stone").length,
      openSites: wallSites.length, stoneWanted: sum(wallSites.map(site => constructionDeliveryNeed(site).stone ?? 0)),
      delivered: sum(wallSites.map(site => site.delivered.stone ?? 0)), priority: state.wallConstructionPriority ?? null },
    otherStoneSites,
    churches: { built: built("church"), begun: begun("church") }, keep: { open: isBuildingOpen(state, "keep"), built: built("keep"), begun: begun("keep") },
    proposalsUsingStone: townProposals(state).filter(p => (BUILDING_CONFIG_BY_KIND[p.what as keyof typeof BUILDING_CONFIG_BY_KIND]?.buildCost?.stone ?? 0) > 0)
      .map(p => `${p.what}:${p.actor}:${p.score}`),
    carryOut: { market: built("market") > 0, carters: (state.trades?.households ?? []).filter(h => h.tradeId === "carter").length,
      stoneAboveReserve: Math.max(0, stoneHeld - (TRADE_BALANCE.carryOutReserve.stone ?? 0)), stuck },
    masonries: { count: masonries.length, staffed: masonries.filter(b => b.workers >= BUILDING_CONFIG_BY_KIND.masonry.workersRequired).length,
      outputFull: masonries.filter(b => (b.inventory.stone ?? 0) >= BUILDING_CONFIG_BY_KIND.masonry.storageCapacity - 1).length,
      stoneEach: masonries.map(b => b.inventory.stone ?? 0) },
  });
}
console.log(JSON.stringify({ seed, years, stoneTownYear, rows }, null, 1));
