import assert from "node:assert/strict";
import { test } from "node:test";

import { BUILDING_CONFIG_BY_KIND, type BuildingKind } from "../src/content/buildingConfig";
import { artPlacements, footprintDiamond, measureAlignment, misaligned } from "../scripts/footprintAlignment";

// R0-2: every finished-building art the game draws (levels, pair lots, facilities, the animated mill, the fitted
// sprites and every Wave 2 variant) stands on its footprint diamond: centred, grounded, sized for the plot.
const placements = artPlacements();

test("R0-2: every building kind the game draws has its finished art checked (the retired wheat farm draws nothing)", () => {
  const kinds = new Set(placements.map(placement => placement.kind));
  const expected = (Object.keys(BUILDING_CONFIG_BY_KIND) as BuildingKind[]).filter(kind => kind !== "wheat_farm");
  assert.deepEqual(expected.filter(kind => !kinds.has(kind)), []);
  assert.ok(placements.length >= 58, `${placements.length} arts`);
});

test("R0-2: no finished-building art is off its footprint (centre, ground line, width)", () => {
  const bad = placements.map(measureAlignment).map(a => ({ label: a.label, problems: misaligned(a) })).filter(row => row.problems.length > 0);
  assert.deepEqual(bad, []);
});

test("R0-2: the check catches the old faults: half a tile row up, a one-tile art on a 2 x 2 plot, a shifted art", () => {
  const storehouse = placements.find(placement => placement.label === "storehouse")!;
  const d = footprintDiamond(storehouse.footprint);
  const moved = (dx: number, dy: number, k = 1) => misaligned(measureAlignment({ ...storehouse,
    dest: { x: d.cx + (storehouse.dest.x - d.cx) * k + dx, y: d.cy + d.hh + (storehouse.dest.y - d.cy - d.hh) * k + dy,
      width: storehouse.dest.width * k, height: storehouse.dest.height * k } }));
  assert.deepEqual(moved(0, 0), []);
  assert.ok(moved(0, -d.hh / 2).some(problem => problem.startsWith("floats")), "half a tile row up");
  assert.ok(moved(0, 0, 0.6).some(problem => problem.startsWith("width")), "a one-tile size on the 2 x 2");
  assert.ok(moved(d.hw * 0.3, 0).some(problem => problem.startsWith("off-centre")), "a third of a half width aside");
});
