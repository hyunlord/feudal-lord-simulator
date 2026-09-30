import type { Building } from "../content/buildingConfig";
import { isAlehouse } from "../engine/ale";
import type { GameState } from "../engine/engine.types";
import { buildingFootprint } from "../geometry/buildingFootprint";
import { boundaryHash } from "../world/boundary/boundaryGeometry";
import { aleBarrelPile } from "./aleWorldArt";
import { depthKey, tileToScreen } from "./iso";
import type { RenderQueueItem } from "./objectRenderTypes";
import { tileIsVisibleInRange, type TileRange } from "./renderVisibility";
import { storyWalkerScale } from "./storyWorldProps";
import { brewingDoor } from "./villageLife";
import { wave9Art, wave9Meta } from "./wave9Art";
import { drawCroppedWorldSprite } from "./worldSprite";

// NAT-2 (QA-002, QA-005): the alehouse crowd of the alehouses' boom (UI-9, RG-1). It was three or four drinkers at
// every alehouse — all 24 houses of the 1380 town, 59 figures on the start screen next to 60 walkers — standing for
// good (a 2 px sway), drawn after every object at a point below the house that could be another building's tile, so
// they stood on the granary's wall and on roofs. Now:
//  - Where: on the tile of the house's ale barrels (village life's brewing door: a free tile with no building on the
//    three tiles in front of it). Each drinker's spot is an object-queue item that the walkers' box rule places among
//    the objects around it (walkerOcclusion.ts `placeWalkers`), so what stands in front covers it and it covers what
//    stands behind. No barrels (no ale, or no free door tile), no crowd: the barrels are why they are there.
//  - How many: one drinker per barrel level (1–3).
//  - What they do: each steps out of the door, drinks by the barrels for 5–8 s (turning between the others and the
//    door), steps back in and stays in for a while — nobody stands 10 s — on the village life's clock (it holds while
//    the game is paused, like the walkers and the animals).
export type DrinkerFacing = "NE" | "SE" | "SW" | "NW";
export type AleDrinker = {
  /** `<house id>:<slot>`: the same drinker each visit. */
  readonly id: string;
  readonly key: "wk_petitioner_m" | "wk_petitioner_f";
  /** Foot in tile units. */
  readonly tx: number;
  readonly ty: number;
  readonly facing: DrinkerFacing;
  /** Walking frame (0 or 1); standing drinkers keep frame 0. */
  readonly gait: number;
  readonly walking: boolean;
};
/** One drinker's place: where it stands (`foot`) and the door it comes out of, on its house's door tile. */
export type AleStand = {
  readonly id: string; readonly houseId: string; readonly slot: number;
  readonly foot: { readonly tx: number; readonly ty: number }; readonly door: { readonly tx: number; readonly ty: number };
  readonly middle: { readonly tx: number; readonly ty: number };
};
export type AleDrinkerItem = { readonly kind: "ale_drinker"; readonly id: string; readonly stand: AleStand; readonly depth: number; readonly anchorTx: number };

const STEP_MS = 900;
const STAY_MS = 5_000;
const STAY_SPREAD_MS = 3_000;
const PERIOD_MS = 15_000;
const PERIOD_SPREAD_MS = 7_000;
const TURN_MS = 2_200;
const GAIT_MS = 260;
/** The longest a drinker is seen standing (the stay's upper bound). */
export const DRINKER_LONGEST_STAY_MS = STAY_MS + STAY_SPREAD_MS;
/** Stand spots on the door tile: `out` from the wall (0 at the wall, 1 at the tile's far edge), `along` the wall from its middle. */
const STANDS = [{ out: 0.55, along: -0.3 }, { out: 0.82, along: 0.08 }, { out: 0.5, along: 0.36 }] as const;

const facingOf = (dtx: number, dty: number): DrinkerFacing =>
  Math.abs(dtx) >= Math.abs(dty) ? (dtx >= 0 ? "SE" : "NW") : (dty >= 0 ? "SW" : "NE");

/** The drinkers' places at `building` (none when it is no alehouse in the boom, or has no barrels shown). */
export function alehouseStands(state: GameState, building: Building): readonly AleStand[] {
  const reorg = state.reorganisation;
  if (reorg?.alehouseBoomTick === undefined || reorg.endedTick !== undefined || building.kind !== "house") return [];
  const house = state.houses.find(candidate => candidate.buildingId === building.id);
  const barrels = house === undefined || !isAlehouse(house) ? null : aleBarrelPile(house);
  const spot = barrels === null ? null : brewingDoor(state, building.id);
  if (barrels === null || spot === null) return [];
  // The door tile and its face: the south-east face (x outward) or the south-west one (y outward), villageLife.ts.
  const southEast = Math.round(spot.x) === building.tx + buildingFootprint(building).width;
  const cell = { tx: Math.round(spot.x), ty: Math.round(spot.y) };
  const at = (out: number, along: number) => southEast
    ? { tx: cell.tx - 0.5 + out, ty: cell.ty + along } : { tx: cell.tx + along, ty: cell.ty - 0.5 + out };
  return STANDS.slice(0, Number(barrels.slice(-1))).map((stand, slot) => ({ id: `${building.id}:${slot}`, houseId: building.id, slot,
    foot: at(stand.out, stand.along), door: at(0.04, stand.along), middle: at(0.62, 0.05) }));
}

/** The drinker of `stand` at the village life clock `lifeMs`, or null while it is inside. */
export function aleDrinker(state: Pick<GameState, "seed">, stand: AleStand, lifeMs: number): AleDrinker | null {
  const hash = (salt: number) => boundaryHash(Math.round(stand.foot.tx * 97 + stand.foot.ty * 13) + stand.slot, state.seed, salt);
  const period = PERIOD_MS + hash(31) % PERIOD_SPREAD_MS;
  const stay = STAY_MS + hash(32) % STAY_SPREAD_MS;
  const t = ((lifeMs + hash(33) % period) % period + period) % period;
  if (t >= stay + 2 * STEP_MS) return null; // inside
  const key = stand.slot % 2 === 0 ? "wk_petitioner_m" : "wk_petitioner_f";
  if (t < STEP_MS || t >= STEP_MS + stay) {
    // Stepping out of the door to the spot, or back in.
    const outward = t < STEP_MS;
    const share = outward ? t / STEP_MS : (t - STEP_MS - stay) / STEP_MS;
    const [from, to] = outward ? [stand.door, stand.foot] : [stand.foot, stand.door];
    return { id: stand.id, key, tx: from.tx + (to.tx - from.tx) * share, ty: from.ty + (to.ty - from.ty) * share,
      facing: facingOf(to.tx - from.tx, to.ty - from.ty), gait: Math.floor(t / GAIT_MS) % 2, walking: true };
  }
  // Drinking: turned to the others, then to the door, by turns.
  const look = Math.floor((t - STEP_MS + hash(34) % TURN_MS) / TURN_MS) % 2 === 1 ? stand.door : stand.middle;
  return { id: stand.id, key, tx: stand.foot.tx, ty: stand.foot.ty, facing: facingOf(look.tx - stand.foot.tx, look.ty - stand.foot.ty), gait: 0, walking: false };
}

/** All the drinkers out at `building` at `lifeMs`. */
export function alehouseDrinkers(state: GameState, building: Building, lifeMs: number): readonly AleDrinker[] {
  return alehouseStands(state, building).flatMap(stand => aleDrinker(state, stand, lifeMs) ?? []);
}

// Cache (AGENTS rule 10): the town's stands, keyed on the houses, buildings and tiles arrays and the reorganisation
// (each replaced when it changes; the brewing door reads them and the persons), and the last merge, keyed on the
// incoming queue, those stands and the range. Reason: the object queue is built every frame.
let lastStands: { readonly key: readonly unknown[]; readonly items: readonly AleDrinkerItem[] } | null = null;
let lastMerge: { readonly queue: readonly RenderQueueItem[]; readonly items: readonly AleDrinkerItem[]; readonly range: string; readonly result: readonly RenderQueueItem[] } | null = null;

function drinkerItems(state: GameState): readonly AleDrinkerItem[] {
  const key = [state.houses, state.buildings, state.tiles, state.reorganisation, state.persons];
  if (lastStands !== null && lastStands.key.every((part, index) => part === key[index])) return lastStands.items;
  const items = state.buildings.flatMap(building => alehouseStands(state, building)).map(stand => ({ kind: "ale_drinker" as const, id: `ale:${stand.id}`, stand,
    depth: depthKey(stand.foot.tx, stand.foot.ty), anchorTx: stand.foot.tx })).sort((a, b) => a.depth - b.depth || a.id.localeCompare(b.id));
  lastStands = { key, items };
  return items;
}

/** The object queue with the view's drinkers' places merged in by depth (the box rule then places them, drawObjectRenderItems). */
export function withAlehouseCrowd(queue: readonly RenderQueueItem[], state: GameState, range: TileRange): readonly RenderQueueItem[] {
  const items = drinkerItems(state);
  if (items.length === 0) return queue;
  const rangeKey = `${range.minTx},${range.minTy},${range.maxTx},${range.maxTy}`;
  if (lastMerge !== null && lastMerge.queue === queue && lastMerge.items === items && lastMerge.range === rangeKey) return lastMerge.result;
  const shown = items.filter(item => tileIsVisibleInRange(Math.round(item.stand.foot.tx), Math.round(item.stand.foot.ty), range));
  const result: RenderQueueItem[] = [];
  let next = 0;
  for (const entry of queue) {
    while (next < shown.length && shown[next]!.depth < entry.depth) result.push(shown[next++]!);
    result.push(entry);
  }
  while (next < shown.length) result.push(shown[next++]!);
  lastMerge = { queue, items, range: rangeKey, result };
  return result;
}

const COLUMN: Readonly<Record<DrinkerFacing, number>> = { NE: 0, SE: 1, SW: 2, NW: 3 };

/** One place's drinker, drawn at its place in the object queue (nothing while it is inside). */
export function drawAleDrinker(context: CanvasRenderingContext2D, state: Pick<GameState, "seed">, item: AleDrinkerItem, lifeMs: number): void {
  const drinker = aleDrinker(state, item.stand, lifeMs);
  if (drinker === null) return;
  const image = wave9Art(drinker.key); const meta = wave9Meta(drinker.key);
  if (image === null || !("frames" in meta)) return;
  const scale = storyWalkerScale(drinker.key);
  const { width, height } = meta.frames;
  const foot = tileToScreen(drinker.tx, drinker.ty);
  drawCroppedWorldSprite(context, image, { x: COLUMN[drinker.facing] * width, y: drinker.gait * height, width, height },
    { x: foot.sx - meta.pivot.x * scale, y: foot.sy - meta.pivot.y * scale, width: width * scale, height: height * scale }, false, true);
}
