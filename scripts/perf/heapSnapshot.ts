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
  // A path from the root to each node (breadth first over strong edges), for naming what the dominator tree shows.
  const parentNode = new Uint32Array(nodeCount).fill(UNSET); const parentEdge = new Uint32Array(nodeCount).fill(UNSET);
  const queue = new Uint32Array(nodeCount); let head = 0; let tailAt = 0; queue[tailAt++] = 0; parentNode[0] = 0;
  while (head < tailAt) {
    const n = queue[head++]!;
    for (let e = firstEdge[n]!; e < firstEdge[n + 1]!; e += EF) { if (edges[e + eType] === WEAK) continue; const t = target(e); if (parentNode[t] !== UNSET) continue; parentNode[t] = n; parentEdge[t] = e; queue[tailAt++] = t; }
  }
  const edgeLabel = (e: number) => { const kind = edges[e + eType]!; const value = edges[e + eName]!;
    return kind === ELEMENT || kind === HIDDEN ? `[${value}]` : (strings[value] ?? "?").slice(0, 40); };
  const pathOf = (n: number) => { const hops: string[] = []; let at = n;
    while (at !== 0 && parentNode[at] !== UNSET && hops.length < 12) { hops.unshift(edgeLabel(parentEdge[at]!)); at = parentNode[at]!; }
    return hops.join(" → "); };
  // The dominator tree from the root, children of at least `minMB`, `depth` levels.
  const childCount = new Uint32Array(reachable + 1);
  for (let p = 0; p < root; p++) if (idom[p] !== UNSET) childCount[idom[p]! + 1]! += 1;
  for (let p = 0; p < reachable; p++) childCount[p + 1]! += childCount[p]!;
  const children = new Uint32Array(childCount[reachable]!); const at = childCount.slice(0, reachable);
  for (let p = 0; p < root; p++) if (idom[p] !== UNSET) children[at[idom[p]!]!++] = p;
  type TreeRow = { depth: number; retainedMB: number; selfMB: number; type: string; name: string; path: string };
  const tree: TreeRow[] = []; const minBytes = 4e6;
  const walk = (p: number, depth: number) => {
    const kids = [...children.subarray(childCount[p]!, childCount[p + 1]!)].filter(q => retained[q]! >= minBytes).sort((a, b) => retained[b]! - retained[a]!);
    for (const q of kids.slice(0, 8)) {
      const n = order[q]!;
      tree.push({ depth, retainedMB: mb(retained[q]!), selfMB: mb(nodes[n * NF + nSelf]!), type: typeOf(n), name: nameOf(n).slice(0, 50), path: pathOf(n) });
      if (depth < 7) walk(q, depth + 1);
    }
  };
  walk(root, 0);
  // Shared data (the game state reached from React, refs and closures at once) is dominated by the root itself, so the
  // tree says little about it. Two more views:
  //  - by path: every node's self size under the first names of its shortest path from the root (index hops and
  //    Blink's own holders left out);
  //  - the game state: objects with tick + buildings + walkers fields, how many are alive, and for the biggest the size
  //    reached through each field (breadth first, a node counted under the first field that reaches it).
  const SKIP = /^\[\d+\]$|^\d+ \/ |^global_object$|^context$|^previous$|^shared$|^map$|^properties$|^elements$|^table$/;
  const byPath = new Map<string, { self: number; count: number }>();
  for (let n = 1; n < nodeCount; n++) {
    if (parentNode[n] === UNSET) continue;
    const labels = pathOf(n).split(" → ").filter(label => !SKIP.test(label)).slice(0, 4).join(" → ");
    const entry = byPath.get(labels) ?? { self: 0, count: 0 }; entry.self += nodes[n * NF + nSelf]!; entry.count += 1; byPath.set(labels, entry);
  }
  const pathRows = [...byPath].map(([path, entry]) => ({ path, selfMB: mb(entry.self), count: entry.count })).sort((a, b) => b.selfMB - a.selfMB).slice(0, top);
  const fieldNames = (n: number) => { const names = new Map<string, number>();
    for (let e = firstEdge[n]!; e < firstEdge[n + 1]!; e += EF) if (edges[e + eType] === PROPERTY) names.set(strings[edges[e + eName]!] ?? "", target(e)); return names; };
  const states: number[] = [];
  for (let n = 0; n < nodeCount; n++) { if (typeOf(n) !== "object") continue; const names = fieldNames(n); if (names.has("tick") && names.has("buildings") && names.has("walkers")) states.push(n); }
  const seen = new Uint8Array(nodeCount);
  const reach = (start: number) => { let bytes = 0; let objects = 0; const stack = [start];
    while (stack.length > 0) { const n = stack.pop()!; if (seen[n]) continue; seen[n] = 1; bytes += nodes[n * NF + nSelf]!; objects += 1;
      for (let e = firstEdge[n]!; e < firstEdge[n + 1]!; e += EF) { const kind = edges[e + eType]!; if (kind === WEAK) continue; const t = target(e);
        const tType = typeOf(t); if (tType === "code" || tType === "hidden" || tType === "object shape" || tType === "closure" || nameOf(t) === "system / Context") continue;
        if (!seen[t]) stack.push(t); } }
    return { bytes, objects }; };
  const stateRows = states.map(n => ({ node: n, path: pathOf(n).slice(-200), fields: fieldNames(n).size }));
  let stateFields: { field: string; MB: number; objects: number }[] = [];
  if (states.length > 0) {
    // The live state (the one the page reaches first) claims its fields first; then what other states add.
    const [first, ...rest] = [...states].sort((a, b) => pathOf(a).length - pathOf(b).length);
    seen[first!] = 1;
    stateFields = [...fieldNames(first!)].map(([field, t]) => ({ field, ...reach(t) })).map(row => ({ field: row.field, MB: mb(row.bytes), objects: row.objects })).sort((a, b) => b.MB - a.MB);
    const others = rest.map(n => reach(n)); stateFields.push({ field: `(그 밖의 상태 ${rest.length}개가 더한 것)`, MB: mb(others.reduce((sum, row) => sum + row.bytes, 0)), objects: others.reduce((sum, row) => sum + row.objects, 0) });
  }
  return { byPath: pathRows, states: stateRows.slice(0, 20), stateCount: states.length, stateFields, nodes: nodeCount, reachable, totalSelfMB: mb(total), rootRetainedMB: mb(retained[root]!), holders: holderRows, kinds: kindRows, tree };
}

if (process.argv[1]?.endsWith("heapSnapshot.ts")) {
  const [file] = process.argv.slice(2); if (file === undefined) throw new Error("Usage: heapSnapshot.ts <file.heapsnapshot> [--top N] [--json out]");
  const flag = (name: string) => { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : undefined; };
  const started = Date.now(); const snapshot = await readSnapshot(file);
  const result = analyseSnapshot(snapshot, Number(flag("top") ?? 40));
  console.log(`${file}: ${result.nodes} nodes, ${result.totalSelfMB} MB self, ${result.rootRetainedMB} MB retained from the root (${((Date.now() - started) / 1000).toFixed(1)} s)`);
  console.log(`game states alive: ${result.stateCount}`); for (const row of result.stateFields.slice(0, 25)) console.log(`  ${String(row.MB).padStart(7)} MB  ${row.field} (${row.objects} objects)`);
  for (const row of result.byPath.slice(0, 25)) console.log(`  ${String(row.selfMB).padStart(7)} MB  ${row.path.slice(0, 160)} (${row.count})`);
  for (const row of result.tree.slice(0, 20)) console.log(`${"  ".repeat(row.depth)}${String(row.retainedMB).padStart(7)} MB  ${row.type} ${row.name}  ← ${row.path.slice(-160)}`);
  const json = flag("json"); if (json !== undefined) writeFileSync(json, `${JSON.stringify(result, null, 1)}\n`);
}
