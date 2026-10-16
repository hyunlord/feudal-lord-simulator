// DELIVERY-GAP a·b diagnosis (the user's ruling 2026-10-16; read only, nothing fixed): the lord-mode bot plays a seed to
// `year`, then samples why the bot lays no road to a quarry site.
//  a — the "road first" fallback of the bot's build step (autoplay.ts buildAction): the candidates (setback, placeable once
//      a road reaches), the walls' room and the service space refused, the road action none, the search budget spent;
//      for a road action none, the same with the palisade lifted (does the road have to pass a gate?).
//  b — a road from the construction network to any quarry site (quarryAccess.ts's search), and the same with one obstacle
//      lifted: the wall's boundary, buildings and planned sites, water; the quarry sites near the map's edge.
//   tsx scripts/quarryRoadProbe.ts <seed> <year> [samples] [sampleTicks] > out.json   (DGX: a tick run)
import { BUILDING_CONFIG_BY_KIND, type Building } from "../src/content/buildingConfig";
import { LORD_SLICE_SCENARIO_ID } from "../src/content/lordSliceConfig";
import { isBuildingConstructionSite } from "../src/economy/construction";
import { autoplayBuildAction } from "../src/engine/autoplay";
import { canPlaceBuilding, hasBuildingWallClearance } from "../src/world/placement";
import { zonePlacementCheck } from "../src/zones/zonePlacement";
import { zonesOf } from "../src/zones/zoneEdits";
import { autoplayConstructionSources } from "../src/engine/autoplayConstructionSources";
import { plannedBuildingRoadAction } from "../src/engine/autoplayConstructionRoads";
import { crossingAction } from "../src/engine/autoplayCrossing";
import { runAutoplaySearch, autoplaySearchExhausted } from "../src/engine/autoplaySearchBudget";
import { preservesAutoplayServiceSpace } from "../src/engine/autoplayServiceSpace";
import { hasAutoplayBuildingClearance } from "../src/engine/autoplaySetback";
import { preservesAutoplayWallSpace } from "../src/engine/autoplayWallSpace";
import { autoplayCanPlace } from "../src/engine/autoplayZones";
import type { GameState } from "../src/engine/engine.types";
import { lordBotCommands } from "../src/engine/lordBot";
import { quarryReach } from "../src/engine/quarryAccess";
import { buildingRoadAccessTiles } from "../src/engine/routing";
import { stateCalendar } from "../src/engine/scenarioState";
import { advanceTick } from "../src/engine/tick";
import { gameReducer } from "../src/state/gameStore";
import { newGameState } from "../src/state/newGame";
import { canTraverseRoadBoundary } from "../src/world/bridges";
import { getTile, type TileCoordinate } from "../src/world/grid";
import { canPlaceRoad, existingRoadComponent } from "../src/world/roadGraph";

const [seedArg = "26", yearArg = "1316", samplesArg = "2", sampleArg = "4000"] = process.argv.slice(2);
let state = newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed: Number(seedArg) }) as GameState;
const step = () => { for (const { command } of lordBotCommands(state)) { const next = gameReducer(state, command); if (next !== state) state = next; } state = advanceTick(state); };
while (stateCalendar(state).year < Number(yearArg)) step();
const key = (tile: TileCoordinate) => `${tile.tx},${tile.ty}`;
const virtual = (tile: TileCoordinate): Building => ({ id: "autoplay-candidate", kind: "quarry", tx: tile.tx, ty: tile.ty, workers: 0, inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0 });

function partA(s: GameState) {
  const roads = s.tiles.filter(tile => tile.hasRoad);
  const candidates = s.tiles.filter(tile => hasAutoplayBuildingClearance(s, "quarry", tile) && autoplayCanPlace(s, "quarry", tile.tx, tile.ty, "later"))
    .map(tile => ({ tile, distance: Math.min(...roads.map(road => Math.abs(road.tx - tile.tx) + Math.abs(road.ty - tile.ty))) }))
    .sort((a, b) => a.distance - b.distance || a.tile.ty - b.tile.ty || a.tile.tx - b.tile.tx);
  const counts = { candidates: candidates.length, tried: 0, wallSpace: 0, serviceSpace: 0, roadNone: 0, roadNoneButWithoutWall: 0, road: 0, budgetSpent: 0 };
  const nearest: unknown[] = [];
  runAutoplaySearch(() => {
    for (const { tile, distance } of candidates.slice(0, 24)) {
      if (autoplaySearchExhausted()) { counts.budgetSpent += 1; continue; }
      counts.tried += 1;
      if (!preservesAutoplayWallSpace(s, "quarry", tile)) { counts.wallSpace += 1; continue; }
      if (!preservesAutoplayServiceSpace(s, { kind: "place_building", building: "quarry", tx: tile.tx, ty: tile.ty })) { counts.serviceSpace += 1; continue; }
      const road = plannedBuildingRoadAction(s, virtual(tile));
      if (road.kind === "none") {
        counts.roadNone += 1;
        if (s.palisade !== null && plannedBuildingRoadAction({ ...s, palisade: null }, virtual(tile)).kind !== "none") counts.roadNoneButWithoutWall += 1;
      } else counts.road += 1;
      if (nearest.length < 3) nearest.push({ at: key(tile), distance, road: road.kind });
    }
  });
  return { ...counts, nearest, build: autoplayBuildAction(s, "quarry").kind, crossing: crossingAction(s, "quarry").kind };
}

function partB(s: GameState) {
  const reach = quarryReach(s);
  const targets = new Set(reach.sites.flatMap(site => site.access));
  const planned = new Set(s.constructionSites.filter(isBuildingConstructionSite).flatMap(site => {
    const size = BUILDING_CONFIG_BY_KIND[site.kind]; const cells: string[] = [];
    for (let dy = 0; dy < size.height; dy += 1) for (let dx = 0; dx < size.width; dx += 1) cells.push(`${site.tx + dx},${site.ty + dy}`);
    return cells; }));
  const sources = autoplayConstructionSources(s).flatMap(building => buildingRoadAccessTiles(s, building));
  const start = existingRoadComponent(s, sources);
  const search = (lift: { wall?: boolean; buildings?: boolean; water?: boolean }, full = false) => {
    const free = (tile: TileCoordinate) => {
      const t = getTile(s, tile); if (t === null) return false;
      if (t.hasRoad) return true;
      if (lift.water && t.terrain === "water") return true;
      if (lift.buildings) return t.terrain !== "water";
      return canPlaceRoad(s, tile) && !planned.has(key(tile));
    };
    const seen = new Set(start.map(key)); const queue = [...start];
    const dist = new Map<string, number>(start.map(tile => [key(tile), 0]));
    let reached = false;
    for (let i = 0; i < queue.length; i += 1) {
      const current = queue[i]!;
      if (targets.has(key(current))) { reached = true; if (!full) return { reached: true, explored: seen.size, dist }; }
      for (const next of [{ tx: current.tx, ty: current.ty - 1 }, { tx: current.tx - 1, ty: current.ty }, { tx: current.tx + 1, ty: current.ty }, { tx: current.tx, ty: current.ty + 1 }]) {
        if (seen.has(key(next)) || !free(next)) continue;
        if (!lift.wall && !canTraverseRoadBoundary(s, current, next)) continue;
        seen.add(key(next)); queue.push(next); dist.set(key(next), (dist.get(key(current)) ?? 0) + 1);
      }
    }
    return { reached, explored: seen.size, dist };
  };
  // Per site: does a construction road reach it (any of its access tiles), and the bot's site check's reason, the
  // clearance refusal split (ring off the map, ring on water, too close to the palisade).
  const full = search({}, true);
  const cross: Record<string, number> = {};
  const fields = new Set(zonesOf(s).filter(zone => zone.kind === "arable").flatMap(zone => zone.membership));
  const targetsA: { at: string; road: number }[] = [];
  const clearanceReached: { at: string; road: number; why: string }[] = [];
  for (const site of reach.sites) {
    const road = Math.min(...site.access.map(tile => full.dist.get(tile) ?? Infinity));
    const reachable = Number.isFinite(road);
    // Every refusal the site has, not only the first the site check stops at (the needs_road reading hid seed 26's
    // field, the user's note 2026-10-17): the setback (ring off the map, ring on water, too near the palisade), the
    // placement now (its reason), the field cover, the zone rules, the walls' room, the service space.
    const Q = BUILDING_CONFIG_BY_KIND.quarry;
    const refusals: string[] = [];
    if (!hasAutoplayBuildingClearance(s, "quarry", site.origin)) {
      let off = false; let water = false;
      for (let ty = site.origin.ty - 1; ty <= site.origin.ty + Q.height; ty += 1) for (let tx = site.origin.tx - 1; tx <= site.origin.tx + Q.width; tx += 1) {
        const t = getTile(s, { tx, ty }); if (t === null) off = true; else if (t.terrain === "water") water = true; }
      const wall = !hasBuildingWallClearance(s, { ...site.origin, width: Q.width, height: Q.height, id: "probe" });
      refusals.push(`clearance:${[off ? "edge" : "", water ? "water" : "", wall ? "wall" : ""].filter(Boolean).join("+") || "?"}`);
    }
    const placed = canPlaceBuilding(s, "quarry", site.origin.tx, site.origin.ty);
    if (!placed.ok) refusals.push(`placement:${placed.reason ?? "?"}`);
    if ([[0, 0], [1, 0], [0, 1], [1, 1]].some(([dx, dy]) => fields.has((site.origin.ty + dy!) * s.width + site.origin.tx + dx!))) refusals.push("field");
    if (!zonePlacementCheck(s, "quarry", site.origin.tx, site.origin.ty).ok) refusals.push("zone");
    if (!preservesAutoplayWallSpace(s, "quarry", site.origin)) refusals.push("wall_space");
    if (!preservesAutoplayServiceSpace(s, { kind: "place_building", building: "quarry", tx: site.origin.tx, ty: site.origin.ty })) refusals.push("service_space");
    const reason = refusals.length === 0 ? "ok" : refusals.join("&");
    if (reachable && refusals.some(r => r.startsWith("clearance"))) clearanceReached.push({ at: key(site.origin), road, why: reason });
    const cell = `${reachable ? "reach" : "noreach"}|${reason}`; cross[cell] = (cross[cell] ?? 0) + 1;
    if (reachable && (reason === "placement:needs_road" || reason === "ok")) targetsA.push({ at: key(site.origin), road });
  }
  targetsA.sort((x, y) => x.road - y.road); clearanceReached.sort((x, y) => x.road - y.road);
  const manor = s.buildings.find(b => b.kind === "manor_house");
  const startEdge = manor === undefined ? null : { at: key(manor), toEdge: Math.min(manor.tx, manor.ty, s.width - manor.tx - 3, s.height - manor.ty - 3), map: `${s.width}x${s.height}` };
  const edge = reach.sites.filter(site => site.origin.tx < 3 || site.origin.ty < 3 || site.origin.tx > s.width - 5 || site.origin.ty > s.height - 5).length;
  return { sites: reach.sites.length, nearEdge: edge, startTiles: start.length, palisade: s.palisade !== null,
    cross, targetsA: { count: targetsA.length, nearest: targetsA.slice(0, 3) }, clearanceReached: { count: clearanceReached.length, nearest: clearanceReached.slice(0, 3) }, startEdge,
    ...Object.fromEntries(Object.entries({ base: {}, noWall: { wall: true }, noBuildings: { buildings: true }, noWater: { water: true },
      waterWall: { water: true, wall: true }, waterBuildings: { water: true, buildings: true }, wallBuildings: { wall: true, buildings: true },
      all: { wall: true, buildings: true, water: true } }).map(([name, lift]) => { const r = search(lift); return [name, { reached: r.reached, explored: r.explored }]; })) };
}

const samples: unknown[] = [];
for (let n = 0; n < Number(samplesArg); n += 1) {
  if (n > 0) { const until = state.tick + Number(sampleArg); while (state.tick < until) step(); }
  samples.push({ year: stateCalendar(state).year, tick: state.tick, era: state.era, quarries: state.buildings.filter(b => b.kind === "quarry").length, a: partA(state), b: partB(state) });
}
process.stdout.write(`${JSON.stringify({ seed: Number(seedArg), samples })}\n`);
