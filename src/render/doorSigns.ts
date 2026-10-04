import { YARD_RULES, type YardOccupationKind } from "../content/backyardConfig";
import type { Building } from "../content/buildingConfig";
import type { TradeId } from "../content/trades";
import type { GameState } from "../engine/engine.types";
import type { Person } from "../engine/persons.types";
import { stateCalendar } from "../engine/scenarioState";
import { lordMode } from "../engine/townAgency";
import { tradesOf } from "../engine/trades";
import { buildingFootprint } from "../geometry/buildingFootprint";
import type { TileCoordinate } from "../geometry/tileGeometry";
import type { House } from "../population/population.types";
import { getTile } from "../world/grid";
import { canTraverseWallBoundary } from "../world/wallTraversal";
import { yardHash, yardMoveIns, yardOccupation } from "./backyardDecals";
import { buildingFrontage } from "./buildingFrontage";
import { renderDetailLevel } from "./buildingVisualState";
import { houseFrontage } from "./houseFrontage";
import { depthKey, tileToScreen } from "./iso";
import { manifestArt } from "./manifestArt";
import type { ObjectRenderItem, RenderQueueItem } from "./objectRenderTypes";
import { tileIsVisibleInRange, type TileRange } from "./renderVisibility";
import { villageLifeCells } from "./villageLife";
import { WAVE37_DOOR_SIGNS, type Wave37DoorSignKey } from "./wave37DoorSignManifest.generated";

// LM-R1 (Wave 37, docs/ops/install-plan-20261003/SPECS/wave37.md): in lord mode each house may show one sign on its
// road side — its trade, or how the household is faring. Presentation only: read from the state, nothing saved, the same
// state gives the same signs (hashes of the house id, no Math.random). The sandbox and the campaign show none.
// Which sign (first match):
//  - none for an empty house (FP-3 `abandonedTick`, no residents, burnt);
//  - strained (the barrel or the firewood): FP-3 `foodShortSinceTick` or `leavingSinceTick` (the yard's "hungry");
//  - newcomer (the handcart): a household moved in within a season (history `person.move_in` / `person.resettled`);
//  - the trade: the household's LM-E6a trade (`GameState.trades`) when Wave 37 drew it, else its craft or a member's
//    trade (backyardDecals `yardOccupation`: brewing → ale, spinning → weaver, miller and granger → miller, sawyer and
//    woodward → carpenter, chapman and storekeeper → merchant). LM-E6a trades with no Wave 37 picture (butcher, tailor,
//    shoemaker, carter, fuller, cooper, wheelwright, mercer, spicer, vintner: the trade-world batch) and the farmer show
//    no trade sign; no engine trade names a shepherd or a fisher yet;
//  - prosperous (the pots, in winter only the bench: no flowers out) at house level 3 or more, else ordinary.
// Where: the road side is the one the house's door path runs to (houseFrontage; a two-cell lot: buildingFrontage's first
// path), and the sign stands on that road cell's verge before the house — FORWARD from the footprint cell's centre
// (between the footprint's edge and the road ribbon's edge), ACROSS to one side of the door path, toward a corner of the
// frontage (a lot: the corner at its row's end). A road toward the camera: the house id's hash picks the side; away from
// it (north-east, north-west): the +x / +y side first, which the house's painting does not hide. The road cell must be
// road (no building, water or rock), on the house's side of the wall and hold no village life spot; a frontage corner
// takes one sign (two neighbours never lean on the same corner). Neither side free: no sign.
// How many: about half the houses show none (the house id's hash, NAT-1's rule B); along one road line (houses facing
// the same road row, in order along it) a picture never stands three times in a row — the third takes its other
// picture (NAT-1's rule A, keeping the sign's meaning). A / B by the house id's hash per sign.
// Zoom: none at block detail; the circumstance props only from DOOR_SIGN_CONDITION_MIN_ZOOM (small at 0.6), the trade
// signs at every painted zoom. Never mirrored; no winter pictures exist, and none are snowed over.

type Sign = (typeof WAVE37_DOOR_SIGNS)[Wave37DoorSignKey]["sign"];
export type DoorSign = {
  readonly id: string;
  readonly buildingId: string;
  readonly key: Wave37DoorSignKey;
  readonly category: "trade" | "condition";
  /** The foot (tile-centre coordinates) and the cell it stands on. */
  readonly x: number;
  readonly y: number;
  readonly cell: TileCoordinate;
};
type Normal = { readonly tx: number; readonly ty: number };

/** Art px → world px: Astra's proof scale (0.45 of a 137 px house canvas whose art is ~118 px wide) on a house drawn 0.87 × 64 px wide. */
export const DOOR_SIGN_SCALE = 0.45 * (0.87 * 64) / 118;
export const DOOR_SIGN_CONDITION_MIN_ZOOM = 0.8;
const SALT_SHOWN = 37;
const SALT_VARIANT = 38;
const SALT_SIDE = 39;
/** The sign's foot from its footprint cell's centre: toward the road (the footprint edge is at 0.5, the ribbon's edge at
 * 1 - ROAD_RIBBON_WIDTH / 2 = 0.675) and along it (the door path is ~0.1 wide; the cell's corner at 0.5). */
const FORWARD = 0.6;
const ACROSS = 0.3;

/** LM-E6a trades Wave 37 drew (the rest: none). */
export const SIGN_BY_TRADE: Readonly<Partial<Record<TradeId, Sign>>> = {
  baker: "baker", brewer: "ale", miller: "miller", innkeeper: "inn", weaver: "weaver", smith: "smith", carpenter: "carpenter",
  merchant: "merchant", dyer: "dyer", tanner: "tanner",
};
/** LM-E6a trades with no Wave 37 picture (decided: no trade sign; the trade-world batch draws them). */
export const UNPICTURED_TRADES: readonly TradeId[] = ["butcher", "tailor", "shoemaker", "carter", "fuller", "cooper", "wheelwright", "mercer", "spicer", "vintner"];
/** The yard's occupations (craft or member's trade) → sign (the farmer: none). */
export const SIGN_BY_YARD_OCCUPATION: Readonly<Partial<Record<YardOccupationKind, Sign>>> = {
  baker: "baker", blacksmith: "smith", carpenter: "carpenter", weaver: "weaver", dyer: "dyer", tanner: "tanner", brewer: "ale",
  miller: "miller", merchant: "merchant", shepherd: "shepherd", fisher: "fisher",
};

export type DoorSignHousehold = {
  readonly house: Pick<House, "level" | "residents" | "abandonedTick" | "foodShortSinceTick" | "leavingSinceTick" | "burntTick" | "crafts" | "buildingId">;
  readonly members: readonly Pick<Person, "id" | "role" | "occupation">[];
  readonly trade: TradeId | null;
  readonly tick: number;
  readonly movedInTick: number | null;
};

/** The sign a household shows (see the header's order), or null. */
export function doorSignKind(input: DoorSignHousehold): Sign | null {
  const { house } = input;
  if (house.abandonedTick !== undefined || house.burntTick !== undefined || house.residents <= 0) return null;
  if (house.foodShortSinceTick !== undefined || house.leavingSinceTick !== undefined) return "strained";
  if (input.movedInTick !== null && input.tick - input.movedInTick < YARD_RULES.newcomerTicks) return "newcomer";
  const traded = input.trade === null ? undefined : SIGN_BY_TRADE[input.trade];
  if (traded !== undefined) return traded;
  const occupation = yardOccupation(house, input.members);
  const sign = occupation === null ? undefined : SIGN_BY_YARD_OCCUPATION[occupation];
  if (sign !== undefined) return sign;
  return house.level >= YARD_RULES.prosperousMinLevel ? "prosperous" : "ordinary";
}

const KEYS = Object.keys(WAVE37_DOOR_SIGNS) as Wave37DoorSignKey[];
/** The sign's picture: A / B by the house id (a fresh stream per sign); winter's prosperous house keeps its bench. */
export function doorSignKey(buildingId: string, sign: Sign, winter: boolean, other = false): Wave37DoorSignKey {
  const pair = KEYS.filter(key => WAVE37_DOOR_SIGNS[key].sign === sign).sort((a, b) => WAVE37_DOOR_SIGNS[a].variant.localeCompare(WAVE37_DOOR_SIGNS[b].variant));
  if (sign === "prosperous" && winter) return pair.find(key => key === "condition_prosperous_bench")!;
  const at = (yardHash(`${buildingId}|${sign}`, SALT_VARIANT) + (other ? 1 : 0)) % pair.length;
  return pair[at]!;
}

/** The house's road side: the way its door path runs (null: no road beside it). */
export function doorSignFront(state: GameState, building: Building): Normal | null {
  const size = buildingFootprint(building);
  if (size.width === 1 && size.height === 1) {
    const tile = getTile(state, building);
    const road = tile === null ? null : houseFrontage(state, tile, state.seed)?.road ?? null;
    return road === null ? null : { tx: road.tx - building.tx, ty: road.ty - building.ty };
  }
  const road = buildingFrontage(state, building, state.seed)?.paths[0]?.road;
  if (road === undefined) return null;
  const tx = Math.max(building.tx, Math.min(road.tx, building.tx + size.width - 1));
  const ty = Math.max(building.ty, Math.min(road.ty, building.ty + size.height - 1));
  return { tx: road.tx - tx, ty: road.ty - ty };
}

/** Every house-front sign in the town, in id order of the houses (see the header's rules). */
export function doorSigns(state: GameState, moveIns = yardMoveIns(state)): readonly DoorSign[] {
  if (!lordMode(state)) return [];
  const { width, height, tiles } = state;
  const index = (cell: TileCoordinate) => cell.ty * width + cell.tx;
  const lifeCells = villageLifeCells(state);
  // Taken spots: the frontage corners (lattice vertices, doubled to integers) a sign already leans on.
  const corners = new Set<string>();
  const tileAt = (tx: number, ty: number) => tx < 0 || ty < 0 || tx >= width || ty >= height ? undefined : tiles[ty * width + tx];
  const winter = stateCalendar(state).season === YARD_RULES.winterSeason;
  const houses = new Map(state.houses.map(house => [house.buildingId, house]));
  const trades = new Map(tradesOf(state).households.map(household => [household.houseId, household.tradeId]));
  const members = new Map<string, Person[]>();
  for (const person of state.persons?.people ?? []) {
    if (!person.alive) continue;
    const list = members.get(person.householdId);
    if (list === undefined) members.set(person.householdId, [person]); else list.push(person);
  }
  type Placed = { readonly sign: Sign; readonly building: Building; readonly line: string; readonly along: number; readonly at: DoorSign };
  const placed: Placed[] = [];
  for (const building of state.buildings.filter(entry => entry.kind === "house").sort((a, b) => a.id.localeCompare(b.id))) {
    const house = houses.get(building.id);
    if (house === undefined || yardHash(building.id, SALT_SHOWN) % 2 === 1) continue;
    const sign = doorSignKind({ house, members: members.get(building.id) ?? [], trade: trades.get(building.id) ?? null, tick: state.tick,
      movedInTick: moveIns.get(building.id) ?? null });
    const front = sign === null ? null : doorSignFront(state, building);
    if (sign === null || front === null) continue;
    const { width: w, height: h } = buildingFootprint(building);
    const along: Normal = front.ty !== 0 ? { tx: 1, ty: 0 } : { tx: 0, ty: 1 };
    // The footprint's road-side row, and the cell beyond each end of it.
    const row = front.ty !== 0
      ? { first: { tx: building.tx, ty: front.ty > 0 ? building.ty + h - 1 : building.ty }, last: { tx: building.tx + w - 1, ty: front.ty > 0 ? building.ty + h - 1 : building.ty } }
      : { first: { tx: front.tx > 0 ? building.tx + w - 1 : building.tx, ty: building.ty }, last: { tx: front.tx > 0 ? building.tx + w - 1 : building.tx, ty: building.ty + h - 1 } };
    const ends = [{ from: row.first, sign: -1 }, { from: row.last, sign: 1 }];
    // A road toward the camera: the house id's hash picks the end; away from it (north-east, north-west): the +x / +y
    // end first, the one the house's own painting does not hide.
    if (front.tx + front.ty < 0 || yardHash(building.id, SALT_SIDE) % 2 === 1) ends.reverse();
    for (const end of ends) {
      const cell = { tx: end.from.tx + front.tx, ty: end.from.ty + front.ty };
      const road = tileAt(cell.tx, cell.ty);
      const corner = `${2 * end.from.tx + front.tx + along.tx * end.sign},${2 * end.from.ty + front.ty + along.ty * end.sign}`;
      if (road === undefined || !road.hasRoad || road.buildingId !== null || road.terrain === "water" || road.terrain === "rock"
        || lifeCells.has(index(cell)) || corners.has(corner) || !canTraverseWallBoundary(state, end.from, cell)) continue;
      corners.add(corner);
      // On the road cell's verge before the house (the ribbon's edge is ROAD_RIBBON_WIDTH / 2 from its centreline),
      // beside the door path, toward the frontage's corner.
      const x = end.from.tx + front.tx * FORWARD + along.tx * end.sign * ACROSS, y = end.from.ty + front.ty * FORWARD + along.ty * end.sign * ACROSS;
      const line = `${front.tx},${front.ty},${front.ty !== 0 ? cell.ty : cell.tx}`;
      placed.push({ sign, building, line, along: front.ty !== 0 ? x : y,
        at: { id: `door-sign:${building.id}`, buildingId: building.id, key: doorSignKey(building.id, sign, winter),
          category: sign === "prosperous" || sign === "ordinary" || sign === "strained" || sign === "newcomer" ? "condition" : "trade", x, y, cell } });
      break;
    }
  }
  // Rule A: along one road line, never the same picture three times in a row (the third takes its other picture).
  const lines = new Map<string, Placed[]>();
  for (const entry of placed) lines.set(entry.line, [...(lines.get(entry.line) ?? []), entry]);
  const signs: DoorSign[] = [];
  for (const line of lines.values()) {
    line.sort((a, b) => a.along - b.along || a.building.id.localeCompare(b.building.id));
    const shown: Wave37DoorSignKey[] = [];
    for (const entry of line) {
      let key = entry.at.key;
      if (shown.length >= 2 && shown[shown.length - 1] === key && shown[shown.length - 2] === key) key = doorSignKey(entry.building.id, entry.sign, winter, true);
      // A sign with one picture (winter's prosperous bench) shows nothing the third time.
      if (shown.length >= 2 && shown[shown.length - 1] === key && shown[shown.length - 2] === key) continue;
      shown.push(key);
      signs.push({ ...entry.at, key });
    }
  }
  return signs.sort((a, b) => a.buildingId.localeCompare(b.buildingId));
}

// Cache (AGENTS rule 10): (a) the signs are keyed on the buildings, tiles, palisade, houses, persons, history and
// trades arrays, the agency (lord mode), the seed, the winter flag and the village life cells (the same set while its
// town holds), and they hold until the earliest newcomer's season runs out (the tick reaches the choice only there);
// (b) nothing else is read; (c) why: the object queue asks every frame, and the plan walks every house's road side.
type Key = readonly unknown[];
let lastPlan: { readonly key: Key; readonly from: number; readonly until: number; readonly signs: readonly DoorSign[] } | null = null;
const sameKey = (a: Key, b: Key) => a.length === b.length && a.every((value, at) => value === b[at]);

/** doorSigns through the cache above. */
export function doorSignPlan(state: GameState): readonly DoorSign[] {
  if (!lordMode(state)) return [];
  const winter = stateCalendar(state).season === YARD_RULES.winterSeason;
  const key: Key = [state.buildings, state.tiles, state.palisade, state.houses, state.persons, state.history, state.trades, state.agency,
    state.seed, winter, villageLifeCells(state)];
  if (lastPlan !== null && sameKey(lastPlan.key, key) && state.tick >= lastPlan.from && state.tick < lastPlan.until) return lastPlan.signs;
  const moveIns = yardMoveIns(state);
  let until = Infinity;
  for (const tick of moveIns.values()) if (state.tick - tick < YARD_RULES.newcomerTicks) until = Math.min(until, tick + YARD_RULES.newcomerTicks);
  lastPlan = { key, from: state.tick, until, signs: doorSigns(state, moveIns) };
  return lastPlan.signs;
}

type DoorSignItem = Extract<ObjectRenderItem, { readonly kind: "door_sign" }>;
const compare = (a: RenderQueueItem, b: RenderQueueItem) => a.depth - b.depth || a.anchorTx - b.anchorTx || a.id.localeCompare(b.id);
// Cache: the last merge, keyed on the incoming queue, the sign plan (cached above) and the visible range; an unchanged
// frame returns the same queue (no sort, no merge).
let lastMerge: { readonly queue: readonly RenderQueueItem[]; readonly signs: readonly DoorSign[]; readonly range: string; readonly result: readonly RenderQueueItem[] } | null = null;

/** The object queue with the visible house-front signs merged in by depth (the queue is sorted, so is the result). */
export function withDoorSigns(queue: readonly RenderQueueItem[], state: GameState, range: TileRange): readonly RenderQueueItem[] {
  const signs = doorSignPlan(state);
  if (signs.length === 0) return queue;
  const rangeKey = `${range.minTx},${range.minTy},${range.maxTx},${range.maxTy},${range.minDepth ?? ""},${range.maxDepth ?? ""},${range.minDiagonal ?? ""},${range.maxDiagonal ?? ""}`;
  if (lastMerge !== null && lastMerge.queue === queue && lastMerge.signs === signs && lastMerge.range === rangeKey) return lastMerge.result;
  const items: DoorSignItem[] = signs.filter(sign => tileIsVisibleInRange(sign.cell.tx, sign.cell.ty, range))
    .map(sign => ({ kind: "door_sign" as const, id: sign.id, sign, depth: depthKey(sign.x, sign.y), anchorTx: sign.cell.tx })).sort(compare);
  const result: RenderQueueItem[] = [];
  let left = 0; let right = 0;
  while (left < queue.length || right < items.length) {
    const a = queue[left]; const b = items[right];
    if (b === undefined || (a !== undefined && compare(a, b) <= 0)) { if (a !== undefined) result.push(a); left += 1; } else { result.push(b); right += 1; }
  }
  lastMerge = { queue, signs, range: rangeKey, result };
  return result;
}

const signArt = manifestArt<Wave37DoorSignKey>(WAVE37_DOOR_SIGNS);

/** Whether a sign draws at this zoom (see the header). */
export function doorSignDrawnAt(sign: Pick<DoorSign, "category">, zoom: number): boolean {
  return renderDetailLevel(zoom) !== "blocks" && (sign.category === "trade" || zoom >= DOOR_SIGN_CONDITION_MIN_ZOOM);
}

/** One sign, its foot (Astra's ground contact) on its spot; nothing until the picture has loaded (a missing file: never). */
export function drawDoorSign(context: CanvasRenderingContext2D, sign: DoorSign, zoom: number): void {
  if (!doorSignDrawnAt(sign, zoom)) return;
  const foot = tileToScreen(sign.x, sign.y);
  signArt.draw(context, sign.key, foot.sx, foot.sy, DOOR_SIGN_SCALE);
}
