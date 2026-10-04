import { GATE_HALF_CLEARANCE } from "../world/wallTraversal";
import { unitEdgeKey, type WallNode } from "../world/boundary/wallBaseline";
import type { TileEdgePoint } from "../world/palisadeGeometry";
import { gateArtAxis } from "./gateArtGeometry";
import type { GateEndNode } from "./gateCornerModules";
import { gateHasSharedOpening } from "./gatePortalBranches";
import { tileToScreen } from "./iso";
import type { StoneWallNode } from "./stoneWallTopology";
import { wallFaceAsset } from "./terrainVariantAssets";
import { drawCroppedWorldSprite } from "./worldSprite";

// QA-003 gate posts (the user's 2026-10-04 request, after Astra's corner-gate piece and timber jamb were both turned
// down): where a wall strip ends at a gate opening, a door post stands on its end.
//  - Palisade: the strip's own end post doubled, drawn from the face strip picture itself (as the NAT-5 corner joins
//    are), so its colour, width and grain are the wall's: two stake columns side by side, GATE_POST_WIDTH times a stake's
//    width and GATE_POST_HEIGHT times the face's height. Below the upper rail the columns keep the face's own scale (the
//    rails line up with the strip beside them); the stake tips keep their shape at the post's width; the plain stake
//    between takes the extra height. It stands on every arm a palisade gate's opening cuts (straight gates and both
//    arms of a corner gate), its opening side on the strip's cut end (gatePostPoint).
//  - Stone: Astra's gate_jamb_stone (confirmed 2026-10-04) where the off-axis arm of a corner gate ends, the place the
//    painted pillar stood, drawn with the registration in its record (64 x 80 canvas, pivot (32, 70), world scale
//    0.5). A straight stone gate keeps the gate art's own towers at both edges of its opening.
//  - Plain wall ends, towers and bends keep what they drew (N5-W2): no door post there.

/** The doubled post: a stake column pair this many times a stake's width, ... */
export const GATE_POST_WIDTH = 1.6;
/** ... and this many times the face's height (the face with its stake tips: FACE_HEIGHT). */
export const GATE_POST_HEIGHT = 1.4;
/** The arm's clearance end stops this far short of the pier point at most (gatePortalBranches puts the pier 0.15 in). */
const PIER_INSET = 0.15;
const PIER_REACH = GATE_HALF_CLEARANCE + PIER_INSET;
const FACE_ROWS = 128;
/** Two stakes of palisade_face_v2_a, seam to seam (the dark seams at source x 237, 251 and 266), ... */
const STAKE_PAIR = { x: 238, width: 28 } as const;
/** ... their tips (rows above TIP_ROWS) and the upper rail's first row (RAIL_ROW): rows below it keep the face's scale. */
const TIP_ROWS = 14;
const RAIL_ROW = 32;
/** The post's foot below its point (screen px at zoom 1), as the plain posts (timberGateRenderer drawPost). */
const FOOT_DROP = 2;

/** The gate's every arm (a lattice neighbour) whose wall ends at the opening: all but a shared opening's half. */
export function gatePostArms(node: StoneWallNode): readonly TileEdgePoint[] {
  return node.neighbors.filter(arm => (arm.x !== node.point.x || arm.y !== node.point.y)
    && !(node.clearanceGates?.some(gate => gate.x === arm.x && gate.y === arm.y) ?? false));
}

/** The arms a gate's art stands over (gateArtAxis: a straight gate's two, a corner gate's axis arm); none without art. */
export function gateArtPostArms(node: StoneWallNode): readonly TileEdgePoint[] {
  const axis = gateArtAxis(node);
  if (axis === null || gateHasSharedOpening(node)) return [];
  return gatePostArms(node).filter(arm => axis === "descending" ? arm.y === node.point.y : arm.x === node.point.x);
}

/**
 * Where a palisade door post stands on the arm from `gate` toward `toward` (any point along it): the arm's strip ends
 * GATE_HALF_CLEARANCE from the gate, and the post is set in from there by half its screen width (at most PIER_INSET),
 * so its opening side stands on the cut end. An arm seen end-on (screen vertical) has the post on its end.
 */
export function gatePostPoint(gate: TileEdgePoint, toward: TileEdgePoint, faceHeight: number): TileEdgePoint {
  const dx = toward.x - gate.x; const dy = toward.y - gate.y;
  const step = Math.max(Math.abs(dx), Math.abs(dy));
  if (step === 0) return gate;
  const across = Math.abs(dx - dy) / step * 32;
  const inset = across === 0 ? 0 : Math.min(PIER_INSET, gatePostWidth(faceHeight) / 2 / across);
  const t = (GATE_HALF_CLEARANCE + inset) / step;
  return { x: gate.x + dx * t, y: gate.y + dy * t };
}

export function gatePostWidth(faceHeight: number): number {
  return STAKE_PAIR.width * faceHeight / FACE_ROWS * GATE_POST_WIDTH;
}

/** QA-003: the door posts the wall item of unit edge `key` draws for a palisade gate with art, on its own arm's end
 * after its strip (the gate's owner draws them over the art as well, drawGateArtPosts). A corner gate's off-axis arm
 * keeps its end module (gateCornerModules); stone gates draw none here. */
export function gateArmPosts(node: WallNode, key: string): readonly GateEndNode[] {
  if (node.kind !== "gate" || node.materials.includes("stone")) return [];
  const legacy = { point: node.point, neighbors: node.neighbors, kind: "gate" as const };
  return gateArtPostArms(legacy).filter(arm => unitEdgeKey(node.point, arm) === key).map(arm => ({ ...node, kind: "terminal" as const,
    point: { x: node.point.x + (arm.x - node.point.x) * PIER_REACH, y: node.point.y + (arm.y - node.point.y) * PIER_REACH },
    neighbors: [], gateEnd: true as const, gate: node.point }));
}

/** The gate's owner, after its art: the door posts of the arms the art stands over (palisade). */
export function drawGateArtPosts(context: CanvasRenderingContext2D, node: StoneWallNode, faceHeight: number): void {
  for (const arm of gateArtPostArms(node)) drawPalisadeGatePost(context, node.point, arm, faceHeight);
}

/** The palisade door post at its arm's end (`pier`: a point along the arm from `gate`); false before the face is loaded. */
export function drawPalisadeGatePost(context: CanvasRenderingContext2D, gate: TileEdgePoint, pier: TileEdgePoint, faceHeight: number): boolean {
  const image = wallFaceAsset("palisade_face_v2_a");
  if (image === null) return false;
  const point = gatePostPoint(gate, pier, faceHeight);
  const scale = faceHeight / FACE_ROWS;
  const width = gatePostWidth(faceHeight);
  const screen = tileToScreen(point.x, point.y);
  const foot = screen.sy - 16 + FOOT_DROP;
  const left = screen.sx - width / 2;
  const lower = (FACE_ROWS - RAIL_ROW) * scale;
  const tips = TIP_ROWS * scale * GATE_POST_WIDTH;
  const top = foot - faceHeight * GATE_POST_HEIGHT;
  // Top down, each part reaching half a pixel into the next (drawn over it), so no seam shows between them.
  const part = (row: number, rows: number, y: number, height: number, overlap: number) => drawCroppedWorldSprite(context, image,
    { x: STAKE_PAIR.x, y: row, width: STAKE_PAIR.width, height: rows }, { x: left, y, width, height: height + overlap }, false, true);
  part(0, TIP_ROWS, top, tips, 0.5);
  part(TIP_ROWS, RAIL_ROW - TIP_ROWS, top + tips, foot - lower - top - tips, 0.5);
  part(RAIL_ROW, FACE_ROWS - RAIL_ROW, foot - lower, lower, 0);
  return true;
}

// gate_jamb_stone's registration (assets-inbox/nat5-fixes/candidates-20261003/records/assets.json): its canvas, the
// pivot on its foot and its world scale (the 44 x 60 body is 22 x 30 at zoom 1).
const JAMB = { width: 64, height: 80, pivot: { x: 32, y: 70 }, scale: 0.5 } as const;

/** The stone gate jamb standing on `point`; false before it is loaded. */
export function drawStoneGateJamb(context: CanvasRenderingContext2D, point: TileEdgePoint): boolean {
  const image = wallFaceAsset("gate_jamb_stone");
  if (image === null) return false;
  const screen = tileToScreen(point.x, point.y);
  drawCroppedWorldSprite(context, image, { x: 0, y: 0, width: JAMB.width, height: JAMB.height },
    { x: screen.sx - JAMB.pivot.x * JAMB.scale, y: screen.sy - 16 - JAMB.pivot.y * JAMB.scale, width: JAMB.width * JAMB.scale, height: JAMB.height * JAMB.scale },
    false, true);
  return true;
}

export function isGateEnd(node: WallNode): node is GateEndNode {
  return "gateEnd" in node && "gate" in node;
}

/** A gate's end module (a corner gate's off-axis pier, or an arm's door post): the jamb or the doubled post; false
 * when its picture is not loaded (the caller draws the old pier). */
export function drawGateEnd(context: CanvasRenderingContext2D, node: GateEndNode, material: "stone" | "timber", faceHeight: number): boolean {
  if (material === "stone") return drawStoneGateJamb(context, node.point);
  return drawPalisadeGatePost(context, node.gate, node.point, faceHeight);
}
