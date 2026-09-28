import { readFileSync } from "node:fs";
import { decodeSave } from "../src/save/saveCodec";
import type { GameState } from "../src/engine/engine.types";
import { canPlaceBuilding } from "../src/world/placement";
const state = decodeSave(new Uint8Array(readFileSync("fixtures/saves/v26/palisade-construction.save.json"))).envelope.state as GameState;
const reasons = new Map<string, number>();
let nearWater = 0;
for (const t of state.tiles) {
  const adj = [[-1,0],[2,0],[0,-1],[0,2],[-1,1],[2,1],[1,-1],[1,2]].some(([dx,dy]) => state.tiles[(t.ty+dy!)*state.width+t.tx+dx!]?.terrain === "water");
  if (!adj) continue; nearWater++;
  const r = canPlaceBuilding(state, "fulling_mill", t.tx, t.ty);
  const key = r.ok ? "ok" : String((r as {reason?: string}).reason ?? JSON.stringify(r).slice(0,60));
  reasons.set(key, (reasons.get(key) ?? 0) + 1);
}
console.log("near water", nearWater, [...reasons]);
const water = state.tiles.filter(t => t.terrain === "water"); console.log("water x range", Math.min(...water.map(t=>t.tx)), Math.max(...water.map(t=>t.tx)), "y", Math.min(...water.map(t=>t.ty)), Math.max(...water.map(t=>t.ty)), "size", state.width, state.height);
