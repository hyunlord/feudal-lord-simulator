// NAT-1 "0 walkers on roofs": the whole town's draw queue as the renderer builds it (objectRenderItemsForFrame over
// every tile with the walkers the screen draws, screenWalkers; the bridges' rails, sortRenderItems), then the walkers placed the way drawObjectRenderItems draws them —
// before NAT-1 (every walker after all the objects, except in a stone gate's passage or on a bridge) and now
// (walkerOcclusion.ts; the passage as drawObjectRenderItems has it, inGatePassage).
// For each order, the box rule's faults: a walker drawn over an object it is behind ("on a roof") and a walker drawn
// under an object it stands in front of ("hidden").
//   npx tsx scripts/nat1Occlusion.ts <state.json | save.json[.gz]> [...]   → one JSON line per file
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import type { GameState } from "../src/engine/engine.types";
import type { RenderQueueItem } from "../src/render/objectRenderOrder";
import { objectRenderItemsForFrame } from "../src/render/renderObjectFrameCache";
import { sortRenderItems } from "../src/render/objectRenderSort";
import { bridgeRailPieces } from "../src/render/drawBridges";
import { bridgeAt } from "../src/world/bridges";
import { inGatePassage, occlusionFaults, placeWalkers } from "../src/render/walkerOcclusion";
import { decodeSave } from "../src/save/saveCodec";
import type { Walker } from "../src/agents/walker.types";
import { withResidentWalkers } from "../src/render/presentation/residentWalkerState";
import { roadAlignedWalkers } from "../src/render/walkerRoadAlignment";
import { boundaryV2Enabled } from "../src/render/renderBoundaryFlag";

export function loadState(path: string): GameState {
  const bytes = path.endsWith(".gz") ? gunzipSync(readFileSync(path)) : readFileSync(path);
  const json = JSON.parse(bytes.toString("utf8")) as { schemaVersion?: number; state?: GameState } & GameState;
  return typeof json.schemaVersion === "number" && json.state !== undefined ? decodeSave(new Uint8Array(bytes)).envelope.state as GameState : json;
}

/** NAT-4 QA-005: the walkers as the screen draws them — the residents with the simulation's walkers (presentedState),
 * on the road ribbon's centreline with curved ground on (canvasRuntimeFrame displayWalkers), which cuts a road's
 * corner, toward the wall where a road turns along it. */
export function screenWalkers(state: GameState): readonly Walker[] {
  const presented = withResidentWalkers(state);
  return boundaryV2Enabled() ? roadAlignedWalkers(presented, presented.walkers) : presented.walkers;
}

export function drawOrders(state: GameState) {
  const range = { minTx: 0, minTy: 0, maxTx: state.width - 1, maxTy: state.height - 1 };
  const items = objectRenderItemsForFrame({ state, visibleTiles: state.tiles, range, includeGroundCover: false, renderWalkers: screenWalkers(state) });
  const rails = bridgeRailPieces(state, state.tiles).map(piece => ({ kind: "bridge_rail" as const, piece, depth: piece.depth, anchorTx: piece.tx, id: `bridge:${piece.tx}:${piece.ty}:${piece.side}` }));
  const queue = sortRenderItems([...items, ...rails]);
  const gates = queue.flatMap(item => item.kind === "palisade_segment" ? (item.stoneNodes ?? []).filter(node => node.kind === "gate").map(node => node.point) : []);
  const keepOrder = (item: Extract<RenderQueueItem, { kind: "walker" }>) =>
    inGatePassage(item.walker.position, gates)
    || bridgeAt(state, { tx: Math.round(item.walker.position.tx), ty: Math.round(item.walker.position.ty) }) !== null;
  const deferred = [...queue.filter(item => item.kind !== "walker" || keepOrder(item)), ...queue.filter(item => item.kind === "walker" && !keepOrder(item))];
  const placed = placeWalkers(queue, state, keepOrder);
  return { queue, deferred, placed, keepOrder, walkers: queue.filter(item => item.kind === "walker").length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const path of process.argv.slice(2)) {
    const state = loadState(path);
    const { deferred, placed, keepOrder, walkers } = drawOrders(state);
    const before = occlusionFaults(deferred, state, keepOrder); const after = occlusionFaults(placed, state, keepOrder);
    console.log(JSON.stringify({ file: path, tick: state.tick, walkers, before: { onRoof: before.onRoof.length, hidden: before.hidden.length },
      after: { onRoof: after.onRoof.length, hidden: after.hidden.length, samples: [...after.onRoof, ...after.hidden].slice(0, 6) } }));
  }
}
