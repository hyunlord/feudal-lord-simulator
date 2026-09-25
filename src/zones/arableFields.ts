/**
 * Arable fields (spec `docs/design/arable-fields.md`, AF-1…AF-11): strip layout, the crop calendar, farmstead
 * labour and the harvest into the farmstead's barn. Everything here is deterministic integer arithmetic on
 * saved state (`arableFields`, save v10) plus the calendar; layouts and tending are derived and unsaved.
 */
import { ARABLE_CONFIG } from "../content/arableConfig";
import { BALANCE } from "../content/balanceConfig";
import { BUILDING_CONFIG_BY_KIND, type Building } from "../content/buildingConfig";
import { availableSpace } from "../economy/storage";
import type { GameState } from "../engine/engine.types";
import { buildingHasRequiredRoadAccess } from "../engine/roadAccess";
import type { TileCoordinate } from "../geometry/tileGeometry";
import type { ArableField, ArableStage, ArableStripRecord } from "./arable.types";
import { zonesOf } from "./zoneEdits";
import { cellCoordinate } from "./zoneRaster";
import type { Zone } from "./zone.types";

const YEAR = BALANCE.TICKS_PER_YEAR;

// ─── Calendar (AF-4) ────────────────────────────────────────────────────────────────────────────────────

export function inYearTick(tick: number): number {
  return ((tick % YEAR) + YEAR) % YEAR;
}

export function isWinter(tick: number): boolean {
  return inYearTick(tick) >= ARABLE_CONFIG.winterFrom;
}

/** Ploughing and sowing: late winter, spring and early summer (the window wraps the year end). */
export function inFieldWorkWindow(tick: number): boolean {
  const t = inYearTick(tick);
  return t >= ARABLE_CONFIG.fieldWorkFrom || t < ARABLE_CONFIG.fieldWorkUntil;
}

/** Non-winter ticks in [0, n). */
function growingTicksBefore(n: number): number {
  return Math.floor(n / YEAR) * ARABLE_CONFIG.winterFrom + Math.min(inYearTick(n), ARABLE_CONFIG.winterFrom);
}

/** Growing ticks (winter excluded) a crop sown at `sownTick` has had by `tick`. */
export function growthTicks(sownTick: number, tick: number): number {
  return Math.max(0, growingTicksBefore(tick) - growingTicksBefore(sownTick));
}

/** The tick this winter began, or null outside winter. */
function winterStartTick(tick: number): number | null {
  const t = inYearTick(tick);
  return t >= ARABLE_CONFIG.winterFrom ? tick - (t - ARABLE_CONFIG.winterFrom) : null;
}

/** First tick at or after `tick` where the in-year tick equals `target`. */
export function nextInYearTick(tick: number, target: number): number {
  const delta = ((target - inYearTick(tick)) % YEAR + YEAR) % YEAR;
  return tick + delta;
}

// ─── Layout (AF-2) ──────────────────────────────────────────────────────────────────────────────────────

export interface ArableLayoutStrip {
  readonly id: string;
  readonly zoneId: string;
  /** Cells in order along the axis. */
  readonly cells: readonly TileCoordinate[];
  /** Σ per-cell yield weight: 1000 for an inner cell, `headlandPermille` for a headland cell (AF-6). */
  readonly weightPermille: number;
  readonly headlandCells: number;
}

export interface ArableZoneLayout {
  readonly zoneId: string;
  readonly axis: "x" | "y";
  readonly strips: readonly ArableLayoutStrip[];
}

type LayoutWorld = Pick<GameState, "width" | "height" | "tiles" | "zones" | "arableFields">;

function mainAxis(cells: readonly TileCoordinate[]): "x" | "y" {
  if (cells.length === 0) return "x";
  let minX = Infinity; let maxX = -Infinity; let minY = Infinity; let maxY = -Infinity;
  for (const cell of cells) {
    minX = Math.min(minX, cell.tx); maxX = Math.max(maxX, cell.tx);
    minY = Math.min(minY, cell.ty); maxY = Math.max(maxY, cell.ty);
  }
  return maxX - minX >= maxY - minY ? "x" : "y";
}

/** Axis a new field takes: the longer side of the zone's bounding box (`x` on a tie), as in C1c Z-18. */
export function zoneMainAxis(zone: Pick<Zone, "membership">, width: number): "x" | "y" {
  return mainAxis(zone.membership.map(index => cellCoordinate(width, index)));
}

/**
 * AF-1: a member cell grows crops when it is open land (grass or woodland) with no road and no building or
 * construction site (both mark `tile.buildingId`). The wall rule (Z-9) governs painting: arable is never painted
 * inside the wall, but a field a later wall encloses keeps being worked, as the old wheat farms were.
 */
export function cultivableArableCell(state: LayoutWorld, index: number): boolean {
  const tile = state.tiles[index];
  if (tile === undefined || tile.hasRoad || tile.buildingId !== null) return false;
  return tile.terrain === "grass" || tile.terrain === "forest";
}

function zoneLayout(state: LayoutWorld, zone: Zone, axis: "x" | "y"): ArableZoneLayout {
  const open = new Set(zone.membership.filter(index => cultivableArableCell(state, index)));
  const width = state.width;
  const inField = (tx: number, ty: number) => tx >= 0 && ty >= 0 && tx < width && ty < state.height && open.has(ty * width + tx);
  const lines = new Map<number, TileCoordinate[]>();
  for (const index of open) {
    const cell = cellCoordinate(width, index);
    const line = axis === "x" ? cell.ty : cell.tx;
    const list = lines.get(line) ?? [];
    list.push(cell);
    lines.set(line, list);
  }
  const along = (cell: TileCoordinate) => axis === "x" ? cell.tx : cell.ty;
  const strips: ArableLayoutStrip[] = [];
  for (const line of [...lines.keys()].sort((a, b) => a - b)) {
    const ordered = lines.get(line)!.sort((a, b) => along(a) - along(b));
    let run: TileCoordinate[] = [];
    const flush = () => {
      if (run.length === 0) return;
      let weight = 0;
      let headland = 0;
      for (const cell of run) {
        const edge = !inField(cell.tx - 1, cell.ty) || !inField(cell.tx + 1, cell.ty)
          || !inField(cell.tx, cell.ty - 1) || !inField(cell.tx, cell.ty + 1);
        if (edge) headland += 1;
        weight += edge ? ARABLE_CONFIG.headlandPermille : 1000;
      }
      strips.push({ id: `${zone.id}:${axis}${line}:${along(run[0]!)}`, zoneId: zone.id, cells: run, weightPermille: weight, headlandCells: headland });
      run = [];
    };
    for (const cell of ordered) {
      const last = run[run.length - 1];
      if (last !== undefined && along(cell) !== along(last) + 1) flush();
      run.push(cell);
    }
    flush();
  }
  return { zoneId: zone.id, axis, strips };
}

/**
 * Cache (rule 10). (a) Key: the identities of `tiles` and `zones`, and the fields' fixed axes as a string.
 * (b) Nothing else feeds the layout: cultivability reads only tiles (a construction site marks its tiles too), and
 * the axis only the field records. (c) Measured in the C1c-2
 * report (tick bench): without it every tick re-rasterised every field.
 */
let layoutMemo: { tiles: unknown; zones: unknown; axes: string; value: readonly ArableZoneLayout[] } | null = null;

export function arableLayouts(state: LayoutWorld): readonly ArableZoneLayout[] {
  const zones = zonesOf(state).filter(zone => zone.kind === "arable");
  if (zones.length === 0) return [];
  const fields = state.arableFields ?? [];
  const axes = fields.map(field => `${field.zoneId}${field.axis}`).join(",");
  if (layoutMemo !== null && layoutMemo.tiles === state.tiles && layoutMemo.zones === state.zones
    && layoutMemo.axes === axes) return layoutMemo.value;
  const byZone = new Map(fields.map(field => [field.zoneId, field.axis]));
  const value = [...zones].sort((a, b) => a.id.localeCompare(b.id))
    .map(zone => zoneLayout(state, zone, byZone.get(zone.id) ?? zoneMainAxis(zone, state.width)));
  layoutMemo = { tiles: state.tiles, zones: state.zones, axes, value };
  return value;
}

// ─── Yield (AF-6) ───────────────────────────────────────────────────────────────────────────────────────

/** Wheat a strip gives at harvest: Σ cell weight × base × completion × fertility (all ‰), rounded down. */
export function stripYield(strip: Pick<ArableLayoutStrip, "weightPermille">, record: Pick<ArableStripRecord, "fertilityPermille">, completionPermille: number): number {
  return Math.floor(strip.weightPermille * ARABLE_CONFIG.baseYieldPerCell * completionPermille * record.fertilityPermille / 1_000_000_000);
}

/** Wheat a strip gives in a full season (prediction; AF-10). */
export function stripSeasonYield(strip: Pick<ArableLayoutStrip, "weightPermille">, fertilityPermille: number = ARABLE_CONFIG.initialFertilityPermille): number {
  return stripYield(strip, { fertilityPermille }, 1000);
}

// ─── Tending (AF-8) ─────────────────────────────────────────────────────────────────────────────────────

export type TendingStatus = "tended" | "no_farmstead" | "farmstead_no_road";
export interface StripTending {
  readonly status: TendingStatus;
  readonly farmsteadId: string | null;
}

function attached(zone: Zone, building: Building, width: number, height: number): boolean {
  const members = new Set(zone.membership);
  const { width: w, height: h } = BUILDING_CONFIG_BY_KIND[building.kind];
  for (let dy = 0; dy < h; dy += 1) {
    for (let dx = 0; dx < w; dx += 1) {
      const tx = building.tx + dx;
      const ty = building.ty + dy;
      for (const [nx, ny] of [[tx, ty], [tx - 1, ty], [tx + 1, ty], [tx, ty - 1], [tx, ty + 1]] as const) {
        if (nx >= 0 && ny >= 0 && nx < width && ny < height && members.has(ny * width + nx)) return true;
      }
    }
  }
  return false;
}

function distanceTo(building: Building, cells: readonly TileCoordinate[]): number {
  let best = Infinity;
  for (const cell of cells) best = Math.min(best, Math.abs(cell.tx - building.tx) + Math.abs(cell.ty - building.ty));
  return best;
}

type TendingWorld = GameState;

/**
 * Cache (rule 10). (a) Key: the layout array identity, `tiles` identity (road access) and each farmstead's id and
 * position. (b) Workers, stock and pause state change what a farmstead does, not which strips it tends.
 * (c) See the C1c-2 report tick bench.
 */
let tendingMemo: { layouts: unknown; tiles: unknown; farmsteads: string; value: ReadonlyMap<string, StripTending> } | null = null;

/** AF-8: each strip is tended by the nearest farmstead that stands in or beside its zone or within `tendRadius`. */
export function stripTending(state: TendingWorld, layouts: readonly ArableZoneLayout[] = arableLayouts(state)): ReadonlyMap<string, StripTending> {
  const farmsteads = state.buildings.filter(building => building.kind === "farmstead").sort((a, b) => a.id.localeCompare(b.id));
  const farmsteadKey = farmsteads.map(building => `${building.id}@${building.tx},${building.ty}`).join(";");
  if (tendingMemo !== null && tendingMemo.layouts === layouts && tendingMemo.tiles === state.tiles && tendingMemo.farmsteads === farmsteadKey) return tendingMemo.value;
  const zones = new Map(zonesOf(state).map(zone => [zone.id, zone]));
  const roads = new Map(farmsteads.map(building => [building.id, buildingHasRequiredRoadAccess(state, building)]));
  const value = new Map<string, StripTending>();
  for (const layout of layouts) {
    const zone = zones.get(layout.zoneId);
    const beside = zone === undefined ? new Set<string>() : new Set(farmsteads.filter(building => attached(zone, building, state.width, state.height)).map(building => building.id));
    for (const strip of layout.strips) {
      let best: { building: Building; distance: number } | null = null;
      for (const building of farmsteads) {
        const distance = distanceTo(building, strip.cells);
        if (!beside.has(building.id) && distance > ARABLE_CONFIG.tendRadius) continue;
        if (best === null || distance < best.distance) best = { building, distance };
      }
      if (best === null) value.set(strip.id, { status: "no_farmstead", farmsteadId: null });
      else value.set(strip.id, { status: roads.get(best.building.id) === true ? "tended" : "farmstead_no_road", farmsteadId: best.building.id });
    }
  }
  tendingMemo = { layouts, tiles: state.tiles, farmsteads: farmsteadKey, value };
  return value;
}

// ─── Records ────────────────────────────────────────────────────────────────────────────────────────────

function fallowRecord(strip: ArableLayoutStrip, tick: number): ArableStripRecord {
  return { id: strip.id, cells: strip.cells.length, crop: "wheat", stage: "fallow", stageTick: tick,
    fertilityPermille: ARABLE_CONFIG.initialFertilityPermille, work: 0 };
}

function withStage(record: ArableStripRecord, stage: ArableStage, tick: number, extra: Partial<ArableStripRecord> = {}): ArableStripRecord {
  const { sownTick: _sown, completionPermille: _completion, ...rest } = record;
  return { ...rest, stage, stageTick: tick, work: 0, ...extra };
}

/** AF-3: lays out every arable zone and keeps each strip's record while its id and length hold. */
export function reconcileArableFields(state: GameState, layouts: readonly ArableZoneLayout[] = arableLayouts(state)): readonly ArableField[] {
  const fields = state.arableFields ?? [];
  const existing = new Map(fields.map(field => [field.zoneId, field]));
  let changed = false;
  const next: ArableField[] = [];
  for (const layout of layouts) {
    const field = existing.get(layout.zoneId);
    if (field === undefined && layout.strips.length === 0) continue;
    const previous = new Map((field?.strips ?? []).map(record => [record.id, record]));
    let stripsChanged = field === undefined || field.strips.length !== layout.strips.length;
    const strips = layout.strips.map((strip, index) => {
      const record = previous.get(strip.id);
      if (record !== undefined && record.cells === strip.cells.length) {
        if (field?.strips[index] !== record) stripsChanged = true;
        return record;
      }
      stripsChanged = true;
      return fallowRecord(strip, state.tick);
    });
    const current = field === undefined ? { zoneId: layout.zoneId, axis: layout.axis, strips, harvestedWheat: 0, lostWheat: 0 }
      : stripsChanged ? { ...field, strips } : field;
    if (current !== fields[next.length]) changed = true;
    next.push(current);
  }
  if (next.length !== fields.length) changed = true;
  return changed ? next : fields;
}

/** AF-4: the calendar part of a strip's stage (growth, forced ripening, winter). Returns the lost wheat too. */
function seasonalRecord(record: ArableStripRecord, strip: ArableLayoutStrip, tick: number): { record: ArableStripRecord; lost: number } {
  const winterStart = winterStartTick(tick);
  if (winterStart !== null && record.stage !== "fallow" && record.stageTick < winterStart) {
    const lost = record.stage === "ripe" ? stripYield(strip, record, record.completionPermille ?? 1000) : 0;
    return { record: withStage(record, "fallow", tick), lost };
  }
  if ((record.stage === "sown" || record.stage === "growing") && record.sownTick !== undefined) {
    const grown = growthTicks(record.sownTick, tick);
    const t = inYearTick(tick);
    if (grown >= ARABLE_CONFIG.growTicks || (t >= ARABLE_CONFIG.forcedRipeFrom && t < ARABLE_CONFIG.winterFrom)) {
      const completionPermille = Math.min(1000, Math.floor(grown * 1000 / ARABLE_CONFIG.growTicks));
      return { record: withStage(record, "ripe", tick, { sownTick: record.sownTick, completionPermille }), lost: 0 };
    }
    if (record.stage === "sown" && grown >= ARABLE_CONFIG.growingAt) {
      return { record: { ...record, stage: "growing", stageTick: tick }, lost: 0 };
    }
  }
  return { record, lost: 0 };
}

type Task = "harvest" | "sow" | "plough";

function taskOf(record: ArableStripRecord, tick: number): Task | null {
  if (record.stage === "ripe") return "harvest";
  if (!inFieldWorkWindow(tick)) return null;
  if (record.stage === "ploughed") return "sow";
  if (record.stage === "fallow") return "plough";
  return null;
}

const TASK_ORDER: Readonly<Record<Task, number>> = { harvest: 0, sow: 1, plough: 2 };

export interface ArableStepActivity {
  readonly harvestedWheat: number;
  readonly lostWheat: number;
}

/**
 * One tick of every field (AF-3…AF-9): lay out and reconcile, apply the calendar, then spend each farmstead's
 * workers (one worker-tick each) on its strips — harvests first, then sowing, then ploughing, each in layout
 * order. A finished harvest goes into the farmstead's barn; with too little barn space it waits (AF-9).
 */
export function stepArableFields(state: GameState): { readonly state: GameState; readonly activity: ArableStepActivity } {
  const idle = { state, activity: { harvestedWheat: 0, lostWheat: 0 } };
  if (!zonesOf(state).some(zone => zone.kind === "arable") && (state.arableFields ?? []).length === 0) return idle;
  const layouts = arableLayouts(state);
  const reconciled = reconcileArableFields(state, layouts);
  const layoutById = new Map<string, ArableLayoutStrip>();
  for (const layout of layouts) for (const strip of layout.strips) layoutById.set(strip.id, strip);
  let lostWheat = 0;
  let harvestedWheat = 0;
  const fields = reconciled.map(field => {
    let strips: ArableStripRecord[] | null = null;
    let lost = 0;
    for (let index = 0; index < field.strips.length; index += 1) {
      const record = field.strips[index]!;
      const strip = layoutById.get(record.id);
      if (strip === undefined) continue;
      const seasonal = seasonalRecord(record, strip, state.tick);
      if (seasonal.record === record) continue;
      strips ??= [...field.strips];
      strips[index] = seasonal.record;
      lost += seasonal.lost;
    }
    lostWheat += lost;
    return strips === null ? field : { ...field, strips, lostWheat: field.lostWheat + lost };
  });

  const tending = stripTending(state, layouts);
  const work = new Map<string, { field: number; strip: number; task: Task }[]>();
  fields.forEach((field, fieldIndex) => field.strips.forEach((record, stripIndex) => {
    const task = taskOf(record, state.tick);
    const assigned = tending.get(record.id);
    if (task === null || assigned?.status !== "tended" || assigned.farmsteadId === null) return;
    const list = work.get(assigned.farmsteadId) ?? [];
    list.push({ field: fieldIndex, strip: stripIndex, task });
    work.set(assigned.farmsteadId, list);
  }));

  let buildings = state.buildings;
  const touched = new Map<number, ArableStripRecord[]>();
  const fieldTotals = new Map<number, number>();
  const recordAt = (fieldIndex: number, stripIndex: number) => (touched.get(fieldIndex) ?? fields[fieldIndex]!.strips)[stripIndex]!;
  const setRecord = (fieldIndex: number, stripIndex: number, record: ArableStripRecord) => {
    const list = touched.get(fieldIndex) ?? [...fields[fieldIndex]!.strips];
    list[stripIndex] = record;
    touched.set(fieldIndex, list);
  };
  for (const farmsteadId of [...work.keys()].sort()) {
    const buildingIndex = buildings.findIndex(building => building.id === farmsteadId);
    let farmstead = buildings[buildingIndex];
    if (farmstead === undefined) continue;
    let budget = Math.max(0, farmstead.workers);
    if (budget === 0) continue;
    const tasks = work.get(farmsteadId)!.sort((a, b) => TASK_ORDER[a.task] - TASK_ORDER[b.task] || a.field - b.field || a.strip - b.strip);
    for (const entry of tasks) {
      if (budget === 0) break;
      const record = recordAt(entry.field, entry.strip);
      const strip = layoutById.get(record.id)!;
      const required = record.cells * ARABLE_CONFIG.workPerCell[entry.task];
      const spent = Math.min(budget, Math.max(0, required - record.work));
      budget -= spent;
      const done = record.work + spent;
      if (done < required) {
        setRecord(entry.field, entry.strip, { ...record, work: done });
        continue;
      }
      if (entry.task === "plough") setRecord(entry.field, entry.strip, withStage(record, "ploughed", state.tick));
      else if (entry.task === "sow") setRecord(entry.field, entry.strip, withStage(record, "sown", state.tick, { sownTick: state.tick }));
      else {
        const amount = stripYield(strip, record, record.completionPermille ?? 1000);
        if (amount > availableSpace(farmstead, BUILDING_CONFIG_BY_KIND.farmstead)) {
          if (record.work !== required) setRecord(entry.field, entry.strip, { ...record, work: required });
          continue;
        }
        farmstead = { ...farmstead, inventory: { ...farmstead.inventory, wheat: (farmstead.inventory.wheat ?? 0) + amount } };
        setRecord(entry.field, entry.strip, withStage(record, "harvested", state.tick));
        harvestedWheat += amount;
        fieldTotals.set(entry.field, (fieldTotals.get(entry.field) ?? 0) + amount);
      }
    }
    if (farmstead !== buildings[buildingIndex]) {
      buildings = [...buildings];
      buildings[buildingIndex] = farmstead;
    }
  }
  const finalFields = touched.size === 0 && fieldTotals.size === 0 ? fields : fields.map((field, index) => {
    const strips = touched.get(index);
    const added = fieldTotals.get(index) ?? 0;
    return strips === undefined && added === 0 ? field
      : { ...field, ...(strips === undefined ? {} : { strips }), harvestedWheat: field.harvestedWheat + added };
  });
  const unchanged = finalFields.length === (state.arableFields ?? []).length
    && finalFields.every((field, index) => field === state.arableFields?.[index]);
  if (unchanged && buildings === state.buildings) return idle;
  return { state: { ...state, buildings, ...(unchanged ? {} : { arableFields: finalFields }) }, activity: { harvestedWheat, lostWheat } };
}
