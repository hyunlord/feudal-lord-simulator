// How much of advanceTick is road path search? Measured without touching engine files: a V8 sampling CPU profile
// of N advanceTick calls on repository fixtures, with each sample attributed to "route search" when its call
// chain passes through a routing module. Measurement only.
// Usage: npx tsx scripts/measureTickRouting.ts [--ticks 3000] [--out docs/verification/b11-render-metrics/tick-routing.json]
import { mkdirSync, writeFileSync } from "node:fs";
import { Session } from "node:inspector/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { benchmarkCities } from "./renderFixtureStates";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const args = process.argv.slice(2);
const flag = (name: string, fallback: string) => { const index = args.indexOf(`--${name}`); return index >= 0 ? args[index + 1] ?? fallback : fallback; };
const TICKS = Number(flag("ticks", "3000"));

/** Modules whose functions are road route search or its caches (a sample counts once if any is on its stack). */
export const ROUTING_MODULES = [
  "src/engine/routing.ts",
  "src/world/roadGraph.ts",
  "src/engine/wallCarryRoute.ts",
  "src/engine/distributorAccess.ts",
] as const;

const CITIES = {
  pop176: () => benchmarkCities().pop176,
  lots24: () => benchmarkCities().lots24,
} as const;

type ProfileNode = { id: number; callFrame: { functionName: string; url: string; lineNumber: number }; children?: number[] };

async function measure(city: keyof typeof CITIES) {
  const session = new Session();
  session.connect();
  const { advanceTick } = await import("../src/engine/tick");
  let state = CITIES[city]();
  for (let index = 0; index < 200; index += 1) state = advanceTick(state); // warm up JIT and caches
  await session.post("Profiler.enable");
  await session.post("Profiler.setSamplingInterval", { interval: 100 });
  await session.post("Profiler.start");
  const started = performance.now();
  for (let index = 0; index < TICKS; index += 1) state = advanceTick(state);
  const wallMs = performance.now() - started;
  const { profile } = await session.post("Profiler.stop");
  session.disconnect();

  const nodes = new Map<number, ProfileNode>((profile.nodes as ProfileNode[]).map(node => [node.id, node]));
  const parent = new Map<number, number>();
  for (const node of nodes.values()) for (const child of node.children ?? []) parent.set(child, node.id);
  const relative = (url: string) => url.replace(/^file:\/\//, "").replace(ROOT.replace(/\/$/, ""), "").replace(/^\//, "");
  let tickUs = 0; let routingUs = 0;
  const byModule = new Map<string, number>(); const selfByFunction = new Map<string, number>();
  const deltas = profile.timeDeltas ?? [];
  (profile.samples ?? []).forEach((id: number, index: number) => {
    const dt = deltas[index] ?? 0;
    const chain: ProfileNode[] = [];
    for (let cursor: number | undefined = id; cursor !== undefined; cursor = parent.get(cursor)) { const node = nodes.get(cursor); if (node) chain.push(node); }
    if (!chain.some(node => node.callFrame.functionName === "advanceTick")) return;
    tickUs += dt;
    const leaf = chain[0];
    if (leaf) { const key = `${leaf.callFrame.functionName || "(anonymous)"} ${relative(leaf.callFrame.url)}:${leaf.callFrame.lineNumber + 1}`; selfByFunction.set(key, (selfByFunction.get(key) ?? 0) + dt); }
    const modules = new Set(chain.map(node => relative(node.callFrame.url)).filter(url => (ROUTING_MODULES as readonly string[]).includes(url)));
    if (modules.size > 0) routingUs += dt;
    // Outermost routing module on the stack owns the sample.
    const outer = [...chain].reverse().find(node => (ROUTING_MODULES as readonly string[]).includes(relative(node.callFrame.url)));
    if (outer) { const key = relative(outer.callFrame.url); byModule.set(key, (byModule.get(key) ?? 0) + dt); }
  });
  return {
    city, ticks: TICKS, startTick: CITIES[city]().tick, wallMsPerTick: wallMs / TICKS,
    sampledTickMs: tickUs / 1000, routingShare: tickUs === 0 ? null : routingUs / tickUs,
    routingByOuterModule: Object.fromEntries([...byModule].sort((a, b) => b[1] - a[1]).map(([key, us]) => [key, us / tickUs])),
    topSelfFunctions: [...selfByFunction].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([fn, us]) => ({ fn, share: us / tickUs })),
  };
}

const results = [];
for (const city of Object.keys(CITIES) as (keyof typeof CITIES)[]) {
  const result = await measure(city);
  results.push(result);
  process.stdout.write(`${city}: ${result.wallMsPerTick.toFixed(3)} ms/tick, route search ${((result.routingShare ?? 0) * 100).toFixed(1)}% of advanceTick\n`);
}
const out = flag("out", "");
if (out !== "") {
  mkdirSync(dirname(resolve(out)), { recursive: true });
  writeFileSync(resolve(out), `${JSON.stringify({ method: "V8 sampling profile (100 µs) of advanceTick in Node; a sample is route search when a ROUTING_MODULES function is on its stack", routingModules: ROUTING_MODULES, node: process.version, results }, null, 2)}\n`);
}
