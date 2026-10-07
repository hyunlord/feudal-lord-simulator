import type { GameState } from "../engine/engine.types";
import { buildingFootprint } from "../geometry/buildingFootprint";
import { constructionSiteFootprint } from "../economy/constructionSiteAccessors";
import { GUILDHALL_FOOTPRINT } from "./reorgWorldProps";
import type { RenderQueueItem } from "./objectRenderOrder";
import { walkerVisualAnchor } from "./walkerAnchor";
import { WALKER_HALF_WIDTH, wallItemEdges, type Box, type Foot, type WallEdge } from "./wallOcclusionEdges";

// NAT-1: walkers in the same depth order as the buildings, walls and sites around them (they were drawn after every
// object, so a walker on the lane behind a house stood on its roof). The queue's scalar depth (tx + ty; a building's
// is its front corner) puts a walker right except beside a wide object's side face, where it can say "behind" of a
// walker standing in front of that face. So each walker is placed by the box rule against the objects near it:
//  - a footprint [x0, x1) × [y0, y1) (tile-centre coordinates, a tile spanning ±0.5): the walker is in front when its
//    foot is past the far edge on either axis (x ≥ x1 or y ≥ y1), else behind. Where the two do not overlap on screen the
//    order does not show, and where they do the rule is exact;
//  - a construction site is ground being built on: a foot inside it is in front too (the hands at work);
//  - a wall item (NAT-4 QA-005, wallOcclusionEdges.ts): the stretch of wall it draws, its face line (the smoothed
//    baseline + half the wall's thickness toward the camera); the walker is in front when its foot is deeper than the
//    face at the foot's screen column, else behind — a foot within the wall's thickness stands against its foot, which
//    the face covers (the old test, "within 0.2 of the unit edge's line is in front", drew such walkers over the wall).
// A walker goes after every object it is in front of and before every object it is behind. When they cannot all hold
// (objects whose own order disagrees), the footprints win over the walls, and among footprints it goes after the last it
// is in front of. Walkers in a stone gate's passage
// or on a bridge keep the queue's own order (the gate's arch and the bridge's rails are drawn around them by depth).
type WalkerItem = Extract<RenderQueueItem, { readonly kind: "walker" }>;
/** NAT-2: an alehouse drinker's place (alehouseCrowd.ts), placed like a walker at its foot. */
type FigureItem = Extract<RenderQueueItem, { readonly kind: "ale_drinker" | "funeral" | "purveyor" }>;
/** The draw queue: the object items and the bridges' rails (drawObjectRenderItems). */
type Queued = RenderQueueItem | Readonly<{ kind: "bridge_rail"; depth: number; anchorTx: number; id: string }>;
type Blocker = { readonly index: number; readonly box: Box | null; readonly site?: boolean; readonly edge: WallEdge | null };
/** What the rule reads of the state: the sites, and the wall's baseline (wallItemEdges) when the state has one. */
type OcclusionState = Pick<GameState, "constructionSites"> & Partial<Pick<GameState, "palisade" | "tiles" | "width" | "height">>;

/** How far around a walker (tiles) an object can meet it on screen: the widest footprint and a tall roof's reach. */
const REACH = 6;
/** NAT-4 QA-005: a stone gate's passage, around its point (tile-centre coordinates, tiles): the four tiles at the gate. */
export const GATE_PASSAGE = 0.75;

/** Whether a walker at `position` is in the passage of one of the stone gates (`gates`: edge points, tile corners). */
export function inGatePassage(position: Foot, gates: readonly { readonly x: number; readonly y: number }[]): boolean {
  return gates.some(gate => Math.hypot(position.tx - (gate.x - 0.5), position.ty - (gate.y - 0.5)) < GATE_PASSAGE);
}

const screenX = (x: number, y: number) => x - y;
const overlapsOnScreen = (box: Box, foot: { tx: number; ty: number }) => {
  const sx = screenX(foot.tx, foot.ty);
  return sx + WALKER_HALF_WIDTH > screenX(box.x0, box.y1) && sx - WALKER_HALF_WIDTH < screenX(box.x1, box.y0);
};

/** Whether the walker's foot is in front of the footprint (box rule). */
export const inFrontOfBox = (foot: { tx: number; ty: number }, box: Box) => foot.tx >= box.x1 || foot.ty >= box.y1;

function blockersOf(queue: readonly Queued[], state: OcclusionState): Blocker[] {
  const blockers: Blocker[] = [];
  const sites = new Map(state.constructionSites.map(site => [site.id, site]));
  for (const [index, item] of queue.entries()) {
    if (item.kind === "building") {
      const size = buildingFootprint(item.building);
      blockers.push({ index, box: { x0: item.building.tx - 0.5, x1: item.building.tx + size.width - 0.5, y0: item.building.ty - 0.5, y1: item.building.ty + size.height - 0.5 }, edge: null });
    } else if (item.kind === "construction_site") {
      const site = sites.get(item.site.id) ?? item.site;
      const size = constructionSiteFootprint(site);
      blockers.push({ index, box: { x0: size.tx - 0.5, x1: size.tx + size.width - 0.5, y0: size.ty - 0.5, y1: size.ty + size.height - 0.5 }, edge: null, site: true });
    } else if (item.kind === "reorg_prop") {
      const prop = item.prop;
      blockers.push({ index, box: { x0: prop.tx - 0.5, x1: prop.tx + GUILDHALL_FOOTPRINT.width - 0.5, y0: prop.ty - 0.5, y1: prop.ty + GUILDHALL_FOOTPRINT.height - 0.5 }, edge: null });
    } else if (item.kind === "palisade_segment") {
      for (const edge of wallItemEdges(item, state)) blockers.push({ index, box: null, edge });
    }
  }
  return blockers;
}

/** A spatial bucket of the blockers by their tile, so a walker asks only the objects around it. */
function bucketed(blockers: readonly Blocker[]): Map<string, Blocker[]> {
  const buckets = new Map<string, Blocker[]>();
  const add = (tx: number, ty: number, blocker: Blocker) => {
    const key = `${tx >> 2}:${ty >> 2}`;
    const list = buckets.get(key); if (list === undefined) buckets.set(key, [blocker]); else list.push(blocker);
  };
  for (const blocker of blockers) {
    const box = blocker.box ?? blocker.edge!.span;
    const seen = new Set<string>();
    for (let tx = Math.floor(box.x0); tx <= Math.ceil(box.x1); tx += 4) for (let ty = Math.floor(box.y0); ty <= Math.ceil(box.y1); ty += 4) {
      const key = `${tx >> 2}:${ty >> 2}`; if (!seen.has(key)) { seen.add(key); add(tx, ty, blocker); }
    }
    const endKey = `${Math.ceil(box.x1) >> 2}:${Math.ceil(box.y1) >> 2}`;
    if (!seen.has(endKey)) add(Math.ceil(box.x1), Math.ceil(box.y1), blocker);
  }
  return buckets;
}

function nearBlockers(buckets: ReadonlyMap<string, readonly Blocker[]>, foot: { tx: number; ty: number }): Blocker[] {
  const near: Blocker[] = [];
  const seen = new Set<Blocker>();
  for (let tx = Math.floor(foot.tx) - REACH; tx <= Math.floor(foot.tx) + REACH; tx += 4) {
    for (let ty = Math.floor(foot.ty) - REACH; ty <= Math.floor(foot.ty) + REACH; ty += 4) {
      for (const blocker of buckets.get(`${tx >> 2}:${ty >> 2}`) ?? []) if (!seen.has(blocker)) { seen.add(blocker); near.push(blocker); }
    }
  }
  return near;
}

/** Where the walker must stand among the blockers: [after the last it fronts, before the first it is behind]. */
function bounds(foot: { tx: number; ty: number }, near: readonly Blocker[]): { lo: number; hi: number } {
  let lo = -1; let hi = Number.POSITIVE_INFINITY;
  for (const blocker of near) {
    const front = frontOf(foot, blocker);
    if (front === null) continue;
    if (front) lo = Math.max(lo, blocker.index); else hi = Math.min(hi, blocker.index);
  }
  return { lo, hi };
}

/** In front of the blocker (true), behind it (false), or not meeting it on screen (null). */
function frontOf(foot: { tx: number; ty: number }, blocker: Blocker): boolean | null {
  if (blocker.box === null) return blocker.edge!.front(foot);
  if (!overlapsOnScreen(blocker.box, foot)) return null;
  // A site is ground being built on: whoever works inside it stands on it, in front.
  return inFrontOfBox(foot, blocker.box) || (blocker.site === true && foot.tx >= blocker.box.x0 && foot.ty >= blocker.box.y0);
}

/**
 * The queue with every walker placed by the box rule (see the head of this file). `keepOrder(item)`: walkers that keep
 * the queue's own place (a stone gate's passage, inGatePassage; a bridge). The rest of the queue keeps its order. NAT-2: the alehouse
 * drinkers' places are placed the same way, at their foot.
 */
export function placeWalkers<T extends Queued>(queue: readonly T[], state: OcclusionState,
  keepOrder: (item: WalkerItem) => boolean): T[] {
  const base: T[] = [];
  const moving: { item: T & (WalkerItem | FigureItem); at: number; order: number }[] = [];
  for (const item of queue) {
    if ((item.kind === "walker" && !keepOrder(item as T & WalkerItem)) || item.kind === "ale_drinker" || item.kind === "funeral" || item.kind === "purveyor") moving.push({ item: item as T & (WalkerItem | FigureItem), at: base.length, order: moving.length });
    else base.push(item);
  }
  if (moving.length === 0) return base;
  const buckets = bucketed(blockersOf(base, state));
  for (const entry of moving) {
    // A drinker's place holds both ends of its short walk: where it stands and the door it comes out of.
    const feet = entry.item.kind === "walker" ? [walkerVisualAnchor(entry.item.walker.position)] : (entry.item.kind === "funeral" || entry.item.kind === "purveyor") ? [entry.item.foot] : [entry.item.stand.foot, entry.item.stand.door];
    const near = nearBlockers(buckets, feet[0]!);
    const both = (blockers: readonly Blocker[]) => feet.map(foot => bounds(foot, blockers))
      .reduce((a, b) => ({ lo: Math.max(a.lo, b.lo), hi: Math.min(a.hi, b.hi) }));
    // `at` is the count of base items before the walker; lo / hi are base indices (after lo: at ≥ lo + 1; before hi: at ≤ hi).
    // The footprints first (a walker on a roof is the fault that shows), then the walls within what they allow.
    const solid = both(near.filter(blocker => blocker.box !== null));
    const low = solid.lo + 1; const high = solid.lo + 1 <= solid.hi ? solid.hi : Number.POSITIVE_INFINITY;
    const walls = both(near.filter(blocker => blocker.box === null));
    let at = Math.min(Math.max(entry.at, low), high);
    at = Math.max(at, Math.min(walls.lo + 1, high));
    if (at > walls.hi && walls.hi >= low) at = walls.hi;
    entry.at = at;
  }
  moving.sort((a, b) => a.at - b.at || a.order - b.order);
  const out: T[] = [];
  let next = 0;
  for (const [index, item] of base.entries()) {
    while (next < moving.length && moving[next]!.at <= index) out.push(moving[next++]!.item);
    out.push(item);
  }
  while (next < moving.length) out.push(moving[next++]!.item);
  return out;
}

/** The pairs where the drawing order breaks the box rule: `onRoof` a walker drawn over an object it is behind (the
 * user's "사람이 지붕 위"), `hidden` one drawn under an object it stands in front of. The "0 walkers on roofs" check. */
export function occlusionFaults(queue: readonly Queued[], state: OcclusionState,
  keepOrder: (item: WalkerItem) => boolean = () => false): { onRoof: string[]; hidden: string[] } {
  const buckets = bucketed(blockersOf(queue, state));
  const onRoof: string[] = []; const hidden: string[] = [];
  for (const [index, item] of queue.entries()) {
    if (item.kind !== "walker" || keepOrder(item)) continue;
    const foot = walkerVisualAnchor(item.walker.position);
    for (const blocker of nearBlockers(buckets, foot)) {
      const { lo, hi } = bounds(foot, [blocker]);
      const target = queue[blocker.index]!;
      if (hi === blocker.index && index > blocker.index) onRoof.push(`${item.walker.id}>${target.id}`);
      if (lo === blocker.index && index < blocker.index) hidden.push(`${item.walker.id}<${target.id}`);
    }
  }
  return { onRoof, hidden };
}

/** Whether an object drawn after the walker at `index` stands in front of it (the walker is hidden, wholly or in part). */
export function walkerHiddenBehind(queue: readonly Queued[], index: number, state: OcclusionState): boolean {
  const item = queue[index];
  if (item === undefined || item.kind !== "walker") return false;
  const foot = walkerVisualAnchor(item.walker.position);
  return nearBlockers(bucketed(blockersOf(queue, state)), foot).some(blocker => blocker.index > index && bounds(foot, [blocker]).hi === blocker.index);
}

/**
 * NAT-2 (QA-005): the box rule's faults of a figure that is not a walker — the alehouse crowd, drawn with its house's
 * door props right after the queue's item `after` — standing at `foot` (tile units): `onRoof`, an object drawn before
 * it that it stands behind (the figure shows on that object); `hidden`, one drawn after it that it stands in front of.
 */
export function figureOrderFaults(queue: readonly Queued[], state: OcclusionState, foot: { tx: number; ty: number },
  after: number): { onRoof: string[]; hidden: string[] } {
  const onRoof: string[] = []; const hidden: string[] = [];
  for (const blocker of nearBlockers(bucketed(blockersOf(queue, state)), foot)) {
    const { lo, hi } = bounds(foot, [blocker]);
    const id = queue[blocker.index]!.id;
    if (hi === blocker.index && blocker.index <= after) onRoof.push(id);
    if (lo === blocker.index && blocker.index > after) hidden.push(id);
  }
  return { onRoof, hidden };
}
