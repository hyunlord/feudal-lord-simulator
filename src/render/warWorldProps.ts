import type { GameState } from "../engine/engine.types";
import { beaconLit, raidEventId, warCoastal } from "../engine/war";
import { buildingFootprint } from "../geometry/buildingFootprint";
import { zonesOf } from "../zones/zoneEdits";
import { renderDetailLevel } from "./buildingVisualState";
import { depthKey, tileToScreen } from "./iso";
import { manifestArt } from "./manifestArt";
import { WAVE17_WORLD_IMAGES } from "./wave17WorldManifest.generated";

// UI-6 chapter 2's war in the world (spec docs/design/chapter-two-war.md WR-5; Wave 17 world sprites,
// scripts/installWave17World.py). Presentation only: nothing here is saved, the same state gives the same props.
//  - The beacon: a coastal town at war (`state.war`, `warCoastal`) keeps a beacon on one shore tile, unlit, and lit
//    while `beaconLit` (the season before the raid). The spot (`beaconSpot`): of the land tiles (grass) beside water
//    that hold no building, road or wall, the one nearest the town's middle (the wall ring's mean point; no ring: the
//    built tiles'), the sea's shore (water joined to the map edge) before a pond's, open ground before zoned ground,
//    ties by ty then tx. It moves only when that tile is built on or
//    the ring is expanded.
//  - The raid (`state.war.raid`), for RAID_AFTERMATH_TICKS from its tick: the burning quay on the shore tile nearest the
//    beacon at least QUAY_BEACON_GAP tiles from it, with no building on the tiles behind it the flames reach (the beacon,
//    not the burnt houses, is its reference: the houses are rebuilt within the window and the quay would jump); a smoke
//    column (four frames, SMOKE_FRAME_MS each, by presentation time) over each house the raid burnt while it stays burnt. The burnt house itself is the Wave 9 burnt
//    painting like any fire's (buildingOverlays.ts, `burntTick`).
// UI-6b: the burning quay lies on the Wave 12 quay (its cell and ground pivot), drawn just before it on the same tile.
// All three join the object queue (drawObjectRenderItems): beacon and quay sorted by their tile like farm props and drawn
// at every zoom; each smoke column right after its house, above block detail (zoom > 0.35) so it reads at 0.6.
export type WarPropKind = "beacon_idle" | "beacon_lit" | "quay" | "raid_burning_quay" | "raid_smoke_column_sheet";
/** `tx`, `ty`: the tile it sorts and culls by; `x`, `y`: its foot (tile units); `depth`: its place in the object queue. */
export type WarProp = { readonly kind: WarPropKind; readonly tx: number; readonly ty: number; readonly x: number; readonly y: number;
  readonly depth: number; readonly id: string };
type Spot = { readonly tx: number; readonly ty: number };

const SEASON_TICKS = 1_000;
/** How long the raid's fires and smoke stay in the world after it (two seasons). */
export const RAID_AFTERMATH_TICKS = 2 * SEASON_TICKS;
const QUAY_BEACON_GAP = 3;
/** The quay's flames stand on the tiles up to three behind its anchor (−ty), source (90,72)…(218,26) from pivot (68,119). */
const QUAY_REACH = 3;
const SMOKE_FRAME_MS = 180;
/** A smoke column sorts right after its row (its house's front tile), before the trees and props just in front of it. */
const SMOKE_DEPTH_AFTER_HOUSE = 0.001;
/** The quay sorts just before its fire on the same tile. */
const QUAY_DEPTH_BEFORE_FIRE = 0.0005;

const wave17World = manifestArt<keyof typeof WAVE17_WORLD_IMAGES>(WAVE17_WORLD_IMAGES);
export const preloadWave17WorldArt = wave17World.preload;

type ShoreScan = { readonly candidates: readonly (Spot & { readonly zoned: boolean; readonly inland: boolean })[]; readonly built: ReadonlySet<number>; readonly centre: Spot };

// Cache (AGENTS rule 10): the shore scan, keyed on the tiles array, the wall ring's polygon and the zones array (each is
// replaced when it changes; buildings, roads and construction sites mark the tiles, so a new one replaces the tiles).
// Nothing else is read. Measured in Node on the 64² campaign map (tests/warWorldProps.test.ts prints it; also the seed 2
// chapter 2 bot town at 1339): the full scan 0.3–2.6 ms, a cached call about 0.01 ms; without it the object pass would
// rescan every frame.
const shoreCache = new WeakMap<object, { readonly polygon: unknown; readonly zones: unknown; readonly scan: ShoreScan }>();

function shoreScan(state: Pick<GameState, "tiles" | "width" | "height" | "palisade" | "zones">): ShoreScan {
  const polygon = state.palisade?.polygon ?? null;
  const zones = zonesOf(state);
  const cached = shoreCache.get(state.tiles);
  if (cached !== undefined && cached.polygon === polygon && cached.zones === zones) return cached.scan;
  const { width, height, tiles } = state;
  // The ring's edge points, every unit step between its vertices.
  const wall = new Set<number>();
  const ring: { x: number; y: number }[] = [];
  const vertices = polygon ?? [];
  for (let index = 0; index < vertices.length; index += 1) {
    const from = vertices[index]!; const to = vertices[index + 1] ?? from;
    const steps = Math.max(1, Math.abs(to.x - from.x), Math.abs(to.y - from.y));
    for (let step = 0; step < steps; step += 1) {
      const point = { x: Math.round(from.x + (to.x - from.x) * step / steps), y: Math.round(from.y + (to.y - from.y) * step / steps) };
      ring.push(point); wall.add(point.y * width + point.x);
    }
  }
  const zoned = new Set<number>();
  for (const zone of zones) for (const cell of zone.membership) zoned.add(cell);
  const water = (tx: number, ty: number) => tx >= 0 && ty >= 0 && tx < width && ty < height && tiles[ty * width + tx]?.terrain === "water";
  // The sea: water joined to the map's edge (flood fill); a pond inside the town is not where the raiders come from.
  const sea = new Uint8Array(width * height);
  const queue: number[] = [];
  for (const tile of tiles) {
    if (tile.terrain === "water" && (tile.tx === 0 || tile.ty === 0 || tile.tx === width - 1 || tile.ty === height - 1)) { sea[tile.ty * width + tile.tx] = 1; queue.push(tile.ty * width + tile.tx); }
  }
  for (let head = 0; head < queue.length; head += 1) {
    const index = queue[head]!; const tx = index % width; const ty = (index - tx) / width;
    for (const [nx, ny] of [[tx - 1, ty], [tx + 1, ty], [tx, ty - 1], [tx, ty + 1]] as const) {
      if (water(nx, ny) && sea[ny * width + nx] === 0) { sea[ny * width + nx] = 1; queue.push(ny * width + nx); }
    }
  }
  const seaAt = (tx: number, ty: number) => water(tx, ty) && sea[ty * width + tx] === 1;
  const nearWall = (tx: number, ty: number) => {
    for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) if (wall.has((ty + dy) * width + tx + dx)) return true;
    return false;
  };
  const built = new Set<number>();
  let sumX = 0, sumY = 0;
  for (const tile of tiles) if (tile.buildingId !== null) { built.add(tile.ty * width + tile.tx); sumX += tile.tx; sumY += tile.ty; }
  // The town's middle: the wall ring's (it moves only when the ring is expanded), else the built tiles' mean.
  const centre = ring.length > 0 ? { tx: ring.reduce((sum, point) => sum + point.x, 0) / ring.length, ty: ring.reduce((sum, point) => sum + point.y, 0) / ring.length }
    : built.size === 0 ? { tx: Math.floor(width / 2), ty: Math.floor(height / 2) } : { tx: sumX / built.size, ty: sumY / built.size };
  const candidates: (Spot & { zoned: boolean; inland: boolean })[] = [];
  for (const tile of tiles) {
    if (tile.terrain !== "grass" || tile.buildingId !== null || tile.hasRoad) continue;
    const { tx, ty } = tile;
    if (!water(tx - 1, ty) && !water(tx + 1, ty) && !water(tx, ty - 1) && !water(tx, ty + 1)) continue;
    if (nearWall(tx, ty)) continue;
    const inland = !seaAt(tx - 1, ty) && !seaAt(tx + 1, ty) && !seaAt(tx, ty - 1) && !seaAt(tx, ty + 1);
    candidates.push({ tx, ty, zoned: zoned.has(ty * width + tx), inland });
  }
  const scan = { candidates, built, centre };
  shoreCache.set(state.tiles, { polygon, zones, scan });
  return scan;
}

function nearest(candidates: ShoreScan["candidates"], to: { readonly tx: number; readonly ty: number }, keep: (spot: Spot) => boolean): Spot | null {
  let best: ShoreScan["candidates"][number] | null = null;
  let bestDistance = Infinity;
  for (const spot of candidates) {
    if (!keep(spot)) continue;
    const distance = (spot.tx - to.tx) ** 2 + (spot.ty - to.ty) ** 2;
    const better = best === null || (spot.inland !== best.inland ? !spot.inland : spot.zoned !== best.zoned ? !spot.zoned
      : distance !== bestDistance ? distance < bestDistance : spot.ty !== best.ty ? spot.ty < best.ty : spot.tx < best.tx);
    if (better) { best = spot; bestDistance = distance; }
  }
  return best === null ? null : { tx: best.tx, ty: best.ty };
}

/** The coastal town's beacon tile (null: no war, inland, or no free shore). */
export function beaconSpot(state: GameState): Spot | null {
  if (state.war === undefined || !warCoastal(state)) return null;
  const scan = shoreScan(state);
  return nearest(scan.candidates, scan.centre, () => true);
}

/** The raid's aftermath is in the world (from the raid's tick for RAID_AFTERMATH_TICKS). */
export function raidAftermathVisible(state: Pick<GameState, "war" | "tick">): boolean {
  const raid = state.war?.raid;
  return raid !== undefined && state.tick >= raid.tick && state.tick < raid.tick + RAID_AFTERMATH_TICKS;
}

/** The houses the raid burnt that are still burnt (their building ids), while its aftermath shows. */
export function raidBurntHouseIds(state: Pick<GameState, "war" | "tick" | "houses">): readonly string[] {
  const raid = state.war?.raid;
  if (raid === undefined || !raidAftermathVisible(state)) return [];
  const eventId = raidEventId(raid.tick);
  return state.houses.filter(house => house.burntTick !== undefined && house.burntByEventId === eventId).map(house => house.buildingId);
}

/** The burning quay's tile while the raid's aftermath shows (null otherwise). */
export function raidQuaySpot(state: GameState): Spot | null {
  if (!raidAftermathVisible(state)) return null;
  const beacon = beaconSpot(state);
  if (beacon === null) return null;
  const scan = shoreScan(state);
  const clearBehind = (spot: Spot) => {
    for (let step = 1; step <= QUAY_REACH; step += 1) if (scan.built.has((spot.ty - step) * state.width + spot.tx)) return false;
    return true;
  };
  return nearest(scan.candidates, beacon, spot => Math.max(Math.abs(spot.tx - beacon.tx), Math.abs(spot.ty - beacon.ty)) >= QUAY_BEACON_GAP && clearBehind(spot));
}

// Cache: the last prop list, keyed on the state; a new state with the same props gets the same array back (the queue
// merge in renderObjectFrameCache is keyed on its identity). The shore scan under it is cached above.
let lastProps: { readonly state: GameState; readonly props: readonly WarProp[] } | null = null;

/** The war's world props now: the beacon (idle or lit) and, after a raid, the burning quay and the ruins' smoke. */
export function warProps(state: GameState): readonly WarProp[] {
  if (lastProps?.state === state) return lastProps.props;
  const props: WarProp[] = [];
  const beacon = beaconSpot(state);
  if (beacon !== null) {
    props.push({ kind: beaconLit(state) ? "beacon_lit" : "beacon_idle", ...beacon, x: beacon.tx, y: beacon.ty, depth: depthKey(beacon.tx, beacon.ty), id: "war:beacon" });
    const quay = raidQuaySpot(state);
    if (quay !== null) {
      props.push({ kind: "quay", ...quay, x: quay.tx, y: quay.ty, depth: depthKey(quay.tx, quay.ty) - QUAY_DEPTH_BEFORE_FIRE, id: "war:quay-stone" });
      props.push({ kind: "raid_burning_quay", ...quay, x: quay.tx, y: quay.ty, depth: depthKey(quay.tx, quay.ty), id: "war:quay" });
    }
  }
  const burnt = new Set(raidBurntHouseIds(state));
  for (const building of state.buildings) {
    if (!burnt.has(building.id)) continue;
    // Sorted just after its house (the house's front tile, as objectRenderOrder sorts a building), rising from its middle.
    const size = buildingFootprint(building);
    const front = { tx: building.tx + size.width - 1, ty: building.ty + size.height - 1 };
    props.push({ kind: "raid_smoke_column_sheet", ...front, x: building.tx + (size.width - 1) / 2, y: building.ty + (size.height - 1) / 2,
      depth: depthKey(front.tx, front.ty) + SMOKE_DEPTH_AFTER_HOUSE, id: `war:smoke:${building.id}` });
  }
  const previous = lastProps?.props;
  const same = previous !== undefined && previous.length === props.length
    && props.every((prop, index) => prop.id === previous[index]!.id && prop.kind === previous[index]!.kind && prop.x === previous[index]!.x && prop.y === previous[index]!.y);
  lastProps = { state, props: same ? previous : props };
  return lastProps.props;
}

/**
 * Draws a war prop with its ground pivot on its foot (Astra's zoom 1 scale); in the normal view only. The smoke is
 * left out at block detail (zoom <= 0.35) and runs its four frames by presentation time, each column from its own frame.
 */
export function drawWarProp(context: CanvasRenderingContext2D, prop: WarProp, zoom: number, nowMs: number): boolean {
  const foot = tileToScreen(prop.x, prop.y);
  if (prop.kind !== "raid_smoke_column_sheet") return wave17World.draw(context, prop.kind, foot.sx, foot.sy, WAVE17_WORLD_IMAGES[prop.kind].zoom1Scale);
  if (renderDetailLevel(zoom) === "blocks") return false;
  const phase = (prop.tx * 7 + prop.ty * 3) % 4;
  return wave17World.draw(context, prop.kind, foot.sx, foot.sy, WAVE17_WORLD_IMAGES[prop.kind].zoom1Scale, Math.floor(nowMs / SMOKE_FRAME_MS) + phase);
}
