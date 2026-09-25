/**
 * v10 retires the wheat farm (spec AF-12): wheat grows on arable zone strips tended from a farmstead.
 *
 * Each old farm (and each farm still under construction) becomes its four cells of arable zone, painted with the
 * zone edit rules (touching fields merge, the later edit owns a cell). A farm the wall already encloses stays a field
 * in place: arable is never *painted* inside the wall (Z-9), and a field a wall encloses keeps being worked (AF-1).
 * Farmsteads then cover the fields greedily: each stands on a
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
import { buildingHasRequiredRoadAccess } from "../../engine/roadAccess";
import { cellInsideWall, zoneIdFor, zonesOf } from "../../zones/zoneEdits";
import type { Zone, ZoneStroke } from "../../zones/zone.types";

export type { ArableMigrationSummary } from "../../zones/arable.types";
import type { ArableMigrationSummary } from "../../zones/arable.types";

interface FarmFootprint { readonly id: string; readonly tx: number; readonly ty: number; readonly wheat: number; readonly paused?: true }

const FARM = BUILDING_CONFIG_BY_KIND.wheat_farm;
const FARM_TICKS_PER_WHEAT = FARM.production?.ticksPerOutput ?? 40;

function cells(farm: FarmFootprint, width: number): number[] {
  const list: number[] = [];
  for (let dy = 0; dy < FARM.height; dy += 1) for (let dx = 0; dx < FARM.width; dx += 1) list.push((farm.ty + dy) * width + farm.tx + dx);
  return list;
}

function freeCell(state: GameState, index: number, taken: ReadonlySet<number>): boolean {
  const tile = state.tiles[index];
  // A farmstead may stand inside the wall (it is a building); only fields are kept out when painting.
  return tile !== undefined && !taken.has(index) && tile.buildingId === null && !tile.hasRoad && tile.terrain !== "water"
    && tile.terrain !== "rock";
}

/** The real road-access test (walls and bridges included) for a farmstead standing on `index`. */
function touchesRoad(state: GameState, index: number): boolean {
  const farmstead: Building = { id: "migration-farmstead", kind: "farmstead", tx: index % state.width, ty: Math.floor(index / state.width),
    workers: 0, inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0 };
  return buildingHasRequiredRoadAccess(state, farmstead);
}

function farmStroke(farm: FarmFootprint): ZoneStroke {
  return { tool: "polygon", points: [{ x: farm.tx, y: farm.ty }, { x: farm.tx + FARM.width, y: farm.ty },
    { x: farm.tx + FARM.width, y: farm.ty + FARM.height }, { x: farm.tx, y: farm.ty + FARM.height }] };
}

function addFieldCells(state: GameState, farm: FarmFootprint): GameState {
  const { width } = state;
  const own = cells(farm, width);
  const ownSet = new Set(own);
  const touching = (zone: Zone) => zone.membership.some(cell => ownSet.has(cell) || ownSet.has(cell - 1) && cell % width !== width - 1
    || ownSet.has(cell + 1) && cell % width !== 0 || ownSet.has(cell - width) || ownSet.has(cell + width));
  const zones = zonesOf(state);
  const merged = zones.filter(zone => zone.kind === "arable" && touching(zone)).sort((a, b) => a.createdOrdinal - b.createdOrdinal);
  const mergedIds = new Set(merged.map(zone => zone.id));
  const target = merged[0];
  const ordinal = state.nextZoneOrdinal ?? 1;
  const membership = [...new Set([...merged.flatMap(zone => zone.membership), ...own])].sort((a, b) => a - b);
  const field: Zone = target === undefined
    ? { id: zoneIdFor(ordinal), kind: "arable", strokes: [farmStroke(farm)], membership, createdOrdinal: ordinal }
    : { ...target, strokes: [...merged.flatMap(zone => zone.strokes), farmStroke(farm)], membership };
  const others = zones.filter(zone => !mergedIds.has(zone.id))
    .map(zone => zone.membership.some(cell => ownSet.has(cell)) ? { ...zone, membership: zone.membership.filter(cell => !ownSet.has(cell)) } : zone)
    .filter(zone => zone.membership.length > 0);
  const next = target === undefined ? [...others, field] : zones.flatMap(zone => zone.id === target.id ? [field]
    : mergedIds.has(zone.id) ? [] : others.filter(other => other.id === zone.id));
  return { ...state, zones: next, nextZoneOrdinal: target === undefined ? ordinal + 1 : ordinal };
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

function placeFarmstead(state: GameState, site: number, wheat: number, paused = false): GameState {
  const tx = site % state.width;
  const ty = Math.floor(site / state.width);
  // A farmstead keeps the player's pause when every farm it replaces was paused.
  const farmstead: Building = { id: `farmstead-${tx}-${ty}-0`, kind: "farmstead", tx, ty, workers: 0, ...(paused ? { operationPaused: true } : {}),
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
    ...farmBuildings.map(farm => ({ id: farm.id, tx: farm.tx, ty: farm.ty, wheat: (farm.inventory.wheat ?? 0) + (cargoByFarm.get(farm.id) ?? 0),
      ...(farm.operationPaused === true ? { paused: true as const } : {}) })),
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
  // Each farm's cells join the arable zone they touch (the oldest, merging any others it bridges) or open a new
  // one, and leave any other zone (the later edit owns a cell, Z-5). A farm the wall already encloses stays a field
  // where it is: Z-9 forbids painting arable inside the wall, and a field a wall encloses keeps being worked (AF-1).
  const targets = farms;
  for (const farm of targets) state = addFieldCells(state, farm);
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
  const fieldRoadSide = [...fieldCells].filter(cell => touchesRoad(state, cell)).sort((x, y) => x - y);
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
    state = placeFarmstead(state, best.site, wheat, best.farms.every(farm => farm.paused === true));
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
  const summary: ArableMigrationSummary = { convertedFarms: farms.length, farmsteads: farmsteads.length, unplacedFarmsteads: unplaced, cellsInsideWall };
  return { ...state, arableFields: fields, arableMigration: summary };
}

export function migrateV9ToV10(input: unknown): unknown {
  if (typeof input !== 'object' || input === null) throw new TypeError('Schema v9 save must be an envelope object');
  const envelope = input as { readonly state?: unknown };
  if (typeof envelope.state !== 'object' || envelope.state === null) throw new TypeError('Schema v9 save has no state');
  return { ...envelope, schemaVersion: 10, state: migrateStateV9ToV10(envelope.state as GameState) };
}
