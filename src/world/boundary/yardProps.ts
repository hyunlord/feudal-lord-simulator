import { boundaryHash, hashNumbers, type BoundaryBounds, type BoundaryPoint } from "./boundaryGeometry";
import { YARD_CORNER_RADIUS, YARD_GROWTH, YARD_SUBCELLS, type BuildingApron, type BuildingYard } from "./buildingGrounds";

// Props in house yards (C1e, asset spec 4.5): croft beds and hurdle fences on top of the C1d yards. Pure and derived.
//  - Croft beds: 1-2 per house yard, in the strip behind the house (the side opposite its frontage), wholly inside the
//    yard, at the strip's far end when that strip lies behind the house on screen (the rest is under its sprite);
//    three variants, never the same within BED_REPEAT_RADIUS (a bed with no free variant is dropped). A bed's long
//    side follows the back strip (mirrored when the strip runs along y).
//  - Hurdles (C1e, ring closed by C1f with Wave 4c): the yard rectangle's unit edges (the footprint grown by YARD_GROWTH
//    has whole-tile sides). An edge the yard fills exactly -- not clipped by a road, water, the wall or another
//    footprint -- and that no other yard touches from outside is fenceable; so is the frontage side now.
//      - Gate: on the frontage side, the fenceable edge nearest the side's middle takes the gate (one per yard).
//      - Part panels: an edge a cut leaves partly filled -- its quarters (2 of the 8 subcells each) wholly the yard's
//        from one end, the rest not at all, no other yard outside -- takes the panel of that length on the filled part:
//        a quarter (Wave 4e), a half (Wave 4c) or a three-quarter (Wave 4e) panel (INSTALL-4e).
//      - Short gate (Wave 4e, INSTALL-4e): a fenced yard whose frontage side has no whole edge but a half edge takes the
//        short gate there instead of the half panel (the frontage half nearest the side's middle).
//      - Corners: at each vertex whose two adjacent edges are both plain panels (not the gate, not halves) the corner
//        piece of that vertex (north: Wave 4b, east / south / west: Wave 4c) replaces them; never mirrored.
//      - Every other fenceable edge is one straight panel (one tile along -y; mirrored it runs along +x).
//  - `wants` keeps what still has no piece: a fenced yard's frontage side with no fenceable edge (no gate), an edge cut
//    other than in half.

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

export type HurdleVertex = "north" | "east" | "south" | "west";

export type HurdlePiece = {
  readonly id: string;
  readonly buildingId: string;
  readonly kind: "straight" | "gate" | "half" | "quarter" | "three_quarter" | "short_gate" | "corner";
  /** Corners: which rectangle vertex (each has its own art). */
  readonly vertex?: HurdleVertex;
  /**
   * Where the piece's anchor post foot stands (straight / gate: the +y / +x end of its edge; part panels and the short
   * gate: the +y / +x end of the part they cover; corner: the vertex).
   */
  readonly anchor: BoundaryPoint;
  /** Straight, gate, part and short gate pieces along x are the mirrored panel. */
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

    // Unit edges of the rectangle: whole (fenceable), half (which half), or nothing.
    type Edge = { readonly side: Side["name"]; readonly at: number; readonly alongX: boolean; readonly line: number; readonly frontage: boolean };
    const whole: Edge[] = [];
    /** Part edges: `quarters` (1..3) of the edge filled from its upper (+) or lower end. */
    const parts: { readonly edge: Edge; readonly upper: boolean; readonly quarters: 1 | 2 | 3 }[] = [];
    for (const side of SIDES) {
      const alongX = side.normal.y !== 0;
      const line = side.name === "top" ? top : side.name === "bottom" ? bottom : side.name === "left" ? left : right;
      const start = alongX ? left : top; const end = alongX ? right : bottom;
      const isFrontage = frontage !== null && frontage.x === side.normal.x && frontage.y === side.normal.y;
      for (let at = start; at < end - 1e-9; at += 1) {
        let idealCount = 0; let filled = 0; let touched = false;
        const quarterFilled = [0, 0, 0, 0]; const quarterIdeal = [0, 0, 0, 0];
        for (let k = 0; k < S; k += 1) {
          const along = at + (k + 0.5) / S;
          const inner = line - (side.normal.x + side.normal.y) * 0.5 / S;
          const outer = line + (side.normal.x + side.normal.y) * 0.5 / S;
          const [ix, iy] = alongX ? [along, inner] : [inner, along];
          const [ox, oy] = alongX ? [along, outer] : [outer, along];
          if (!ideal(ix, iy)) continue;
          if (other(ox, oy)) touched = true;
          const quarter = Math.floor(k * 4 / S);
          idealCount += 1; quarterIdeal[quarter] = (quarterIdeal[quarter] as number) + 1;
          if (mine(ix, iy)) { filled += 1; quarterFilled[quarter] = (quarterFilled[quarter] as number) + 1; }
        }
        const edge: Edge = { side: side.name, at, alongX, line, frontage: isFrontage };
        const middle = alongX ? { x: at + 0.5, y: line } : { x: line, y: at + 0.5 };
        if (touched) continue;
        if (idealCount >= S / 2 && filled === idealCount) { whole.push(edge); continue; }
        // A cut: the first m quarters from one end wholly the yard's (their ideal part), the others none of it.
        // (A quarter the rounded corner leaves without ideal subcells counts as filled; the run must hold some.)
        const full = (q: number): boolean => quarterFilled[q] === quarterIdeal[q];
        const empty = (q: number): boolean => quarterFilled[q] === 0;
        const runIdeal = (qs: readonly number[]): number => qs.reduce((sum, q) => sum + (quarterIdeal[q] as number), 0);
        let part: { readonly upper: boolean; readonly quarters: 1 | 2 | 3 } | null = null;
        for (const quarters of [2, 1, 3] as const) {
          const low = [0, 1, 2, 3].filter(q => q < quarters); const high = [0, 1, 2, 3].filter(q => q >= 4 - quarters);
          const lower = runIdeal(low) > 0 && [0, 1, 2, 3].every(q => q < quarters ? full(q) : empty(q));
          const upper = runIdeal(high) > 0 && [0, 1, 2, 3].every(q => q >= 4 - quarters ? full(q) : empty(q));
          if (lower || upper) { part = { upper, quarters }; break; }
        }
        if (part !== null) parts.push({ edge, ...part });
        else if (filled >= S / 4) wants.push({ buildingId: yard.buildingId, kind: "half", at: middle });
      }
    }
    // The gate: the frontage side's fenceable edge nearest its middle (ties: the lower one).
    const frontEdges = whole.filter(edge => edge.frontage);
    let gate: Edge | null = null;
    if (frontEdges.length > 0) {
      const mid = frontEdges[0]!.alongX ? (left + right) / 2 : (top + bottom) / 2;
      gate = [...frontEdges].sort((p, q) => Math.abs(p.at + 0.5 - mid) - Math.abs(q.at + 0.5 - mid) || p.at - q.at)[0] ?? null;
    }
    // No whole frontage edge: the short gate takes the frontage half edge nearest the side's middle (ties: the lower).
    let shortGate: (typeof parts)[number] | null = null;
    if (gate === null && frontage !== null && whole.length + parts.length > 0) {
      const alongX = frontage.y !== 0;
      const mid = alongX ? (left + right) / 2 : (top + bottom) / 2;
      const centre = (part: (typeof parts)[number]): number => part.edge.at + (part.upper ? 0.75 : 0.25);
      shortGate = parts.filter(part => part.edge.frontage && part.quarters === 2)
        .sort((p, q) => Math.abs(centre(p) - mid) - Math.abs(centre(q) - mid) || p.edge.at - q.edge.at)[0] ?? null;
      if (shortGate === null) {
        // A fenced yard whose frontage side has no whole or half edge left: no gate can stand (listed; unfenced yards need none).
        const line = frontage.y < 0 ? top : frontage.y > 0 ? bottom : frontage.x < 0 ? left : right;
        wants.push({ buildingId: yard.buildingId, kind: "gate", at: alongX ? { x: (left + right) / 2, y: line } : { x: line, y: (top + bottom) / 2 } });
      }
    }
    const plain = new Set(whole.filter(edge => edge !== gate).map(edge => `${edge.side}:${edge.at}`));
    const push = (piece: Omit<HurdlePiece, "id" | "buildingId">): void => {
      hurdles.push({ ...piece, buildingId: yard.buildingId, id: `yard-hurdle:${yard.buildingId}:${piece.vertex ?? piece.kind}:${piece.anchor.x},${piece.anchor.y}` });
    };
    // Corners: the vertex and the two unit edges each covers, with the middle of what it covers (x + y) as depth.
    const corners: readonly { readonly vertex: HurdleVertex; readonly anchor: BoundaryPoint; readonly edges: readonly [string, string]; readonly depth: number }[] = [
      { vertex: "north", anchor: { x: left, y: top }, edges: [`top:${left}`, `left:${top}`], depth: left + top + 0.5 },
      { vertex: "east", anchor: { x: right, y: top }, edges: [`top:${right - 1}`, `right:${top}`], depth: right + top },
      { vertex: "south", anchor: { x: right, y: bottom }, edges: [`bottom:${right - 1}`, `right:${bottom - 1}`], depth: right + bottom - 0.5 },
      { vertex: "west", anchor: { x: left, y: bottom }, edges: [`bottom:${left}`, `left:${bottom - 1}`], depth: left + bottom },
    ];
    const covered = new Set<string>();
    for (const corner of corners) {
      const [a, b] = corner.edges;
      if (!plain.has(a) || !plain.has(b) || covered.has(a) || covered.has(b)) continue;
      covered.add(a); covered.add(b);
      push({ kind: "corner", vertex: corner.vertex, anchor: corner.anchor, mirror: false, depth: corner.depth });
    }
    for (const edge of whole) {
      if (covered.has(`${edge.side}:${edge.at}`)) continue;
      const kind = edge === gate ? "gate" : "straight";
      if (edge.alongX) push({ kind, anchor: { x: edge.at + 1, y: edge.line }, mirror: true, depth: edge.at + 0.5 + edge.line });
      else push({ kind, anchor: { x: edge.line, y: edge.at + 1 }, mirror: false, depth: edge.line + edge.at + 0.5 });
    }
    for (const part of parts) {
      // A part panel covers [at, at + q / 4] (lower) or [at + 1 - q / 4, at + 1] (upper); its anchor is that part's
      // +y / +x end.
      const { edge, upper, quarters } = part;
      const length = quarters / 4;
      const end = upper ? edge.at + 1 : edge.at + length;
      const middle = end - length / 2;
      const kind = part === shortGate ? "short_gate" : quarters === 1 ? "quarter" : quarters === 2 ? "half" : "three_quarter";
      if (edge.alongX) push({ kind, anchor: { x: end, y: edge.line }, mirror: true, depth: middle + edge.line });
      else push({ kind, anchor: { x: edge.line, y: end }, mirror: false, depth: edge.line + middle });
    }

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
  const kindCode = (piece: HurdlePiece): number => ({ straight: 2, gate: 3, half: 4, quarter: 5, three_quarter: 6, short_gate: 7,
    corner: 10 + ["north", "east", "south", "west"].indexOf(piece.vertex ?? "north") })[piece.kind];
  const hash = hashNumbers([...beds.map(bed => bed.hash), ...hurdles.flatMap(piece => [piece.anchor.x, piece.anchor.y, kindCode(piece), piece.mirror ? 1 : 0])]);
  return { beds, hurdles, wants, hash };
}

function insideRoundedRect(x: number, y: number, left: number, top: number, right: number, bottom: number, radius: number): boolean {
  if (x < left || x > right || y < top || y > bottom) return false;
  const cx = Math.min(Math.max(x, left + radius), right - radius);
  const cy = Math.min(Math.max(y, top + radius), bottom - radius);
  return Math.hypot(x - cx, y - cy) <= radius;
}
