import { BUILDING_CONFIG_BY_KIND } from "../content/buildingConfig";
import type { TerrainType } from "../content/terrainConfig";

const QUARRY_DEFINITION = BUILDING_CONFIG_BY_KIND.quarry;
const QUARRY_RESOURCE_PATCH_WIDTH = QUARRY_DEFINITION.width + 1;
const QUARRY_RESOURCE_PATCH_HEIGHT = QUARRY_DEFINITION.height + 2;
const MAX_RESOURCE_PATCHES_PER_COMPONENT = 4;
const ORTHOGONAL_OFFSETS = [{ tx: 0, ty: -1 }, { tx: 1, ty: 0 }, { tx: 0, ty: 1 }, { tx: -1, ty: 0 }] as const;

export type EssentialResourceGuaranteeResult =
  | { readonly ok: true; readonly reason: "existing_quarry_resource" | "inserted_quarry_resource"; readonly terrains: readonly TerrainType[]; readonly changed: boolean }
  | { readonly ok: false; readonly reason: "no_quarry_resource_site"; readonly terrains: readonly TerrainType[] };

function terrainIndex(width: number, tx: number, ty: number): number {
  return ty * width + tx;
}

function terrainAt(
  terrains: readonly TerrainType[],
  width: number,
  height: number,
  tx: number,
  ty: number,
): TerrainType | null {
  if (tx < 0 || ty < 0 || tx >= width || ty >= height) return null;
  return terrains[terrainIndex(width, tx, ty)] ?? null;
}

function isDryTerrain(terrain: TerrainType | null): boolean {
  return terrain !== null && terrain !== "water";
}

type LandComponent = {
  readonly cells: ReadonlySet<number>;
  readonly centroidTx: number;
  readonly centroidTy: number;
};

function dryComponents(
  terrains: readonly TerrainType[],
  width: number,
  height: number,
): readonly LandComponent[] {
  const visited = new Uint8Array(terrains.length);
  const components: LandComponent[] = [];

  for (let start = 0; start < terrains.length; start += 1) {
    if (visited[start] !== 0 || !isDryTerrain(terrains[start] ?? null)) continue;
    const cells = new Set<number>();
    const queue = [start];
    let sumTx = 0;
    let sumTy = 0;
    visited[start] = 1;

    for (let queueIndex = 0; queueIndex < queue.length; queueIndex += 1) {
      const index = queue[queueIndex];
      if (index === undefined) continue;
      cells.add(index);
      const tx = index % width;
      const ty = Math.floor(index / width);
      sumTx += tx;
      sumTy += ty;

      for (const offset of ORTHOGONAL_OFFSETS) {
        const nextTx = tx + offset.tx;
        const nextTy = ty + offset.ty;
        if (nextTx < 0 || nextTy < 0 || nextTx >= width || nextTy >= height) continue;
        const nextIndex = terrainIndex(width, nextTx, nextTy);
        if (visited[nextIndex] !== 0 || !isDryTerrain(terrains[nextIndex] ?? null)) continue;
        visited[nextIndex] = 1;
        queue.push(nextIndex);
      }
    }

    components.push({
      cells,
      centroidTx: sumTx / cells.size,
      centroidTy: sumTy / cells.size,
    });
  }

  return components.sort((a, b) => b.cells.size - a.cells.size);
}

function componentHasTile(component: LandComponent, width: number, height: number, tx: number, ty: number): boolean {
  if (tx < 0 || ty < 0 || tx >= width || ty >= height) return false;
  return component.cells.has(terrainIndex(width, tx, ty));
}

function quarryFootprintIsOnComponent(
  component: LandComponent,
  width: number,
  height: number,
  tx: number,
  ty: number,
): boolean {
  for (let dy = 0; dy < QUARRY_DEFINITION.height; dy += 1) {
    for (let dx = 0; dx < QUARRY_DEFINITION.width; dx += 1) {
      if (!componentHasTile(component, width, height, tx + dx, ty + dy)) return false;
    }
  }
  return true;
}

function quarryHasAdjacentRock(
  terrains: readonly TerrainType[],
  width: number,
  height: number,
  tx: number,
  ty: number,
): boolean {
  const required = QUARRY_DEFINITION.requiresAdjacentTerrain;
  if (required === null) return true;
  for (let ringY = ty - 1; ringY <= ty + QUARRY_DEFINITION.height; ringY += 1) {
    for (let ringX = tx - 1; ringX <= tx + QUARRY_DEFINITION.width; ringX += 1) {
      const insideFootprint =
        ringX >= tx &&
        ringX < tx + QUARRY_DEFINITION.width &&
        ringY >= ty &&
        ringY < ty + QUARRY_DEFINITION.height;
      if (!insideFootprint && terrainAt(terrains, width, height, ringX, ringY) === required) return true;
    }
  }
  return false;
}

function quarryAccessTiles(tx: number, ty: number): readonly { readonly tx: number; readonly ty: number }[] {
  const tiles: { tx: number; ty: number }[] = [];
  for (let dx = 0; dx < QUARRY_DEFINITION.width; dx += 1) {
    tiles.push({ tx: tx + dx, ty: ty - 1 });
    tiles.push({ tx: tx + dx, ty: ty + QUARRY_DEFINITION.height });
  }
  for (let dy = 0; dy < QUARRY_DEFINITION.height; dy += 1) {
    tiles.push({ tx: tx - 1, ty: ty + dy });
    tiles.push({ tx: tx + QUARRY_DEFINITION.width, ty: ty + dy });
  }
  return tiles;
}

function quarryHasComponentAccess(
  component: LandComponent,
  width: number,
  height: number,
  tx: number,
  ty: number,
): boolean {
  return quarryAccessTiles(tx, ty).some((tile) => componentHasTile(component, width, height, tile.tx, tile.ty));
}

function hasQuarryResourceSite(
  terrains: readonly TerrainType[],
  width: number,
  height: number,
  component: LandComponent,
): boolean {
  for (let ty = 0; ty <= height - QUARRY_DEFINITION.height; ty += 1) {
    for (let tx = 0; tx <= width - QUARRY_DEFINITION.width; tx += 1) {
      if (
        quarryFootprintIsOnComponent(component, width, height, tx, ty) &&
        quarryHasAdjacentRock(terrains, width, height, tx, ty) &&
        quarryHasComponentAccess(component, width, height, tx, ty)
      ) return true;
    }
  }
  return false;
}

function resourcePatchFits(
  terrains: readonly TerrainType[],
  component: LandComponent,
  width: number,
  height: number,
  tx: number,
  ty: number,
  allowForest: boolean,
): boolean {
  if (tx < 0 || ty < 0 || tx + QUARRY_RESOURCE_PATCH_WIDTH > width || ty + QUARRY_RESOURCE_PATCH_HEIGHT > height) {
    return false;
  }
  for (let patchY = ty; patchY < ty + QUARRY_RESOURCE_PATCH_HEIGHT; patchY += 1) {
    for (let patchX = tx; patchX < tx + QUARRY_RESOURCE_PATCH_WIDTH; patchX += 1) {
      if (!componentHasTile(component, width, height, patchX, patchY)) return false;
    }
  }
  const rockX = tx + QUARRY_DEFINITION.width;
  for (let dy = 0; dy < QUARRY_RESOURCE_PATCH_HEIGHT; dy += 1) {
    const terrain = terrainAt(terrains, width, height, rockX, ty + dy);
    if (terrain !== "grass" && !(allowForest && terrain === "forest")) return false;
  }
  return true;
}

function resourcePatchScore(component: LandComponent, seed: number, tx: number, ty: number): number {
  const distance = Math.abs(tx - component.centroidTx) + Math.abs(ty - component.centroidTy);
  const hash =
    Math.imul(tx + 17, 73_856_093) ^
    Math.imul(ty + 31, 19_349_663) ^
    Math.imul(seed + 47, 83_492_791);
  return distance * 1_000 + (hash >>> 0) % 1_000;
}

function resourcePatchAnchors(
  terrains: readonly TerrainType[],
  component: LandComponent,
  width: number,
  height: number,
  seed: number,
  limit: number,
): readonly { readonly tx: number; readonly ty: number }[] {
  const candidates: { readonly tx: number; readonly ty: number; readonly score: number }[] = [];
  for (const allowForest of [false, true]) {
    for (let ty = 0; ty <= height - QUARRY_RESOURCE_PATCH_HEIGHT; ty += 1) {
      for (let tx = 0; tx <= width - QUARRY_RESOURCE_PATCH_WIDTH; tx += 1) {
        if (!resourcePatchFits(terrains, component, width, height, tx, ty, allowForest)) continue;
        candidates.push({ tx, ty, score: resourcePatchScore(component, seed, tx, ty) });
      }
    }
    if (candidates.length > 0) break;
  }
  candidates.sort((a, b) => a.score - b.score);

  const anchors: { readonly tx: number; readonly ty: number }[] = [];
  while (anchors.length < limit && candidates.length > 0) {
    let bestIndex = 0;
    let bestDistance = -1;
    for (const [index, candidate] of candidates.entries()) {
      const distance = anchors.length === 0
        ? Number.POSITIVE_INFINITY
        : Math.min(...anchors.map((anchor) => Math.abs(anchor.tx - candidate.tx) + Math.abs(anchor.ty - candidate.ty)));
      if (distance > bestDistance) {
        bestIndex = index;
        bestDistance = distance;
      }
    }
    const [anchor] = candidates.splice(bestIndex, 1);
    if (anchor === undefined) break;
    anchors.push({ tx: anchor.tx, ty: anchor.ty });
  }
  return anchors;
}

/** New-map geology only: later building occupancy can still sever access to a resource. */
export function guaranteeEssentialResourceTerrain(
  terrains: readonly TerrainType[],
  width: number,
  height: number,
  seed: number,
): EssentialResourceGuaranteeResult {
  const components = dryComponents(terrains, width, height);
  if (components.length === 0) return { ok: false, reason: "no_quarry_resource_site", terrains };

  const guaranteed = [...terrains];
  let changed = false;
  let guaranteedSites = 0;

  for (const component of components) {
    if (hasQuarryResourceSite(guaranteed, width, height, component)) {
      guaranteedSites += 1;
      continue;
    }

    const anchors = resourcePatchAnchors(guaranteed, component, width, height, seed, MAX_RESOURCE_PATCHES_PER_COMPONENT);
    if (anchors.length === 0) continue;

    for (const anchor of anchors) {
      const rockX = anchor.tx + QUARRY_DEFINITION.width;
      for (let dy = 0; dy < QUARRY_RESOURCE_PATCH_HEIGHT; dy += 1) {
        guaranteed[terrainIndex(width, rockX, anchor.ty + dy)] = "rock";
      }
    }
    if (hasQuarryResourceSite(guaranteed, width, height, component)) {
      changed = true;
      guaranteedSites += 1;
    }
  }

  if (guaranteedSites === 0) return { ok: false, reason: "no_quarry_resource_site", terrains };
  if (!changed) return { ok: true, reason: "existing_quarry_resource", terrains, changed: false };
  return { ok: true, reason: "inserted_quarry_resource", terrains: guaranteed, changed: true };
}
