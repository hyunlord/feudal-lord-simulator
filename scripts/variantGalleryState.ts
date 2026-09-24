// Evidence-only state (V1 gate 3): every Wave 2 house variant in the four conditions (maintained, strained, neglected,
// vacant) on open grass of the new-game map. Anchors are chosen by searching positions whose variant seed yields the
// wanted variant, so the capture shows exactly the art the game would pick there. This is an injected state (상태 주입),
// not a played town. Rows: maintained / strained / neglected / vacant; L0 has no strained row (it cannot lose a grade).
// A finished wall surrounds the gallery so the inside-wall-only L1 tile variant can be shown too.
import type { Building } from "../src/content/buildingConfig";
import type { GameState } from "../src/engine/engine.types";
import type { House } from "../src/population/population.types";
import { BUILDING_VARIANT_POOLS } from "../src/render/buildingVariantManifest";
import { rawVariant, touching } from "../src/render/buildingVariants";
import { DEFAULT_GAME_STATE } from "../src/state/gameStore";

type Condition = "maintained" | "strained" | "neglected" | "vacant";
const CONDITIONS: readonly Condition[] = ["maintained", "strained", "neglected", "vacant"];

export type GalleryEntry = { readonly id: string; readonly pool: string; readonly variant: string; readonly condition: Condition;
  readonly tx: number; readonly ty: number };

function houseRecord(buildingId: string, level: number, condition: Condition): House {
  const lost = condition === "strained" ? 1 : 0;
  return { buildingId, level: Math.max(0, level - lost), builtLevel: level, residents: condition === "vacant" ? 0 : 4, hasWater: true,
    breadStock: 4, lastServicedTick: 0, unmetRequirementTicks: condition === "neglected" ? 1_200 : 0 };
}

export function variantGallery(base: GameState = DEFAULT_GAME_STATE): { readonly state: GameState; readonly entries: readonly GalleryEntry[] } {
  const buildings: Building[] = []; const houses: House[] = []; const entries: GalleryEntry[] = [];
  const corners = [{ x: 8, y: 42 }, { x: 64, y: 42 }, { x: 64, y: 64 }, { x: 8, y: 64 }, { x: 8, y: 42 }];
  const palisade: GameState["palisade"] = { id: "gallery-wall", polygon: corners, gate: { x: 20, y: 42 },
    segments: [{ id: "gallery-wall-0", order: 0, edgePath: corners, tileCount: 156, completed: true, constructionSiteId: null, material: "stone" }] };
  const houseImages = BUILDING_VARIANT_POOLS.filter(pool => pool.kind === "house")
    .flatMap(pool => pool.variants.filter(variant => variant.id !== "base").map(variant => ({ pool, variant })));
  const singles = houseImages.filter(image => "lot" in image.pool && image.pool.lot === "single");
  const pairs = houseImages.filter(image => "lot" in image.pool && image.pool.lot !== "single");
  const cells: { tx: number; ty: number; image: (typeof houseImages)[number]; condition: Condition }[] = [];
  singles.forEach((image, column) => CONDITIONS.forEach((condition, row) => cells.push({ tx: 10 + column * 4, ty: 43 + row * 4, image, condition })));
  pairs.forEach((image, index) => CONDITIONS.forEach((condition, row) =>
    cells.push({ tx: 10 + (index * 2 + (row % 2)) * 6, ty: 58 + Math.floor(row / 2) * 3, image, condition })));
  for (const cell of cells) {
    if (!("level" in cell.image.pool)) continue;
    const level = cell.image.pool.level;
    if (level === 0 && cell.condition === "strained") continue;
    const lot = cell.image.pool.lot === "single" ? undefined : cell.image.pool.lot;
    let placed: Building | null = null;
    // Nearest free anchor (by ring) whose seed yields the wanted variant and that touches no house placed so far.
    for (let radius = 0; radius <= 6 && placed === null; radius += 1) {
      for (let dy = -radius; dy <= radius && placed === null; dy += 1) for (let dx = -radius; dx <= radius && placed === null; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
        const tx = cell.tx + dx; const ty = cell.ty + dy;
        if (tx < 8 || ty < 42 || tx > 62 || ty > 62) continue;
        const candidate: Building = { id: `gallery-${tx}-${ty}`, kind: "house", tx, ty,
          workers: 0, inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0, ...(lot === undefined ? {} : { houseLot: lot }) };
        if (buildings.some(other => touching(other, candidate))) continue;
        if (rawVariant(base.seed, candidate, level, palisade)?.id === cell.image.variant.id) placed = candidate;
      }
    }
    if (placed === null) throw new Error(`No anchor near ${cell.tx},${cell.ty} yields ${cell.image.pool.pool}#${cell.image.variant.id}`);
    buildings.push(placed); houses.push(houseRecord(placed.id, level, cell.condition));
    entries.push({ id: placed.id, pool: cell.image.pool.pool, variant: cell.image.variant.id, condition: cell.condition, tx: placed.tx, ty: placed.ty });
  }
  const occupied = new Map<string, string>();
  for (const building of buildings) {
    const width = building.houseLot === "horizontal" ? 2 : 1; const height = building.houseLot === "vertical" ? 2 : 1;
    for (let dy = 0; dy < height; dy += 1) for (let dx = 0; dx < width; dx += 1) occupied.set(`${building.tx + dx},${building.ty + dy}`, building.id);
  }
  const tiles = base.tiles.map(tile => tile.ty >= 42 && tile.tx >= 8
    ? { ...tile, terrain: "grass" as const, hasRoad: false, buildingId: occupied.get(`${tile.tx},${tile.ty}`) ?? null } : tile);
  return { state: { ...base, palisade, tiles, buildings: [...base.buildings, ...buildings], houses: [...base.houses, ...houses], roadRevision: base.roadRevision + 1, pathCache: {} }, entries };
}
