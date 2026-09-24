// Chooses the screen targets for the C1b gate 1 run (scripts/zoneBrushEvidence.mjs play) on a natural snapshot:
// a curved road stretch outside the wall to paint plots along, a plot anchor for a house and a plain grass tile
// outside the plots, an arable patch outside the wall with a wheat-farm spot, a point inside the wall, and pasture
// and orchard patches — all near one camera. It only picks coordinates: the run itself uses mouse input. Candidate
// spots are checked with the same reducer the game uses, so the run never aims at a tile that could not work.
// Usage: npx tsx scripts/zoneBrushPlan.ts <snapshot.json> <outDir>   (writes <outDir>/plan.json)
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import type { GameState } from "../src/engine/engine.types";
import { gameReducer } from "../src/state/gameStore";
import { roadCenterlineGraph } from "../src/world/boundary/roadCenterline";
import { isPointInsidePalisade } from "../src/world/palisadeGeometry";
import { canPlaceBuilding } from "../src/world/placement";
import { zonePaintAssessment } from "../src/zones/zoneEdits";
import { burgageParcels } from "../src/zones/zoneFillAgent";
import { canPlaceBuildingWithZones } from "../src/zones/zonePlacement";
import type { ZoneKind, ZoneStroke } from "../src/zones/zone.types";

const [snapshotPath, outDir] = process.argv.slice(2);
if (snapshotPath === undefined || outDir === undefined) throw new Error("Usage: zoneBrushPlan.ts <snapshot.json> <outDir>");
const initial = JSON.parse(readFileSync(snapshotPath, "utf8")) as GameState;
const inside = (tx: number, ty: number): boolean => initial.palisade !== null && isPointInsidePalisade({ x: tx + 0.5, y: ty + 0.5 }, initial.palisade.polygon);
const tile = (state: GameState, tx: number, ty: number) => tx < 0 || ty < 0 || tx >= state.width || ty >= state.height ? undefined : state.tiles[ty * state.width + tx];
const freeGrass = (state: GameState, tx: number, ty: number): boolean => { const t = tile(state, tx, ty); return t !== undefined && t.terrain === "grass" && !t.hasRoad && t.buildingId === null; };

// 1. A road chain outside the wall with bends; take up to 12 cells around its middle.
const graph = roadCenterlineGraph({ width: initial.width, height: initial.height, tiles: initial.tiles, palisade: initial.palisade });
const turns = (cells: readonly { tx: number; ty: number }[]): number => cells.slice(2).filter((cell, index) => {
  const a = cells[index]!; const b = cells[index + 1]!;
  return (b.tx - a.tx) !== (cell.tx - b.tx) || (b.ty - a.ty) !== (cell.ty - b.ty);
}).length;
// Runs of consecutive road cells outside the wall, most bends first (a curved road is the point of the run), then longest.
const runs = graph.chains.flatMap(candidate => {
  const found: (typeof candidate.cells)[] = []; let current: (typeof candidate.cells[number])[] = [];
  for (const cell of candidate.cells) {
    if (inside(cell.tx, cell.ty)) { if (current.length > 0) found.push(current); current = []; } else current.push(cell);
  }
  if (current.length > 0) found.push(current);
  return found.filter(run => run.length >= 8);
});
const chosen = runs.sort((a, b) => Math.min(4, turns(b)) - Math.min(4, turns(a)) || b.length - a.length)[0];
if (chosen === undefined) throw new Error("No curved road outside the wall");
const middle = Math.floor(chosen.length / 2);
const stretch = chosen.slice(Math.max(0, middle - 6), middle + 6);

// Side with more free grass 1.5 tiles off the road.
const normalAt = (index: number) => {
  const a = stretch[Math.max(0, index - 1)]!; const b = stretch[Math.min(stretch.length - 1, index + 1)]!;
  const dx = b.tx - a.tx; const dy = b.ty - a.ty; const length = Math.hypot(dx, dy) || 1;
  return { x: -dy / length, y: dx / length };
};
const sideScore = (side: 1 | -1) => stretch.filter((cell, index) => { const n = normalAt(index); return freeGrass(initial, Math.round(cell.tx + n.x * 1.5 * side), Math.round(cell.ty + n.y * 1.5 * side)); }).length;
const side = sideScore(1) >= sideScore(-1) ? 1 : -1;
// Stroke points in tile-centre coordinates (the run converts with tileClientPoint); edge space is +0.5.
const plotStroke = stretch.map((cell, index) => { const n = normalAt(index); return [cell.tx + n.x * 1.4 * side, cell.ty + n.y * 1.4 * side] as [number, number]; });
const toStroke = (points: readonly [number, number][], radius: number): ZoneStroke => ({ tool: "brush", points: points.map(([x, y]) => ({ x: x + 0.5, y: y + 0.5 })), radius });
const paint = (state: GameState, kind: ZoneKind, points: readonly [number, number][], radius = 2): GameState => {
  const stroke = toStroke(points, radius);
  const assessment = zonePaintAssessment(state, kind, stroke);
  if (!assessment.ok) throw new Error(`${kind} stroke refused: ${assessment.reason}`);
  return gameReducer(state, { type: "zone_paint", kind, stroke: assessment.stroke });
};
let state = paint(initial, "burgage", plotStroke);
const centre = stretch[Math.floor(stretch.length / 2)] ?? stretch[0]!;

// 2. House inside a plot (its anchor) and a plain grass tile outside the plots where only the zone rule refuses it.
const anchor = burgageParcels(state).map(parcel => parcel.anchor).find(cell => canPlaceBuildingWithZones(state, "house", cell.tx, cell.ty).ok);
if (anchor === undefined) throw new Error("No plot anchor takes a house");
const ring = (radius: number) => {
  const cells: [number, number][] = [];
  for (let ty = centre.ty - radius; ty <= centre.ty + radius; ty += 1) for (let tx = centre.tx - radius; tx <= centre.tx + radius; tx += 1) cells.push([tx, ty]);
  return cells.sort((a, b) => Math.hypot(a[0] - centre.tx, a[1] - centre.ty) - Math.hypot(b[0] - centre.tx, b[1] - centre.ty) || a[1] - b[1] || a[0] - b[0]);
};
const houseOutside = ring(20).find(([tx, ty]) => canPlaceBuilding(state, "house", tx, ty).ok && !canPlaceBuildingWithZones(state, "house", tx, ty).ok);
if (houseOutside === undefined) throw new Error("No tile where only the zone rule refuses a house");
state = gameReducer(state, { type: "place_building", kind: "house", tx: anchor.tx, ty: anchor.ty });

// 3. Arable outside the wall (a short stroke on free grass by a road, not overlapping the plots) and a farm spot in it.
const zoned = (s: GameState) => new Set((s.zones ?? []).flatMap(zone => zone.membership));
const patch = (s: GameState, radius: number, needRoad: boolean) => ring(radius).find(([tx, ty]) => {
  // Keep off the map edge, where the camera cannot centre a patch above the bottom menu.
  if (tx < 6 || ty < 6 || tx > s.width - 8 || ty > s.height - 9) return false;
  const taken = zoned(s);
  for (let dy = -1; dy <= 2; dy += 1) for (let dx = -1; dx <= 2; dx += 1) {
    if (!freeGrass(s, tx + dx, ty + dy) || inside(tx + dx, ty + dy) || taken.has((ty + dy) * s.width + tx + dx)) return false;
  }
  if (!needRoad) return true;
  for (let dy = -3; dy <= 4; dy += 1) for (let dx = -3; dx <= 4; dx += 1) if (tile(s, tx + dx, ty + dy)?.hasRoad === true) return true;
  return false;
});
let arableOutside: [number, number][] | null = null; let farmInside: [number, number] | null = null;
for (let radius = 6; radius <= 30 && farmInside === null; radius += 2) {
  const spot = patch(state, radius, true);
  if (spot === undefined) continue;
  const stroke: [number, number][] = [[spot[0] + 0.5, spot[1] + 0.5], [spot[0] + 1, spot[1] + 1]];
  const trial = paint(state, "arable", stroke, 2);
  const farm = ring(radius + 3).find(([tx, ty]) => canPlaceBuildingWithZones(trial, "wheat_farm", tx, ty).ok);
  if (process.env.PLAN_DEBUG === "1") {
    const arable = (trial.zones ?? []).find(zone => zone.kind === "arable");
    const reasons = new Map<string, number>();
    for (const cell of arable?.membership ?? []) {
      const result = canPlaceBuildingWithZones(trial, "wheat_farm", cell % trial.width, Math.floor(cell / trial.width));
      const key = result.ok ? "ok" : String(result.reason); reasons.set(key, (reasons.get(key) ?? 0) + 1);
    }
    process.stderr.write(`radius ${radius} spot ${spot} arable cells ${arable?.membership.length} ${JSON.stringify([...reasons])}\n`);
  }
  if (farm !== undefined) { arableOutside = stroke; farmInside = farm; state = trial; }
}
if (arableOutside === null || farmInside === null) throw new Error("No arable patch with a wheat-farm spot near the plots");

// 4. A grass point inside the wall, nearest the camera.
const insideSpot = ring(30).find(([tx, ty]) => inside(tx, ty) && freeGrass(state, tx, ty) && zonePaintAssessment(state, "arable", toStroke([[tx, ty]], 1)).ok === false);
if (insideSpot === undefined) throw new Error("No grass inside the wall near the camera");
const arableInside: [number, number][] = [[insideSpot[0], insideSpot[1]], [insideSpot[0] + 0.8, insideSpot[1] + 0.6]];

// 5. Pasture and orchard patches on free grass.
const pastureSpot = patch(state, 30, false);
if (pastureSpot === undefined) throw new Error("No pasture patch");
const pasture: [number, number][] = [[pastureSpot[0], pastureSpot[1]], [pastureSpot[0] + 1.5, pastureSpot[1] + 1]];
state = paint(state, "pasture", pasture);
const orchardSpot = patch(state, 30, false);
if (orchardSpot === undefined) throw new Error("No orchard patch");
const orchard: [number, number][] = [[orchardSpot[0], orchardSpot[1]], [orchardSpot[0] + 1.5, orchardSpot[1] + 1]];

const plan = {
  snapshot: snapshotPath, tick: initial.tick, camera: [centre.tx, centre.ty], road: stretch.map(cell => [cell.tx, cell.ty]), side,
  plotStroke, houseInside: [anchor.tx, anchor.ty], houseOutside, arableOutside, farmInside, arableInside, pasture, orchard,
};
mkdirSync(outDir, { recursive: true });
writeFileSync(`${outDir}/plan.json`, `${JSON.stringify(plan, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(plan)}\n`);
