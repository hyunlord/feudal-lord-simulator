import type { Tile } from "../world/world.types";

export type CardinalDirection = "north" | "east" | "south" | "west";

export type GroundDecal =
  | { readonly kind: "none" }
  | { readonly kind: "tufts"; readonly count: 2 | 3 | 4; readonly variant: number }
  | { readonly kind: "rock"; readonly variant: number };

const DIRECTIONS = [
  ["north", 0, -1],
  ["east", 1, 0],
  ["south", 0, 1],
  ["west", -1, 0],
] as const satisfies readonly (readonly [CardinalDirection, number, number])[];

export function roadConnectionArms(
  tile: Tile,
  neighbours: readonly Tile[],
): readonly CardinalDirection[] {
  return DIRECTIONS
    .filter(([, dx, dy]) =>
      neighbours.some((candidate) =>
        candidate.tx === tile.tx + dx &&
        candidate.ty === tile.ty + dy &&
        candidate.hasRoad,
      ),
    )
    .map(([direction]) => direction);
}

export function groundDecalFor(tx: number, ty: number, seed: number): GroundDecal {
  const roll = tileHash(tx, ty, seed, 17) % 100;
  if (roll < 15) {
    return {
      kind: "tufts",
      count: (2 + (tileHash(tx, ty, seed, 41) % 3)) as 2 | 3 | 4,
      variant: tileHash(tx, ty, seed, 59),
    };
  }
  if (roll < 20) return { kind: "rock", variant: tileHash(tx, ty, seed, 73) };
  return { kind: "none" };
}

export function roadPebbleVariants(tx: number, ty: number, seed: number): readonly number[] {
  const count = 2 + (tileHash(tx, ty, seed, 89) & 1);
  return Array.from({ length: count }, (_, index) => tileHash(tx, ty, seed, 101 + index));
}

function tileHash(tx: number, ty: number, seed: number, salt: number): number {
  let hash = Math.imul(tx + 40_961, 73_856_093) ^ Math.imul(ty + 73_121, 19_349_663);
  hash ^= Math.imul(seed + 101_111, 83_492_791) ^ Math.imul(salt, 374_761_393);
  hash = Math.imul(hash ^ (hash >>> 13), 1_274_126_177);
  return (hash ^ (hash >>> 16)) >>> 0;
}
