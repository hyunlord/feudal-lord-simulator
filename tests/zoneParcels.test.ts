import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import type { TileCoordinate } from "../src/geometry/tileGeometry";
import { deriveParcels, frontageStrips, roadChains, type ParcelWorld } from "../src/zones/parcels";
import { rasterizeZoneStroke } from "../src/zones/zoneRaster";
import type { Parcel, Zone, ZoneStroke } from "../src/zones/zone.types";

interface SceneFixture {
  readonly width: number;
  readonly height: number;
  readonly roadCells: readonly TileCoordinate[];
  readonly burgageStroke: ZoneStroke;
  readonly probeMembersExcludingRoads?: number;
  readonly probeStrips?: readonly { readonly front: TileCoordinate; readonly cells: readonly TileCoordinate[] }[];
  readonly probeSpur?: readonly TileCoordinate[];
}

const PROBE = JSON.parse(readFileSync("fixtures/zones/v3a-probe-p5.json", "utf8")) as SceneFixture;
const CURVED = JSON.parse(readFileSync("fixtures/zones/curved-road-12x12.json", "utf8")) as SceneFixture;

function world(scene: SceneFixture, extraRoads: readonly TileCoordinate[] = [], houses: ParcelWorld["buildings"] = []): ParcelWorld & { tiles: { terrain: "grass"; hasRoad: boolean }[] } {
  const roads = new Set([...scene.roadCells, ...extraRoads].map(cell => cell.ty * scene.width + cell.tx));
  return {
    width: scene.width,
    height: scene.height,
    tiles: Array.from({ length: scene.width * scene.height }, (_, index) => ({ terrain: "grass" as const, hasRoad: roads.has(index) })),
    buildings: houses,
    constructionSites: [],
  };
}

function burgage(scene: SceneFixture, stroke: ZoneStroke = scene.burgageStroke): Zone {
  return { id: "zone-000001", kind: "burgage", strokes: [stroke], membership: rasterizeZoneStroke(stroke, world(scene)), createdOrdinal: 1 };
}

const cellKey = (cell: TileCoordinate) => `${cell.tx},${cell.ty}`;
const parcelKey = (parcel: Parcel) => parcel.cells.map(cellKey).join(";");

function assertWellFormed(parcels: readonly Parcel[], zone: Zone, scene: SceneFixture, extraRoads: readonly TileCoordinate[] = []): void {
  const members = new Set(zone.membership);
  const roads = new Set([...scene.roadCells, ...extraRoads].map(cellKey));
  const seen = new Set<string>();
  for (const parcel of parcels) {
    assert.ok(parcel.width >= 2 && parcel.width <= 4, `${parcel.id} width ${parcel.width}`);
    for (const cell of parcel.cells) {
      assert.ok(members.has(cell.ty * scene.width + cell.tx), `${parcel.id} leaves the zone at ${cellKey(cell)}`);
      assert.ok(!roads.has(cellKey(cell)), `${parcel.id} covers a road`);
      assert.ok(!seen.has(cellKey(cell)), `${cellKey(cell)} is in two parcels`);
      seen.add(cellKey(cell));
    }
    for (const front of parcel.frontageCells) {
      assert.ok([[0, -1], [1, 0], [0, 1], [-1, 0]].some(([dx, dy]) => roads.has(`${front.tx + dx!},${front.ty + dy!}`)), `${cellKey(front)} does not touch a road`);
    }
    assert.deepEqual(parcel.anchor, parcel.frontageCells[0]);
    assert.equal(parcel.id, `${zone.id}:${cellKey(parcel.anchor)}`);
  }
}

/** Branch effect: plots the branch runs over, other existing plots that change, and plots new along the branch. */
function branchEffect(before: readonly Parcel[], after: readonly Parcel[], branch: readonly TileCoordinate[]) {
  const branchCells = new Set(branch.map(cellKey));
  const afterKeys = new Set(after.map(parcelKey));
  const crossed = before.filter(parcel => parcel.cells.some(cell => branchCells.has(cellKey(cell))));
  const crossedIds = new Set(crossed.map(parcel => parcel.id));
  const collateral = before.filter(parcel => !crossedIds.has(parcel.id) && !afterKeys.has(parcelKey(parcel)));
  const beforeIds = new Set(before.map(parcel => parcel.id));
  const added = after.filter(parcel => !beforeIds.has(parcel.id));
  return { crossed: crossed.length, collateral: collateral.length, added: added.length };
}

test("Z-12 the v3-A probe P5 scene reproduces: 160 members, one 48-cell chain and the probe's 25 strips cell for cell", () => {
  const zone = burgage(PROBE);
  const scene = world(PROBE);
  assert.equal(zone.membership.filter(cell => !scene.tiles[cell]!.hasRoad).length, PROBE.probeMembersExcludingRoads);
  const chains = roadChains(scene);
  assert.equal(chains.length, 1);
  assert.deepEqual(chains[0], PROBE.roadCells);
  const strips = frontageStrips(zone, scene).map(strip => ({ front: strip.front, cells: strip.cells }));
  assert.equal(strips.length, 25);
  assert.deepEqual(strips, PROBE.probeStrips);
});

test("Z-12 probe P5 plots: 9 plots of width 2–4, identical on every recomputation, and the probe spur changes at most 2 other plots", () => {
  const zone = burgage(PROBE);
  const parcels = deriveParcels(zone, world(PROBE));
  assert.equal(parcels.length, 9);
  assert.deepEqual(parcels.map(parcel => parcel.width), [2, 3, 2, 2, 4, 2, 2, 3, 3]);
  assertWellFormed(parcels, zone, PROBE);
  for (let run = 0; run < 3; run += 1) assert.deepEqual(deriveParcels(burgage(PROBE), world(PROBE)), parcels);
  const spur = PROBE.probeSpur!;
  const after = deriveParcels(zone, world(PROBE, spur));
  assertWellFormed(after, zone, PROBE, spur);
  assert.deepEqual(branchEffect(parcels, after, spur), { crossed: 1, collateral: 1, added: 1 });
});

test("Z-12 12×12 curved road: 9 plots, the same for reversed polygon vertices and on every run", () => {
  const zone = burgage(CURVED);
  const parcels = deriveParcels(zone, world(CURVED));
  assert.equal(zone.membership.length, 132);
  assert.equal(parcels.length, 9);
  assertWellFormed(parcels, zone, CURVED);
  const reversed = burgage(CURVED, { ...CURVED.burgageStroke, points: [...CURVED.burgageStroke.points].reverse() });
  assert.deepEqual(reversed.membership, zone.membership);
  assert.deepEqual(deriveParcels(reversed, world(CURVED)), parcels);
  assert.deepEqual(deriveParcels(zone, world(CURVED)), parcels);
});

/** Every 3-cell road branch leaving a road cell north or south; `clean` = a T-junction that forms no 2×2 road block. */
function branches(scene: SceneFixture) {
  const roads = new Set(scene.roadCells.map(cellKey));
  const degree = (cell: TileCoordinate) => [[0, -1], [1, 0], [0, 1], [-1, 0]].filter(([dx, dy]) => roads.has(`${cell.tx + dx!},${cell.ty + dy!}`)).length;
  return scene.roadCells.flatMap(base => [-1, 1].map(direction => {
    const cells = [1, 2, 3].map(step => ({ tx: base.tx, ty: base.ty + direction * step }));
    const fits = cells.every(cell => cell.ty >= 0 && cell.ty < scene.height && !roads.has(cellKey(cell)));
    const clean = fits && degree(base) === 2 && cells.every((cell, index) => degree(cell) === (index === 0 ? 1 : 0));
    return { base, direction, cells, fits, clean };
  })).filter(branch => branch.fits);
}

test("Z-12 12×12 curved road: adding any clean road branch changes at most 2 plots besides the one it runs over", () => {
  const zone = burgage(CURVED);
  const before = deriveParcels(zone, world(CURVED));
  const clean = branches(CURVED).filter(branch => branch.clean);
  assert.equal(clean.length, 13);
  const effects = clean.map(branch => {
    const after = deriveParcels(zone, world(CURVED, branch.cells));
    assertWellFormed(after, zone, CURVED, branch.cells);
    return { at: `${cellKey(branch.base)}${branch.direction > 0 ? "S" : "N"}`, ...branchEffect(before, after, branch.cells) };
  });
  for (const effect of effects) {
    assert.ok(effect.crossed <= 2, `${effect.at} runs over ${effect.crossed} plots`);
    assert.ok(effect.collateral <= 2, `${effect.at} changes ${effect.collateral} other plots`);
  }
  assert.equal(Math.max(...effects.map(effect => effect.collateral)), 2);
});

test("Z-13 a standing house keeps its whole footprint in one plot, before and after a road branch", () => {
  const zone = burgage(CURVED);
  const plain = deriveParcels(zone, world(CURVED));
  // A house on the second cell of the fourth plot, not on its anchor.
  const host = plain[3]!;
  const spot = host.cells.find(cell => cellKey(cell) !== cellKey(host.anchor))!;
  const house = { id: "house-fixed", kind: "house" as const, tx: spot.tx, ty: spot.ty };
  for (const extra of [[], ...branches(CURVED).filter(branch => branch.clean).map(branch => branch.cells)]) {
    if (extra.some(cell => cellKey(cell) === cellKey(spot))) continue;
    const parcels = deriveParcels(zone, world(CURVED, extra, [house]));
    const holders = parcels.filter(parcel => parcel.cells.some(cell => cellKey(cell) === cellKey(spot)));
    assert.equal(holders.length, 1);
    assert.deepEqual(holders[0]!.buildingIds, ["house-fixed"]);
  }
  // A house no strip reaches still gets its own plot.
  const far = deriveParcels(zone, world(CURVED, [], [{ id: "house-back", kind: "house", tx: 6, ty: 10 }]));
  assert.deepEqual(far.filter(parcel => parcel.buildingIds.includes("house-back")).map(parcel => parcel.cells), [[{ tx: 6, ty: 10 }]]);
});

test("Z-12 only burgage zones have plots", () => {
  assert.deepEqual(deriveParcels({ ...burgage(CURVED), kind: "arable" }, world(CURVED)), []);
});
