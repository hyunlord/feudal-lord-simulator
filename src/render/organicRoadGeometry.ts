import type { CardinalDirection } from "./terrainDetails";

export type RoadGroundPoint = { readonly tx: number; readonly ty: number };
type RoadGroundInput = RoadGroundPoint & {
  readonly seed: number;
  readonly arms: readonly CardinalDirection[];
  readonly widthScale?: 0.45 | 1;
};

const DIRECTIONS = ["north", "east", "south", "west"] as const;
const OFFSETS = {
  north: [0, -1], east: [1, 0], south: [0, 1], west: [-1, 0],
} as const satisfies Record<CardinalDirection, readonly [number, number]>;

export function roadGroundPolygons(input: RoadGroundInput): readonly (readonly RoadGroundPoint[])[] {
  const widthScale = input.widthScale ?? 1;
  const centreWidth = (0.208 + edgeVariation(input.tx, input.ty, input.seed) * 0.012) * widthScale;
  const centre = Array.from({ length: 24 }, (_, index) => {
    const angle = index * Math.PI / 12;
    return { tx: input.tx + Math.cos(angle) * centreWidth, ty: input.ty + Math.sin(angle) * centreWidth };
  });
  const arms = DIRECTIONS.filter(direction => input.arms.includes(direction));
  const polygons: (readonly RoadGroundPoint[])[] = [centre];
  for (const direction of arms) {
    const [dx, dy] = OFFSETS[direction];
    const edgeWidth = (0.20 + edgeVariation(input.tx + dx * 0.5, input.ty + dy * 0.5, input.seed) * 0.035) * widthScale;
    const side = (sign: number, step: number): RoadGroundPoint => {
      const t = step / 8;
      const blend = t * t * (3 - 2 * t);
      const width = centreWidth * (1 - blend) + edgeWidth * blend;
      return {
        tx: input.tx + dx * t * 0.5 - dy * width * sign,
        ty: input.ty + dy * t * 0.5 + dx * width * sign,
      };
    };
    polygons.push([
      ...Array.from({ length: 9 }, (_, step) => side(-1, step)),
      ...Array.from({ length: 9 }, (_, step) => side(1, 8 - step)),
    ]);
  }
  for (const [index, direction] of DIRECTIONS.entries()) {
    const next = DIRECTIONS[(index + 1) % DIRECTIONS.length];
    if (next === undefined || !arms.includes(direction) || !arms.includes(next)) continue;
    const [ax, ay] = OFFSETS[direction];
    const [bx, by] = OFFSETS[next];
    const reach = 0.40 * widthScale;
    const arc = Array.from({ length: 13 }, (_, step) => {
      const t = step / 12;
      const alongA = (1 - t) ** 2 * reach + (2 * (1 - t) * t + t * t) * centreWidth;
      const alongB = ((1 - t) ** 2 + 2 * (1 - t) * t) * centreWidth + t * t * reach;
      return { tx: input.tx + ax * alongA + bx * alongB, ty: input.ty + ay * alongA + by * alongB };
    });
    polygons.push([{ tx: input.tx, ty: input.ty }, ...arc]);
  }
  return polygons;
}

function edgeVariation(tx: number, ty: number, seed: number): number {
  const hash = Math.imul(tx * 2 + 97, 73_856_093) ^ Math.imul(ty * 2 + 193, 19_349_663) ^ Math.imul(seed, 83_492_791);
  return ((hash ^ (hash >>> 13)) >>> 0) / 0xffffffff;
}
