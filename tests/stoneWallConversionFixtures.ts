import type { Building } from "../src/content/buildingConfig";
import {
  createPalisadeConstructionSite,
  createStoneWallConstructionSite,
  type PalisadeConstructionSite,
  type StoneWallConstructionSite,
} from "../src/economy/construction";
import type { GameState, PalisadeSegment, PalisadeState } from "../src/engine/engine.types";
import type { House } from "../src/population/population.types";
import { DEFAULT_GAME_STATE } from "../src/state/gameStore";

export function building(id: string, kind: Building["kind"], tx: number, ty: number, patch: Partial<Building> = {}): Building {
  return {
    id,
    kind,
    tx,
    ty,
    workers: 0,
    inventory: {},
    reserved: {},
    stockReserved: {},
    productionProgress: 0,
    ...patch,
  };
}

function eligibilityBuildings(stone: number): readonly Building[] {
  return [
    building("home-a", "house", 5, 5),
    building("market-a", "market", 1, 1),
    building("masonry-a", "masonry", 3, 1),
    building("store-a", "storehouse", 0, 0, { inventory: { stone } }),
  ];
}

function house(residents: number): House {
  return {
    buildingId: "home-a",
    level: 0,
    residents,
    hasWater: false,
    breadStock: 0,
    lastServicedTick: 0,
    unmetRequirementTicks: 0,
  };
}

export function timberSite(index: number, patch: Partial<PalisadeConstructionSite> = {}): PalisadeConstructionSite {
  return {
    ...createPalisadeConstructionSite({
      id: `wall-a-segment-${String(index).padStart(3, "0")}`,
      wallId: "wall-a",
      segmentIndex: index,
      gateDistance: index === 0 ? 0 : index === 1 ? 4 : 8,
      order: index,
      path: [{ x: 2 + index, y: 2 }, { x: 3 + index, y: 2 }],
      startedTick: 0,
    }),
    ...patch,
  };
}

export function stoneSite(index: number, patch: Partial<StoneWallConstructionSite> = {}): StoneWallConstructionSite {
  return {
    ...createStoneWallConstructionSite({
      id: `wall-a-segment-${String(index).padStart(3, "0")}-stone`,
      wallId: "wall-a",
      segmentIndex: index,
      gateDistance: index === 0 ? 0 : index === 1 ? 4 : 8,
      order: index,
      path: [{ x: 2 + index, y: 2 }, { x: 3 + index, y: 2 }],
      startedTick: 100,
    }),
    ...patch,
  };
}

export function palisadeSegment(index: number, patch: Partial<PalisadeSegment> = {}): PalisadeSegment {
  const site = timberSite(index);
  return {
    id: site.id,
    order: site.order,
    gateDistance: site.gateDistance,
    edgePath: site.path,
    tileCount: 1,
    completed: true,
    constructionSiteId: null,
    material: "timber",
    replacementConstructionSiteId: null,
    ...patch,
  };
}

export function palisade(segments: readonly PalisadeSegment[]): PalisadeState {
  return {
    id: "wall-a",
    polygon: [{ x: 2, y: 2 }, { x: 6, y: 2 }, { x: 6, y: 5 }, { x: 2, y: 5 }, { x: 2, y: 2 }],
    gate: { x: 2, y: 2 },
    segments,
  };
}

export function state(patch: Partial<GameState> = {}): GameState {
  return {
    ...DEFAULT_GAME_STATE,
    tick: 100,
    wallTick: 100,
    era: "palisade",
    eraProclaimedTick: 10,
    population: 140,
    houses: [house(140)],
    treasuryCoin: 200,
    buildings: [...eligibilityBuildings(400)],
    constructionSites: [],
    palisade: palisade([palisadeSegment(0), palisadeSegment(1), palisadeSegment(2)]),
    ...patch,
  };
}

export function coverageMaterial(segment: PalisadeSegment): "none" | "timber" | "stone" {
  if (!segment.completed) return "none";
  return segment.material ?? "timber";
}
