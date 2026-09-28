import type { Building } from "../content/buildingConfig";
import { BUILDING_CONFIG_BY_KIND } from "../content/buildingConfig";
import { YARD_OCCUPATION_BY_CRAFT, YARD_OCCUPATION_BY_TRADE, YARD_RULES, YARD_SHARED_KINDS, YARD_SHARED_LEAN,
  type YardCircumstance, type YardOccupationKind } from "../content/backyardConfig";
import { isBuildingConstructionSite } from "../economy/constructionSiteAccessors";
import type { GameState } from "../engine/engine.types";
import type { Person } from "../engine/persons.types";
import { buildingRoadAccessTiles } from "../engine/routing";
import { stateCalendar } from "../engine/scenarioState";
import { buildingFootprint } from "../geometry/buildingFootprint";
import type { TileCoordinate } from "../geometry/tileGeometry";
import type { House } from "../population/population.types";
import { canTraverseWallBoundary } from "../world/wallTraversal";
import { zonesOf } from "../zones/zoneEdits";
import { depthKey } from "./iso";
import type { Wave27YardKey } from "./wave27YardManifest.generated";

// INSTALL-27 backyard decals (Wave 27): each house's back yard shows its household — its trade, or how it is faring —
// on the cells behind the house, the side away from its road. Presentation only: read from the state, nothing saved,
// the same state gives the same yards (hashes of the house id, no Math.random). Which picture: src/content/backyardConfig.ts.
// Where:
//  - Frontage: the footprint side with the most road access tiles (engine `buildingRoadAccessTiles`, wall-aware); ties
//    go to the sides facing the camera (+y, +x, -x, -y), as the C1d aprons. No road: the north-east side is the front's
//    opposite default (back = -y), as the C1e croft beds.
//  - Back row: the cells touching the footprint on the side opposite the frontage. The 2 x 1 picture takes two of them
//    side by side along the road (a single house's one back cell and its neighbour along the road, the side the house
//    id's hash picks first). Both must be free: open grass (or felled forest), no road, building or building site, not
//    a field zone's cell, not across the wall from the house, not another yard's. The picture's long side runs along +x;
//    a pair along y takes it mirrored.
//  - Only one free back cell: a 1 x 1 shared prop there (backyardConfig YARD_SHARED_KINDS). None free: no decal.
//  - Houses claim cells in id order.
// A / B: by the house (household) id's hash, per picture kind.

export type BackyardDecal = {
  readonly id: string;
  readonly buildingId: string;
  readonly key: Wave27YardKey;
  /** The cells the picture stands on (2 for an occupation or state picture, 1 for a shared prop). */
  readonly cells: readonly TileCoordinate[];
  /** Ground centre of those cells (tile-centre coordinates). */
  readonly x: number;
  readonly y: number;
  /** The pair runs along y: the picture is drawn mirrored. */
  readonly mirror: boolean;
  /** Draw order among yards (x + y of the ground centre). */
  readonly depth: number;
  /** The cells around `cells` the picture's edge may overlap (the draw clips to `cells` and these). */
  readonly spill: readonly TileCoordinate[];
};

type Normal = { readonly tx: number; readonly ty: number };
const SIDES: readonly Normal[] = [{ tx: 0, ty: 1 }, { tx: 1, ty: 0 }, { tx: -1, ty: 0 }, { tx: 0, ty: -1 }];
const NO_ROAD_BACK: Normal = { tx: 0, ty: -1 };

export function yardHash(text: string, salt: number): number {
  let h = (0x811c9dc5 ^ Math.imul(salt + 1, 0x9e3779b1)) >>> 0;
  for (let index = 0; index < text.length; index += 1) h = Math.imul(h ^ text.charCodeAt(index), 0x01000193) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d) >>> 0;
  return (h ^ (h >>> 15)) >>> 0;
}

/** The household's yard trade: its craft first, then the members' trades (head, spouse, the rest by id); null: none. */
export function yardOccupation(house: Pick<House, "crafts">, members: readonly Pick<Person, "id" | "role" | "occupation">[]): YardOccupationKind | null {
  for (const slot of house.crafts ?? []) {
    const craft = slot.craftId === null ? undefined : YARD_OCCUPATION_BY_CRAFT[slot.craftId];
    if (craft !== undefined) return craft;
  }
  const order = (person: Pick<Person, "role">) => (person.role === "head" ? 0 : person.role === "spouse" ? 1 : 2);
  const sorted = [...members].sort((a, b) => order(a) - order(b) || a.id.localeCompare(b.id));
  for (const person of sorted) {
    const kind = YARD_OCCUPATION_BY_TRADE[person.occupation];
    if (kind !== undefined) return kind;
  }
  return null;
}

export type YardHousehold = {
  readonly house: Pick<House, "level" | "residents" | "abandonedTick" | "foodShortSinceTick" | "leavingSinceTick" | "crafts">;
  readonly members: readonly Pick<Person, "id" | "role" | "occupation">[];
  readonly tick: number;
  readonly winter: boolean;
  /** The last tick a household moved into the house (history), or null. */
  readonly movedInTick: number | null;
};

/** The picture's kind: a circumstance, or the occupation (backyardConfig YARD_RULES order). */
export function yardPictureKind(input: YardHousehold): YardCircumstance | YardOccupationKind {
  const { house } = input;
  if (input.winter) return "winter";
  if (house.abandonedTick !== undefined || house.residents <= 0) return "vacant";
  if (house.foodShortSinceTick !== undefined || house.leavingSinceTick !== undefined) return "hungry";
  if (input.movedInTick !== null && input.tick - input.movedInTick < YARD_RULES.newcomerTicks) return "newcomer";
  const occupation = yardOccupation(house, input.members);
  if (occupation !== null) return occupation;
  return house.level >= YARD_RULES.prosperousMinLevel ? "prosperous" : "strained";
}

/** A / B by the household id (a fresh stream per kind, so one house does not show every kind's `a`). */
export function yardVariant(householdId: string, kind: string): "a" | "b" {
  return yardHash(`${householdId}|${kind}`, 27) % 2 === 0 ? "a" : "b";
}

export function yardKey(householdId: string, kind: YardCircumstance | YardOccupationKind): Wave27YardKey {
  return `yard_${kind}_${yardVariant(householdId, kind)}`;
}

/** The 1 x 1 shared prop of a household with one free back cell. */
export function yardSharedKey(householdId: string, kind: YardCircumstance | YardOccupationKind): Wave27YardKey {
  if (kind === "winter" || kind === "vacant" || kind === "hungry") return `yard_${YARD_SHARED_LEAN}`;
  return `yard_${YARD_SHARED_KINDS[yardHash(householdId, 28) % YARD_SHARED_KINDS.length]!}`;
}

/**
 * The sides a yard may take, best first: the back (opposite the frontage), then the other sides with no road access
 * (camera-facing first). No road: the default back (-y), then the others.
 */
export function yardBackSides(state: Pick<GameState, "width" | "height" | "tiles" | "palisade">, building: Building): readonly Normal[] {
  const size = buildingFootprint(building);
  const counts = SIDES.map(() => 0);
  for (const road of buildingRoadAccessTiles(state, building)) {
    const side = road.ty < building.ty ? 3 : road.ty >= building.ty + size.height ? 0 : road.tx < building.tx ? 2 : 1;
    counts[side] = (counts[side] ?? 0) + 1;
  }
  let best = -1;
  counts.forEach((count, side) => { if (count > 0 && (best < 0 || count > (counts[best] ?? 0))) best = side; });
  const front = SIDES[best];
  const back = front === undefined ? NO_ROAD_BACK : { tx: 0 - front.tx, ty: 0 - front.ty };
  return [back, ...SIDES.filter((side, at) => counts[at] === 0 && !(side.tx === back.tx && side.ty === back.ty))];
}

/** The cells touching the footprint on the back side, in +x / +y order. */
export function yardBackRow(building: Building, back: Normal): readonly TileCoordinate[] {
  const { width, height } = buildingFootprint(building);
  if (back.ty !== 0) {
    const ty = back.ty < 0 ? building.ty - 1 : building.ty + height;
    return Array.from({ length: width }, (_, index) => ({ tx: building.tx + index, ty }));
  }
  const tx = back.tx < 0 ? building.tx - 1 : building.tx + width;
  return Array.from({ length: height }, (_, index) => ({ tx, ty: building.ty + index }));
}

/** `spill`: the cells around them the picture's edge may overlap (no road, water, rock or field: the draw clips to them). */
type Layout = { readonly buildingId: string; readonly cells: readonly TileCoordinate[]; readonly spill: readonly TileCoordinate[] };

/** Where each house's yard picture stands (houses in id order claim their cells): two cells, one, or none. */
export function backyardLayout(state: GameState): readonly Layout[] {
  const { width, height, tiles } = state;
  const index = (cell: TileCoordinate) => cell.ty * width + cell.tx;
  const fields = new Set<number>();
  for (const zone of zonesOf(state)) if (zone.kind !== "burgage") for (const cell of zone.membership) fields.add(cell);
  const taken = new Set<number>(fields);
  for (const site of state.constructionSites) {
    if (!isBuildingConstructionSite(site)) continue;
    const size = BUILDING_CONFIG_BY_KIND[site.kind];
    for (let dy = 0; dy < size.height; dy += 1) for (let dx = 0; dx < size.width; dx += 1) taken.add((site.ty + dy) * width + site.tx + dx);
  }
  const felled = new Set(state.forestHarvests.map(harvest => harvest.ty * width + harvest.tx));
  const free = (cell: TileCoordinate) => {
    if (cell.tx < 0 || cell.ty < 0 || cell.tx >= width || cell.ty >= height || taken.has(index(cell))) return false;
    const tile = tiles[index(cell)];
    return tile !== undefined && tile.buildingId === null && !tile.hasRoad && (tile.terrain === "grass" || (tile.terrain === "forest" && felled.has(index(cell))));
  };
  const layouts: Layout[] = [];
  const houses = state.buildings.filter(building => building.kind === "house").sort((a, b) => a.id.localeCompare(b.id));
  for (const building of houses) {
    let single: TileCoordinate | null = null;
    let cells: readonly TileCoordinate[] = [];
    for (const back of yardBackSides(state, building)) {
      const along = back.ty !== 0 ? { tx: 1, ty: 0 } : { tx: 0, ty: 1 };
      const row = yardBackRow(building, back).filter(cell => free(cell) && canTraverseWallBoundary(state, { tx: cell.tx - back.tx, ty: cell.ty - back.ty }, cell));
      const pairs: (readonly [TileCoordinate, TileCoordinate])[] = [];
      for (let at = 0; at + 1 < row.length; at += 1) {
        const [a, b] = [row[at]!, row[at + 1]!];
        if (Math.abs(a.tx - b.tx) + Math.abs(a.ty - b.ty) === 1) pairs.push([a, b]);
      }
      if (pairs.length === 0 && row.length === 1) {
        const cell = row[0]!;
        for (const sign of yardHash(building.id, 29) % 2 === 0 ? [1, -1] : [-1, 1]) {
          const next = { tx: cell.tx + along.tx * sign, ty: cell.ty + along.ty * sign };
          if (free(next) && canTraverseWallBoundary(state, cell, next)) pairs.push(sign > 0 ? [cell, next] : [next, cell]);
        }
      }
      single ??= row[0] ?? null;
      if (pairs[0] !== undefined) { cells = pairs[0]; break; }
    }
    if (cells.length === 0 && single !== null) cells = [single];
    for (const cell of cells) taken.add(index(cell));
    if (cells.length > 0) layouts.push({ buildingId: building.id, cells, spill: spillCells(state, cells, fields) });
  }
  return layouts;
}

function spillCells(state: GameState, cells: readonly TileCoordinate[], fields: ReadonlySet<number>): readonly TileCoordinate[] {
  const own = new Set(cells.map(cell => cell.ty * state.width + cell.tx));
  const spill = new Map<number, TileCoordinate>();
  for (const cell of cells) for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
    const next = { tx: cell.tx + dx, ty: cell.ty + dy };
    const at = next.ty * state.width + next.tx;
    const tile = next.tx < 0 || next.ty < 0 || next.tx >= state.width || next.ty >= state.height ? undefined : state.tiles[at];
    if (tile === undefined || own.has(at) || fields.has(at) || tile.hasRoad || tile.terrain === "water" || tile.terrain === "rock") continue;
    spill.set(at, next);
  }
  return [...spill.entries()].sort((a, b) => a[0] - b[0]).map(([, cell]) => cell);
}

/** The last tick a household moved into each house (history `person.move_in` / `person.resettled`). */
export function yardMoveIns(state: Pick<GameState, "history">): ReadonlyMap<string, number> {
  const moves = new Map<string, number>();
  for (const record of state.history?.records ?? []) {
    const id = record.place?.buildingId;
    if (id === undefined || (record.template !== "person.move_in" && record.template !== "person.resettled")) continue;
    if (record.tick > (moves.get(id) ?? -Infinity)) moves.set(id, record.tick);
  }
  return moves;
}

/** Every yard picture in the town, in draw order (see the header's rules). */
export function backyardDecals(state: GameState, layouts: readonly Layout[] = backyardLayout(state), moveIns = yardMoveIns(state)): readonly BackyardDecal[] {
  const winter = stateCalendar(state).season === YARD_RULES.winterSeason;
  const houses = new Map(state.houses.map(house => [house.buildingId, house]));
  const members = new Map<string, Person[]>();
  for (const person of state.persons?.people ?? []) {
    if (!person.alive) continue;
    const list = members.get(person.householdId);
    if (list === undefined) members.set(person.householdId, [person]); else list.push(person);
  }
  const decals: BackyardDecal[] = [];
  for (const layout of layouts) {
    const house = houses.get(layout.buildingId);
    if (house === undefined) continue;
    const kind = yardPictureKind({ house, members: members.get(layout.buildingId) ?? [], tick: state.tick, winter, movedInTick: moveIns.get(layout.buildingId) ?? null });
    const [first, second] = layout.cells;
    if (first === undefined) continue;
    const x = second === undefined ? first.tx : (first.tx + second.tx) / 2;
    const y = second === undefined ? first.ty : (first.ty + second.ty) / 2;
    decals.push({ id: `yard:${layout.buildingId}`, buildingId: layout.buildingId, cells: layout.cells, spill: layout.spill, x, y, depth: depthKey(x, y),
      key: second === undefined ? yardSharedKey(layout.buildingId, kind) : yardKey(layout.buildingId, kind), mirror: second !== undefined && second.tx === first.tx });
  }
  return decals.sort((a, b) => a.depth - b.depth || a.id.localeCompare(b.id));
}

// Cache (AGENTS rule 10): (a) the layout is keyed on the buildings, tiles, zones, palisade, construction sites and
// felled-forest arrays (each is replaced when it changes); the pictures on that layout, the houses, persons and history
// objects and the winter flag, and they hold until the earliest newcomer's season runs out (the tick reaches the choice
// only there: a house becomes a newcomer only through a new history record). (b) Nothing else is read. (c) Reason: the
// ground pass asks every frame; the layout walks every house's road access and back cells. Measured in Node (Mac),
// tests/backyardDecals.test.ts prints it: the v26 palisade-construction town (24 houses) 0.45 ms uncached, a cached
// call 0.0004 ms.
type LayoutKey = readonly unknown[];
let lastLayout: { readonly key: LayoutKey; readonly layouts: readonly Layout[] } | null = null;
let lastPlan: { readonly key: LayoutKey; readonly from: number; readonly until: number; readonly decals: readonly BackyardDecal[] } | null = null;
const sameKey = (a: LayoutKey, b: LayoutKey) => a.length === b.length && a.every((value, at) => value === b[at]);

/** backyardDecals through the cache above. */
export function backyardPlan(state: GameState): readonly BackyardDecal[] {
  const layoutKey: LayoutKey = [state.buildings, state.tiles, state.zones, state.palisade, state.constructionSites, state.forestHarvests, state.width];
  if (lastLayout === null || !sameKey(lastLayout.key, layoutKey)) lastLayout = { key: layoutKey, layouts: backyardLayout(state) };
  const winter = stateCalendar(state).season === YARD_RULES.winterSeason;
  const key: LayoutKey = [lastLayout.layouts, state.houses, state.persons, state.history, winter];
  if (lastPlan !== null && sameKey(lastPlan.key, key) && state.tick >= lastPlan.from && state.tick < lastPlan.until) return lastPlan.decals;
  const moveIns = yardMoveIns(state);
  let until = Infinity;
  for (const tick of moveIns.values()) if (state.tick - tick < YARD_RULES.newcomerTicks) until = Math.min(until, tick + YARD_RULES.newcomerTicks);
  lastPlan = { key, from: state.tick, until, decals: backyardDecals(state, lastLayout.layouts, moveIns) };
  return lastPlan.decals;
}
