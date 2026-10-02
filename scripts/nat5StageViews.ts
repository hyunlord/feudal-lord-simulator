// NAT-5 stages: the capture views over the gate states (scripts/nat5StageStates.ts) — for every Wave 42 picture and
// footpath piece the engine's state draws, the cell nearest the town centre that shows it, in summer and in winter, plus
// the forest gate camera (QA round 17: centre (44, 38), zoom 1, 1600 x 1100) of the last year. Written as JSON for
// scripts/nat5StageCaptures.ts (which needs none of the render modules, so the same views run on the base commit).
//   npx tsx scripts/nat5StageViews.ts <states-dir> > views.json
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { GameState } from "../src/engine/engine.types";
import { landOf } from "../src/engine/land";
import { footpathPieces, type FootpathShape } from "../src/render/footpathModel";
import { fallowPicture, treeStagePicture, type LandStagePicture } from "../src/render/landStageModel";
import { clearedTreeTileKeys } from "../src/render/objectRenderOrder";
import { townCentre } from "./landStates";

const [dir] = process.argv.slice(2);
if (dir === undefined) throw new Error("usage: nat5StageViews.ts <states-dir>");
const load = (name: string) => JSON.parse(readFileSync(join(dir, `${name}.json`), "utf8")) as GameState;
const CLOSE = { zoom: 2, width: 1280, height: 800, clip: { x: 480, y: 250, width: 320, height: 240 } };
const views: Record<string, unknown>[] = [];
const near = (state: GameState) => { const centre = townCentre(state); return (tx: number, ty: number) => Math.hypot(tx - centre.tx, ty - centre.ty); };

for (const season of ["summer", "winter"] as const) {
  // Felled trees: each picture in the latest year that has it (a cell the object pass draws it on: open forest).
  const pictures: LandStagePicture[] = ["stump_oak_large_fresh", "stump_ash_small_fresh", "stump_oak_large_mossy", "stump_ash_small_mossy",
    "sapling_1to3", "sapling_4to8", "young_wood_a", "young_wood_b"];
  for (const picture of pictures) {
    for (const year of [3, 2, 1, 0]) {
      const name = `forest-y${year}-${season}`;
      const state = load(name);
      const distance = near(state);
      const cleared = clearedTreeTileKeys(state.buildings, state.constructionSites ?? []);
      const found = (state.forestHarvests ?? []).filter(harvest => {
        const tile = state.tiles[harvest.ty * state.width + harvest.tx];
        return tile?.terrain === "forest" && !tile.hasRoad && tile.buildingId === null && !cleared.has(`${harvest.tx}:${harvest.ty}`)
          && treeStagePicture(harvest, state.tick) === picture;
      }).sort((a, b) => distance(a.tx, a.ty) - distance(b.tx, b.ty))[0];
      if (found === undefined) continue;
      views.push({ name: `tree-${picture}-${season}`, state: name, tile: [found.tx, found.ty], ...CLOSE });
      break;
    }
  }
  // Fallow: the painted field (or the first fallow cell) in each year that has it.
  for (const year of [1, 2, 3]) {
    const name = `forest-y${year}-${season}`;
    const state = load(name);
    const fallow = landOf(state).fallow;
    if (fallow.length === 0) continue;
    const xs = fallow.map(([cell]) => cell % state.width), ys = fallow.map(([cell]) => Math.floor(cell / state.width));
    const [cell, since] = fallow[0] ?? [0, 0];
    const picture = fallowPicture((state.tiles[cell]?.buildingId ?? null) !== null, since, state.tick);
    const tile = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
    views.push({ name: `fallow-${picture}-${season}`, state: name, tile, ...CLOSE });
  }
  // Footpaths: each piece shape in the last year (else the latest year that has it).
  const shapes: FootpathShape[] = ["straight_ne", "straight_nw", "corner_ne", "corner_nw", "corner_n", "corner_s", "fork_ne", "fork_nw", "fork_se",
    "fork_sw", "cross", "end", "dot"];
  for (const shape of shapes) {
    for (const year of [3, 2, 1, 0]) {
      const name = `forest-y${year}-${season}`;
      const state = load(name);
      const distance = near(state);
      const piece = footpathPieces(state, landOf(state).footpaths).filter(entry => entry.rule.shape === shape)
        .sort((a, b) => distance(a.tx, a.ty) - distance(b.tx, b.ty))[0];
      if (piece === undefined) continue;
      views.push({ name: `path-${shape}-${season}`, state: name, tile: [piece.tx, piece.ty], ...CLOSE });
      break;
    }
  }
  views.push({ name: `gate-forest-${season}`, state: `forest-y3-${season}`, tile: [44, 38], zoom: 1, width: 1600, height: 1100, clip: { x: 0, y: 0, width: 1600, height: 1100 } });
  views.push({ name: `gate-field-${season}`, state: `forest-y3-${season}`, tile: [40, 46], zoom: 1.4, width: 1280, height: 800, clip: { x: 160, y: 100, width: 960, height: 600 } });
}
process.stdout.write(`${JSON.stringify(views, null, 1)}\n`);
