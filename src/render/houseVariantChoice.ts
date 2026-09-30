import type { Building } from "../content/buildingConfig";
import { BALANCE, PRESSURE_BALANCE } from "../content/balanceConfig";
import { HOUSE_VARIANT_CONFIG, type HouseRoof, type HouseWealth } from "../content/houseVariantConfig";
import type { GameState } from "../engine/engine.types";
import type { HistoryState } from "../engine/history.types";
import { rentRelief } from "../engine/moneyRules";
import { houseBuiltLevel, houseCondition } from "../population/houseCondition";
import type { House } from "../population/population.types";
import { alehouseArt } from "./aleWorldArt";
import { textRandom, touching } from "./buildingVariants";
import { WAVE26_HOUSE_VARIANTS } from "./wave26HouseManifest.generated";
import { WAVE30_PAIR_HOUSE_VARIANTS } from "./wave30PairHouseManifest.generated";

// INSTALL-26 which painting a single-lot house shows (Wave 26) and which state layer lies on it: pure choices read
// from the saved state, nothing stored. Weights and thresholds: src/content/houseVariantConfig.ts.
// Choice, per household. The household's key is its house's building id (Person.householdId is that id; a House has
// no other), so the seed is hash(world seed, building id): a household keeps its painting where it is, and a rebuilt
// plot with a new building id is a new pick. Each level has five paintings: the approved one ("existing", which then
// goes on to its Wave 2 variants and the alehouse exactly as before) and Wave 26's c-f.
//   1. roof: stream 1 picks a roof with chance weight(roof, wealth) x the level's paintings with that roof;
//   2. painting: stream 2 picks uniformly among the level's paintings with that roof.
// So a household whose wealth changes (a master appointed or dismissed, PS-4) repaints only when its roof changes.
// Neighbour push, as Wave 2's: a touching house earlier in (ty, tx) order with the same raw pick takes the roof's
// next painting (raw picks only, no cascade). A burning or burnt house (Wave 9's fire and ruin layers are painted on
// the approved house) and an alehouse under its stake keep the approved painting.
// INSTALL-30 a pair lot (L2-L4, horizontal or vertical) by the same rule among Wave 30's c-e only: every pair wears a
// painting with its own fresh, weathered, snow and boarded layers (the approved pair has none; it stays installed and
// is drawn only while a Wave 30 painting loads, with its Wave 2 variants). The household is the lot's building id (a
// merge keeps the source house's id, so a merged household picks again among the pair's paintings). A pair has no
// fire or ruin painting (it shows the smoke column and soot on whatever it wears), so a burning or burnt pair keeps its own.

export type Wave26Variant = (typeof WAVE26_HOUSE_VARIANTS)[number];
export type Wave30PairVariant = (typeof WAVE30_PAIR_HOUSE_VARIANTS)[number];
/** A house painting beside the approved one: a single lot's Wave 26 variant or a pair lot's Wave 30 one. */
export type HousePainting = Wave26Variant | Wave30PairVariant;
export type HouseLot = "single" | "horizontal" | "vertical";
/** One of a level's paintings: a Wave 26 / Wave 30 variant, or null for the approved one. */
export type HouseBodyOption = { readonly roof: HouseRoof; readonly variant: HousePainting | null };

const ROOF_ORDER: readonly HouseRoof[] = ["thatch", "clay_tile", "stone_slate"];
const OPTIONS: readonly (readonly HouseBodyOption[])[] = [0, 1, 2, 3, 4].map(level => [
  { roof: HOUSE_VARIANT_CONFIG.existingRoof[level] as HouseRoof, variant: null },
  ...WAVE26_HOUSE_VARIANTS.filter(variant => variant.level === level).map(variant => ({ roof: variant.roof as HouseRoof, variant })),
]);
const PAIR_OPTIONS = new Map<string, readonly HouseBodyOption[]>([2, 3, 4].flatMap(level => (["horizontal", "vertical"] as const).map(lot => [
  `${level}:${lot}`, WAVE30_PAIR_HOUSE_VARIANTS.filter(variant => variant.level === level && variant.lot === lot).map(variant => ({ roof: variant.roof as HouseRoof, variant })),
] as const)));

/** The level's paintings: for a single lot five, the approved one first; for a pair (levels 2-4) Wave 30's three. */
export function houseBodyOptions(level: number, lot: HouseLot = "single"): readonly HouseBodyOption[] {
  if (lot !== "single") return PAIR_OPTIONS.get(`${Math.max(2, Math.min(4, level))}:${lot}`) as readonly HouseBodyOption[];
  return OPTIONS[Math.max(0, Math.min(4, level))] as readonly HouseBodyOption[];
}

/** Rich: a merchant, gentry or master-artisan head, or a house built to the top level. */
export function householdWealth(builtLevel: number, headClassBand: string | undefined): HouseWealth {
  return builtLevel >= HOUSE_VARIANT_CONFIG.richFromLevel || (headClassBand !== undefined && HOUSE_VARIANT_CONFIG.richClassBands.includes(headClassBand))
    ? "rich" : "common";
}

/** The pick before the neighbour push. */
export function rawHouseBody(worldSeed: number, householdId: string, level: number, wealth: HouseWealth, lot: HouseLot = "single"): HouseBodyOption {
  const options = houseBodyOptions(level, lot);
  const weights = HOUSE_VARIANT_CONFIG.roofWeight[wealth];
  const roofs = ROOF_ORDER.map(roof => ({ roof, weight: weights[roof] * options.filter(option => option.roof === roof).length }));
  let cursor = textRandom(worldSeed, householdId, 1) * roofs.reduce((sum, entry) => sum + entry.weight, 0);
  let roof: HouseRoof | null = null;
  for (const entry of roofs) {
    cursor -= entry.weight;
    if (entry.weight > 0 && cursor < 0) { roof = entry.roof; break; }
  }
  const last = roofs.filter(entry => entry.weight > 0).at(-1)?.roof;
  const same = options.filter(option => option.roof === (roof ?? last));
  return same[Math.floor(textRandom(worldSeed, householdId, 2) * same.length)] as HouseBodyOption;
}

type ChoiceState = Pick<GameState, "seed" | "buildings" | "houses"> & Partial<Pick<GameState, "persons" | "events">>;

/**
 * Whether the house may show a Wave 26 painting at all: a single lot, not on fire nor burnt, and not hanging out the
 * ale-stake (the INSTALL-3 alehouse painting is an edit of the approved L2 house). A pair lot a Wave 30 one: built to
 * L2 or more (below that it has no painting).
 */
export function houseBodyEligible(state: Pick<GameState, "seed"> & Partial<Pick<GameState, "events">>, building: Building, house: House): boolean {
  if (building.kind === "house" && building.houseLot !== undefined) return houseBuiltLevel(house) >= 2;
  return building.kind === "house" && house.burntTick === undefined
    && state.events?.burning.some(entry => entry.buildingId === building.id) !== true && alehouseArt(state, building, house, houseBuiltLevel(house)) === null;
}

export type HouseBodyEntry = { readonly building: Building; readonly level: number; readonly lot: HouseLot; readonly raw: HouseBodyOption };

/** Every eligible house with its level and raw pick (cheap: two hashes a house). */
export function houseBodyEntries(state: ChoiceState): readonly HouseBodyEntry[] {
  const heads = new Map<string, string>();
  for (const person of state.persons?.people ?? []) if (person.role === "head") heads.set(person.householdId, person.classBand);
  const buildings = new Map(state.buildings.map(building => [building.id, building]));
  const entries: HouseBodyEntry[] = [];
  for (const house of state.houses) {
    const building = buildings.get(house.buildingId);
    if (building === undefined || !houseBodyEligible(state, building, house)) continue;
    const level = Math.max(0, Math.min(4, houseBuiltLevel(house)));
    const lot = building.houseLot ?? "single";
    entries.push({ building, level, lot, raw: rawHouseBody(state.seed, building.id, level, householdWealth(level, heads.get(building.id)), lot) });
  }
  return entries;
}

/** Every eligible house's painting by building id (null: the approved one), after the neighbour push. */
export function houseBodyAssignments(state: ChoiceState, entries: readonly HouseBodyEntry[] = houseBodyEntries(state)): ReadonlyMap<string, HousePainting | null> {
  const result = new Map<string, HousePainting | null>();
  for (const entry of entries) {
    const pushed = entries.some(other => other !== entry && other.level === entry.level && other.raw === entry.raw && touching(other.building, entry.building)
      && (other.building.ty < entry.building.ty || (other.building.ty === entry.building.ty && other.building.tx < entry.building.tx)));
    const same = houseBodyOptions(entry.level, entry.lot).filter(option => option.roof === entry.raw.roof);
    result.set(entry.building.id, pushed ? (same[(same.indexOf(entry.raw) + 1) % same.length] as HouseBodyOption).variant : entry.raw.variant);
  }
  return result;
}

const SEASON = PRESSURE_BALANCE.seasonTicks;
/** Any positive rent: the engine's relief takes all of it from a starving household and half from one leaving. */
const RENT_PROBE = 2;
export type HouseStateLayer = "fresh" | "weathered" | null;

/**
 * When each house was last completed, from the history ledger (the engine keeps no build tick on a house): its
 * rebuild (`person.rebuilt`), else its household's first move-in (`person.move_in`, never folded, HL-10). A house
 * in neither and never emptied (`person.emptied`, `person.left`) is `awaiting` its first household — just built.
 */
export function houseCompletions(history: Pick<HistoryState, "records"> | undefined): ReadonlyMap<string, { readonly tick?: number; readonly lived: boolean }> {
  const result = new Map<string, { tick?: number; lived: boolean }>();
  for (const record of history?.records ?? []) {
    const id = record.place?.buildingId;
    if (id === undefined) continue;
    const entry = result.get(id) ?? { lived: false };
    if (record.template === "person.rebuilt" || (record.template === "person.move_in" && entry.tick === undefined)) entry.tick = record.tick;
    if (record.template === "person.emptied" || record.template === "person.left") entry.lived = true;
    result.set(id, entry);
  }
  return result;
}

/**
 * The house's state layer (weathered and fresh are exclusive). `fresh` for `freshSeasons` after completion, or while
 * a just-built house awaits its household; otherwise `weathered` when it is `oldYears` old (a house the ledger does
 * not date counts from tick 0: a founding house), its household is short of food (`foodShortSinceTick`) or pays less
 * than its rent (the engine's rent relief: starving or leaving; houses owe no upkeep and run no rent arrears), or it
 * is run down (condition strained or neglected — the approved painting's wear marks, which a Wave 26 painting does not
 * take). Fresh wins: a house two seasons old has not weathered.
 */
export function houseStateLayer(tick: number, house: House, completion: { readonly tick?: number; readonly lived: boolean } | undefined): HouseStateLayer {
  const awaiting = completion?.tick === undefined && completion?.lived !== true && house.residents <= 0 && house.abandonedTick === undefined;
  const completed = completion?.tick ?? 0;
  if (awaiting || (completion?.tick !== undefined && tick - completed < HOUSE_VARIANT_CONFIG.freshSeasons * SEASON)) return "fresh";
  const condition = houseCondition(house);
  const worn = tick - completed >= HOUSE_VARIANT_CONFIG.oldYears * BALANCE.TICKS_PER_YEAR || house.foodShortSinceTick !== undefined
    || rentRelief(house, tick, RENT_PROBE) < RENT_PROBE || condition === "strained" || condition === "neglected";
  return worn ? "weathered" : null;
}
