import type { Tile } from "../world/world.types";
import { TILE_H, TILE_W, screenToTile, tileToScreen } from "./iso";
import { objectPhase } from "./renderMotion";

export type TreeSilhouette = "narrow" | "broad" | "rounded";
export type TreeTone = "forest" | "sageDark";
export type TreeSpriteKey =
  | "tree_broadleaf_a"
  | "tree_broadleaf_b"
  | "tree_conifer_a"
  | "tree_conifer_b";
export type GroundCoverSpriteKey = "shrub_a" | "shrub_b";

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

export type GroundCoverDescriptor = {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly offsetX: number;
  readonly offsetY: number;
  readonly scale: number;
  readonly phase: number;
  readonly sortY: number;
  readonly anchorTx: number;
  readonly anchorTy: number;
  readonly spriteKey: GroundCoverSpriteKey;
};

export type ForestLookup = ReadonlySet<string>;

type TreeClusterInput = {
  readonly tile: Tile;
  readonly forestLookup: ForestLookup;
  readonly seed: number;
};

const SILHOUETTES: readonly TreeSilhouette[] = ["narrow", "broad", "rounded"];
const TREE_TONES: readonly TreeTone[] = ["forest", "sageDark"];
const SHRUB_SPRITES: readonly GroundCoverSpriteKey[] = ["shrub_a", "shrub_b"];
const MAX_OFFSET_X = TILE_W * 0.35;
const MAX_OFFSET_Y = TILE_H * 0.35;
const SAFE_DIAMOND_RADIUS = 0.7;

export function buildTreeCluster(input: TreeClusterInput): readonly TreeDescriptor[] {
  const treeCount = forestTreeCount(input.tile, input.forestLookup, input.seed);
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
    const scale = 0.75 + hashUnit(input.tile.tx, input.tile.ty, input.seed, index, 37) * 0.5;
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
      tone: "forest",
      phase: objectPhase(`tree:${input.seed}:${index}:${silhouette}`, input.tile.tx, input.tile.ty),
      sortY: y + scale * 8,
      anchorTx: anchor.tx,
      anchorTy: anchor.ty,
      spriteKey: treeSpriteKey(input.tile.tx, input.tile.ty, input.seed, index, silhouette),
    });
  }

  return descriptors
    .sort((left, right) => left.sortY - right.sortY || left.id.localeCompare(right.id))
    .map((tree, index) => ({ ...tree, tone: TREE_TONES[(toneOffset + index) % TREE_TONES.length] ?? "forest" }));
}

export function buildGroundCover(input: {
  readonly tile: Tile;
  readonly seed: number;
}): readonly GroundCoverDescriptor[] {
  if (input.tile.terrain === "water" || input.tile.buildingId !== null || input.tile.hasRoad) {
    return [];
  }
  const roll = hashUnit(input.tile.tx, input.tile.ty, input.seed, 0, 83);
  if (roll < 0.62) {
    return [];
  }
  const center = tileToScreen(input.tile.tx, input.tile.ty);
  const offset = constrainToDiamond({
    x: jitter(input.tile.tx, input.tile.ty, input.seed, 0, 89) * TILE_W * 0.24,
    y: jitter(input.tile.tx, input.tile.ty, input.seed, 0, 97) * TILE_H * 0.24,
  });
  const x = center.sx + offset.x;
  const y = center.sy + offset.y;
  const anchor = screenToTile(x, y);
  const scale = 0.75 + hashUnit(input.tile.tx, input.tile.ty, input.seed, 0, 101) * 0.5;
  const spriteIndex = Math.floor(hashUnit(input.tile.tx, input.tile.ty, input.seed, 0, 103) * SHRUB_SPRITES.length) % SHRUB_SPRITES.length;
  const spriteKey = SHRUB_SPRITES[spriteIndex] ?? "shrub_a";
  return [{
    id: `groundCover:${input.tile.tx}:${input.tile.ty}:${input.seed}:0`,
    x,
    y,
    offsetX: offset.x,
    offsetY: offset.y,
    scale,
    phase: objectPhase(`groundCover:${input.seed}:${spriteKey}`, input.tile.tx, input.tile.ty),
    sortY: y + scale * 2,
    anchorTx: anchor.tx,
    anchorTy: anchor.ty,
    spriteKey,
  }];
}

export function buildForestLookup(tiles: readonly Tile[]): ForestLookup {
  return new Set(
    tiles
      .filter((tile) => tile.terrain === "forest" && tile.buildingId === null && !tile.hasRoad)
      .map((tile) => tileKey(tile.tx, tile.ty)),
  );
}

export function forestTreeCount(tile: Tile, forestLookup: ForestLookup, seed: number): 1 | 2 | 3 {
  const neighborCount = forestNeighborCount(tile, forestLookup);
  const densityRoll = hashUnit(tile.tx, tile.ty, seed, 0, 59);

  if (neighborCount >= 4) {
    return 3;
  }
  if (neighborCount >= 2) {
    return densityRoll > 0.78 ? 3 : 2;
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

const forestNeighborCount = orthogonalForestNeighborCount;

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
  const variant = Math.floor(hashUnit(tx, ty, seed, index, 37) * 997) % 2;
  if (silhouette === "narrow") {
    return variant === 0 ? "tree_conifer_a" : "tree_conifer_b";
  }
  return variant === 0 ? "tree_broadleaf_a" : "tree_broadleaf_b";
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

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
