import type { GameState } from "../engine/engine.types";
import { spinningSlot } from "../engine/cloth";
import { buildingFootprint } from "../geometry/buildingFootprint";
import type { Wave3ClothKey } from "./wave3ClothArt";
import { backyardPlan } from "./backyardDecals";

// NAT-1: door prop allocation for spinning houses (≤250 LOC, pure, no Math.random).
//
// The same white yarn-skein prop used to appear at every spinning house's door because
// spinningPile() always returned "yarn_skeins_1". This module replaces that with a
// deterministic, varied allocation that satisfies three rules:
//
//   A. Same prop at most on two consecutive houses in a street row.
//   B. At least half of spinning houses show nothing at the door.
//   C. If the house's Wave 27 backyard already shows a craft yard (yard_weaver_*),
//      skip the door prop (the backyard already represents the trade).
//
// Street-row definition: houses grouped by (tx + footprint width) — the x-column their
// SE-face door opens onto, which aligns houses that share a road running along +y. Within
// a group, houses are ordered by ty (position along that road).
//
// Prop variants for a spinning house (Wave 3 cloth pile art):
//   yarn_skeins_1, yarn_skeins_2, yarn_skeins_3, fleece_heap_1
// (No spinning wheel or distaff art exists in Wave 3 / Wave 23 / Wave 27 manifests.)

// NAT-1: the four spinning-house door prop variants, in rotation
const SPIN_VARIANTS: readonly Wave3ClothKey[] = [
  "yarn_skeins_1", "yarn_skeins_2", "yarn_skeins_3", "fleece_heap_1",
];

// NAT-1: FNV-like hash (same style as villageLife.ts to keep the idiom consistent)
function doorHash(text: string, salt: number): number {
  let h = (0x811c9dc5 ^ Math.imul(salt, 0x9e3779b1)) >>> 0;
  for (let i = 0; i < text.length; i += 1) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d) >>> 0;
  return (h ^ (h >>> 15)) >>> 0;
}

const SALT_SHOWN = 41;   // NAT-1: whether this house gets any door prop
const SALT_VARIANT = 42; // NAT-1: which of the four prop variants

type RowEntry = { readonly id: string; readonly ty: number };

// NAT-1: cache keyed on buildings + houses array identity (cheap per frame, like reorgWorldProps)
let cacheBuildings: GameState["buildings"] | null = null;
let cacheHouses: GameState["houses"] | null = null;
let cacheResult: ReadonlyMap<string, Wave3ClothKey | null> | null = null;

/**
 * NAT-1: the spinning-house door prop for a given building (null = show nothing).
 * Returns null for non-spinning houses or backyard-skipped houses.
 * Cached by buildings + houses array identity.
 */
export function spinDoorProp(state: GameState, buildingId: string): Wave3ClothKey | null {
  if (state.buildings !== cacheBuildings || state.houses !== cacheHouses) {
    cacheResult = computeSpinDoorAllocation(state);
    cacheBuildings = state.buildings;
    cacheHouses = state.houses;
  }
  return cacheResult!.get(buildingId) ?? null;
}

function computeSpinDoorAllocation(state: GameState): ReadonlyMap<string, Wave3ClothKey | null> {
  const result = new Map<string, Wave3ClothKey | null>();

  // NAT-1 rule C: houses whose backyard already shows the craft yard get no door prop
  const weaverYardIds = new Set(
    backyardPlan(state)
      .filter(decal => decal.key === "yard_weaver_a" || decal.key === "yard_weaver_b")
      .map(decal => decal.buildingId),
  );

  const houseMap = new Map(state.houses.map(h => [h.buildingId, h]));

  // NAT-1: group spinning house buildings by door column (tx + footprint width = the SE-face x)
  const rows = new Map<number, RowEntry[]>();

  for (const building of state.buildings) {
    if (building.kind !== "house") continue;
    const house = houseMap.get(building.id);
    if (house === undefined || spinningSlot(house) === null) continue;
    if (weaverYardIds.has(building.id)) {
      result.set(building.id, null); // NAT-1 rule C: skip; backyard covers the trade
      continue;
    }
    const col = building.tx + buildingFootprint(building).width;
    let row = rows.get(col);
    if (row === undefined) { row = []; rows.set(col, row); }
    row.push({ id: building.id, ty: building.ty });
  }

  // NAT-1: allocate props within each street row in ty order
  for (const row of rows.values()) {
    row.sort((a, b) => a.ty - b.ty);
    const assigned: Array<Wave3ClothKey | null> = [];

    for (const entry of row) {
      // NAT-1 rule B: 50% of houses show nothing (hash bit 0)
      const shown = doorHash(entry.id, SALT_SHOWN) % 2 === 0;
      let prop: Wave3ClothKey | null = null;

      if (shown) {
        const varIdx = doorHash(entry.id, SALT_VARIANT) % SPIN_VARIANTS.length;
        const candidate = SPIN_VARIANTS[varIdx]!;
        const len = assigned.length;
        const p1 = len >= 1 ? assigned[len - 1] : undefined;
        const p2 = len >= 2 ? assigned[len - 2] : undefined;

        // NAT-1 rule A: if candidate would be 3rd consecutive, rotate to next distinct variant
        if (p1 === candidate && p2 === candidate) {
          let found = false;
          for (let r = 1; r < SPIN_VARIANTS.length; r += 1) {
            const alt = SPIN_VARIANTS[(varIdx + r) % SPIN_VARIANTS.length]!;
            if (alt !== candidate) { prop = alt; found = true; break; }
          }
          if (!found) prop = null; // all variants identical (impossible with 4 distinct items)
        } else {
          prop = candidate;
        }
      }

      assigned.push(prop);
      result.set(entry.id, prop);
    }
  }

  return result;
}

/**
 * NAT-1: the share of each spinning-house door prop in a set of building ids
 * (used by the measurement script and tests). Returns prop key → fraction of
 * all spinning houses that show it (null key = empty, shown as "none").
 */
export function spinDoorPropShares(state: GameState): ReadonlyMap<string, number> {
  const counts = new Map<string, number>();
  let total = 0;
  for (const building of state.buildings) {
    if (building.kind !== "house") continue;
    const house = state.houses.find(h => h.buildingId === building.id);
    if (house === undefined || spinningSlot(house) === null) continue;
    const prop = spinDoorProp(state, building.id);
    const key = prop ?? "none";
    counts.set(key, (counts.get(key) ?? 0) + 1);
    total += 1;
  }
  const shares = new Map<string, number>();
  if (total > 0) for (const [key, count] of counts) shares.set(key, count / total);
  return shares;
}
