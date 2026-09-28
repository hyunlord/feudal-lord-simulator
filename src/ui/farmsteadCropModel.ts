import { ARABLE_CONFIG } from "../content/arableConfig";
import { BALANCE } from "../content/balanceConfig";
import { FIELD_CROPS, type FieldCrop } from "../content/buildingConfig";
import { resourceName } from "../content/resourceCatalog.ko";
import type { GameState } from "../engine/engine.types";
import { scenarioOf } from "../engine/scenarioState";
import { farmsteadCropLock } from "../engine/ale";
import { arableLayouts, inFieldWorkWindow, inYearTick, reconcileArableFields, stripTending } from "../zones/arableFields";
import type { GameAction } from "../state/gameStore.types";
import { calendarArrivalLabel } from "./calendarArrival";
import { FARMSTEAD_CROP_COPY } from "./farmsteadCropCopy.ko";

// INSTALL-3: the barn card's crop choice. The engine command `set_farmstead_crop` (src/engine/ale.ts) changes the crop
// the barn sows from then on; ECON-UI: barley waits for the malt kiln (FIX-7 `farmsteadCropLock`, before the market
// town) — the choice is then disabled with the engine's reason while the barn is in wheat (a barn already in barley can
// still go back to wheat, which is always allowed); a strip takes its barn's crop when it is sown
// (src/zones/arableFields.ts, the `sow` task), so strips already sown, growing or ripe keep theirs until harvested,
// and the barn carts out what it holds of the other crop first (`fieldOutputResource`). Read-only over those rules.
export type FarmsteadCropModel = Readonly<{
  buildingId: string;
  crop: FieldCrop;
  options: readonly { readonly value: FieldCrop; readonly label: string }[];
  label: string;
  current: string;
  note: string;
  sowing: string;
  /** Strips of this barn still in the other crop (sown, growing or ripe), null when none. */
  pending: string | null;
  /** The other crop still in the barn (carted out first), null when none. */
  carting: string | null;
  /** ECON-UI: why barley cannot be chosen yet (the engine's reason), null when it can. */
  locked: string | null;
  /** The choice has nothing to change to (barley locked and the barn in wheat). */
  disabled: boolean;
}>;

const IN_GROUND = new Set(["sown", "growing", "ripe"]);
const YEAR = BALANCE.TICKS_PER_YEAR;

function sowingLine(state: GameState): string {
  // The first year's spring and summer sow to `firstYearFieldWorkUntil` (FIX-4 E4); every other window is the usual one.
  const firstYear = state.tick >= 0 && state.tick < YEAR && inYearTick(state.tick) < ARABLE_CONFIG.firstYearFieldWorkUntil;
  if (inFieldWorkWindow(state.tick)) return FARMSTEAD_CROP_COPY.sowingNow(firstYear ? FARMSTEAD_CROP_COPY.firstYearUntil : FARMSTEAD_CROP_COPY.until);
  // Outside the window the next one opens at `fieldWorkFrom` this year (the window wraps the year end).
  const opens = state.tick - inYearTick(state.tick) + ARABLE_CONFIG.fieldWorkFrom;
  return FARMSTEAD_CROP_COPY.sowingNext(calendarArrivalLabel(state.tick, opens, scenarioOf(state).startYear), FARMSTEAD_CROP_COPY.until);
}

/** The strips this barn tends whose crop in the ground is not its crop. */
function stripsInOtherCrop(state: GameState, barnId: string, crop: FieldCrop): number {
  const layouts = arableLayouts(state);
  const tending = stripTending(state, layouts);
  let count = 0;
  for (const field of reconcileArableFields(state, layouts)) {
    for (const strip of field.strips) {
      if (tending.get(strip.id)?.farmsteadId === barnId && IN_GROUND.has(strip.stage) && strip.crop !== crop) count += 1;
    }
  }
  return count;
}

const cache = new WeakMap<GameState, Map<string, FarmsteadCropModel | null>>();

/** The crop choice of a farmstead (null for anything else). Cached per state: the card renders every frame. */
export function farmsteadCropModel(state: GameState, buildingId: string): FarmsteadCropModel | null {
  const byId = cache.get(state) ?? new Map<string, FarmsteadCropModel | null>();
  cache.set(state, byId);
  if (byId.has(buildingId)) return byId.get(buildingId)!;
  const barn = state.buildings.find(building => building.id === buildingId);
  let model: FarmsteadCropModel | null = null;
  if (barn !== undefined && barn.kind === "farmstead") {
    const crop = barn.crop ?? "wheat";
    const other = FIELD_CROPS.find(candidate => candidate !== crop)!;
    const pending = stripsInOtherCrop(state, barn.id, crop);
    const left = Math.floor(barn.inventory[other] ?? 0);
    const lock = farmsteadCropLock(state, "barley");
    model = {
      buildingId: barn.id, crop,
      options: FIELD_CROPS.map(value => ({ value, label: resourceName(value) })),
      label: FARMSTEAD_CROP_COPY.label,
      current: FARMSTEAD_CROP_COPY.current(resourceName(crop)),
      note: FARMSTEAD_CROP_COPY.note,
      sowing: sowingLine(state),
      pending: pending === 0 ? null : FARMSTEAD_CROP_COPY.pending(resourceName(other), pending, resourceName(crop)),
      carting: left <= 0 ? null : FARMSTEAD_CROP_COPY.carting(resourceName(other), left),
      locked: lock === null ? null : lock.reason, disabled: lock !== null && crop === "wheat",
    };
  }
  byId.set(buildingId, model);
  return model;
}

/** The game command the choice sends. */
export function farmsteadCropAction(buildingId: string, crop: FieldCrop): GameAction {
  return { type: "set_farmstead_crop", buildingId, crop };
}
