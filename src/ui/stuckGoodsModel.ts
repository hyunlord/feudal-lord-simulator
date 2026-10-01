import { BARN_BACKLOG_STOCK } from "../agents/deliveryBuildingCandidates";
import { BUILDING_CONFIG_BY_KIND, operationSuspended, type Building, type BuildingKind } from "../content/buildingConfig";
import { STORAGE_KIND_BY_RESOURCE, type StorableResourceType } from "../content/resourceConfig";
import type { GameState } from "../engine/engine.types";
import { buildingRoadAccessTiles } from "../engine/routing";
import { availableSpace, storageIntakeSpace } from "../economy/storage";
import { buildingFootprint } from "../geometry/buildingFootprint";
import type { InputIntent } from "../input/inputIntent";
import type { TileCoordinate } from "../world/grid";
import { labelRoadComponents } from "../world/roadGraph";
import { farmsteadCause } from "../zones/arableStrips";

// UI-AUDIT-1 (BOT-4): the HUD's food and goods are the demesne's totals, so a barn holding 800 wheat that cannot leave
// (and a harvest lost in the field behind it) still reads "enough". This model finds stock piled in one building that
// is not going anywhere, from what the engine already exposes: each building's inventory and claims, the road network
// (the same component labels the market service reads), the receivers' intake room and the carters on the map. The
// engine keeps no "stuck since" and no reason; FIX-11 is asked for that record (docs in the UI-AUDIT-1 report). Until
// then the reasons are derived here and a small per-session memory (never saved) supplies "since".
//
// Sources: stock a building's own carter hauls out and that can pile up far past a cart load — a farmstead's barn
// (its field's wheat; barley waits in the barn for the kiln by design, AL4) and a pastoral farm's fleece yard.
// Producers hold 20-40 at most and their "output full" already rings a crisis bell (alertStackModel).

export type StuckGoodsReason = "no_road" | "no_receiver" | "receiver_full" | "no_carrier" | "unknown";

export type StuckGoods = Readonly<{
  buildingId: string;
  kind: BuildingKind;
  good: StorableResourceType;
  /** Stock no other carter has claimed. */
  amount: number;
  /** First tick this session saw the stock piled (null without a memory). */
  since: number | null;
  reason: StuckGoodsReason;
  /** The barn is full and ripe strips wait in the field — the harvest is being lost (farmsteadCause `barn_full`). */
  spoiling: boolean;
  /** Carters out from this building now. */
  carriers: number;
  /** The building's footprint centre (camera `lookAt`). */
  tile: TileCoordinate;
}>;

/** Pile threshold: the engine's own "barn backed up" stock (LB-15), or this share of a smaller building's room. */
export const STUCK_MIN_AMOUNT = BARN_BACKLOG_STOCK;
export const STUCK_MIN_SHARE_PERMILLE = 400;
/**
 * With a road and a receiver with room, the pile counts as stuck only when it has not gone down once in this long
 * (6 guidance samples of 60 ticks, about 32 days): a barn filling at harvest while its cart shuttles is not stuck.
 */
export const STUCK_STILL_TICKS = 360;
/** Same as alertStackModel's: before this tick supply has not been computed yet. */
export const STUCK_MIN_TICK = 20;

/** Per-session watch of each pile (key `buildingId|good`). Not saved; a loaded or restarted game starts it again. */
export type StuckGoodsMemory = Readonly<{
  seed: number;
  tick: number;
  piles: ReadonlyMap<string, Readonly<{ since: number; amount: number; lastDrop: number; lastCarrier: number }>>;
}>;
export const EMPTY_STUCK_MEMORY: StuckGoodsMemory = Object.freeze({ seed: 0, tick: -1, piles: new Map() });

type Pile = Readonly<{ building: Building; good: StorableResourceType; amount: number }>;

function pileThreshold(building: Building): number {
  const room = BUILDING_CONFIG_BY_KIND[building.kind].storageCapacity;
  return Math.max(1, Math.min(STUCK_MIN_AMOUNT, Math.floor(room * STUCK_MIN_SHARE_PERMILLE / 1000)));
}

function piles(state: GameState): readonly Pile[] {
  return state.buildings.flatMap((building) => {
    const definition = BUILDING_CONFIG_BY_KIND[building.kind];
    const good: StorableResourceType | undefined = definition.yardOutput === "fleece" ? "fleece"
      : definition.fieldOutput !== undefined ? "wheat" : undefined;
    if (good === undefined) return [];
    const amount = Math.max(0, (building.inventory[good] ?? 0) - Math.max(0, building.stockReserved[good] ?? 0));
    return amount >= pileThreshold(building) ? [{ building, good, amount }] : [];
  });
}

/** Buildings that take `good` out of a pile: its store kind, and for wheat the mills (they fetch from barns, AF-9). */
function receivers(state: GameState, good: StorableResourceType, source: Building): readonly Building[] {
  const store = STORAGE_KIND_BY_RESOURCE[good];
  return state.buildings.filter(building => building.id !== source.id && (building.kind === store || (good === "wheat" && building.kind === "mill")));
}

function hasRoom(receiver: Building, good: StorableResourceType): boolean {
  if (operationSuspended(receiver)) return false;
  const space = availableSpace(receiver, BUILDING_CONFIG_BY_KIND[receiver.kind]);
  return receiver.kind === "mill" ? space > 0 : storageIntakeSpace(receiver, good, space) > 0;
}

function footprintCentre(building: Building): TileCoordinate {
  const size = buildingFootprint(building);
  return { tx: building.tx + Math.floor((size.width - 1) / 2), ty: building.ty + Math.floor((size.height - 1) / 2) };
}

type Structural = Readonly<{ reason: StuckGoodsReason | null; spoiling: boolean }>;

/** What the state alone says about a pile: a reason it cannot move, or null (it can; the memory decides). */
function structuralReason(state: GameState, pile: Pile, labels: ReadonlyMap<string, number>): Structural {
  const componentsOf = (building: Building): ReadonlySet<number> => new Set(buildingRoadAccessTiles(state, building)
    .flatMap(road => { const label = labels.get(`${road.tx},${road.ty}`); return label === undefined ? [] : [label]; }));
  const own = componentsOf(pile.building);
  const all = receivers(state, pile.good, pile.building);
  const spoiling = pile.building.kind === "farmstead" && own.size > 0 && farmsteadCause(state, pile.building.id) === "barn_full";
  if (own.size === 0) return { reason: "no_road", spoiling };
  if (all.length === 0) return { reason: "no_receiver", spoiling };
  const connected = all.filter(receiver => [...componentsOf(receiver)].some(label => own.has(label)));
  if (connected.length === 0) return { reason: "no_road", spoiling };
  if (!connected.some(receiver => hasRoom(receiver, pile.good))) return { reason: "receiver_full", spoiling };
  // A route and room, but the harvest waits on barn space: the carts cannot keep up.
  return { reason: spoiling ? "no_carrier" : null, spoiling };
}

function carriersOf(state: GameState, buildingId: string): number {
  return state.walkers.filter(walker => walker.kind === "carter" && walker.homeBuildingId === buildingId).length;
}

const pileKey = (pile: Pick<Pile, "good"> & { readonly building: Pick<Building, "id"> }): string => `${pile.building.id}|${pile.good}`;

/**
 * The next memory after seeing `state`: a pile keeps its first tick while it stays over the threshold, its last drop
 * and the last tick a carter of its building was out. Another game's seed or an earlier tick (a load, a restart)
 * starts it again.
 */
export function observeStuckGoods(state: GameState, memory: StuckGoodsMemory): StuckGoodsMemory {
  const previous = state.seed !== memory.seed || state.tick < memory.tick ? EMPTY_STUCK_MEMORY.piles : memory.piles;
  const next = new Map<string, { since: number; amount: number; lastDrop: number; lastCarrier: number }>();
  for (const pile of piles(state)) {
    const key = pileKey(pile);
    const seen = previous.get(key);
    const carried = carriersOf(state, pile.building.id) > 0;
    next.set(key, seen === undefined
      ? { since: state.tick, amount: pile.amount, lastDrop: state.tick, lastCarrier: state.tick }
      : { since: seen.since, amount: pile.amount, lastDrop: pile.amount < seen.amount ? state.tick : seen.lastDrop,
        lastCarrier: carried ? state.tick : seen.lastCarrier });
  }
  return { seed: state.seed, tick: state.tick, piles: next };
}

/**
 * Stuck piles in `state`, the largest first. `memory` (from `observeStuckGoods` on this state) gives `since` and the
 * still-pile check; without it only what the state shows is reported (no road, no receiver, every receiver full,
 * a harvest lost behind a full barn).
 */
export function stuckGoods(state: GameState, memory: StuckGoodsMemory = EMPTY_STUCK_MEMORY): readonly StuckGoods[] {
  if (state.tick < STUCK_MIN_TICK) return [];
  const found = piles(state);
  if (found.length === 0) return [];
  const labels = labelRoadComponents(state);
  const rows = found.flatMap((pile): StuckGoods[] => {
    const structural = structuralReason(state, pile, labels);
    const watched = memory.piles.get(pileKey(pile));
    const still = watched !== undefined && state.tick - watched.lastDrop >= STUCK_STILL_TICKS;
    const reason = structural.reason ?? (!still ? null : state.tick - watched.lastCarrier >= STUCK_STILL_TICKS ? "no_carrier" : "unknown");
    if (reason === null) return [];
    return [{ buildingId: pile.building.id, kind: pile.building.kind, good: pile.good, amount: pile.amount, since: watched?.since ?? null,
      reason, spoiling: structural.spoiling, carriers: carriersOf(state, pile.building.id), tile: footprintCentre(pile.building) }];
  });
  return rows.sort((a, b) => b.amount - a.amount || a.buildingId.localeCompare(b.buildingId));
}

export type Compass = "north" | "northEast" | "east" | "southEast" | "south" | "southWest" | "west" | "northWest" | "centre";
/** Within this many tiles of the town centre a building is "by the keep", not in a direction. */
export const STUCK_CENTRE_RADIUS_TILES = 4;
const COMPASS: readonly Compass[] = ["east", "southEast", "south", "southWest", "west", "northWest", "north", "northEast"];

/** The town's centre: the keep, else the church or chapel, else the buildings' mean, else the map's middle. */
export function townCentre(state: GameState): TileCoordinate {
  const seat = state.buildings.find(building => building.kind === "keep")
    ?? state.buildings.find(building => building.kind === "church" || building.kind === "chapel");
  if (seat !== undefined) return footprintCentre(seat);
  if (state.buildings.length === 0) return { tx: Math.floor(state.width / 2), ty: Math.floor(state.height / 2) };
  const sum = state.buildings.reduce((total, building) => ({ tx: total.tx + building.tx, ty: total.ty + building.ty }), { tx: 0, ty: 0 });
  return { tx: Math.round(sum.tx / state.buildings.length), ty: Math.round(sum.ty / state.buildings.length) };
}

/**
 * Where `tile` lies from the town centre as the player sees it on the screen (the map is drawn 2:1 isometric, so
 * screen up is -tx -ty; the words follow the screen, not the grid axes).
 */
export function compassFromCentre(state: GameState, tile: TileCoordinate): Compass {
  const centre = townCentre(state);
  const dx = tile.tx - centre.tx;
  const dy = tile.ty - centre.ty;
  if (Math.max(Math.abs(dx), Math.abs(dy)) <= STUCK_CENTRE_RADIUS_TILES) return "centre";
  // iso.ts tileToScreen: sx = (tx - ty) * 32, sy = (tx + ty) * 16.
  const angle = Math.atan2((dx + dy) * 16, (dx - dy) * 32);
  const sector = ((Math.round(angle / (Math.PI / 4)) % 8) + 8) % 8;
  return COMPASS[sector]!;
}

/** The chip's press: the camera to the building. */
export function stuckGoodsLookAtIntent(row: StuckGoods): InputIntent {
  return { kind: "lookAt", tile: row.tile };
}
