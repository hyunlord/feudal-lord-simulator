import type { TerrainType } from "../src/content/terrainConfig";
import { buildWorldGrid, TERRAIN_THRESHOLDS } from "../src/world/terrain";

const WIDTH = 64;
const HEIGHT = 64;
const DEFAULT_SEEDS = [1, 73] as const;

const SYMBOL_BY_TERRAIN: Readonly<Record<TerrainType, string>> = {
  grass: ".",
  forest: "T",
  water: "~",
  rock: "^",
};

function parseSeeds(arguments_: readonly string[]): number[] {
  if (arguments_.length === 0) return [...DEFAULT_SEEDS];

  return arguments_.map((argument) => {
    const seed = Number(argument);
    if (!Number.isInteger(seed)) {
      throw new Error(`seed must be an integer: ${argument}`);
    }
    return seed;
  });
}

function printPreview(seed: number): void {
  const grid = buildWorldGrid({ width: WIDTH, height: HEIGHT, seed });
  const counts: Record<TerrainType, number> = {
    grass: 0,
    forest: 0,
    water: 0,
    rock: 0,
  };

  console.log(`Seed ${seed} (${WIDTH}x${HEIGHT})`);
  for (let ty = 0; ty < grid.height; ty += 1) {
    let row = "";
    for (let tx = 0; tx < grid.width; tx += 1) {
      const terrain = grid.tiles[ty * grid.width + tx]?.terrain;
      if (terrain === undefined) throw new Error(`missing tile at ${tx},${ty}`);
      counts[terrain] += 1;
      row += SYMBOL_BY_TERRAIN[terrain];
    }
    console.log(row);
  }

  const ratios = Object.fromEntries(
    Object.entries(counts).map(([terrain, count]) => [
      terrain,
      `${count} (${((count / grid.tiles.length) * 100).toFixed(1)}%)`,
    ]),
  );
  console.log(`Counts ${JSON.stringify(ratios)}`);
  console.log("");
}

console.log("Legend: .=grass T=forest ~=water ^=rock");
console.log(`Thresholds ${JSON.stringify(TERRAIN_THRESHOLDS)}`);
console.log("");

for (const seed of parseSeeds(process.argv.slice(2))) {
  printPreview(seed);
}
