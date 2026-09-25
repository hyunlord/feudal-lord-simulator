import { boundaryHash, hashNumbers, type BoundaryBounds, type BoundaryPoint } from "./boundaryGeometry";
import { YARD_CORNER_RADIUS, YARD_GROWTH, YARD_SUBCELLS, type BuildingApron, type BuildingYard } from "./buildingGrounds";

// Props in house yards (C1e, asset spec 4.5): croft beds and hurdle fences on top of the C1d yards. Pure and derived.
//  - Croft beds: 1-2 per house yard, in the strip behind the house (the side opposite its frontage), wholly inside the
//    yard, at the strip's far end when that strip lies behind the house on screen (the rest is under its sprite);
//    three variants, never the same within BED_REPEAT_RADIUS (a bed with no free variant is dropped). A bed's long
//    side follows the back strip (mirrored when the strip runs along y).
//  - Hurdles: the yard rectangle's unit edges (the footprint grown by YARD_GROWTH has whole-tile sides) that the yard
//    fills exactly -- not clipped by a road, water, the wall or another footprint -- and that no other yard touches
//    from outside, except the frontage side. Each edge is one straight panel (Wave 4b: one tile along -y; mirrored it
//    runs along +x); the north vertex of the rectangle takes the corner piece when both of its edges are fenced.
//  - Wanted pieces the Wave 4b set lacks are listed (`wants`) for the Astra 4c request: a gate on the frontage side,
//    corners at the east / south / west vertices, and half panels where only part of an edge is fenceable.

export const BED_REPEAT_RADIUS = 4;
export const BED_VARIANTS = 3;
/** Half extents of a bed at its drawn scale (tiles): along its long side and across it. */
export const BED_HALF_ALONG = 0.3;
export const BED_HALF_ACROSS = 0.23;

export type CroftBed = {
  readonly buildingId: string;
  /** Ground centre (tile-centre coordinates). */
  readonly anchor: BoundaryPoint;
  readonly variant: number;
  /** Long side along y (the art's long side runs along x). */
  readonly mirror: boolean;
  readonly bounds: BoundaryBounds;
  readonly hash: number;
};

export type HurdlePiece = {
  readonly id: string;
  readonly buildingId: string;
  readonly kind: "straight" | "corner";
  /** Where the piece's anchor post foot stands (straight: the +y / +x end; corner: the north vertex). */
  readonly anchor: BoundaryPoint;
  /** Straight pieces along x are the mirrored panel. */
  readonly mirror: boolean;
  /** Draw order: the middle of what the piece covers (x + y). */
  readonly depth: number;
};

export type FenceWant = { readonly buildingId: string; readonly kind: "gate" | "corner" | "half"; readonly at: BoundaryPoint };

export type YardProps = {
  readonly beds: readonly CroftBed[];
  readonly hurdles: readonly HurdlePiece[];
  readonly wants: readonly FenceWant[];
  readonly hash: number;
};

export type YardPropsInput = {
  readonly yards: readonly BuildingYard[];
  readonly aprons: readonly BuildingApron[];
  /** Buildings that get yard props (houses). */
  readonly houses: ReadonlySet<string>;
  readonly seed: number;
};

type Side = { readonly normal: BoundaryPoint; readonly name: "top" | "right" | "bottom" | "left" };
const SIDES: readonly Side[] = [
  { normal: { x: 0, y: -1 }, name: "top" }, { normal: { x: 1, y: 0 }, name: "right" },
  { normal: { x: 0, y: 1 }, name: "bottom" }, { normal: { x: -1, y: 0 }, name: "left" },
];

export function yardProps(input: YardPropsInput): YardProps {
  const S = YARD_SUBCELLS;
  const owner = new Map<number, number>();
  input.yards.forEach((yard, index) => { for (const subcell of yard.subcells) owner.set(subcell, index); });
  const apronOf = new Map(input.aprons.map(apron => [apron.buildingId, apron]));
  const beds: CroftBed[] = [];
  const hurdles: HurdlePiece[] = [];
  const wants: FenceWant[] = [];

  input.yards.forEach((yard, yardIndex) => {
    if (!input.houses.has(yard.buildingId)) return;
    const stride = yard.subcellStride;
    const { tx, ty, width, height } = yard.footprint;
    const left = tx - 0.5 - YARD_GROWTH; const top = ty - 0.5 - YARD_GROWTH;
    const right = tx + width - 0.5 + YARD_GROWTH; const bottom = ty + height - 0.5 + YARD_GROWTH;
    const subcellAt = (x: number, y: number): number => Math.floor((y + 0.5) * S) * stride + Math.floor((x + 0.5) * S);
    const mine = (x: number, y: number): boolean => owner.get(subcellAt(x, y)) === yardIndex;
    const other = (x: number, y: number): boolean => { const at = owner.get(subcellAt(x, y)); return at !== undefined && at !== yardIndex; };
    const ideal = (x: number, y: number): boolean => insideRoundedRect(x, y, left, top, right, bottom, YARD_CORNER_RADIUS);
    const frontage = apronOf.get(yard.buildingId)?.normal ?? null;

    // Unit edges of the rectangle: fenced, a gate / half-panel want, or nothing.
    const fenced = new Map<string, boolean>();
    for (const side of SIDES) {
      const alongX = side.normal.y !== 0;
      const line = side.name === "top" ? top : side.name === "bottom" ? bottom : side.name === "left" ? left : right;
      const start = alongX ? left : top; const end = alongX ? right : bottom;
      const isFrontage = frontage !== null && frontage.x === side.normal.x && frontage.y === side.normal.y;
      for (let at = start; at < end - 1e-9; at += 1) {
        let idealCount = 0; let filled = 0; let touched = false;
        for (let k = 0; k < S; k += 1) {
          const along = at + (k + 0.5) / S;
          const inner = line - (side.normal.x + side.normal.y) * 0.5 / S;
          const outer = line + (side.normal.x + side.normal.y) * 0.5 / S;
          const [ix, iy] = alongX ? [along, inner] : [inner, along];
          const [ox, oy] = alongX ? [along, outer] : [outer, along];
          if (!ideal(ix, iy)) continue;
          idealCount += 1;
          if (mine(ix, iy)) filled += 1;
          if (other(ox, oy)) touched = true;
        }
        const whole = idealCount >= S / 2 && filled === idealCount && !touched;
        const middle = alongX ? { x: at + 0.5, y: line } : { x: line, y: at + 0.5 };
        if (isFrontage) {
          if (filled > 0) wants.push({ buildingId: yard.buildingId, kind: "gate", at: middle });
          continue;
        }
        if (whole) fenced.set(`${side.name}:${at}`, true);
        else if (!touched && filled >= S / 4) wants.push({ buildingId: yard.buildingId, kind: "half", at: middle });
      }
    }
    const has = (side: Side["name"], at: number): boolean => fenced.get(`${side}:${at}`) === true;
    const cornerNorth = has("top", left) && has("left", top);
    const push = (piece: Omit<HurdlePiece, "id" | "buildingId">): void => {
      hurdles.push({ ...piece, buildingId: yard.buildingId, id: `yard-hurdle:${yard.buildingId}:${piece.kind}:${piece.anchor.x},${piece.anchor.y}` });
    };
    if (cornerNorth) push({ kind: "corner", anchor: { x: left, y: top }, mirror: false, depth: left + top + 0.5 });
    for (const [key] of fenced) {
      const [name, value] = key.split(":") as [Side["name"], string];
      const at = Number(value);
      if (cornerNorth && ((name === "top" && at === left) || (name === "left" && at === top))) continue;
      if (name === "top" || name === "bottom") {
        const y = name === "top" ? top : bottom;
        push({ kind: "straight", anchor: { x: at + 1, y }, mirror: true, depth: at + 0.5 + y });
      } else {
        const x = name === "left" ? left : right;
        push({ kind: "straight", anchor: { x, y: at + 1 }, mirror: false, depth: x + at + 0.5 });
      }
    }
    // Corners the set has no piece for (both edges fenced at the east, south or west vertex).
    if (has("top", right - 1) && has("right", top)) wants.push({ buildingId: yard.buildingId, kind: "corner", at: { x: right, y: top } });
    if (has("bottom", right - 1) && has("right", bottom - 1)) wants.push({ buildingId: yard.buildingId, kind: "corner", at: { x: right, y: bottom } });
    if (has("bottom", left) && has("left", bottom - 1)) wants.push({ buildingId: yard.buildingId, kind: "corner", at: { x: left, y: bottom } });

    // Croft beds behind the house.
    const back = frontage === null ? { x: 0, y: -1 } : { x: -frontage.x, y: -frontage.y };
    const alongX = back.y !== 0;
    const depthLine = back.y < 0 ? top : back.y > 0 ? bottom : back.x < 0 ? left : right;
    const acrossCentre = depthLine - (back.x + back.y) * YARD_GROWTH / 2;
    const low = (alongX ? left : top) + YARD_CORNER_RADIUS + BED_HALF_ALONG;
    const high = (alongX ? right : bottom) - YARD_CORNER_RADIUS - BED_HALF_ALONG;
    if (high < low) return;
    const hash = boundaryHash(tx * 131 + ty, input.seed, 83);
    // A back strip behind the house on screen (north-east or north-west) is mostly under the house sprite except at its
    // far end (+x or +y): one bed there. A back strip in front of the house (south-west / south-east) shows whole.
    const behind = back.y < 0 || back.x < 0;
    const count = !behind && high - low >= BED_HALF_ALONG * 2 + 0.2 && hash % 3 !== 0 ? 2 : 1;
    const centres = behind ? [high] : count === 1 ? [(low + high) / 2 + ((((hash >>> 4) % 1000) / 999) - 0.5) * Math.min(0.3, high - low)] : [low, high];
    centres.forEach((along, bedIndex) => {
      const anchor = alongX ? { x: along, y: acrossCentre } : { x: acrossCentre, y: along };
      const halfX = alongX ? BED_HALF_ALONG : BED_HALF_ACROSS; const halfY = alongX ? BED_HALF_ACROSS : BED_HALF_ALONG;
      for (let j = 0; j <= 4; j += 1) for (let i = 0; i <= 4; i += 1) {
        if (!mine(anchor.x - halfX + (2 * halfX) * i / 4, anchor.y - halfY + (2 * halfY) * j / 4)) return;
      }
      const near = new Set(beds.filter(bed => Math.hypot(bed.anchor.x - anchor.x, bed.anchor.y - anchor.y) < BED_REPEAT_RADIUS).map(bed => bed.variant));
      const first = (boundaryHash(tx * 131 + ty + bedIndex * 7, input.seed, 89)) % BED_VARIANTS;
      let variant = -1;
      for (let tried = 0; tried < BED_VARIANTS; tried += 1) {
        const option = (first + tried) % BED_VARIANTS;
        if (!near.has(option)) { variant = option; break; }
      }
      if (variant < 0) return;
      beds.push({ buildingId: yard.buildingId, anchor, variant, mirror: !alongX,
        bounds: { left: anchor.x - 1, top: anchor.y - 1.2, right: anchor.x + 1, bottom: anchor.y + 0.8 },
        hash: hashNumbers([anchor.x, anchor.y, variant, alongX ? 1 : 2]) });
    });
  });
  const hash = hashNumbers([...beds.map(bed => bed.hash), ...hurdles.flatMap(piece => [piece.anchor.x, piece.anchor.y, piece.kind === "corner" ? 1 : 2, piece.mirror ? 1 : 0])]);
  return { beds, hurdles, wants, hash };
}

function insideRoundedRect(x: number, y: number, left: number, top: number, right: number, bottom: number, radius: number): boolean {
  if (x < left || x > right || y < top || y > bottom) return false;
  const cx = Math.min(Math.max(x, left + radius), right - radius);
  const cy = Math.min(Math.max(y, top + radius), bottom - radius);
  return Math.hypot(x - cx, y - cy) <= radius;
}
