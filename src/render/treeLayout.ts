import { RAMPS, SEMANTIC_PALETTE, type PaletteColor } from "../content/palette";
import type { ForestHarvest } from "../engine/engine.types";
import { stumpAgeAt } from "../engine/forestHarvests";
import type { Tile } from "../world/world.types";
import { TILE_H, TILE_W, screenToTile, tileToScreen } from "./iso";
import { objectPhase } from "./renderMotion";
import { treeClearsStartingLandmarks } from "./treeLandmarkClearance";

export type TreeSilhouette = "narrow" | "broad" | "rounded";
export type TreeTone = PaletteColor;
export type TreeSpriteKey =
  | "tree_oak_large"
  | "tree_oak_small"
  | "tree_pine_tall"
  | "tree_pine_short"
  | "tree_birch"
  | "tree_dead";
export type StumpSpriteKey = "stump_fresh" | "stump_old";

export type TreeDescriptor = {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly offsetX: number;
  readonly offsetY: number;
  readonly scale: number;
  readonly silhouette: TreeSilhouette;
  readonly tone: TreeTone;
  readonly phase: number;
  readonly sortY: number;
  readonly anchorTx: number;
  readonly anchorTy: number;
  readonly spriteKey: TreeSpriteKey;
};

export type StumpDescriptor = {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly scale: number;
  readonly sortY: number;
  readonly anchorTx: number;
  readonly anchorTy: number;
  readonly spriteKey: StumpSpriteKey;
};

export type ForestLookup = ReadonlySet<string>;

type TreeClusterInput = {
  readonly tile: Tile;
  readonly forestLookup: ForestLookup;
  readonly seed: number;
};

const SILHOUETTES: readonly TreeSilhouette[] = ["narrow", "broad", "rounded"];
const TREE_TONES: readonly TreeTone[] = RAMPS.foliage;
const FIRST_TREE_TONE: TreeTone = RAMPS.foliage[0] ?? SEMANTIC_PALETTE.forest;
const TREE_SPRITES: readonly TreeSpriteKey[] = [
  "tree_oak_large",
  "tree_oak_small",
  "tree_pine_tall",
  "tree_pine_short",
  "tree_birch",
  "tree_dead",
];
const TREE_SPRITE_FAMILY_OFFSETS: Readonly<Record<TreeSilhouette, number>> = {
  narrow: 0,
  broad: 2,
  rounded: 4,
};
const MAX_OFFSET_X = TILE_W * 0.35;
const MAX_OFFSET_Y = TILE_H * 0.35;
const SAFE_DIAMOND_RADIUS = 0.7;
const treeClusterCache = new WeakMap<Tile, Map<string, readonly TreeDescriptor[]>>();
const forestLookupCache = new WeakMap<readonly Tile[], ForestLookup>();

export { buildGroundCover } from "./groundCoverLayout";
export type { GroundCoverDescriptor, GroundCoverSpriteKey } from "./groundCoverLayout";

export function buildTreeCluster(input: TreeClusterInput): readonly TreeDescriptor[] {
  const treeCount = forestTreeCount(input.tile, input.forestLookup, input.seed);
  const cacheKey = `${input.seed}:${treeCount}`;
  const cached = treeClusterCache.get(input.tile)?.get(cacheKey);
  if (cached !== undefined) return cached;
  const center = tileToScreen(input.tile.tx, input.tile.ty);
  const descriptors: TreeDescriptor[] = [];
  const silhouetteOffset = Math.floor(hashUnit(input.tile.tx, input.tile.ty, input.seed, 0, 41) * SILHOUETTES.length) % SILHOUETTES.length;
  const toneOffset = Math.floor(hashUnit(input.tile.tx, input.tile.ty, input.seed, 0, 67) * TREE_TONES.length) % TREE_TONES.length;

  for (let index = 0; index < treeCount; index += 1) {
    const localAnchor = treeAnchor(treeCount, index);
    const offset = constrainToDiamond({
      x: clamp(localAnchor.x + jitter(input.tile.tx, input.tile.ty, input.seed, index, 11) * 8, -MAX_OFFSET_X, MAX_OFFSET_X),
      y: clamp(localAnchor.y + jitter(input.tile.tx, input.tile.ty, input.seed, index, 23) * 5, -MAX_OFFSET_Y, MAX_OFFSET_Y),
    });
    const { x: offsetX, y: offsetY } = offset;
    const scale = treeScale(input.tile.tx, input.tile.ty, input.seed, index);
    const silhouetteIndex = treeCount === SILHOUETTES.length
      ? (silhouetteOffset + index) % SILHOUETTES.length
      : Math.floor(hashUnit(input.tile.tx, input.tile.ty, input.seed, index, 41) * SILHOUETTES.length) % SILHOUETTES.length;
    const silhouette = SILHOUETTES[silhouetteIndex] ?? "narrow";
    const x = center.sx + offsetX;
    const y = center.sy + offsetY;
    const anchor = screenToTile(x, y);

    descriptors.push({
      id: `tree:${input.tile.tx}:${input.tile.ty}:${input.seed}:${index}`,
      x,
      y,
      offsetX,
      offsetY,
      scale,
      silhouette,
      tone: FIRST_TREE_TONE,
      phase: objectPhase(`tree:${input.seed}:${index}:${silhouette}`, input.tile.tx, input.tile.ty),
      sortY: y + scale * 8,
      anchorTx: anchor.tx,
      anchorTy: anchor.ty,
      spriteKey: treeSpriteKey(input.tile.tx, input.tile.ty, input.seed, index, silhouette),
    });
  }

  const result = descriptors
    .filter((tree) => treeClearsStartingLandmarks(tree))
    .sort((left, right) => left.sortY - right.sortY || left.id.localeCompare(right.id))
    .map((tree, index) => ({ ...tree, tone: treeToneAt(toneOffset + index) }));
  const tileCache = treeClusterCache.get(input.tile) ?? new Map();
  tileCache.set(cacheKey, result);
  treeClusterCache.set(input.tile, tileCache);
  return result;
}

export function buildStumpDescriptor(input: {
  readonly harvest: ForestHarvest;
  readonly tick: number;
}): StumpDescriptor {
  const center = tileToScreen(input.harvest.tx, input.harvest.ty);
  const spriteKey = stumpAgeAt(input.harvest, input.tick) === "old" ? "stump_old" : "stump_fresh";
  return {
    id: `stump:${input.harvest.tx}:${input.harvest.ty}:${input.harvest.harvestedAtTick}`,
    x: center.sx,
    y: center.sy,
    scale: 1,
    sortY: center.sy + 3,
    anchorTx: input.harvest.tx,
    anchorTy: input.harvest.ty,
    spriteKey,
  };
}

export function buildForestLookup(tiles: readonly Tile[]): ForestLookup {
  const cached = forestLookupCache.get(tiles);
  if (cached !== undefined) return cached;
  const lookup = new Set(
    tiles
      .filter((tile) => tile.terrain === "forest" && tile.buildingId === null && !tile.hasRoad)
      .map((tile) => tileKey(tile.tx, tile.ty)),
  );
  forestLookupCache.set(tiles, lookup);
  return lookup;
}

export function forestTreeCount(tile: Tile, forestLookup: ForestLookup, seed: number): 1 | 2 {
  const neighborCount = orthogonalForestNeighborCount(tile, forestLookup);
  const densityRoll = hashUnit(tile.tx, tile.ty, seed, 0, 59);

  if (neighborCount >= 2) {
    return densityRoll > 0.33 ? 2 : 1;
  }
  return 1;
}

export function orthogonalForestNeighborCount(tile: Tile, forestLookup: ForestLookup): number {
  return (
    Number(forestLookup.has(tileKey(tile.tx - 1, tile.ty))) +
    Number(forestLookup.has(tileKey(tile.tx + 1, tile.ty))) +
    Number(forestLookup.has(tileKey(tile.tx, tile.ty - 1))) +
    Number(forestLookup.has(tileKey(tile.tx, tile.ty + 1)))
  );
}

function treeAnchor(treeCount: number, index: number): { readonly x: number; readonly y: number } {
  if (treeCount === 1) {
    return { x: 0, y: 0 };
  }
  if (treeCount === 2) {
    return index === 0 ? { x: -10, y: -2 } : { x: 10, y: 4 };
  }
  switch (index) {
    case 0:
      return { x: 0, y: -7 };
    case 1:
      return { x: -13, y: 5 };
    default:
      return { x: 13, y: 4 };
  }
}

function constrainToDiamond(offset: { readonly x: number; readonly y: number }): { readonly x: number; readonly y: number } {
  const diamondRadius = Math.abs(offset.x) / (TILE_W / 2) + Math.abs(offset.y) / (TILE_H / 2);
  if (diamondRadius <= SAFE_DIAMOND_RADIUS) return offset;
  const scale = SAFE_DIAMOND_RADIUS / diamondRadius;
  return { x: offset.x * scale, y: offset.y * scale };
}

function tileKey(tx: number, ty: number): string {
  return `${tx}:${ty}`;
}

function jitter(tx: number, ty: number, seed: number, index: number, salt: number): number {
  return hashUnit(tx, ty, seed, index, salt) * 2 - 1;
}

function treeSpriteKey(
  tx: number,
  ty: number,
  seed: number,
  index: number,
  silhouette: TreeSilhouette,
): TreeSpriteKey {
  const silhouetteOffset = TREE_SPRITE_FAMILY_OFFSETS[silhouette];
  const hashSlot = Math.floor(hashUnit(tx, ty, seed, index, 109) * 997);
  const variant = positiveModulo(hashSlot + tx + ty + seed + index + silhouetteOffset, TREE_SPRITES.length);
  return TREE_SPRITES[variant] ?? "tree_oak_large";
}

function treeScale(tx: number, ty: number, seed: number, index: number): number {
  const bucket = Math.min(60, Math.floor(hashUnit(tx, ty, seed, index, 37) * 61));
  return 0.7 + bucket / 100;
}

function treeToneAt(index: number): TreeTone {
  return TREE_TONES[index % TREE_TONES.length] ?? FIRST_TREE_TONE;
}

function hashUnit(tx: number, ty: number, seed: number, index: number, salt: number): number {
  let hash = 2_166_136_261;
  hash ^= Math.imul(tx + 40_961, 374_761_393);
  hash = Math.imul(hash, 16_777_619);
  hash ^= Math.imul(ty + 73_121, 668_265_263);
  hash = Math.imul(hash, 16_777_619);
  hash ^= Math.imul(seed + 101_111, 2_246_822_519);
  hash = Math.imul(hash, 16_777_619);
  hash ^= Math.imul(index + 17, 3_266_489_917);
  hash = Math.imul(hash, 16_777_619);
  hash ^= Math.imul(salt + 97, 1_597_334_677);
  return (hash >>> 0) / 4_294_967_295;
}

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
