import type { Tile } from "../world/world.types";
import { TILE_H, TILE_W, screenToTile, tileToScreen } from "./iso";
import { objectPhase } from "./renderMotion";

export type GroundCoverSpriteKey = "shrub_a" | "shrub_b" | "grass_tuft" | "field_stone";

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

const GROUND_COVER_SPRITES: readonly GroundCoverSpriteKey[] = [
  "shrub_a",
  "shrub_b",
  "grass_tuft",
  "field_stone",
];
const SAFE_DIAMOND_RADIUS = 0.7;
const groundCoverCache = new WeakMap<Tile, Map<number, readonly GroundCoverDescriptor[]>>();

export function buildGroundCover(input: {
  readonly tile: Tile;
  readonly seed: number;
}): readonly GroundCoverDescriptor[] {
  const cached = groundCoverCache.get(input.tile)?.get(input.seed);
  if (cached !== undefined) return cached;
  if (
    input.tile.terrain !== "grass" ||
    input.tile.buildingId !== null ||
    input.tile.hasRoad
  ) {
    return cacheGroundCover(input.tile, input.seed, []);
  }
  const roll = hashUnit(input.tile.tx, input.tile.ty, input.seed, 0, 83);
  if (roll < 0.92) {
    return cacheGroundCover(input.tile, input.seed, []);
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
  const variantRoll = hashUnit(input.tile.ty, input.tile.tx, input.seed + 17_171, 1, 149);
  const spriteIndex = Math.floor(variantRoll * GROUND_COVER_SPRITES.length) % GROUND_COVER_SPRITES.length;
  const spriteKey = GROUND_COVER_SPRITES[spriteIndex] ?? "shrub_a";
  return cacheGroundCover(input.tile, input.seed, [{
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
  }]);
}

function cacheGroundCover(
  tile: Tile,
  seed: number,
  descriptors: readonly GroundCoverDescriptor[],
): readonly GroundCoverDescriptor[] {
  const tileCache = groundCoverCache.get(tile) ?? new Map();
  tileCache.set(seed, descriptors);
  groundCoverCache.set(tile, tileCache);
  return descriptors;
}

function constrainToDiamond(offset: { readonly x: number; readonly y: number }): { readonly x: number; readonly y: number } {
  const diamondRadius = Math.abs(offset.x) / (TILE_W / 2) + Math.abs(offset.y) / (TILE_H / 2);
  if (diamondRadius <= SAFE_DIAMOND_RADIUS) return offset;
  const scale = SAFE_DIAMOND_RADIUS / diamondRadius;
  return { x: offset.x * scale, y: offset.y * scale };
}

function jitter(tx: number, ty: number, seed: number, index: number, salt: number): number {
  return hashUnit(tx, ty, seed, index, salt) * 2 - 1;
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
