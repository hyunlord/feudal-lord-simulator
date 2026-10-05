import type { GameState } from '../engine/engine.types';
import type { Tile } from '../world/world.types';
import { clearedTreeTileKeys, isTreeCandidate } from './objectRenderOrder';
import { forestHarvestLookup, stumpRenderItemForTile } from './stumpRenderItems';
import { buildForestLookup, buildTreeCluster, type TreeDescriptor } from './treeLayout';
import { mix, tileCentre } from './weatherPlacement';
import { autumnAccumulation, calendarProgress } from './calendarProgress';

export type DeciduousGroup = 'broad-deciduous' | 'narrow-deciduous';
export type NatureTree = { readonly tree: TreeDescriptor; readonly group: DeciduousGroup };
/** Visual morphology groups only: these do not create beech/maple engine species. */
export function liveDeciduousTrees(state: GameState): readonly NatureTree[] {
  const result: NatureTree[] = [];
  const cleared = clearedTreeTileKeys(state.buildings, state.constructionSites);
  const harvests = forestHarvestLookup(state.forestHarvests ?? []);
  const forestLookup = buildForestLookup(state.tiles);
  for (const tile of state.tiles) {
    if (tile.terrain !== 'forest' || !isTreeCandidate(tile, cleared) || stumpRenderItemForTile(tile, harvests, cleared, state.tick) !== null) continue;
    for (const tree of buildTreeCluster({ tile, forestLookup, seed: state.seed })) {
      switch (tree.spriteKey) {
        case 'tree_oak_large': case 'tree_oak_small': result.push({ tree, group: 'broad-deciduous' }); break;
        case 'tree_birch': result.push({ tree, group: 'narrow-deciduous' }); break;
        case 'tree_pine_tall': case 'tree_pine_short': case 'tree_dead': break;
      }
    }
  }
  return result;
}
export type LeafSpot = { readonly tile: Tile; readonly x: number; readonly y: number; readonly hash: number; readonly group: DeciduousGroup | 'mixed'; readonly amount: number };
export function accumulatedLeafSpots(state: GameState, trees: readonly NatureTree[]): readonly LeafSpot[] {
  const amount = autumnAccumulation(calendarProgress(state));
  if (amount <= 0) return [];
  const edges = new Map<string, Set<DeciduousGroup>>();
  for (const { tree, group } of trees) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
    const key = `${Math.round(tree.anchorTx) + (dx ?? 0)}:${Math.round(tree.anchorTy) + (dy ?? 0)}`;
    const groups = edges.get(key) ?? new Set<DeciduousGroup>(); groups.add(group); edges.set(key, groups);
  }
  const result: LeafSpot[] = [];
  for (const tile of state.tiles) {
    if ((tile.terrain !== 'grass' && tile.terrain !== 'water') || tile.buildingId !== null || tile.hasRoad) continue;
    const groups = edges.get(`${tile.tx}:${tile.ty}`);
    if (groups === undefined) continue;
    const hash = mix(state.seed, tile.tx, tile.ty, 39201);
    if ((hash % 1000) / 1000 > amount * 0.6) continue;
    const group = groups.size > 1 ? 'mixed' : groups.has('broad-deciduous') ? 'broad-deciduous' : 'narrow-deciduous';
    result.push({ tile, ...tileCentre(tile.tx, tile.ty), hash, group, amount });
  }
  return result;
}
