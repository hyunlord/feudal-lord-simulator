/**
 * F0-B fire (spec docs/design/flow-events.md EV-4, EV-6). Every house is thatched in chapter 1 (no roof material yet).
 *
 * - Ignition: on a planned dry summer, every `ignitionStepTicks`, the scheduler asks for a site. A candidate is a
 *   standing thatched house (not burnt, not burning, not being rebuilt) with at least `minNeighbours` such houses within
 *   `densityRadius` and at least `minWellDistance` from every well. Houses with the most touching thatch (where the fire
 *   can spread) catch first, then the densest, then the ones without a well's water, then the farthest from a well;
 *   among the three best the seed picks.
 * - Spread: every `spreadStepTicks` a burning house may set each edge-adjacent thatched house alight (an empty tile or a
 *   well between two houses stops it), with the season's weather chance, × `wellSpreadPermille` when that neighbour's
 *   household draws water from a well (`hasWater`: they throw water on the roof).
 * - Douse and burn out: a burning house burns `burnTicks`, or `dousedBurnTicks` when its household has a well's water,
 *   then is `burnt`: its level and larder are lost, it pays no rent and cannot rise until rebuilt. The household stays
 *   (not a departure).
 * - Rebuild (EV-6): the ordinary construction flow from stage 2 (foundation), a quarter of the cost and work done.
 */
import type { Building } from "../content/buildingConfig";
import { FIRE_CONFIG } from "../content/eventConfig";
import { createConstructionSite, isBuildingConstructionSite, type BuildingConstructionSite } from "../economy/construction";
import { buildingFootprintDistance } from "../geometry/buildingDistance";
import type { House } from "../population/population.types";
import type { GameState } from "./engine.types";
import type { BurningHouse } from "./events.types";
import { weatherAt } from "./eventSchedule";
import { hashSeed, rollPermille } from "./prng";

function wellsOf(state: GameState): readonly Building[] {
  return state.buildings.filter(building => building.kind === "well");
}

function nearestWellDistance(building: Building, wells: readonly Building[]): number {
  let nearest = Infinity;
  for (const well of wells) nearest = Math.min(nearest, buildingFootprintDistance(building, well));
  return nearest;
}

/** EV-4: a house that can catch fire: standing, thatched, not burning, not burnt and not being rebuilt. */
function flammableHouses(state: GameState): readonly Building[] {
  const burning = new Set((state.events?.burning ?? []).map(entry => entry.buildingId));
  const burnt = new Set(state.houses.filter(house => house.burntTick !== undefined).map(house => house.buildingId));
  const rebuilding = new Set(state.constructionSites.flatMap(site => isBuildingConstructionSite(site) && site.rebuildOf !== undefined ? [site.rebuildOf] : []));
  return state.buildings.filter(building => building.kind === "house" && !burning.has(building.id) && !burnt.has(building.id) && !rebuilding.has(building.id));
}

/** A household that draws water from a well (the service allocation's `hasWater`) douses its roof. */
function watered(state: GameState): ReadonlySet<string> {
  return new Set(state.houses.filter(house => house.hasWater && house.residents > 0).map(house => house.buildingId));
}

export interface IgnitionCandidate {
  readonly building: Building;
  /** Thatched houses within `spreadRadius` (the fire can reach them). */
  readonly touching: number;
  /** Thatched houses within `densityRadius`. */
  readonly neighbours: number;
  readonly watered: boolean;
  readonly wellDistance: number;
}

/** EV-4: the houses that meet the ignition conditions, best first (touching, dense, unwatered, far from a well, id). */
export function fireIgnitionCandidates(state: GameState): readonly IgnitionCandidate[] {
  const houses = flammableHouses(state);
  const wells = wellsOf(state);
  const water = watered(state);
  const candidates: IgnitionCandidate[] = [];
  for (const building of houses) {
    const wellDistance = nearestWellDistance(building, wells);
    if (wellDistance < FIRE_CONFIG.minWellDistance) continue;
    let neighbours = 0;
    let touching = 0;
    for (const other of houses) {
      if (other === building) continue;
      const distance = buildingFootprintDistance(building, other);
      if (distance <= FIRE_CONFIG.densityRadius) neighbours += 1;
      if (distance <= FIRE_CONFIG.spreadRadius) touching += 1;
    }
    if (neighbours >= FIRE_CONFIG.minNeighbours) candidates.push({ building, touching, neighbours, watered: water.has(building.id), wellDistance });
  }
  return candidates.sort((a, b) => b.touching - a.touching || b.neighbours - a.neighbours || Number(a.watered) - Number(b.watered)
    || b.wellDistance - a.wellDistance || a.building.id.localeCompare(b.building.id));
}

function burningEntry(state: GameState, building: Building, eventId: string, tick: number): BurningHouse {
  const doused = watered(state).has(building.id);
  return { buildingId: building.id, eventId, ignitedTick: tick, outTick: tick + (doused ? FIRE_CONFIG.dousedBurnTicks : FIRE_CONFIG.burnTicks), doused };
}

/** EV-4: sets the chosen candidate alight. Null when no house meets the conditions. */
export function igniteFire(state: GameState, eventId: string): { readonly state: GameState; readonly originBuildingId: string } | null {
  const candidates = fireIgnitionCandidates(state);
  if (candidates.length === 0) return null;
  const pool = candidates.slice(0, 3);
  const origin = pool[hashSeed(state.seed, `fire-origin:${eventId}`, state.tick) % pool.length]!.building;
  const events = state.events ?? { records: [], burning: [] };
  return {
    originBuildingId: origin.id,
    state: { ...state, events: { ...events, burning: [...events.burning, burningEntry(state, origin, eventId, state.tick)] } },
  };
}

/** EV-4: a burnt house — level and larder lost, rent-free, no promotion; the household stays. */
function burnt(house: House, tick: number, eventId: string): House {
  const { promotionTicks: _promotion, ...rest } = house;
  return { ...rest, level: 0, builtLevel: 0, breadStock: 0, unmetRequirementTicks: 0, burntTick: tick, burntByEventId: eventId };
}

export interface FireStep {
  readonly state: GameState;
  /** Houses that burnt out this tick, by event id. */
  readonly burntOut: readonly { readonly buildingId: string; readonly eventId: string }[];
}

/** EV-4: one tick of every fire: spread rolls on `spreadStepTicks`, then burn-outs. */
export function stepFires(state: GameState): FireStep {
  const events = state.events;
  if (events === undefined || events.burning.length === 0) return { state, burntOut: [] };
  const tick = state.tick;
  let burning = [...events.burning];
  if (tick % FIRE_CONFIG.spreadStepTicks === 0) {
    const chance = FIRE_CONFIG.spreadPermille[weatherAt(state, tick).kind];
    const byId = new Map(state.buildings.map(building => [building.id, building]));
    const water = watered(state);
    let flammable = flammableHouses(state);
    for (const fire of events.burning) {
      const source = byId.get(fire.buildingId);
      if (source === undefined || tick >= fire.outTick) continue;
      for (const target of flammable) {
        if (buildingFootprintDistance(source, target) > FIRE_CONFIG.spreadRadius) continue;
        const permille = water.has(target.id) ? Math.floor(chance * FIRE_CONFIG.wellSpreadPermille / 1000) : chance;
        if (rollPermille(state.seed, `fire-spread:${fire.buildingId}>${target.id}`, tick) >= permille) continue;
        burning = [...burning, burningEntry(state, target, fire.eventId, tick)];
        flammable = flammable.filter(candidate => candidate.id !== target.id);
      }
    }
  }
  const out = burning.filter(fire => tick >= fire.outTick);
  if (out.length === 0 && burning.length === events.burning.length) return { state, burntOut: [] };
  const outIds = new Map(out.map(fire => [fire.buildingId, fire.eventId]));
  const houses = out.length === 0 ? state.houses : state.houses.map(house => {
    const eventId = outIds.get(house.buildingId);
    return eventId === undefined ? house : burnt(house, tick, eventId);
  });
  return {
    state: { ...state, houses, events: { ...events, burning: burning.filter(fire => tick < fire.outTick) } },
    burntOut: out.map(fire => ({ buildingId: fire.buildingId, eventId: fire.eventId })),
  };
}

/** EV-6: the rebuild site for a burnt house, or null when the house is not burnt or already being rebuilt. */
export function rebuildSiteFor(state: GameState, buildingId: string): BuildingConstructionSite | null {
  const house = state.houses.find(candidate => candidate.buildingId === buildingId);
  const building = state.buildings.find(candidate => candidate.id === buildingId);
  if (house?.burntTick === undefined || building === undefined) return null;
  if (state.constructionSites.some(site => isBuildingConstructionSite(site) && site.rebuildOf === buildingId)) return null;
  const site = createConstructionSite({ ordinal: state.nextConstructionOrdinal, kind: "house", tx: building.tx, ty: building.ty, startedTick: state.wallTick });
  const left = 1000 - FIRE_CONFIG.rebuildDonePermille;
  const required = Object.fromEntries(Object.entries(site.required).map(([resource, amount]) => [resource, Math.ceil((amount ?? 0) * left / 1000)]));
  return { ...site, required, builderTicks: Math.floor(site.requiredBuilderTicks * FIRE_CONFIG.rebuildDonePermille / 1000), rebuildOf: buildingId };
}

/** EV-6 action `rebuild_house`: starts rebuilding a burnt house (its tiles stay the house's). */
export function rebuildBurntHouse(state: GameState, buildingId: string): GameState {
  const site = rebuildSiteFor(state, buildingId);
  if (site === null) return state;
  return { ...state, constructionSites: [...state.constructionSites, site], nextConstructionOrdinal: state.nextConstructionOrdinal + 1 };
}

/** EV-6: a completed rebuild clears the house's burnt state; its household moves back in at level 0. */
export function completeRebuild(house: House): House {
  const { burntTick: _tick, burntByEventId: _event, ...rest } = house;
  return rest;
}
