// C1c-2 rule 10 measurement for the arable layout/tending caches: the cost of one field layout + tending on the
// migrated seed-2 town (30 strips, 5 farmsteads) with a cold key (a fresh `tiles` array each call) and a warm key.
// Usage: tsx scripts/arableCacheBench.ts [calls=2000]
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import type { GameState } from "../src/engine/engine.types";
import { migrateStateV9ToV10 } from "../src/save/migrations/v9ToV10";
import { arableLayouts, stripTending } from "../src/zones/arableFields";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const state = migrateStateV9ToV10(JSON.parse(gunzipSync(readFileSync(resolve(ROOT, "docs/verification/c1b-zone-brush/seed2-natural-snapshot.json.gz"))).toString()) as GameState);
const calls = Number(process.argv[2] ?? 2000);
const time = (label: string, next: () => GameState) => {
  const started = performance.now();
  for (let index = 0; index < calls; index += 1) { const current = next(); stripTending(current, arableLayouts(current)); }
  const perCall = (performance.now() - started) / calls;
  return { label, calls, msPerCall: Number(perCall.toFixed(4)) };
};
const cold = time("cold key (fresh tiles each call)", () => ({ ...state, tiles: [...state.tiles] }));
const warm = time("warm key (same state)", () => state);
process.stdout.write(`${JSON.stringify({ strips: arableLayouts(state).reduce((sum, layout) => sum + layout.strips.length, 0), cold, warm }, null, 2)}\n`);
