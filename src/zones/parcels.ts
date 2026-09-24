/**
 * Frontage parcels (spec Z-12, Z-13; v3-A F-frontage rule F1 and probe P5). Derived from a burgage zone,
 * the road cells and the buildings; never saved. Pure: the same inputs give the same parcels.
 *
 * 1. Road chains: road cells whose 4-neighbour degree is not 2 are nodes; the cells between two nodes
 *    form a chain, oriented from its smaller end (tx, then ty) and walked in chain order.
 * 2. Strips (F1): for each chain road cell, each 4-neighbour (N, E, S, W) that the zone owns, that is not a
 *    road or a non-house building and that no strip has claimed yet is a frontage cell. Its strip runs
 *    from the frontage cell along the normal of the smoothed chain centreline (moving average 5, Chaikin
 *    ×2, ends pinned), sampled every 0.25 tile up to 3.2 tiles, and stops at the first cell it may not take.
 * 3. Plots: per chain side, touching strips form runs. A run is cut into plots of 2–4 strips; a cut falls
 *    before a strip whose frontage key (tx + 2·ty) mod 5 is 0 or 2 once the plot has 2 strips, and always
 *    at 4. The key depends on the cell alone, so an edit upstream re-synchronises within a plot or two.
 *    A last plot of 1 strip joins its neighbour (or takes one strip from a plot of 4); a run of 1 strip
 *    joins a touching plot as back land, or stays unplotted.
 * 4. Houses are fixed input: a house footprint inside the zone is moved whole into the plot that holds its
 *    first cell; a house no plot reaches gets a plot of its own footprint.
 */
import { BUILDING_CONFIG_BY_KIND, type BuildingKind } from "../content/buildingConfig";
import { PARCEL_RULES } from "../content/zoneConfig";
import { isBuildingConstructionSite, type ConstructionSite } from "../economy/construction";
import type { TileCoordinate } from "../geometry/tileGeometry";
import type { Tile } from "../world/world.types";
import type { Parcel, Zone } from "./zone.types";

export interface ParcelWorld {
  readonly width: number;
  readonly height: number;
  readonly tiles: readonly Pick<Tile, "hasRoad">[];
  readonly buildings: readonly { readonly id: string; readonly kind: BuildingKind; readonly tx: number; readonly ty: number }[];
  readonly constructionSites: readonly ConstructionSite[];
}

type Point = { readonly x: number; readonly y: number };

const NEIGHBOURS = [[0, -1], [1, 0], [0, 1], [-1, 0]] as const;

function compareCells(left: TileCoordinate, right: TileCoordinate): number {
  return left.tx - right.tx || left.ty - right.ty;
}

/**
 * Road chains, routed straight through junctions: at a cell with three or four road neighbours the two
 * arms that point most nearly opposite (measured four cells out, longer arms winning near-ties) continue
 * each other, so adding a branch
 * never splits the road it leaves. A chain ends at a dead end or at an arm left unpaired (the branch).
 * Each chain runs from its smaller end (tx, then ty); chains are ordered by their first two cells.
 */
export function roadChains(world: Pick<ParcelWorld, "width" | "height" | "tiles">): readonly (readonly TileCoordinate[])[] {
  const { width, height } = world;
  const isRoad = (tx: number, ty: number) => tx >= 0 && ty >= 0 && tx < width && ty < height && world.tiles[ty * width + tx]?.hasRoad === true;
  const key = (cell: TileCoordinate) => cell.ty * width + cell.tx;
  const neighbours = (cell: TileCoordinate) => NEIGHBOURS
    .map(([dx, dy]) => ({ tx: cell.tx + dx, ty: cell.ty + dy }))
    .filter(next => isRoad(next.tx, next.ty));
  const roads: TileCoordinate[] = [];
  for (let tx = 0; tx < width; tx += 1) for (let ty = 0; ty < height; ty += 1) if (isRoad(tx, ty)) roads.push({ tx, ty });
  const same = (a: TileCoordinate, b: TileCoordinate) => a.tx === b.tx && a.ty === b.ty;
  // Direction four cells out along an arm, and the arm's length up to 8 cells (to a junction or dead end).
  const arm = (node: TileCoordinate, first: TileCoordinate): { readonly vector: Point; readonly length: number } => {
    let previous = node;
    let current = first;
    let vector: Point | null = null;
    let length = 1;
    for (; length < 8; length += 1) {
      if (length === 4) vector = { x: current.tx - node.tx, y: current.ty - node.ty };
      const around = neighbours(current);
      if (around.length !== 2) break;
      const next = around.find(candidate => !same(candidate, previous))!;
      previous = current;
      current = next;
    }
    return { vector: vector ?? { x: current.tx - node.tx, y: current.ty - node.ty }, length };
  };
  const cosine = (a: Point, b: Point) => (a.x * b.x + a.y * b.y) / Math.sqrt((a.x * a.x + a.y * a.y) * (b.x * b.x + b.y * b.y));
  // partner.get(node)[i] = index of the arm that continues arm i, or -1.
  const partner = new Map<number, readonly number[]>();
  for (const cell of roads) {
    const around = neighbours(cell);
    if (around.length < 3) continue;
    const arms = around.map(next => arm(cell, next));
    const pairs: (readonly [number, number])[][] = around.length === 3
      ? [[[0, 1]], [[0, 2]], [[1, 2]]]
      : [[[0, 1], [2, 3]], [[0, 2], [1, 3]], [[0, 3], [1, 2]]];
    let best = pairs[0]!;
    let bestScore = Infinity;
    for (const pairing of pairs) {
      // Straightest continuation, weighted toward long arms: a short new branch must not capture the road
      // it leaves at a bend (measured: 0.05 per cell still let it at the probe S-curve crest).
      const score = pairing.reduce((sum, [a, b]) => sum + cosine(arms[a]!.vector, arms[b]!.vector)
        - 0.1 * (arms[a]!.length + arms[b]!.length), 0);
      if (score < bestScore - 1e-9) {
        bestScore = score;
        best = pairing;
      }
    }
    const links = around.map(() => -1);
    for (const [a, b] of best) {
      links[a] = b;
      links[b] = a;
    }
    partner.set(key(cell), links);
  }
  const continuation = (cell: TileCoordinate, from: TileCoordinate): TileCoordinate | null => {
    const around = neighbours(cell);
    if (around.length === 2) return around.find(candidate => !same(candidate, from)) ?? null;
    if (around.length < 2) return null;
    const incoming = around.findIndex(candidate => same(candidate, from));
    const out = partner.get(key(cell))?.[incoming] ?? -1;
    return out < 0 ? null : around[out]!;
  };
  const edge = (a: TileCoordinate, b: TileCoordinate) => Math.min(key(a), key(b)) * width * height + Math.max(key(a), key(b));
  const used = new Set<number>();
  const chains: TileCoordinate[][] = [];
  const walk = (start: TileCoordinate, first: TileCoordinate): TileCoordinate[] => {
    const chain = [start];
    let previous = start;
    let current: TileCoordinate | null = first;
    used.add(edge(previous, current));
    while (current !== null) {
      chain.push(current);
      const next: TileCoordinate | null = continuation(current, previous);
      if (next === null || used.has(edge(current, next))) break;
      used.add(edge(current, next));
      previous = current;
      current = next;
    }
    return chain;
  };
  for (const cell of roads) {
    const around = neighbours(cell);
    if (around.length === 0) chains.push([cell]);
    if (around.length === 1 && !used.has(edge(cell, around[0]!))) chains.push(walk(cell, around[0]!));
    if (around.length >= 3) {
      const links = partner.get(key(cell))!;
      around.forEach((next, index) => {
        if (links[index] === -1 && !used.has(edge(cell, next))) chains.push(walk(cell, next));
      });
    }
  }
  for (const cell of roads) {
    for (const next of [...neighbours(cell)].sort(compareCells)) if (!used.has(edge(cell, next))) chains.push(walk(cell, next));
  }
  const oriented = chains.map(chain => (compareCells(chain.at(-1)!, chain[0]!) < 0 ? [...chain].reverse() : chain));
  return oriented.sort((left, right) => compareCells(left[0]!, right[0]!) || compareCells(left[1] ?? left[0]!, right[1] ?? right[0]!));
}

function movingAverage(line: readonly Point[], window: number): Point[] {
  const half = Math.floor(window / 2);
  return line.map((_, index) => {
    let sx = 0;
    let sy = 0;
    let n = 0;
    for (let j = Math.max(0, index - half); j <= Math.min(line.length - 1, index + half); j += 1) {
      sx += line[j]!.x;
      sy += line[j]!.y;
      n += 1;
    }
    return { x: sx / n, y: sy / n };
  });
}

function chaikin(line: readonly Point[], rounds: number): Point[] {
  let current = [...line];
  for (let round = 0; round < rounds; round += 1) {
    const next: Point[] = [current[0]!];
    for (let index = 0; index < current.length - 1; index += 1) {
      const a = current[index]!;
      const b = current[index + 1]!;
      next.push({ x: 0.75 * a.x + 0.25 * b.x, y: 0.75 * a.y + 0.25 * b.y }, { x: 0.25 * a.x + 0.75 * b.x, y: 0.25 * a.y + 0.75 * b.y });
    }
    next.push(current.at(-1)!);
    current = next;
  }
  return current;
}

/** Smoothed centreline of a chain in cell-centre space (cell (tx,ty) at (tx,ty)). */
export function chainCentreline(chain: readonly TileCoordinate[]): readonly Point[] {
  return chaikin(movingAverage(chain.map(cell => ({ x: cell.tx, y: cell.ty })), 5), 2);
}

interface Strip {
  readonly front: TileCoordinate;
  readonly cells: TileCoordinate[];
  readonly side: 1 | -1;
  readonly chain: number;
  /** Coordinate along the road at the frontage cell: tx where the road runs more east–west, else ty. */
  readonly along: number;
}

/** Strips of step 2 (F1). Exposed for the probe reproduction test. */
export function frontageStrips(zone: Pick<Zone, "membership">, world: ParcelWorld): readonly Strip[] {
  const { width } = world;
  const members = new Set(zone.membership);
  const blocked = new Set<number>();
  for (const building of world.buildings) if (building.kind !== "house") markFootprint(blocked, width, building.kind, building.tx, building.ty);
  for (const site of world.constructionSites) {
    if (isBuildingConstructionSite(site) && site.kind !== "house") markFootprint(blocked, width, site.kind, site.tx, site.ty);
  }
  const claimable = (tx: number, ty: number) => {
    if (tx < 0 || ty < 0 || tx >= width || ty >= world.height) return false;
    const index = ty * width + tx;
    return members.has(index) && world.tiles[index]?.hasRoad !== true && !blocked.has(index);
  };
  const claimed = new Map<number, number>();
  const strips: Strip[] = [];
  roadChains(world).forEach((chain, chainIndex) => {
    const line = chainCentreline(chain);
    for (const road of chain) {
      for (const [dx, dy] of NEIGHBOURS) {
        const front = { tx: road.tx + dx, ty: road.ty + dy };
        if (!claimable(front.tx, front.ty) || claimed.has(front.ty * width + front.tx)) continue;
        let nearest = 0;
        let best = Infinity;
        for (let index = 0; index < line.length; index += 1) {
          const ex = line[index]!.x - front.tx;
          const ey = line[index]!.y - front.ty;
          const distance = ex * ex + ey * ey;
          if (distance < best) {
            best = distance;
            nearest = index;
          }
        }
        const a = line[Math.max(0, nearest - 1)]!;
        const b = line[Math.min(line.length - 1, nearest + 1)]!;
        const anchor = line[nearest]!;
        const tangentLength = Math.sqrt((b.x - a.x) * (b.x - a.x) + (b.y - a.y) * (b.y - a.y));
        let normal: Point;
        let side: 1 | -1 = 1;
        if (tangentLength === 0) normal = { x: dx, y: dy };
        else {
          normal = { x: -(b.y - a.y) / tangentLength, y: (b.x - a.x) / tangentLength };
          if ((front.tx - anchor.x) * normal.x + (front.ty - anchor.y) * normal.y < 0) {
            normal = { x: -normal.x, y: -normal.y };
            side = -1;
          }
        }
        const id = strips.length;
        const cells: TileCoordinate[] = [];
        for (let s = 0; s <= PARCEL_RULES.depthTiles; s += PARCEL_RULES.depthStep) {
          const cell = { tx: Math.round(front.tx + normal.x * s), ty: Math.round(front.ty + normal.y * s) };
          if (!claimable(cell.tx, cell.ty)) break;
          const index = cell.ty * width + cell.tx;
          const owner = claimed.get(index);
          if (owner !== undefined) {
            if (owner !== id) break;
            continue;
          }
          claimed.set(index, id);
          cells.push(cell);
        }
        const along = Math.abs(normal.y) >= Math.abs(normal.x) ? front.tx : front.ty;
        if (cells.length > 0) strips.push({ front, cells, side, chain: chainIndex, along });
      }
    }
  });
  return strips;
}

function markFootprint(into: Set<number>, width: number, kind: BuildingKind, tx: number, ty: number): void {
  const definition = BUILDING_CONFIG_BY_KIND[kind];
  for (let dy = 0; dy < definition.height; dy += 1) {
    for (let dx = 0; dx < definition.width; dx += 1) into.add((ty + dy) * width + tx + dx);
  }
}

function stripsTouch(left: Strip, right: Strip): boolean {
  return left.cells.some(a => right.cells.some(b => Math.abs(a.tx - b.tx) + Math.abs(a.ty - b.ty) === 1));
}

/** A plot starts at a strip whose along-road coordinate is a multiple of 3 (cell-local, so edits stay local). */
const startsPlot = (strip: Strip) => ((strip.along % 3) + 3) % 3 === 0;

function chunkRun(run: readonly Strip[]): Strip[][] {
  const segments: Strip[][] = [];
  for (const strip of run) {
    if (segments.length === 0 || startsPlot(strip)) segments.push([]);
    segments.at(-1)!.push(strip);
  }
  // Long segments (a road bend) split into near-equal plots of at most maxWidth.
  const sized = segments.flatMap(segment => {
    if (segment.length <= PARCEL_RULES.maxWidth) return [segment];
    const parts = Math.ceil(segment.length / 3);
    const out: Strip[][] = [];
    for (let part = 0, at = 0; part < parts; part += 1) {
      const size = Math.floor((segment.length - at) / (parts - part));
      out.push(segment.slice(at, at + size));
      at += size;
    }
    return out;
  });
  // A 1-strip plot joins a neighbour with room (previous first), else takes a strip from the previous one.
  for (let index = 0; index < sized.length; index += 1) {
    const segment = sized[index]!;
    if (segment.length >= PARCEL_RULES.minWidth || sized.length === 1) continue;
    const previous = sized[index - 1];
    const next = sized[index + 1];
    if (previous !== undefined && previous.length < PARCEL_RULES.maxWidth) {
      previous.push(...segment);
      sized.splice(index, 1);
      index -= 1;
    } else if (next !== undefined && next.length < PARCEL_RULES.maxWidth) {
      next.unshift(...segment);
      sized.splice(index, 1);
      index -= 1;
    } else if (previous !== undefined) {
      segment.unshift(previous.pop()!);
    }
  }
  return sized;
}

interface Draft {
  readonly strips: Strip[];
  readonly extra: TileCoordinate[];
}

/** Z-12/Z-13: frontage parcels of one burgage zone. Other zone kinds have none. */
export function deriveParcels(zone: Zone, world: ParcelWorld): readonly Parcel[] {
  if (zone.kind !== "burgage") return [];
  const { width } = world;
  const strips = frontageStrips(zone, world);
  const drafts: Draft[] = [];
  const remnants: Strip[] = [];
  const chains = [...new Set(strips.map(strip => strip.chain))];
  for (const chain of chains) {
    for (const side of [1, -1] as const) {
      const sequence = strips.filter(strip => strip.chain === chain && strip.side === side);
      let run: Strip[] = [];
      const flush = () => {
        if (run.length === 1) remnants.push(run[0]!);
        else if (run.length > 1) for (const chunk of chunkRun(run)) drafts.push({ strips: chunk, extra: [] });
        run = [];
      };
      for (const strip of sequence) {
        if (run.length > 0 && !stripsTouch(run.at(-1)!, strip)) flush();
        run.push(strip);
      }
      flush();
    }
  }
  for (const remnant of remnants) {
    const host = drafts.find(draft => draft.strips.some(strip => stripsTouch(strip, remnant)));
    if (host !== undefined) host.extra.push(...remnant.cells);
  }
  // Z-13: house footprints are fixed input and stay whole inside one plot.
  const owner = new Map<number, number>();
  drafts.forEach((draft, index) => {
    for (const strip of draft.strips) for (const cell of strip.cells) owner.set(cell.ty * width + cell.tx, index);
    for (const cell of draft.extra) owner.set(cell.ty * width + cell.tx, index);
  });
  const members = new Set(zone.membership);
  const houses = [
    ...world.buildings.filter(building => building.kind === "house").map(building => ({ id: building.id, kind: building.kind, tx: building.tx, ty: building.ty })),
    ...world.constructionSites.filter(isBuildingConstructionSite).filter(site => site.kind === "house").map(site => ({ id: site.id, kind: site.kind, tx: site.tx, ty: site.ty })),
  ];
  const buildingsByDraft = new Map<number, string[]>();
  const fixedPlots: Parcel[] = [];
  for (const house of houses) {
    const footprint: number[] = [];
    markFootprintList(footprint, width, house.kind, house.tx, house.ty);
    const inside = footprint.filter(cell => members.has(cell));
    if (inside.length === 0) continue;
    const hostIndex = inside.map(cell => owner.get(cell)).find(index => index !== undefined);
    if (hostIndex === undefined) {
      const cells = inside.map(cell => ({ tx: cell % width, ty: Math.floor(cell / width) }));
      const frontage = cells.filter(cell => NEIGHBOURS.some(([dx, dy]) => world.tiles[(cell.ty + dy) * width + cell.tx + dx]?.hasRoad === true
        && cell.tx + dx >= 0 && cell.tx + dx < width));
      const anchor = { tx: house.tx, ty: house.ty };
      fixedPlots.push({ id: `${zone.id}:${anchor.tx},${anchor.ty}`, zoneId: zone.id, cells, frontageCells: frontage, anchor,
        width: BUILDING_CONFIG_BY_KIND[house.kind].width, depth: BUILDING_CONFIG_BY_KIND[house.kind].height, buildingIds: [house.id] });
      for (const cell of inside) owner.set(cell, -1);
      continue;
    }
    for (const cell of inside) owner.set(cell, hostIndex);
    buildingsByDraft.set(hostIndex, [...(buildingsByDraft.get(hostIndex) ?? []), house.id]);
  }
  const parcels: Parcel[] = [];
  drafts.forEach((draft, index) => {
    const frontage = draft.strips.map(strip => strip.front).filter(cell => owner.get(cell.ty * width + cell.tx) === index);
    if (frontage.length === 0) return;
    const cells = [...owner.entries()].filter(([, at]) => at === index).map(([cell]) => cell).sort((left, right) => left - right)
      .map(cell => ({ tx: cell % width, ty: Math.floor(cell / width) }));
    const anchor = frontage[0]!;
    parcels.push({
      id: `${zone.id}:${anchor.tx},${anchor.ty}`,
      zoneId: zone.id,
      cells,
      frontageCells: frontage,
      anchor,
      width: frontage.length,
      depth: Math.max(...draft.strips.map(strip => strip.cells.length)),
      buildingIds: buildingsByDraft.get(index) ?? [],
    });
  });
  return [...parcels, ...fixedPlots];
}

function markFootprintList(into: number[], width: number, kind: BuildingKind, tx: number, ty: number): void {
  const definition = BUILDING_CONFIG_BY_KIND[kind];
  for (let dy = 0; dy < definition.height; dy += 1) {
    for (let dx = 0; dx < definition.width; dx += 1) into.push((ty + dy) * width + tx + dx);
  }
}
