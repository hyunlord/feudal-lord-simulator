/**
 * ARCH-1 (spec docs/design/map-archetypes.md AR-5): what a render lays on a land — per tile, a Wave 22 ground fill, a
 * transition or shore band and a decal — derived from the terrain, the land and the seed alone (the terrain does not
 * change in play, so a render computes it once per map). The land's field boundary (Wave 28) and water movement
 * (Wave 29) are the archetype's `ground.fieldBoundary` and `ground.water`. The simulation never reads this layer.
 *
 * Keys are the confirmed files' names without the version (`terrain/chalk_down` + the render's season and a/b,
 * `boundary/chalk_edge_a`, `shore/sand_beach_b`, `decals/fen_pool_c`, `props/driftwood_a`).
 */
import type { ArchetypeDef } from "../content/scenario/types";
import type { TerrainType } from "../content/terrainConfig";
import { hashSeed } from "../engine/prng";
import { fbm } from "./noise";

export interface GroundLayer {
  /** Key table; index 0 is "none" (a band or decal absent). */
  readonly keys: readonly string[];
  /** Per tile (row-major): the fill's key index (forest, water and rock keep their own art: index 0). */
  readonly fill: Uint8Array;
  /** Per tile: the band's key index — a transition between fills, a shore, a reed bed — or 0. */
  readonly band: Uint8Array;
  /** Per tile: the decal's key index, or 0. */
  readonly decal: Uint8Array;
}

const NEIGHBOURS = [[0, -1], [1, 0], [0, 1], [-1, 0]] as const;

/** Distance (4-neighbour steps, capped) from every tile to the nearest tile whose terrain is `target`. */
function distanceTo(terrains: readonly TerrainType[], width: number, height: number, target: (index: number) => boolean, cap: number): Uint8Array {
  const distance = new Uint8Array(terrains.length).fill(cap);
  const queue: number[] = [];
  for (let index = 0; index < terrains.length; index += 1) if (target(index)) { distance[index] = 0; queue.push(index); }
  for (let head = 0; head < queue.length; head += 1) {
    const index = queue[head]!;
    const next = distance[index]! + 1;
    if (next >= cap) continue;
    const tx = index % width, ty = Math.floor(index / width);
    for (const [dx, dy] of NEIGHBOURS) {
      const x = tx + dx, y = ty + dy;
      if (x < 0 || y < 0 || x >= width || y >= height) continue;
      const neighbour = y * width + x;
      if (distance[neighbour]! > next) { distance[neighbour] = next; queue.push(neighbour); }
    }
  }
  return distance;
}

/** Water joined to the map's edge (the sea, a river's mouth); a mere inside the land is not. */
function seaMask(terrains: readonly TerrainType[], width: number, height: number): Uint8Array {
  const sea = new Uint8Array(terrains.length);
  const queue: number[] = [];
  for (let index = 0; index < terrains.length; index += 1) {
    const tx = index % width, ty = Math.floor(index / width);
    if (terrains[index] === "water" && (tx === 0 || ty === 0 || tx === width - 1 || ty === height - 1)) { sea[index] = 1; queue.push(index); }
  }
  for (let head = 0; head < queue.length; head += 1) {
    const index = queue[head]!;
    const tx = index % width, ty = Math.floor(index / width);
    for (const [dx, dy] of NEIGHBOURS) {
      const x = tx + dx, y = ty + dy;
      if (x < 0 || y < 0 || x >= width || y >= height) continue;
      const neighbour = y * width + x;
      if (sea[neighbour] === 0 && terrains[neighbour] === "water") { sea[neighbour] = 1; queue.push(neighbour); }
    }
  }
  return sea;
}

/** AR-5: the land's ground layer. */
export function archetypeGroundLayer(archetype: ArchetypeDef, terrains: readonly TerrainType[], width: number, height: number, seed: number): GroundLayer {
  const ground = archetype.ground;
  const keys: string[] = ["none"];
  const key = (name: string): number => { let index = keys.indexOf(name); if (index < 0) { index = keys.length; keys.push(name); } return index; };
  const count = terrains.length;
  const fill = new Uint8Array(count);
  const band = new Uint8Array(count);
  const decal = new Uint8Array(count);
  const open = (index: number) => terrains[index] === "grass";
  const variant = (index: number, salt: string) => (hashSeed(seed, salt, index) % 2 === 0 ? "a" : "b");
  const sea = seaMask(terrains, width, height);
  const kind = archetype.terrain.kind;
  const nearSea = kind === "coast" ? distanceTo(terrains, width, height, index => sea[index] === 1, 9) : null;
  const nearWater = kind === "fen" ? distanceTo(terrains, width, height, index => terrains[index] === "water", 6) : null;
  const nearForest = kind === "woodland" ? distanceTo(terrains, width, height, index => terrains[index] === "forest", 6) : null;
  const meadow = key("terrain/grass");
  const own = key(`terrain/${ground.fill}`);
  const patch = ground.patchFill === undefined ? 0 : key(`terrain/${ground.patchFill}`);

  // The fill: the land's own ground, the meadow where the land gives way (the fen's dry ground, the forest's clearings,
  // the coast's inland fields, the down's in-bye by the town), and the down's heath in patches.
  for (let index = 0; index < count; index += 1) {
    if (!open(index)) continue;
    const tx = index % width, ty = Math.floor(index / width);
    let chosen = own;
    if (kind === "coast") chosen = nearSea![index]! < 8 ? own : meadow;
    else if (kind === "fen") chosen = nearWater![index]! < 5 ? own : meadow;
    else if (kind === "woodland") chosen = nearForest![index]! < 5 ? own : meadow;
    else if (kind === "downs") {
      const inBye = Math.hypot(tx - 40, ty - 46) < 9 + (fbm(tx * 0.2, ty * 0.2, seed + 61_001, 2) - 0.5) * 6;
      chosen = inBye ? meadow : patch !== 0 && fbm(tx * 0.08, ty * 0.08, seed + 61_103, 3) > 0.62 ? patch : own;
    }
    fill[index] = chosen;
  }

  // The bands: a shore on the sea's land edge (sand, shingle or salt marsh by stretches), a reed bed on a fen's water
  // edge, and the Wave 22 transition where the land's fill meets the meadow (or the down's heath).
  const shoreKinds = ["sand_beach", "shingle", "salt_marsh"] as const;
  for (let index = 0; index < count; index += 1) {
    if (!open(index)) continue;
    const tx = index % width, ty = Math.floor(index / width);
    let touchesSea = false, touchesWater = false, meetsOther = 0;
    for (const [dx, dy] of NEIGHBOURS) {
      const x = tx + dx, y = ty + dy;
      if (x < 0 || y < 0 || x >= width || y >= height) continue;
      const neighbour = y * width + x;
      if (sea[neighbour] === 1) touchesSea = true;
      if (terrains[neighbour] === "water") touchesWater = true;
      if (open(neighbour) && fill[neighbour] !== fill[index] && fill[index] !== meadow) meetsOther = fill[neighbour]!;
    }
    if (kind === "coast" && touchesSea) {
      // fbm gathers near 0.5: the cuts give each shore a stretch of about a third.
      const field = fbm(tx * 0.07, ty * 0.07, seed + 62_011, 2);
      const stretch = shoreKinds[field < 0.46 ? 0 : field < 0.54 ? 1 : 2]!;
      band[index] = key(`shore/${stretch}_${variant(index, "archetype:shore")}`);
    } else if (kind === "fen" && touchesWater) {
      band[index] = key(`boundary/reed_bed_${variant(index, "archetype:reed")}`);
    } else if (meetsOther !== 0 && ground.edge !== undefined) {
      const edge = fill[index] === patch || meetsOther === patch ? "heath" : ground.edge;
      band[index] = key(`boundary/${edge}_edge_${variant(index, "archetype:edge")}`);
    }
  }

  // The decals: the land's scatter on its own fill (never on a band), the shore's driftwood and rock pools on the shore.
  const shoreProps = ground.decals.filter(name => name.includes("driftwood") || name.includes("rock_pool"));
  const fieldProps = ground.decals.filter(name => !shoreProps.includes(name));
  for (let index = 0; index < count; index += 1) {
    if (!open(index) || hashSeed(seed, "archetype:decal", index) % 1000 >= ground.decalPermille) continue;
    const onShore = band[index] !== 0 && keys[band[index]!]!.startsWith("shore/");
    const pool = onShore ? shoreProps : band[index] === 0 && fill[index] !== meadow ? fieldProps : [];
    if (pool.length > 0) decal[index] = key(pool[hashSeed(seed, "archetype:decal-pick", index) % pool.length]!);
  }
  return { keys, fill, band, decal };
}
