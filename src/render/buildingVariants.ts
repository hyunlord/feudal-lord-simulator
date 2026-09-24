import type { Building } from "../content/buildingConfig";
import type { GameState } from "../engine/engine.types";
import { buildingFootprint } from "../geometry/buildingFootprint";
import { houseBuiltLevel } from "../population/houseCondition";
import { BUILDING_VARIANT_POOLS } from "./buildingVariantManifest";

// Deterministic visual variants (V1). A building's variant is a pure function of saved state, so the same save always
// draws the same town and a load draws what was saved:
//   seed = hash(world seed, kind, anchor tx/ty, lot width)   (buildings carry no build ordinal, so none is used)
// - Only the grade's own pool is used. On a grade change the variant is re-picked with the same seed; with
//   probability FAMILY_KEEP (also from the seed) a house keeps its family ("garden" at L1 prefers "garden" at L2).
//   Decline and recovery do not touch the grade used here (built level), so the variant stays.
// - A merged lot has its own seed (lot width 2); when the merge is undone the single house gets its old seed back.
// - Neighbour push: if a touching building of the same pool that comes earlier in (ty, tx) order made the same raw
//   pick, take the next variant once. Raw picks only, so one change never cascades across a street.
// Cache: assignments are rebuilt when the (id, kind, tx, ty, lot, built level) list or the world seed changes;
// nothing else is read. Measured in docs/verification/v1-visual-variants/REPORT.md.

type Pool = (typeof BUILDING_VARIANT_POOLS)[number];
export type BuildingVariant = Pool["variants"][number];
export const FAMILY_KEEP = 0.5;

export type BuildingVariantAssignment = { readonly pool: Pool["pool"]; readonly variant: BuildingVariant; readonly pushed: boolean };

export function variantPool(building: Pick<Building, "kind" | "houseLot">, level: number): Pool | null {
  return BUILDING_VARIANT_POOLS.find(pool => pool.kind === building.kind
    && (pool.kind !== "house" || ("level" in pool && pool.level === level && pool.lot === (building.houseLot ?? "single")))) ?? null;
}

/** Each value is folded in and fully avalanched (murmur3 finaliser), so nearby anchors give unrelated picks. */
function hash(values: readonly number[]): number {
  let value = 0x9e37_79b9;
  for (const item of values) {
    value = (value ^ (item + 0x7f4a_7c15 + (value << 6) + (value >>> 2))) >>> 0;
    value = Math.imul(value ^ (value >>> 16), 0x85eb_ca6b);
    value = Math.imul(value ^ (value >>> 13), 0xc2b2_ae35);
    value = (value ^ (value >>> 16)) >>> 0;
  }
  return value;
}

function textCode(text: string): number {
  return hash([...text].map(character => character.charCodeAt(0)));
}

/** Uniform [0,1) stream `salt` of a building's variant seed. */
export function variantRandom(worldSeed: number, building: Pick<Building, "kind" | "tx" | "ty" | "houseLot">, salt: number): number {
  const lotWidth = building.houseLot === undefined ? 1 : 2;
  return hash([worldSeed, textCode(building.kind), building.tx, building.ty, lotWidth, salt]) / 4_294_967_296;
}

function weightedPick(variants: readonly BuildingVariant[], random: number): BuildingVariant {
  const total = variants.reduce((sum, variant) => sum + variant.weight, 0);
  let cursor = random * total;
  for (const variant of variants) {
    cursor -= variant.weight;
    if (cursor < 0) return variant;
  }
  return variants[variants.length - 1] as BuildingVariant;
}

/** The pick before the neighbour push, following the family chain from the lowest grade that has a pool. */
export function rawVariant(worldSeed: number, building: Pick<Building, "kind" | "tx" | "ty" | "houseLot">, level: number): BuildingVariant | null {
  const pool = variantPool(building, level);
  if (pool === null) return null;
  const pick = variantRandom(worldSeed, building, 1);
  if (building.kind !== "house") return weightedPick(pool.variants, pick);
  let previous: BuildingVariant | null = null;
  for (let grade = 0; grade <= level; grade += 1) {
    const gradePool = variantPool(building, grade);
    if (gradePool === null) continue;
    const family = previous?.family;
    const keep = family !== undefined && family !== "base" && variantRandom(worldSeed, building, 10 + grade) < FAMILY_KEEP;
    const sameFamily = keep ? gradePool.variants.filter(variant => variant.family === family) : [];
    previous = weightedPick(sameFamily.length > 0 ? sameFamily : gradePool.variants, pick);
  }
  return previous;
}

type Entry = { readonly building: Building; readonly level: number; readonly pool: Pool; readonly raw: BuildingVariant };

export function buildingVariantAssignments(state: Pick<GameState, "seed" | "buildings" | "houses">): ReadonlyMap<string, BuildingVariantAssignment> {
  const levels = new Map(state.houses.map(house => [house.buildingId, houseBuiltLevel(house)]));
  const entries: Entry[] = [];
  for (const building of state.buildings) {
    const level = building.kind === "house" ? levels.get(building.id) ?? 0 : 0;
    const pool = variantPool(building, level);
    const raw = rawVariant(state.seed, building, level);
    if (pool !== null && raw !== null) entries.push({ building, level, pool, raw });
  }
  const byPool = new Map<string, Entry[]>();
  for (const entry of entries) byPool.set(entry.pool.pool, [...(byPool.get(entry.pool.pool) ?? []), entry]);
  const result = new Map<string, BuildingVariantAssignment>();
  for (const entry of entries) {
    const earlierSame = (byPool.get(entry.pool.pool) ?? []).some(other => other !== entry && touching(other.building, entry.building)
      && (other.building.ty < entry.building.ty || (other.building.ty === entry.building.ty && other.building.tx < entry.building.tx))
      && other.raw.id === entry.raw.id);
    const variants = entry.pool.variants;
    const index = variants.findIndex(variant => variant.id === entry.raw.id);
    const variant = earlierSame && variants.length > 1 ? variants[(index + 1) % variants.length] as BuildingVariant : entry.raw;
    result.set(entry.building.id, { pool: entry.pool.pool, variant, pushed: earlierSame && variants.length > 1 });
  }
  return result;
}

/** Footprints share an edge or a corner. */
export function touching(a: Pick<Building, "kind" | "tx" | "ty" | "houseLot">, b: Pick<Building, "kind" | "tx" | "ty" | "houseLot">): boolean {
  const sa = buildingFootprint(a); const sb = buildingFootprint(b);
  const gapX = Math.max(a.tx, b.tx) - Math.min(a.tx + sa.width, b.tx + sb.width);
  const gapY = Math.max(a.ty, b.ty) - Math.min(a.ty + sa.height, b.ty + sb.height);
  return gapX <= 0 && gapY <= 0;
}

let frame: { readonly signature: string; readonly seed: number; readonly assignments: ReadonlyMap<string, BuildingVariantAssignment> } | null = null;
let frameInputs: { readonly buildings: GameState["buildings"]; readonly houses: GameState["houses"]; readonly seed: number } | null = null;

/** Called once per frame by the object pass; draw functions then look variants up by building id. */
export function beginBuildingVariantFrame(state: Pick<GameState, "seed" | "buildings" | "houses">): void {
  if (frameInputs !== null && frameInputs.buildings === state.buildings && frameInputs.houses === state.houses && frameInputs.seed === state.seed) return;
  frameInputs = { buildings: state.buildings, houses: state.houses, seed: state.seed };
  const levels = new Map(state.houses.map(house => [house.buildingId, houseBuiltLevel(house)]));
  const signature = `${state.seed}|${state.buildings.map(building =>
    `${building.id}:${building.kind}:${building.tx}:${building.ty}:${building.houseLot ?? ""}:${levels.get(building.id) ?? ""}`).join(";")}`;
  if (frame?.signature === signature) return;
  frame = { signature, seed: state.seed, assignments: buildingVariantAssignments(state) };
}

let variantsEnabled = true;
/** Tests that pin the base art (e.g. the base farm layer order) switch variants off. */
export function setBuildingVariantsEnabled(value: boolean): void { variantsEnabled = value; }

/** The variant chosen for this building in the current frame; null = base art. */
export function frameBuildingVariant(building: Pick<Building, "id">): BuildingVariant | null {
  if (!variantsEnabled) return null;
  const variant = frame?.assignments.get(building.id)?.variant;
  return variant === undefined || variant.id === "base" ? null : variant;
}
