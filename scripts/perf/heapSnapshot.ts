// SMOOTH-G: a Chrome heap snapshot (.heapsnapshot) → what holds the JS heap. The file is hundreds of MB, past V8's
// string limit, so it is read as bytes: the node and edge arrays into typed arrays, then the string table.
//  - retained size: the dominator tree (Cooper–Harvey–Kennedy over the reverse post order from the root; weak edges
//    do not retain), each node's retained size = its own + what it dominates.
//  - holders: every variable in a closure context (edge type "context": a module's top-level `const cache = new
//    Map()` is one) and every property of a module-level object, with the retained size of what it points at.
//  - kinds: self size summed by node type and constructor name (native Blink nodes included).
//   tsx scripts/perf/heapSnapshot.ts <file.heapsnapshot> [--top 40] [--json <out.json>]
import { createReadStream, writeFileSync } from "node:fs";

interface Meta { node_fields: string[]; node_types: (string[] | string)[]; edge_fields: string[]; edge_types: (string[] | string)[] }

export async function readSnapshot(path: string) {
  let header = ""; let meta: Meta | null = null; let nodeCount = 0; let edgeCount = 0;
  let nodes = new Uint32Array(0); let edges = new Uint32Array(0);
  let phase: "header" | "nodes" | "betweenEdges" | "edges" | "skip" | "strings" = "header";
  let index = 0; let number = 0; let inNumber = false; const tail: Buffer[] = []; let skipText = "";
  for await (const chunk of createReadStream(path, { highWaterMark: 1 << 22 }) as AsyncIterable<Buffer>) {
    let offset = 0;
    if (phase === "header") {
      header += chunk.toString("latin1"); const at = header.indexOf('"nodes":[');
      if (at < 0) continue;
      const json = JSON.parse(`${header.slice(0, header.lastIndexOf(",", at))}}`);
      meta = json.snapshot.meta as Meta; nodeCount = json.snapshot.node_count; edgeCount = json.snapshot.edge_count;
      nodes = new Uint32Array(nodeCount * meta.node_fields.length); edges = new Uint32Array(edgeCount * meta.edge_fields.length);
      offset = chunk.length - (header.length - (at + '"nodes":['.length)); header = ""; phase = "nodes";
    }
    for (let i = offset; i < chunk.length; i++) {
      const byte = chunk[i]!;
      if (phase === "nodes" || phase === "edges") {
        if (byte >= 48 && byte <= 57) { number = number * 10 + (byte - 48); inNumber = true; continue; }
        if (inNumber) { (phase === "nodes" ? nodes : edges)[index++] = number; number = 0; inNumber = false; }
        if (byte === 93) { phase = phase === "nodes" ? "betweenEdges" : "skip"; index = 0; skipText = ""; }
      } else if (phase === "betweenEdges" || phase === "skip") {
        skipText += String.fromCharCode(byte); if (skipText.length > 32) skipText = skipText.slice(-32);
        if (phase === "betweenEdges" && skipText.endsWith('"edges":[')) phase = "edges";
        else if (phase === "skip" && skipText.endsWith('"strings":[')) { phase = "strings"; tail.push(chunk.subarray(i + 1)); break; }
      } else if (phase === "strings") { tail.push(chunk.subarray(i)); break; }
    }
  }
  if (meta === null) throw new Error(`${path}: no snapshot header`);
  const text = Buffer.concat(tail).toString("utf8"); const end = text.lastIndexOf("]");
  const strings = JSON.parse(`[${text.slice(0, end)}]`) as string[];
  return { meta, nodeCount, edgeCount, nodes, edges, strings };
}

export function analyseSnapshot(snapshot: Awaited<ReturnType<typeof readSnapshot>>, top = 40) {
  const { meta, nodeCount, nodes, edges, strings } = snapshot;
  const NF = meta.node_fields.length; const EF = meta.edge_fields.length;
  const nType = meta.node_fields.indexOf("type"); const nName = meta.node_fields.indexOf("name"); const nSelf = meta.node_fields.indexOf("self_size"); const nEdges = meta.node_fields.indexOf("edge_count");
  const eType = meta.edge_fields.indexOf("type"); const eName = meta.edge_fields.indexOf("name_or_index"); const eTo = meta.edge_fields.indexOf("to_node");
  const nodeTypes = meta.node_types[nType] as string[]; const edgeTypes = meta.edge_types[eType] as string[];
  const WEAK = edgeTypes.indexOf("weak"); const CONTEXT = edgeTypes.indexOf("context"); const PROPERTY = edgeTypes.indexOf("property");
  const ELEMENT = edgeTypes.indexOf("element"); const HIDDEN = edgeTypes.indexOf("hidden");
  const firstEdge = new Uint32Array(nodeCount + 1);
  for (let n = 0; n < nodeCount; n++) firstEdge[n + 1] = firstEdge[n]! + nodes[n * NF + nEdges]! * EF;
  const target = (e: number) => edges[e + eTo]! / NF;
  // Retainers (reverse edges) without weak edges.
  const retainerCount = new Uint32Array(nodeCount + 1);
  for (let n = 0; n < nodeCount; n++) for (let e = firstEdge[n]!; e < firstEdge[n + 1]!; e += EF) if (edges[e + eType] !== WEAK) retainerCount[target(e) + 1]! += 1;
  for (let n = 0; n < nodeCount; n++) retainerCount[n + 1]! += retainerCount[n]!;
  const retainers = new Uint32Array(retainerCount[nodeCount]!); const fill = retainerCount.slice(0, nodeCount);
  for (let n = 0; n < nodeCount; n++) for (let e = firstEdge[n]!; e < firstEdge[n + 1]!; e += EF) if (edges[e + eType] !== WEAK) retainers[fill[target(e)]!++] = n;
  // Post order from the root (node 0), iterative.
  const UNSET = 0xffffffff; const post = new Uint32Array(nodeCount).fill(UNSET); const order = new Uint32Array(nodeCount);
  const visited = new Uint8Array(nodeCount); const stackNode = new Uint32Array(nodeCount); const stackEdge = new Uint32Array(nodeCount);
  let depth = 0; let count = 0; stackNode[0] = 0; stackEdge[0] = firstEdge[0]!; visited[0] = 1;
  while (depth >= 0) {
    const n = stackNode[depth]!; let e = stackEdge[depth]!;
    for (; e < firstEdge[n + 1]!; e += EF) { if (edges[e + eType] === WEAK) continue; const t = target(e); if (visited[t]) continue; visited[t] = 1; break; }
    if (e < firstEdge[n + 1]!) { stackEdge[depth] = e + EF; depth += 1; const t = target(e); stackNode[depth] = t; stackEdge[depth] = firstEdge[t]!; }
    else { post[n] = count; order[count++] = n; depth -= 1; }
  }
  const reachable = count; const root = reachable - 1;
  // Dominators by post-order number.
  const idom = new Uint32Array(reachable).fill(UNSET); idom[root] = root;
  for (let changed = true, pass = 0; changed && pass < 200; pass++) {
    changed = false;
    for (let p = root - 1; p >= 0; p--) {
      const n = order[p]!; let next = UNSET;
      for (let r = retainerCount[n]!; r < retainerCount[n + 1]!; r++) {
        const q = post[retainers[r]!]!; if (q === UNSET || idom[q] === UNSET) continue;
        if (next === UNSET) { next = q; continue; }
        let a = q, b = next; while (a !== b) { while (a < b) a = idom[a]!; while (b < a) b = idom[b]!; } next = a;
      }
      if (next !== UNSET && idom[p] !== next) { idom[p] = next; changed = true; }
    }
  }
  const retained = new Float64Array(reachable);
  for (let p = 0; p < reachable; p++) retained[p] = nodes[order[p]! * NF + nSelf]!;
  for (let p = 0; p < root; p++) if (idom[p] !== UNSET && idom[p] !== p) retained[idom[p]!]! += retained[p]!;
  const retainedOf = (n: number) => post[n] === UNSET ? 0 : retained[post[n]!]!;
  const typeOf = (n: number) => nodeTypes[nodes[n * NF + nType]!] ?? "?";
  const nameOf = (n: number) => strings[nodes[n * NF + nName]!] ?? "";
  const mb = (bytes: number) => Math.round(bytes / 1e5) / 10;

  // Holders: named context variables and module-level object properties.
  const holders = new Map<number, { names: Set<string>; via: string }>();
  for (let n = 0; n < nodeCount; n++) {
    const fromType = typeOf(n); const fromName = nameOf(n);
    for (let e = firstEdge[n]!; e < firstEdge[n + 1]!; e += EF) {
      const kind = edges[e + eType]!; if (kind !== CONTEXT && !(kind === PROPERTY && fromName === "system / Context")) continue;
      const name = strings[edges[e + eName]!] ?? ""; const t = target(e);
      if (retainedOf(t) < 1e6) continue;
      const entry = holders.get(t) ?? { names: new Set<string>(), via: fromType }; entry.names.add(name); holders.set(t, entry);
    }
  }
  const holderRows = [...holders].map(([n, entry]) => ({ names: [...entry.names].slice(0, 4), type: typeOf(n), constructor: nameOf(n).slice(0, 60), retainedMB: mb(retainedOf(n)), selfMB: mb(nodes[n * NF + nSelf]!) }))
    .sort((a, b) => b.retainedMB - a.retainedMB).slice(0, top);
  // Self size by type and name.
  const kinds = new Map<string, { count: number; self: number }>();
  for (let n = 0; n < nodeCount; n++) {
    const type = typeOf(n); const name = type === "object" || type === "native" || type === "closure" || type === "hidden" ? nameOf(n).slice(0, 60) : "";
    const key = `${type}|${name}`; const entry = kinds.get(key) ?? { count: 0, self: 0 }; entry.count += 1; entry.self += nodes[n * NF + nSelf]!; kinds.set(key, entry);
  }
  const kindRows = [...kinds].map(([key, entry]) => ({ type: key.split("|")[0]!, name: key.slice(key.indexOf("|") + 1), count: entry.count, selfMB: mb(entry.self) }))
    .sort((a, b) => b.selfMB - a.selfMB).slice(0, top);
  let total = 0; for (let n = 0; n < nodeCount; n++) total += nodes[n * NF + nSelf]!;
  void ELEMENT; void HIDDEN;
  return { nodes: nodeCount, reachable, totalSelfMB: mb(total), rootRetainedMB: mb(retained[root]!), holders: holderRows, kinds: kindRows };
}

if (process.argv[1]?.endsWith("heapSnapshot.ts")) {
  const [file] = process.argv.slice(2); if (file === undefined) throw new Error("Usage: heapSnapshot.ts <file.heapsnapshot> [--top N] [--json out]");
  const flag = (name: string) => { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : undefined; };
  const started = Date.now(); const snapshot = await readSnapshot(file);
  const result = analyseSnapshot(snapshot, Number(flag("top") ?? 40));
  console.log(`${file}: ${result.nodes} nodes, ${result.totalSelfMB} MB self, ${result.rootRetainedMB} MB retained from the root (${((Date.now() - started) / 1000).toFixed(1)} s)`);
  for (const row of result.holders.slice(0, 20)) console.log(`  ${String(row.retainedMB).padStart(8)} MB  ${row.names.join(",")}  (${row.type} ${row.constructor})`);
  const json = flag("json"); if (json !== undefined) writeFileSync(json, `${JSON.stringify(result, null, 1)}\n`);
}
