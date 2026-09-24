// Copies the ground-relevant part (tiles, palisade, buildings, houses) of the automatic-growth seed 1-5 final states into
// tests/fixtures/boundary/, so the boundary tolerance tests do not read output/ (AGENTS rule 13).
// Usage: npx tsx scripts/extractBoundaryFixtures.ts <dir containing seed1..seed5/final-state.json>
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { gzipSync } from "node:zlib";
import { decodeSave } from "../src/save/saveCodec";

const source = process.argv[2];
if (source === undefined) throw new Error("Pass the folder that holds seed1..seed5/final-state.json");
for (const seed of [1, 2, 3, 4, 5]) {
  const path = resolve(source, `seed${seed}`, "final-state.json");
  const bytes = readFileSync(path);
  const state = decodeSave(new Uint8Array(bytes)).envelope.state;
  const fixture = {
    source: path.slice(path.indexOf("output/")),
    sourceSha256: createHash("sha256").update(bytes).digest("hex"),
    seed: state.seed, width: state.width, height: state.height,
    terrain: state.tiles.map(tile => tile.terrain[0]).join(""),
    roads: state.tiles.map(tile => (tile.hasRoad ? "1" : "0")).join(""),
    buildingIds: state.tiles.flatMap((tile, index) => (tile.buildingId === null ? [] : [[index, tile.buildingId]])),
    palisade: state.palisade,
    farms: state.buildings.filter(building => building.kind === "wheat_farm").map(({ id, kind, tx, ty }) => ({ id, kind, tx, ty })),
    // Enough of the city to draw it (evidence captures); simulation-only fields are left out.
    buildings: state.buildings, houses: state.houses, era: state.era,
  };
  writeFileSync(resolve("tests/fixtures/boundary", `seed${seed}-ground.json.gz`), gzipSync(JSON.stringify(fixture)));
  console.log(seed, fixture.farms.length, "farms", fixture.roads.split("1").length - 1, "road tiles");
}
