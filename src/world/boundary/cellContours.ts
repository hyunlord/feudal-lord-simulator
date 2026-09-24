import { boundaryEdgeKey, hashNumbers, type BoundaryPoint } from "./boundaryGeometry";

// Marching squares over a cell mask. Samples are tile centres; every contour vertex is the midpoint of one tile
// edge that separates an inside cell from an outside cell, so the two tiles of that edge (and every neighbouring
// terrain) read one shared line. Saddles stay separated: diagonal-only contact never merges two regions, matching
// the 4-connected rules the simulation uses. Loops are oriented with the inside on the left of travel (y down)
// and start at their smallest (y, x) vertex, so the result does not depend on how the cells were enumerated.

export type CellMask = {
  readonly width: number;
  readonly height: number;
  readonly inside: (tx: number, ty: number) => boolean;
  /** Value of cells beyond the map edge. `true` keeps contours off the map border. */
  readonly outside: boolean;
};

export type CellContourLoop = {
  /** Closed polyline to smooth (the last point connects back to the first). */
  readonly points: readonly BoundaryPoint[];
  /** Midpoint of every boundary tile edge along the loop, in loop order. */
  readonly edgeMidpoints: readonly BoundaryPoint[];
  /** boundaryEdgeKey of each boundary tile edge (same order as edgeMidpoints). */
  readonly edgeKeys: readonly number[];
  /** For each boundary edge, its inside cell. */
  readonly insideCells: readonly { readonly tx: number; readonly ty: number }[];
  /** Positive for outer boundaries, negative for holes (shoelace, y down). */
  readonly signedArea: number;
  readonly hash: number;
};

type Crossing = { readonly key: number; readonly point: BoundaryPoint; readonly edgeKey: number;
  readonly inside: { readonly tx: number; readonly ty: number }; readonly outsideCell: { readonly tx: number; readonly ty: number } };

// Segments per case (corner bits: a=(x,y)=1, b=(x+1,y)=2, c=(x+1,y+1)=4, d=(x,y+1)=8) between square sides.
type Side = "top" | "right" | "bottom" | "left";
const CASES: Readonly<Record<number, readonly (readonly [Side, Side])[]>> = {
  1: [["left", "top"]], 2: [["top", "right"]], 3: [["left", "right"]], 4: [["right", "bottom"]],
  5: [["left", "top"], ["right", "bottom"]], 6: [["top", "bottom"]], 7: [["left", "bottom"]], 8: [["bottom", "left"]],
  9: [["top", "bottom"]], 10: [["top", "right"], ["bottom", "left"]], 11: [["right", "bottom"]], 12: [["left", "right"]],
  13: [["top", "right"]], 14: [["left", "top"]],
};

export function cellContourLoops(mask: CellMask): CellContourLoop[] {
  const value = (tx: number, ty: number): boolean =>
    tx < 0 || ty < 0 || tx >= mask.width || ty >= mask.height ? mask.outside : mask.inside(tx, ty);
  const stride = mask.width * 2 + 6;
  const pointKey = (x: number, y: number): number => (Math.round(y * 2) + 3) * stride + (Math.round(x * 2) + 3);
  const crossings = new Map<number, Crossing>();
  const links = new Map<number, number[]>();
  const crossing = (side: Side, x: number, y: number): number => {
    // Each side of the square lies between two sample cells; its midpoint is on the tile edge between them.
    const [a, b] = side === "top" ? [{ tx: x, ty: y }, { tx: x + 1, ty: y }]
      : side === "bottom" ? [{ tx: x, ty: y + 1 }, { tx: x + 1, ty: y + 1 }]
      : side === "left" ? [{ tx: x, ty: y }, { tx: x, ty: y + 1 }]
      : [{ tx: x + 1, ty: y }, { tx: x + 1, ty: y + 1 }];
    const point = { x: (a.tx + b.tx) / 2, y: (a.ty + b.ty) / 2 };
    const key = pointKey(point.x, point.y);
    if (!crossings.has(key)) {
      const aInside = value(a.tx, a.ty);
      crossings.set(key, {
        key, point, edgeKey: boundaryEdgeKey(mask.width, a.tx, a.ty, b.tx - a.tx, b.ty - a.ty),
        inside: aInside ? a : b, outsideCell: aInside ? b : a,
      });
    }
    return key;
  };
  const link = (from: number, to: number): void => {
    links.set(from, [...(links.get(from) ?? []), to]);
    links.set(to, [...(links.get(to) ?? []), from]);
  };
  for (let y = -1; y < mask.height; y += 1) {
    for (let x = -1; x < mask.width; x += 1) {
      const code = (value(x, y) ? 1 : 0) | (value(x + 1, y) ? 2 : 0) | (value(x + 1, y + 1) ? 4 : 0) | (value(x, y + 1) ? 8 : 0);
      for (const [from, to] of CASES[code] ?? []) link(crossing(from, x, y), crossing(to, x, y));
    }
  }

  const visited = new Set<number>();
  const loops: CellContourLoop[] = [];
  for (const start of [...crossings.keys()].sort((a, b) => a - b)) {
    if (visited.has(start)) continue;
    const ring: number[] = [];
    let previous = -1; let current = start;
    while (!visited.has(current)) {
      visited.add(current); ring.push(current);
      const next = (links.get(current) ?? []).find(candidate => candidate !== previous && !visited.has(candidate))
        ?? (links.get(current) ?? []).find(candidate => candidate !== previous);
      if (next === undefined) break;
      previous = current; current = next;
    }
    loops.push(orientedLoop(ring.map(key => crossings.get(key) as Crossing), pointKey));
  }
  return loops;
}

function orientedLoop(ring: readonly Crossing[], pointKey: (x: number, y: number) => number): CellContourLoop {
  const first = ring[0] as Crossing; const second = ring[1 % ring.length] as Crossing;
  // Inside on the left (y down): left normal of the travel direction points from outside cell to inside cell.
  const dx = second.point.x - first.point.x; const dy = second.point.y - first.point.y;
  const toInside = { x: first.inside.tx - first.outsideCell.tx, y: first.inside.ty - first.outsideCell.ty };
  const leftNormal = { x: dy, y: -dx };
  let ordered = leftNormal.x * toInside.x + leftNormal.y * toInside.y >= 0 ? [...ring] : [...ring].reverse();
  let startIndex = 0;
  ordered.forEach((entry, index) => {
    const best = ordered[startIndex] as Crossing;
    if (pointKey(entry.point.x, entry.point.y) < pointKey(best.point.x, best.point.y)) startIndex = index;
  });
  ordered = [...ordered.slice(startIndex), ...ordered.slice(0, startIndex)];
  const points = ordered.map(entry => entry.point);
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const a = points[index] as BoundaryPoint; const b = points[(index + 1) % points.length] as BoundaryPoint;
    area += a.x * b.y - b.x * a.y;
  }
  return {
    points,
    edgeMidpoints: points,
    edgeKeys: ordered.map(entry => entry.edgeKey),
    insideCells: ordered.map(entry => entry.inside),
    signedArea: area / 2,
    hash: hashNumbers(points.flatMap(point => [point.x, point.y])),
  };
}

/**
 * The same regions traced along the tile edges themselves: vertices are tile corners, so after Chaikin a rectangle
 * of cells keeps its shape with ~0.25-tile rounded corners (used for fields, which are laid out as rectangles).
 * Diagonal-only contact stays separated (at a saddle corner the trace turns to hug its own cell).
 */
export function cellOutlineLoops(mask: CellMask): CellContourLoop[] {
  const value = (tx: number, ty: number): boolean =>
    tx < 0 || ty < 0 || tx >= mask.width || ty >= mask.height ? mask.outside : mask.inside(tx, ty);
  type Directed = { readonly from: BoundaryPoint; readonly to: BoundaryPoint; readonly edgeKey: number;
    readonly inside: { readonly tx: number; readonly ty: number } };
  const stride = mask.width * 2 + 6;
  const cornerKey = (point: BoundaryPoint): number => (Math.round(point.y * 2) + 3) * stride + (Math.round(point.x * 2) + 3);
  const outgoing = new Map<number, Directed[]>();
  const add = (edge: Directed): void => { const key = cornerKey(edge.from); outgoing.set(key, [...(outgoing.get(key) ?? []), edge]); };
  for (let ty = -1; ty <= mask.height; ty += 1) for (let tx = -1; tx <= mask.width; tx += 1) {
    if (!value(tx, ty)) continue;
    // Inside on the left of travel (y down): walk each exposed side of the inside cell counter-clockwise on screen.
    const x0 = tx - 0.5; const x1 = tx + 0.5; const y0 = ty - 0.5; const y1 = ty + 0.5;
    const inside = { tx, ty };
    if (!value(tx, ty - 1)) add({ from: { x: x1, y: y0 }, to: { x: x0, y: y0 }, edgeKey: boundaryEdgeKey(mask.width, tx, ty, 0, -1), inside });
    if (!value(tx - 1, ty)) add({ from: { x: x0, y: y0 }, to: { x: x0, y: y1 }, edgeKey: boundaryEdgeKey(mask.width, tx, ty, -1, 0), inside });
    if (!value(tx, ty + 1)) add({ from: { x: x0, y: y1 }, to: { x: x1, y: y1 }, edgeKey: boundaryEdgeKey(mask.width, tx, ty, 0, 1), inside });
    if (!value(tx + 1, ty)) add({ from: { x: x1, y: y1 }, to: { x: x1, y: y0 }, edgeKey: boundaryEdgeKey(mask.width, tx, ty, 1, 0), inside });
  }
  const used = new Set<Directed>();
  const loops: CellContourLoop[] = [];
  const starts = [...outgoing.entries()].sort((a, b) => a[0] - b[0]);
  for (const [, edges] of starts) for (const first of edges) {
    if (used.has(first)) continue;
    const ring: Directed[] = [];
    let current: Directed | undefined = first;
    while (current !== undefined && !used.has(current)) {
      used.add(current); ring.push(current);
      const here: Directed = current;
      const candidates: Directed[] = (outgoing.get(cornerKey(here.to)) ?? []).filter(edge => !used.has(edge) || edge === first);
      // Saddle: prefer the edge of the same inside cell (a left turn around it).
      current = candidates.find(edge => edge.inside.tx === here.inside.tx && edge.inside.ty === here.inside.ty) ?? candidates[0];
      if (current === first) break;
    }
    let startIndex = 0;
    ring.forEach((edge, index) => { if (cornerKey(edge.from) < cornerKey((ring[startIndex] as Directed).from)) startIndex = index; });
    const ordered = [...ring.slice(startIndex), ...ring.slice(0, startIndex)];
    const points = ordered.map(edge => edge.from);
    let area = 0;
    for (let index = 0; index < points.length; index += 1) {
      const a = points[index] as BoundaryPoint; const b = points[(index + 1) % points.length] as BoundaryPoint;
      area += a.x * b.y - b.x * a.y;
    }
    loops.push({
      points,
      edgeMidpoints: ordered.map(edge => ({ x: (edge.from.x + edge.to.x) / 2, y: (edge.from.y + edge.to.y) / 2 })),
      edgeKeys: ordered.map(edge => edge.edgeKey),
      insideCells: ordered.map(edge => edge.inside),
      signedArea: area / 2,
      hash: hashNumbers(points.flatMap(point => [point.x, point.y])),
    });
  }
  return loops;
}
