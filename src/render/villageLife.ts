import type { GameState } from "../engine/engine.types";
import { ageBandOf, ageOf, currentYear } from "../engine/persons";
import type { Person } from "../engine/persons.types";
import { stateCalendar } from "../engine/scenarioState";
import { buildingFootprint } from "../geometry/buildingFootprint";
import type { House } from "../population/population.types";
import { zonesOf } from "../zones/zoneEdits";
import { depthKey } from "./iso";
import { tileIsVisibleInRange, type TileRange } from "./renderVisibility";
import { WAVE23_IMAGES } from "./wave23ArtManifest.generated";

// INSTALL-23 ③ village life (Wave 23 life_birds / life_ground / life_props): hens, cats and dogs in the yards, crows and
// sparrows crossing the view, pigeons on the ridges, children's toys, washing lines, a chair or a barrel at the door and
// a bucket at each well. Presentation only: nothing is saved or simulated; the same state and view give the same list
// (hashes of the seed and the building ids, no Math.random); flight and walking follow presentation time at draw.
//
// Which house gets what (a lived-in house: residents, not abandoned, not burnt; its household = the persons whose
// `householdId` is the house's building id):
//  - A play prop (ball, hoop or wooden sword) only where a child (under 14) lives, one such house in two by its hash;
//    in winter one in six (children kept indoors).
//  - A washing line only where a woman (14 or over) lives, one such house in two; none in winter.
//  - At the door: a chair where an elder (55 or over) lives, one such house in two; else a barrel at a house of level 2
//    or more, one in three.
//  - One animal candidate per house by its level (chosen by hash): level 1 hens ×3 : cat; level 2 hens ×2 : cat : dog;
//    level 3+ hens : cat : dog ×2. Winter: only one house in two keeps an animal out of doors.
//  - Pigeons on the ridge of a house of level 2 or more (at most PIGEONS[season] in view); flying birds cross the view
//    (sparrows and crows; crows only in winter).
//  - A bucket beside every well while the town has a lived-in house (not where buildings in front hide the well).
// At most MAX_ANIMALS[season] animals in any view, counting each hen of a flock (flock a has two, b and c three):
// flying birds first, then pigeons, then the yards' animals in hash order. Props: at most two per house (door, yard) and
// MAX_PROPS in view. Nothing appears when no house is lived in.
//
// Scale: each art's `displayScale` (Astra's, set against the pasture's `cattle_pair`, 128 px drawn 30 px wide); the
// small animals — hens, cats, dogs and birds — are drawn SMALL_ANIMAL_LEGIBILITY times larger so they read at zoom 1.
// Props keep their scale. Large animals (none in this batch) keep the ASSET-2 rule (animalScale.ts).

export const SMALL_ANIMAL_LEGIBILITY = 1.6;
export const MAX_ANIMALS = { summer: 8, winter: 4 } as const;
const MAX_PROPS = 24;
const FLYING = { summer: 2, winter: 1 } as const;
const PIGEONS = { summer: 2, winter: 1 } as const;
/** Sorts after every object of the view: flying birds are above the roofs. */
export const FLYING_DEPTH = 1e6;
/** A pigeon sorts just after its house (as the raid smoke does). */
const PERCH_DEPTH_AFTER_HOUSE = 0.002;

export type VillageLifeKind = "crow_flight_sheet" | "sparrow_flight_sheet" | "pigeon_perched_a" | "pigeon_perched_b"
  | "cat_idle_a" | "cat_idle_b" | "chicken_flock_a" | "chicken_flock_b" | "chicken_flock_c" | "chicken_walk_sheet"
  | "village_dog_sleep" | "village_dog_walk_sheet" | "child_ball" | "child_hoop" | "child_wooden_sword"
  | "clothesline_a" | "clothesline_b" | "doorstep_barrel" | "doorstep_chair" | "well_bucket";
export type VillageLifeSpecies = "hen" | "cat" | "dog" | "crow" | "sparrow" | "pigeon";
export type VillageLifeMotion = "still" | "walk" | "flight" | "perch";

export type VillageLifeItem = {
  readonly id: string;
  readonly kind: VillageLifeKind;
  /** Null for props. */
  readonly species: VillageLifeSpecies | null;
  /** How many animals the picture shows (0 for props). */
  readonly animals: number;
  readonly motion: VillageLifeMotion;
  /** Foot in tile units (a pigeon: its house's middle; a flying bird: the middle of the view). */
  readonly x: number;
  readonly y: number;
  /** Place in the object queue. */
  readonly depth: number;
  readonly anchorTx: number;
  /** World px per asset px at zoom 1: displayScale, × SMALL_ANIMAL_LEGIBILITY for the small animals. */
  readonly scale: number;
  /** The house (or well) it belongs to. */
  readonly buildingId: string | null;
  /** Walkers: the tile axis they pace along ("x" or "y"); others null. */
  readonly axis: "x" | "y" | null;
  /** Animation seed (frame phase, flight lane). */
  readonly phase: number;
};

export type VillageLifeView = { readonly range: TileRange };

const SMALL_ANIMALS: ReadonlySet<VillageLifeKind> = new Set(["crow_flight_sheet", "sparrow_flight_sheet", "pigeon_perched_a", "pigeon_perched_b",
  "cat_idle_a", "cat_idle_b", "chicken_flock_a", "chicken_flock_b", "chicken_flock_c", "chicken_walk_sheet", "village_dog_sleep", "village_dog_walk_sheet"]);
/** Hens in each flock picture (Astra's life-ground-scale.json `animalCount`). */
const FLOCK_SIZE: Partial<Record<VillageLifeKind, number>> = { chicken_flock_a: 2, chicken_flock_b: 3, chicken_flock_c: 3 };

export function villageLifeScale(kind: VillageLifeKind): number {
  return WAVE23_IMAGES[kind].displayScale * (SMALL_ANIMALS.has(kind) ? SMALL_ANIMAL_LEGIBILITY : 1);
}

function hash(text: string, salt: number): number {
  let h = (0x811c9dc5 ^ Math.imul(salt, 0x9e3779b1)) >>> 0;
  for (let index = 0; index < text.length; index += 1) h = Math.imul(h ^ text.charCodeAt(index), 0x01000193) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d) >>> 0;
  return (h ^ (h >>> 15)) >>> 0;
}
const unit = (h: number) => (h % 10_000) / 10_000;

type Candidate = { readonly item: VillageLifeItem; readonly rank: number; readonly tx: number; readonly ty: number };
type Town = { readonly props: readonly Candidate[]; readonly animals: readonly Candidate[]; readonly perches: readonly Candidate[];
  readonly lived: readonly { readonly tx: number; readonly ty: number }[]; readonly winter: boolean; readonly seed: number };

function item(kind: VillageLifeKind, id: string, x: number, y: number, buildingId: string | null, phase: number, fields: Partial<VillageLifeItem> = {}): VillageLifeItem {
  const species: VillageLifeSpecies | null = kind.startsWith("chicken") ? "hen" : kind.startsWith("cat") ? "cat" : kind.startsWith("village_dog") ? "dog"
    : kind.startsWith("pigeon") ? "pigeon" : kind.startsWith("crow") ? "crow" : kind.startsWith("sparrow") ? "sparrow" : null;
  const motion: VillageLifeMotion = kind.endsWith("walk_sheet") ? "walk" : kind.endsWith("flight_sheet") ? "flight" : species === "pigeon" ? "perch" : "still";
  return { id, kind, species, animals: species === null ? 0 : FLOCK_SIZE[kind] ?? 1, motion, x, y, depth: depthKey(x, y), anchorTx: Math.round(x),
    scale: villageLifeScale(kind), buildingId, axis: null, phase, ...fields };
}

/** The town's candidates (every lived-in house), before the view's caps. */
function townLife(state: GameState): Town {
  const winter = stateCalendar(state).season === 3;
  const year = currentYear(state);
  const { width, height, tiles, seed } = state;
  const blocked = new Set<number>();
  for (const zone of zonesOf(state)) if (zone.kind !== "burgage") for (const cell of zone.membership) blocked.add(cell);
  const used = new Set<number>();
  const tileAt = (tx: number, ty: number) => tx < 0 || ty < 0 || tx >= width || ty >= height ? undefined : tiles[ty * width + tx];
  // A spot is seen only when no building stands on the three tiles in front of it (drawn later, their art would cover it).
  const clear = (tx: number, ty: number) => { const tile = tileAt(tx, ty); return tile === undefined || tile.buildingId === null; };
  const doorFree = (tx: number, ty: number) => { const tile = tileAt(tx, ty); return tile !== undefined && tile.buildingId === null && tile.terrain !== "water" && !used.has(ty * width + tx)
    && clear(tx + 1, ty) && clear(tx, ty + 1) && clear(tx + 1, ty + 1); };
  // Open ground: grass, or forest the town has felled (its stumps and regrowth are low; standing trees are not yards).
  const felled = new Set(state.forestHarvests.map(harvest => harvest.ty * width + harvest.tx));
  const open = (tx: number, ty: number) => { const terrain = tileAt(tx, ty)?.terrain; return terrain === "grass" || (terrain === "forest" && felled.has(ty * width + tx)); };
  const yardFree = (tx: number, ty: number) => doorFree(tx, ty) && open(tx, ty) && tileAt(tx, ty)?.hasRoad === false && !blocked.has(ty * width + tx);
  const households = new Map<string, Person[]>();
  for (const person of state.persons?.people ?? []) {
    if (!person.alive) continue;
    const members = households.get(person.householdId);
    if (members === undefined) households.set(person.householdId, [person]); else members.push(person);
  }
  const houses = new Map<string, House>(state.houses.map(house => [house.buildingId, house]));
  const lived = [...state.buildings].filter(building => {
    const house = building.kind === "house" ? houses.get(building.id) : undefined;
    return house !== undefined && house.residents > 0 && house.level >= 1 && house.abandonedTick === undefined && house.burntTick === undefined;
  }).sort((a, b) => a.id.localeCompare(b.id));
  const props: Candidate[] = []; const animals: Candidate[] = []; const perches: Candidate[] = [];
  if (lived.length === 0) return { props, animals, perches, lived: [], winter, seed };
  for (const building of lived) {
    const level = houses.get(building.id)?.level ?? 1;
    const members = households.get(building.id) ?? [];
    const band = (person: Person) => ageBandOf(ageOf(person, year));
    const child = members.some(person => band(person) === "child");
    const woman = members.some(person => person.sex === "female" && band(person) !== "child");
    const elder = members.some(person => band(person) === "elder");
    const h = (salt: number) => hash(building.id, seed * 31 + salt);
    const { width: w, height: d } = buildingFootprint(building);
    const { tx, ty } = building;
    const claim = (cx: number, cy: number) => used.add(cy * width + cx);
    const rank = h(1);
    // The door: the house's south-east or south-west face (its hash picks which first), just outside the wall.
    const doors = [
      { x: tx + w - 0.5 + 0.16, y: ty + (d - 1) / 2 + 0.1, cx: tx + w, cy: ty + Math.round((d - 1) / 2) },
      { x: tx + (w - 1) / 2 + 0.1, y: ty + d - 0.5 + 0.16, cx: tx + Math.round((w - 1) / 2), cy: ty + d },
    ];
    if (h(2) % 2 === 1) doors.reverse();
    const doorKind: VillageLifeKind | null = elder && h(3) % 2 === 0 ? "doorstep_chair" : level >= 2 && h(21) % 3 === 0 ? "doorstep_barrel" : null;
    const door = doorKind === null ? undefined : doors.find(spot => doorFree(spot.cx, spot.cy));
    if (doorKind !== null && door !== undefined) {
      claim(door.cx, door.cy);
      props.push({ item: item(doorKind, `life:${building.id}:door`, door.x, door.y, building.id, h(4)), rank, tx: door.cx, ty: door.cy });
    }
    // The yard: the free grass tiles in front of the house, then beside it, each item on its own tile.
    const yard: [number, number][] = [];
    for (let j = 0; j < d; j += 1) yard.push([tx + w, ty + j]);
    for (let i = 0; i < w; i += 1) yard.push([tx + i, ty + d]);
    yard.push([tx + w, ty + d], [tx + w, ty - 1], [tx - 1, ty + d]);
    const start = h(5) % Math.max(1, w + d);
    const ordered = [...yard.slice(start, w + d), ...yard.slice(0, start), ...yard.slice(w + d)];
    const takeYard = (salt: number): { x: number; y: number; cx: number; cy: number } | null => {
      const spot = ordered.find(([cx, cy]) => yardFree(cx, cy));
      if (spot === undefined) return null;
      claim(spot[0], spot[1]);
      return { x: spot[0] + (unit(h(salt)) - 0.5) * 0.4, y: spot[1] + (unit(h(salt + 1)) - 0.5) * 0.4, cx: spot[0], cy: spot[1] };
    };
    const yardProps: VillageLifeKind[] = [];
    if (woman && !winter && h(6) % 2 === 0) yardProps.push(h(7) % 2 === 0 ? "clothesline_a" : "clothesline_b");
    if (child && h(8) % (winter ? 6 : 2) === 0) yardProps.push((["child_ball", "child_hoop", "child_wooden_sword"] as const)[h(9) % 3]!);
    // Two props at most per house: the door's and one in the yard (the hash picks between line and toy).
    const yardKind = yardProps.length === 0 ? null : yardProps[(doorKind !== null && door !== undefined) ? h(10) % yardProps.length : 0]!;
    const extra = doorKind !== null && door !== undefined ? null : yardProps.find(kind => kind !== yardKind) ?? null;
    for (const [index, kind] of [yardKind, extra].entries()) {
      if (kind === null) continue;
      const spot = takeYard(20 + index * 2);
      if (spot !== null) props.push({ item: item(kind, `life:${building.id}:yard${index}`, spot.x, spot.y, building.id, h(11)), rank, tx: spot.cx, ty: spot.cy });
    }
    // One animal candidate by level; in winter one house in two keeps it out of doors.
    if (!winter || h(12) % 2 === 0) {
      const table: readonly VillageLifeSpecies[] = level <= 1 ? ["hen", "hen", "hen", "cat"] : level === 2 ? ["hen", "hen", "cat", "dog"] : ["hen", "cat", "dog", "dog"];
      const species = table[h(13) % table.length]!;
      const kind: VillageLifeKind = species === "hen" ? (["chicken_flock_a", "chicken_flock_b", "chicken_flock_c", "chicken_walk_sheet"] as const)[h(14) % 4]!
        : species === "cat" ? (h(14) % 2 === 0 ? "cat_idle_a" : "cat_idle_b") : h(14) % 2 === 0 ? "village_dog_sleep" : "village_dog_walk_sheet";
      const spot = takeYard(30);
      if (spot !== null) {
        animals.push({ item: item(kind, `life:${building.id}:animal`, spot.x, spot.y, building.id, h(15), kind.endsWith("walk_sheet") ? { axis: h(16) % 2 === 0 ? "x" : "y" } : {}),
          rank: h(17), tx: spot.cx, ty: spot.cy });
      }
    }
    if (level >= 2) {
      const size = buildingFootprint(building);
      const front = { tx: tx + size.width - 1, ty: ty + size.height - 1 };
      const kind: VillageLifeKind = h(18) % 2 === 0 ? "pigeon_perched_a" : "pigeon_perched_b";
      perches.push({ item: { ...item(kind, `life:${building.id}:pigeon`, tx + (size.width - 1) / 2, ty + (size.height - 1) / 2, building.id, h(19)),
        depth: depthKey(front.tx, front.ty) + PERCH_DEPTH_AFTER_HOUSE, anchorTx: front.tx }, rank: h(20), tx: front.tx, ty: front.ty });
    }
  }
  for (const well of state.buildings) {
    if (well.kind !== "well" || !(clear(well.tx + 1, well.ty) && clear(well.tx, well.ty + 1) && clear(well.tx + 1, well.ty + 1))) continue;
    const x = well.tx + 0.28; const y = well.ty + 0.42;
    props.push({ item: { ...item("well_bucket", `life:${well.id}:bucket`, x, y, well.id, hash(well.id, seed)), depth: depthKey(well.tx, well.ty) + 0.001, anchorTx: well.tx },
      rank: 0, tx: well.tx, ty: well.ty });
  }
  const byRank = (a: Candidate, b: Candidate) => a.rank - b.rank || a.item.id.localeCompare(b.item.id);
  return { props: props.sort(byRank), animals: animals.sort(byRank), perches: perches.sort(byRank), lived: lived.map(({ tx, ty }) => ({ tx, ty })), winter, seed };
}

// Cache (AGENTS rule 10): (a) the town's candidates, keyed on the houses, buildings, persons, tiles and zones arrays
// (each is replaced when it changes) with the year and season (ages and the winter rule); (b) the view's list, keyed on
// that town and the range. Reason: the object queue asks every frame; the town scan groups every person by household.
// Measured in Node (Mac): tests/villageLife.test.ts prints it for the v19 24-house fixture (463 people): the scan 0.33 ms,
// a cached call 0.0035 ms; the seed-2 town of 1340 (24 houses, 729 people): the scan 0.4–0.55 ms once warm.
type TownKey = { readonly houses: unknown; readonly buildings: unknown; readonly persons: unknown; readonly tiles: unknown; readonly zones: unknown;
  readonly year: number; readonly season: number; readonly seed: number };
let lastTown: { readonly key: TownKey; readonly town: Town } | null = null;
let lastView: { readonly town: Town; readonly range: string; readonly items: readonly VillageLifeItem[] } | null = null;

function cachedTown(state: GameState): Town {
  const date = stateCalendar(state);
  const key: TownKey = { houses: state.houses, buildings: state.buildings, persons: state.persons, tiles: state.tiles, zones: state.zones,
    year: date.year, season: date.season, seed: state.seed };
  const previous = lastTown?.key;
  if (lastTown !== null && previous !== undefined && (Object.keys(key) as (keyof TownKey)[]).every(name => previous[name] === key[name])) return lastTown.town;
  lastTown = { key, town: townLife(state) };
  return lastTown.town;
}

/** Village life in a view: props and animals with their kinds, feet, scales and queue places (see the header's rules). */
export function villageLife(state: GameState, view: VillageLifeView): readonly VillageLifeItem[] {
  const town = cachedTown(state);
  const { range } = view;
  const rangeKey = `${range.minTx},${range.minTy},${range.maxTx},${range.maxTy},${range.minDepth ?? ""},${range.maxDepth ?? ""},${range.minDiagonal ?? ""},${range.maxDiagonal ?? ""}`;
  if (lastView !== null && lastView.town === town && lastView.range === rangeKey) return lastView.items;
  const visible = (candidate: Candidate) => tileIsVisibleInRange(candidate.tx, candidate.ty, range);
  const items: VillageLifeItem[] = [];
  const houseInView = town.lived.some(house => tileIsVisibleInRange(house.tx, house.ty, range));
  if (houseInView) {
    const season = town.winter ? "winter" : "summer";
    let animals = 0;
    const cap = MAX_ANIMALS[season];
    const middle = { x: (range.minTx + range.maxTx) / 2, y: (range.minTy + range.maxTy) / 2 };
    for (let lane = 0; lane < FLYING[season] && animals < cap; lane += 1) {
      const h = hash(`flight:${lane}`, town.seed);
      const kind: VillageLifeKind = town.winter || lane % 2 === 1 ? "crow_flight_sheet" : "sparrow_flight_sheet";
      items.push({ ...item(kind, `life:flight:${lane}`, middle.x, middle.y, null, h), depth: FLYING_DEPTH + lane, anchorTx: 0 });
      animals += 1;
    }
    for (const perch of town.perches.filter(visible).slice(0, PIGEONS[season])) {
      if (animals + perch.item.animals > cap) break;
      items.push(perch.item); animals += perch.item.animals;
    }
    for (const candidate of town.animals) {
      if (animals >= cap) break;
      if (!visible(candidate) || animals + candidate.item.animals > cap) continue;
      items.push(candidate.item); animals += candidate.item.animals;
    }
    items.push(...town.props.filter(visible).slice(0, MAX_PROPS).map(candidate => candidate.item));
  }
  lastView = { town, range: rangeKey, items };
  return items;
}

/** The on-screen animal count of a village life list (each hen of a flock counts). */
export function villageLifeAnimalCount(items: readonly VillageLifeItem[]): number {
  return items.reduce((sum, entry) => sum + entry.animals, 0);
}
