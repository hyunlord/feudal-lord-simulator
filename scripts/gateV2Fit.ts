// INSTALL-4e gate 2: where the gate v2 art's passage and wall contacts land against the gate logic (pure registration
// math, the transform drawRegisteredGate applies). The passage centre (Wave 4e ledger `portal.center` (265, 360) of 512)
// is carried to the ground line; its offset from the gate node along the wall axis must stay within 0.15 tile, and the
// art's registered ground line (left -> right registration points) must run within 5 degrees of the wall axis (screen
// slope +-0.5). The painter's wall contacts (ledger `wallContacts`, "proposed, not verified") are reported, not judged:
// they sit up the flanks, which the renderer compresses (flankScale), so their line is not the ground line.
// Usage: npx tsx scripts/gateV2Fit.ts [out.json]
import { writeFileSync } from "node:fs";
import { gateArtPanels, type GateMaterial } from "../src/render/gateArtGeometry";
import { gateV2Registration } from "../src/render/gateArtRenderer";

const SCALE = 1254 / 512;
const PORTAL = { x: 265 * SCALE, y: 360 * SCALE };
const CONTACTS = [{ x: 65 * SCALE, y: 305 * SCALE }, { x: 461 * SCALE, y: 450 * SCALE }];
const rows = [];
for (const material of ["stone", "timber"] as GateMaterial[]) for (const axis of ["descending", "ascending"] as const) {
  const source = gateV2Registration(material, axis);
  const slope = axis === "descending" ? 0.5 : -0.5;
  const groundSlope = (source.right.y - source.left.y) / (source.right.x - source.left.x);
  const mirror = (point: { x: number; y: number }) => axis === "descending" ? point : { x: 1254 - point.x, y: point.y };
  // Screen position (relative to the gate node) of a canvas point, through its panel's transform.
  const screen = (point: { x: number; y: number }) => {
    const panel = gateArtPanels(material, axis, source).find(p => point.x >= p.sourceLeft && point.x <= p.sourceRight)!;
    const a = (panel.targetRight - panel.targetLeft) / (panel.sourceRight - panel.sourceLeft);
    const e = panel.targetLeft - a * panel.sourceLeft;
    const b = slope * a - source.heightScale * groundSlope;
    const f = slope * e - source.heightScale * (source.left.y - groundSlope * source.left.x);
    return { x: a * point.x + e, y: b * point.x + source.heightScale * point.y + f };
  };
  // The passage centre's ground point: the canvas ground line (left -> right registration) below it.
  const portal = mirror(PORTAL);
  const ground = { x: portal.x, y: source.left.y + groundSlope * (portal.x - source.left.x) };
  const at = screen(ground);
  const offsetTiles = at.x / 32; // along the wall a tile edge spans 32 screen px in x
  const [c0, c1] = CONTACTS.map(mirror).map(screen) as [{ x: number; y: number }, { x: number; y: number }];
  const lineAngle = (p: { x: number; y: number }, q: { x: number; y: number }) => {
    const angle = Math.atan2(q.y - p.y, q.x - p.x) * 180 / Math.PI;
    return angle > 90 ? angle - 180 : angle < -90 ? angle + 180 : angle;
  };
  const contactAngle = lineAngle(c0, c1);
  const groundAngle = lineAngle(screen(source.left), screen(source.right));
  const axisAngle = Math.atan(slope) * 180 / Math.PI;
  rows.push({ material, axis, passageOffsetTiles: +offsetTiles.toFixed(3), passageOffGround: +(at.y - slope * at.x).toFixed(2),
    axisAngleDeg: +axisAngle.toFixed(2), groundLineAngleDeg: +groundAngle.toFixed(2), groundLineErrorDeg: +Math.abs(groundAngle - axisAngle).toFixed(2),
    painterContactAngleDeg: +contactAngle.toFixed(2), painterContactErrorDeg: +Math.abs(contactAngle - axisAngle).toFixed(2),
    pass: Math.abs(offsetTiles) <= 0.15 && Math.abs(groundAngle - axisAngle) <= 5 });
}
const out = JSON.stringify({ limits: { passageTiles: 0.15, angleDeg: 5 }, rows }, null, 1);
if (process.argv[2] !== undefined) writeFileSync(process.argv[2], out + "\n");
console.log(out);
