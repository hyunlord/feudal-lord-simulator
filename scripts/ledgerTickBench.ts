// Gate ⑤ of B3: advanceTick time with the ledger vs without, on a natural market town.
// Usage: tsx scripts/ledgerTickBench.ts <repoRoot> <stateFile> <warmTicks> <measureTicks>
// Warms up (so the new code's ledger reaches its retained size), then times each advanceTick.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

type AnyState = Record<string, unknown> & { tick: number };

const [root, stateFile, warm, measure] = process.argv.slice(2);
if (root === undefined || stateFile === undefined) throw new RangeError("Usage: ledgerTickBench.ts <repoRoot> <stateFile> <warmTicks> <measureTicks>");
const load = async <T>(path: string) => await import(pathToFileURL(resolve(root, path)).href) as T;
const { advanceTick } = await load<{ advanceTick: (state: AnyState) => AnyState }>("src/engine/tick.ts");
const { decodeSave } = await load<{ decodeSave: (bytes: Uint8Array) => { envelope: { state: AnyState } } }>("src/save/saveCodec.ts");
let state = decodeSave(new Uint8Array(readFileSync(resolve(stateFile)))).envelope.state;
for (let tick = 0; tick < Number(warm); tick += 1) state = advanceTick(state);
const samples: number[] = [];
for (let tick = 0; tick < Number(measure); tick += 1) {
  const started = performance.now();
  state = advanceTick(state);
  samples.push(performance.now() - started);
}
const sorted = [...samples].sort((left, right) => left - right);
const pick = (q: number) => Number(sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]!.toFixed(4));
const ledger = state.ledger as { entries: unknown[] } | undefined;
process.stdout.write(`${JSON.stringify({ root, stateFile, warm: Number(warm), measure: Number(measure),
  meanMs: Number((samples.reduce((a, b) => a + b, 0) / samples.length).toFixed(4)), p50Ms: pick(0.5), p95Ms: pick(0.95), p99Ms: pick(0.99),
  ledgerEntries: ledger?.entries.length ?? null })}\n`);
