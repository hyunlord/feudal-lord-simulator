/**
 * v10 retires the wheat farm (spec AF-12): wheat grows on arable zone strips tended from a farmstead.
 *
 * Each old farm (and each farm still under construction) becomes its four cells of arable zone, painted with the
 * ordinary zone rule (touching fields merge). A farm with a cell inside the wall, where arable is forbidden (Z-9),
 * moves its field to the nearest free block outside. Farmsteads then cover the fields greedily: each stands on a
 * free road-side cell and takes up to `MIGRATION_FARMS_PER_FARMSTEAD` fields within the tend radius (AF-8). A
 * field nothing reaches gets a farmstead on its own road-side cell; failing that it is reported in
 * `arableMigration.unplacedFarmsteads`.
 *
 * So bread does not stop while the new fields wait for their harvest, the strips start in the stage a worked
 * field has at that point of the year, and each farmstead's barn opens with its farms' wheat, their carters'
 * cargo and the wheat those farms would have grown until the next harvest (1 per 40 ticks each).
 */
import { ARABLE_CONFIG, MIGRATION_FARMS_PER_FARMSTEAD } from "../../content/arableConfig";
import { BALANCE } from "../../content/balanceConfig";
import { BUILDING_CONFIG_BY_KIND, type Building } from "../../content/buildingConfig";
import { isBuildingConstructionSite } from "../../economy/construction";
import type { GameState } from "../../engine/engine.types";
import type { CarterWalker } from "../../agents/walker.types";
import type { ArableField, ArableStripRecord } from "../../zones/arable.types";
import { arableLayouts, growthTicks, inYearTick, reconcileArableFields } from "../../zones/arableFields";
import { cellInsideWall, paintZone, zonesOf } from "../../zones/zoneEdits";

export type { ArableMigrationSummary } from "../../zones/arable.types";
import type { ArableMigrationSummary } from "../../zones/arable.types";

interface FarmFootprint { readonly id: string; readonly tx: number; readonly ty: number; readonly wheat: number }

const FARM = BUILDING_CONFIG_BY_KIND.wheat_farm;
const FARM_TICKS_PER_WHEAT = FARM.production?.ticksPerOutput ?? 40;

function cells(farm: FarmFootprint, width: number): number[] {
  const list: number[] = [];
  for (let dy = 0; dy < FARM.height; dy += 1) for (let dx = 0; dx < FARM.width; dx += 1) list.push((farm.ty + dy) * width + farm.tx + dx);
  return list;
}

function freeCell(state: GameState, index: number, taken: ReadonlySet<number>): boolean {
  const tile = state.tiles[index];
  return tile !== undefined && !taken.has(index) && tile.buildingId === null && !tile.hasRoad && tile.terrain !== "water"
    && tile.terrain !== "rock" && !cellInsideWall(state, index);
}

function touchesRoad(state: GameState, index: number): boolean {
  const { width } = state;
  const tx = index % width;
  return [tx > 0 ? index - 1 : -1, tx < width - 1 ? index + 1 : -1, index - width, index + width]
    .some(neighbour => neighbour >= 0 && state.tiles[neighbour]?.hasRoad === true);
}

/**
 * The nearest free 2×2 block outside the wall to `farm` (Manhattan between anchors, then row, then column): open
 * land (grass or woodland) with no building, road or zone, and a road outside the wall within two cells so its
 * farmstead can stand beside it.
 */
function relocatedBlock(state: GameState, farm: FarmFootprint, blocked: ReadonlySet<number>, zoneCells: ReadonlySet<number>): FarmFootprint | null {
  const { width, height } = state;
  const roads = state.tiles.flatMap((tile, index) => tile.hasRoad && !cellInsideWall(state, index) ? [{ tx: tile.tx, ty: tile.ty }] : []);
  const open = (tx: number, ty: number) => {
    if (tx < 0 || ty < 0 || tx >= width || ty >= height) return false;
    const index = ty * width + tx;
    const tile = state.tiles[index]!;
    return (tile.terrain === "grass" || tile.terrain === "forest") && tile.buildingId === null && !tile.hasRoad
      && !blocked.has(index) && !zoneCells.has(index) && !cellInsideWall(state, index);
  };
  let best: { tx: number; ty: number; distance: number } | null = null;
  for (let ty = 0; ty < height - 1; ty += 1) {
    for (let tx = 0; tx < width - 1; tx += 1) {
      const distance = Math.abs(tx - farm.tx) + Math.abs(ty - farm.ty);
      if (best !== null && distance > best.distance) continue;
      if (!open(tx, ty) || !open(tx + 1, ty) || !open(tx, ty + 1) || !open(tx + 1, ty + 1)) continue;
      // A road touches the block or a cell beside it, so its farmstead can stand on a road-side cell.
      if (!roads.some(road => Math.min(Math.abs(road.tx - tx), Math.abs(road.tx - tx - 1)) + Math.min(Math.abs(road.ty - ty), Math.abs(road.ty - ty - 1)) <= 2
        && road.tx >= tx - 2 && road.tx <= tx + 3 && road.ty >= ty - 2 && road.ty <= ty + 3)) continue;
      if (best === null || distance < best.distance) best = { tx, ty, distance };
    }
  }
  return best === null ? null : { ...farm, tx: best.tx, ty: best.ty };
}

/** AF-12: the stage a worked field is in at `tick`, sown on spring day 1 of this year. */
function inSeasonRecord(record: ArableStripRecord, tick: number): ArableStripRecord {
  const t = inYearTick(tick);
  if (t >= ARABLE_CONFIG.winterFrom) return record;
  const sownTick = tick - t;
  const grown = growthTicks(sownTick, tick);
  if (grown >= ARABLE_CONFIG.growTicks || t >= ARABLE_CONFIG.forcedRipeFrom) {
    return { ...record, stage: "ripe", stageTick: tick, sownTick, completionPermille: Math.min(1000, Math.floor(grown * 1000 / ARABLE_CONFIG.growTicks)) };
  }
  return { ...record, stage: grown >= ARABLE_CONFIG.growingAt ? "growing" : "sown", stageTick: tick, sownTick };
}

/** Ticks until the migrated crop is ripe: this summer, or next summer from autumn's end and winter. */
function ticksUntilHarvest(tick: number): number {
  const t = inYearTick(tick);
  if (t < ARABLE_CONFIG.growTicks) return ARABLE_CONFIG.growTicks - t;
  if (t < ARABLE_CONFIG.winterFrom) return 0;
  return BALANCE.TICKS_PER_YEAR - t + ARABLE_CONFIG.growTicks;
}

function placeFarmstead(state: GameState, site: number, wheat: number): GameState {
  const tx = site % state.width;
  const ty = Math.floor(site / state.width);
  const farmstead: Building = { id: `farmstead-${tx}-${ty}-0`, kind: "farmstead", tx, ty, workers: 0,
    inventory: wheat > 0 ? { wheat: Math.min(BUILDING_CONFIG_BY_KIND.farmstead.storageCapacity, wheat) } : {}, reserved: {}, stockReserved: {}, productionProgress: 0 };
  return { ...state, buildings: [...state.buildings, farmstead],
    tiles: state.tiles.map((tile, index) => index === site ? { ...tile, buildingId: farmstead.id } : tile) };
}

export function migrateStateV9ToV10(input: GameState): GameState {
  const farmBuildings = input.buildings.filter(building => building.kind === "wheat_farm");
  const farmSites = input.constructionSites.filter(isBuildingConstructionSite).filter(site => site.kind === "wheat_farm");
  if (farmBuildings.length === 0 && farmSites.length === 0) return input;
  const farmIds = new Set([...farmBuildings.map(farm => farm.id), ...farmSites.map(site => site.id)]);
  // Cargo carried by the farms' carters goes back into the barn; their reservations at the destination are released.
  const carters = input.walkers.filter((walker): walker is CarterWalker => walker.kind === "carter" && farmIds.has(walker.homeBuildingId));
  const cargoByFarm = new Map<string, number>();
  const releases = new Map<string, number>();
  for (const carter of carters) {
    if (carter.cargo?.resource === "wheat") cargoByFarm.set(carter.homeBuildingId, (cargoByFarm.get(carter.homeBuildingId) ?? 0) + carter.cargo.amount);
    const destination = carter.reservation.destination;
    if (carter.cancellation === null && carter.phase === "outbound" && destination.kind === "building" && carter.reservation.resource === "wheat") {
      releases.set(destination.buildingId, (releases.get(destination.buildingId) ?? 0) + carter.reservation.amount);
    }
  }
  const farms: FarmFootprint[] = [
    ...farmBuildings.map(farm => ({ id: farm.id, tx: farm.tx, ty: farm.ty, wheat: (farm.inventory.wheat ?? 0) + (cargoByFarm.get(farm.id) ?? 0) })),
    ...farmSites.map(site => ({ id: site.id, tx: site.tx, ty: site.ty, wheat: 0 })),
  ].sort((a, b) => a.id.localeCompare(b.id));

  const width = input.width;
  const farmCells = new Set(farms.flatMap(farm => cells(farm, width)));
  let state: GameState = {
    ...input,
    buildings: input.buildings.filter(building => !farmIds.has(building.id)).map(building => {
      const released = releases.get(building.id);
      return released === undefined ? building
        : { ...building, reserved: { ...building.reserved, wheat: Math.max(0, (building.reserved.wheat ?? 0) - released) } };
    }),
    constructionSites: input.constructionSites.filter(site => !farmIds.has(site.id)),
    walkers: input.walkers.filter(walker => !carters.includes(walker as CarterWalker)
      && !(walker.kind === "builder" && farmIds.has(walker.siteId))),
    tiles: input.tiles.map((tile, index) => farmCells.has(index) ? { ...tile, buildingId: null } : tile),
    pathCache: {},
  };
  const cellsInsideWall = [...farmCells].filter(cell => cellInsideWall(state, cell)).length;
  // A farm with a cell inside the wall cannot become arable there (Z-9): its field moves to the nearest free
  // 2×2 block outside the wall that lies near a road, in farm id order.
  const zoneCells = new Set(zonesOf(state).flatMap(zone => zone.membership));
  const blocked = new Set<number>();
  const targets: FarmFootprint[] = [];
  let relocatedFarms = 0;
  let droppedFarms = 0;
  for (const farm of farms) {
    const own = cells(farm, width);
    const target = own.every(cell => !cellInsideWall(state, cell)) ? farm : relocatedBlock(state, farm, blocked, zoneCells);
    if (target === null) { droppedFarms += 1; continue; }
    if (target !== farm) relocatedFarms += 1;
    targets.push(target);
    cells(target, width).forEach(cell => blocked.add(cell));
  }
  for (const farm of targets) {
    state = paintZone(state, "arable", { tool: "polygon", points: [{ x: farm.tx, y: farm.ty }, { x: farm.tx + FARM.width, y: farm.ty },
      { x: farm.tx + FARM.width, y: farm.ty + FARM.height }, { x: farm.tx, y: farm.ty + FARM.height }] });
  }
  const fieldCells = new Set(targets.flatMap(farm => cells(farm, width)));
  // The undo stack could split the converted fields again, and an observation of a farm has nothing left to watch.
  const { zoneUndo: _undo, autoplayFoodObservation: observation, ...rest } = state;
  state = observation === undefined || farmIds.has(observation.siteId) ? rest : { ...rest, autoplayFoodObservation: observation };

  // Farmsteads never stand on a zone cell (a field or a plot) unless nothing else reaches a field (AF-12).
  const zoneMembers = new Set(zonesOf(state).flatMap(zone => zone.membership));
  const farmsteads: Building[] = [];
  let unplaced = 0;
  const reserveTicks = ticksUntilHarvest(state.tick);
  // The farthest cell of the field, so every strip of it is within the tend radius.
  const reach = (site: number, farm: FarmFootprint) => Math.max(...cells(farm, width)
    .map(cell => Math.abs((cell % width) - (site % width)) + Math.abs(Math.floor(cell / width) - Math.floor(site / width))));
  const roadSide = state.tiles.flatMap((_, index) => freeCell(state, index, zoneMembers) && touchesRoad(state, index) ? [index] : []);
  // A farmstead beside a field's zone tends all of that zone (AF-8), however long the zone is.
  const zoneOfCell = new Map<number, string>();
  for (const zone of zonesOf(state)) if (zone.kind === "arable") for (const cell of zone.membership) zoneOfCell.set(cell, zone.id);
  const zoneOfFarm = new Map(targets.map(farm => [farm.id, zoneOfCell.get(cells(farm, width)[0]!)]));
  const besideZones = (site: number) => {
    const tx = site % width;
    return new Set([tx > 0 ? site - 1 : -1, tx < width - 1 ? site + 1 : -1, site - width, site + width].flatMap(cell => {
      const zone = zoneOfCell.get(cell);
      return zone === undefined ? [] : [zone];
    }));
  };
  // Field cells that touch a road can hold a farmstead too, at the cost of that cell (used only when they cover more).
  const fieldRoadSide = [...fieldCells].filter(cell => touchesRoad(state, cell) && !cellInsideWall(state, cell)).sort((x, y) => x - y);
  let uncovered = [...targets];
  while (uncovered.length > 0) {
    // Greedy cover: the site that reaches the most uncovered fields (at most `MIGRATION_FARMS_PER_FARMSTEAD`), then
    // one off the fields, then the smaller summed distance, then the lower cell index.
    let best: { site: number; farms: FarmFootprint[]; distance: number; onField: boolean } | null = null;
    for (const [site, onField] of [...roadSide.map(cell => [cell, false] as const), ...fieldRoadSide.map(cell => [cell, true] as const)]) {
      if (state.tiles[site]?.buildingId !== null) continue;
      const beside = besideZones(site);
      const inReach = uncovered.map(farm => ({ farm, distance: reach(site, farm) }))
        .filter(entry => entry.distance <= ARABLE_CONFIG.tendRadius || beside.has(zoneOfFarm.get(entry.farm.id) ?? ""))
        .sort((a, b) => a.distance - b.distance || a.farm.id.localeCompare(b.farm.id)).slice(0, MIGRATION_FARMS_PER_FARMSTEAD);
      if (inReach.length === 0) continue;
      const distance = inReach.reduce((sum, entry) => sum + entry.distance, 0);
      const better = best === null || inReach.length > best.farms.length
        || (inReach.length === best.farms.length && (onField !== best.onField ? !onField : distance < best.distance));
      if (better) best = { site, farms: inReach.map(entry => entry.farm), distance, onField };
    }
    if (best === null) { unplaced += 1; uncovered = uncovered.slice(1); continue; }
    if (process.env.MIG_DEBUG) console.log("site", best.site % width, Math.floor(best.site / width), best.onField, best.farms.map(f => `${f.id}@${f.tx},${f.ty}:${zoneOfFarm.get(f.id)}`).join(" "));
    const served = new Set(best.farms.map(farm => farm.id));
    const built = best.farms.filter(farm => farmBuildings.some(building => building.id === farm.id)).length;
    const wheat = best.farms.reduce((sum, farm) => sum + farm.wheat, 0) + Math.floor(built * reserveTicks / FARM_TICKS_PER_WHEAT);
    state = placeFarmstead(state, best.site, wheat);
    farmsteads.push(state.buildings.at(-1)!);
    uncovered = uncovered.filter(farm => !served.has(farm.id));
  }

  // Strips on converted cells start in season; strips of fields painted before v10 start fallow as usual.
  const layouts = arableLayouts(state);
  const fields: readonly ArableField[] = reconcileArableFields(state, layouts).map(field => ({ ...field,
    strips: field.strips.map(record => {
      const layout = layouts.find(entry => entry.zoneId === field.zoneId)?.strips.find(strip => strip.id === record.id);
      const converted = layout?.cells.some(cell => fieldCells.has(cell.ty * width + cell.tx)) === true;
      return converted ? inSeasonRecord(record, state.tick) : record;
    }) }));
  const summary: ArableMigrationSummary = { convertedFarms: farms.length, farmsteads: farmsteads.length, unplacedFarmsteads: unplaced,
    cellsInsideWall, relocatedFarms, droppedFarms };
  return { ...state, arableFields: fields, arableMigration: summary };
}

export function migrateV9ToV10(input: unknown): unknown {
  if (typeof input !== 'object' || input === null) throw new TypeError('Schema v9 save must be an envelope object');
  const envelope = input as { readonly state?: unknown };
  if (typeof envelope.state !== 'object' || envelope.state === null) throw new TypeError('Schema v9 save has no state');
  return { ...envelope, schemaVersion: 10, state: migrateStateV9ToV10(envelope.state as GameState) };
}
