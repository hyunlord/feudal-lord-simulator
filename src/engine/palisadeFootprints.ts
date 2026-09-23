import { constructionSiteFootprint, isBuildingConstructionSite } from "../economy/construction";
import type { BuildingKind } from "../content/buildingConfig";
import { buildingFootprint } from "../geometry/buildingFootprint";
import type { TileCoordinate } from "../world/grid";
import {
  computePalisadeProposal,
  footprintCorners,
  isPointInsidePalisade,
  palisadePathHasBuildingClearance,
  palisadePathEnclosesFootprints,
  type PalisadeFootprint,
  type PalisadePath,
  type PalisadeProposalResult,
} from "../world/palisadeGeometry";
import type { GameState } from "./engine.types";

const LIVING_CORE_KINDS = new Set<BuildingKind>([
  "house", "well", "storehouse", "granary", "chapel", "wheat_farm", "mill", "market", "church", "keep",
]);

export function isPalisadeCoreBuildingKind(kind: BuildingKind): boolean {
  return LIVING_CORE_KINDS.has(kind);
}
const ROAD_STEPS = [
  { tx: -1, ty: 0 }, { tx: 1, ty: 0 }, { tx: 0, ty: -1 }, { tx: 0, ty: 1 },
] as const;
type CoreProposal = {
  readonly buildings: readonly PalisadeFootprint[];
  readonly core: readonly PalisadeFootprint[];
  readonly proposal: PalisadeProposalResult;
};
const coreProposalByState = new WeakMap<GameState, CoreProposal>();
type ProposalCandidates = {
  readonly layout: string;
  readonly candidates: readonly Extract<PalisadeProposalResult, { readonly ok: true }>[];
  readonly failure: PalisadeProposalResult;
};
const proposalCandidatesByTiles = new WeakMap<GameState['tiles'], ProposalCandidates>();

function roadKey(tile: TileCoordinate): string {
  return `${tile.tx},${tile.ty}`;
}

function connectedCoreRoads(state: GameState, core: readonly PalisadeFootprint[]): readonly PalisadeFootprint[] {
  const roads = new Map(state.tiles.filter(tile => tile.hasRoad && tile.terrain !== "water")
    .map(tile => [roadKey(tile), { tx: tile.tx, ty: tile.ty }]));
  if (roads.size === 0 || core.length === 0) return [];
  const contacts = core.map(footprint => {
    const adjacent: TileCoordinate[] = [];
    for (let tx = footprint.tx; tx < footprint.tx + footprint.width; tx += 1) {
      adjacent.push({ tx, ty: footprint.ty - 1 }, { tx, ty: footprint.ty + footprint.height });
    }
    for (let ty = footprint.ty; ty < footprint.ty + footprint.height; ty += 1) {
      adjacent.push({ tx: footprint.tx - 1, ty }, { tx: footprint.tx + footprint.width, ty });
    }
    return adjacent.filter(tile => roads.has(roadKey(tile)));
  });
  const center = core.reduce((sum, footprint) => ({
    tx: sum.tx + footprint.tx + footprint.width / 2,
    ty: sum.ty + footprint.ty + footprint.height / 2,
  }), { tx: 0, ty: 0 });
  const root = contacts.flat().sort((left, right) => {
    const leftDistance = (left.tx - center.tx / core.length) ** 2 + (left.ty - center.ty / core.length) ** 2;
    const rightDistance = (right.tx - center.tx / core.length) ** 2 + (right.ty - center.ty / core.length) ** 2;
    return leftDistance - rightDistance || left.ty - right.ty || left.tx - right.tx;
  })[0];
  if (root === undefined) return [];
  const parents = new Map<string, string | null>([[roadKey(root), null]]);
  const queue: TileCoordinate[] = [root];
  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    if (current === undefined) continue;
    for (const step of ROAD_STEPS) {
      const next = { tx: current.tx + step.tx, ty: current.ty + step.ty };
      const key = roadKey(next);
      if (!roads.has(key) || parents.has(key)) continue;
      parents.set(key, roadKey(current));
      queue.push(next);
    }
  }
  const included = new Set<string>();
  for (const options of contacts) {
    const target = options.filter(tile => parents.has(roadKey(tile)))
      .sort((left, right) => (parentsDepth(parents, roadKey(left)) - parentsDepth(parents, roadKey(right)))
        || left.ty - right.ty || left.tx - right.tx)[0];
    if (target === undefined) continue;
    let key: string | null = roadKey(target);
    while (key !== null && !included.has(key)) {
      included.add(key);
      key = parents.get(key) ?? null;
    }
  }
  return [...included].sort().flatMap(key => {
    const tile = roads.get(key);
    return tile === undefined ? [] : [{ id: `core-road-${key}`, ...tile, width: 1, height: 1 }];
  });
}

function parentsDepth(parents: ReadonlyMap<string, string | null>, key: string): number {
  let depth = 0;
  let cursor = parents.get(key) ?? null;
  while (cursor !== null) {
    depth += 1;
    cursor = parents.get(cursor) ?? null;
  }
  return depth;
}

export function palisadeFootprintsForState(state: GameState): readonly PalisadeFootprint[] {
  return [
    ...state.buildings.map(building => ({
      id: building.id,
      tx: building.tx,
      ty: building.ty,
      ...buildingFootprint(building),
    })),
    ...state.constructionSites.filter(isBuildingConstructionSite).map(site => ({
      id: site.id,
      ...constructionSiteFootprint(site),
    })),
  ].sort((left, right) => left.id.localeCompare(right.id));
}

function coreProposalForState(state: GameState): CoreProposal {
  const cached = coreProposalByState.get(state);
  if (cached !== undefined) return cached;
  const all = palisadeFootprintsForState(state);
  const coreIds = new Set([
    ...state.buildings.filter(building => LIVING_CORE_KINDS.has(building.kind)).map(building => building.id),
    ...state.constructionSites.filter(isBuildingConstructionSite)
      .filter(site => LIVING_CORE_KINDS.has(site.kind)).map(site => site.id),
  ]);
  const buildings = all.filter(footprint => coreIds.has(footprint.id));
  const preliminary = computePalisadeProposal(state, buildings, path =>
    palisadePathEnclosesFootprints(path, buildings) && palisadePathHasBuildingClearance(path, all), [2, 3]);
  const roads = preliminary.ok
    ? connectedCoreRoads(state, buildings).filter(footprint => footprintCorners(footprint)
      .every(corner => isPointInsidePalisade(corner, preliminary.path)))
    : [];
  const result = {
    buildings,
    core: [...buildings, ...roads].sort((left, right) => left.id.localeCompare(right.id)),
    proposal: preliminary,
  };
  coreProposalByState.set(state, result);
  return result;
}

export function palisadeCoreFootprintsForState(state: GameState): readonly PalisadeFootprint[] {
  return coreProposalForState(state).core;
}

export function palisadeCoreBuildingFootprintsForState(state: GameState): readonly PalisadeFootprint[] {
  return coreProposalForState(state).buildings;
}

export function palisadeCoreProposalForState(state: GameState): PalisadeProposalResult {
  return coreProposalForState(state).proposal;
}

export function computePalisadeProposalForState(
  state: GameState,
  acceptPath?: (path: PalisadePath) => boolean,
): PalisadeProposalResult {
  const { buildings, core, proposal } = coreProposalForState(state);
  const all = palisadeFootprintsForState(state);
  const layout = JSON.stringify([state.width, state.height, all,
    state.buildings.map(building => [building.id, building.kind]),
    state.constructionSites.filter(site => 'kind' in site).map(site => [site.id, site.kind])]);
  let cached = proposalCandidatesByTiles.get(state.tiles);
  if (cached?.layout !== layout) {
    const candidates = new Map<string, Extract<PalisadeProposalResult, { readonly ok: true }>>();
    const add = (candidate: PalisadeProposalResult): void => {
      if (candidate.ok) candidates.set(JSON.stringify(candidate.path), candidate);
    };
    add(proposal);
    const acceptsGeometry = (path: PalisadePath) =>
      palisadePathEnclosesFootprints(path, core) && palisadePathHasBuildingClearance(path, all);
    for (const anchors of [buildings, all]) {
      for (const subset of [anchors, ...anchors.map(omitted => anchors.filter(item => item !== omitted))]) {
        for (const margin of [2, 3]) add(computePalisadeProposal(state, subset, acceptsGeometry, [margin]));
      }
    }
    cached = { layout, candidates: [...candidates.values()].sort((left, right) =>
      left.perimeterSteps - right.perimeterSteps || JSON.stringify(left.path).localeCompare(JSON.stringify(right.path))),
      failure: proposal };
    proposalCandidatesByTiles.set(state.tiles, cached);
  }
  const accepted = cached.candidates.find(candidate => acceptPath === undefined || acceptPath(candidate.path));
  if (accepted !== undefined) return accepted;
  if (acceptPath === undefined || !proposal.ok) return cached.failure;
  const accepts = (path: PalisadePath) =>
    palisadePathEnclosesFootprints(path, core)
      && palisadePathHasBuildingClearance(path, all)
      && acceptPath(path);
  const preferred = computePalisadeProposal(state, buildings, accepts, [2, 3]);
  return preferred.ok ? preferred : computePalisadeProposal(state, buildings, accepts, [1]);
}
