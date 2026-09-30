// FIX-11 (13, rule 10): cost of the render's market-activity check per frame — the first ask of a state (a miss) and
// the repeats of the same state (hits: the frames between two ticks, and the world signs + facility art asking twice).
//   tsx scripts/perf/marketSaleCheck.ts <save.json>
import { readFileSync } from "node:fs";
import { marketHasSaleCandidate } from "../../src/engine/marketSettlement";
import type { GameState } from "../../src/engine/engine.types";
import { decodeSave } from "../../src/save/saveCodec";

const state = decodeSave(new Uint8Array(readFileSync(process.argv[2]!))).envelope.state as unknown as GameState;
const markets = state.buildings.filter(building => building.kind === "market");
const time = (run: () => void, repeat: number) => { const start = performance.now(); for (let i = 0; i < repeat; i += 1) run(); return (performance.now() - start) / repeat; };
// A miss: a fresh tiles array each time (the road search again); a frame at 5×: new buildings (stock), same tiles.
const miss = time(() => { const fresh = { ...state, tiles: [...state.tiles] }; for (const market of markets) marketHasSaleCandidate(fresh, market); }, 200);
let tick = state.tick;
const hit = time(() => { tick += 5; const next = { ...state, tick, buildings: [...state.buildings] }; for (const market of markets) marketHasSaleCandidate(next, market); }, 2000);
process.stdout.write(`${JSON.stringify({ markets: markets.length, buildings: state.buildings.length, missMsPerFrame: +miss.toFixed(4), framesAt5xMs: +hit.toFixed(5) })}\n`);
