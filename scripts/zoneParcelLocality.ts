// Parcel counts and road-branch locality for the zone fixtures (B5+C1a gate ②, evidence table).
// Usage: tsx scripts/zoneParcelLocality.ts > docs/verification/zones/parcel-locality.json
// For every 3-cell branch leaving a road cell north or south: plots the branch runs over (crossed),
// other plots that change (collateral, the gate number) and plots new along the branch (added).
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { TileCoordinate } from "../src/geometry/tileGeometry";
import { deriveParcels, frontageStrips, type ParcelWorld } from "../src/zones/parcels";
import { rasterizeZoneStroke, type ZoneGrid } from "../src/zones/zoneRaster";
import type { Parcel, Zone, ZoneStroke } from "../src/zones/zone.types";

const ROOT = fileURLToPath(new URL("../", import.meta.url));

interface Scene {
  readonly id: string;
  readonly width: number;
  readonly height: number;
  readonly roadCells: readonly TileCoordinate[];
  readonly burgageStroke: ZoneStroke;
  readonly probeSpur?: readonly TileCoordinate[];
}

const key = (cell: TileCoordinate) => `${cell.tx},${cell.ty}`;
const parcelKey = (parcel: Parcel) => parcel.cells.map(key).join(";");

function world(scene: Scene, extra: readonly TileCoordinate[] = []): ParcelWorld & ZoneGrid {
  const roads = new Set([...scene.roadCells, ...extra].map(cell => cell.ty * scene.width + cell.tx));
  const tiles = Array.from({ length: scene.width * scene.height }, (_, index) => ({ terrain: "grass" as const, hasRoad: roads.has(index) }));
  return { width: scene.width, height: scene.height, buildings: [], constructionSites: [], tiles };
}

function effect(before: readonly Parcel[], after: readonly Parcel[], branch: readonly TileCoordinate[]) {
  const cells = new Set(branch.map(key));
  const afterKeys = new Set(after.map(parcelKey));
  const crossed = before.filter(parcel => parcel.cells.some(cell => cells.has(key(cell))));
  const crossedIds = new Set(crossed.map(parcel => parcel.id));
  const beforeIds = new Set(before.map(parcel => parcel.id));
  return {
    crossed: crossed.length,
    collateral: before.filter(parcel => !crossedIds.has(parcel.id) && !afterKeys.has(parcelKey(parcel))).length,
    added: after.filter(parcel => !beforeIds.has(parcel.id)).length,
    // The v3-A probe's own measure: plots of the new result that match no plot of the old one.
    probeMetric: after.filter(parcel => !new Set(before.map(parcelKey)).has(parcelKey(parcel))).length,
  };
}

export function sceneReport(scene: Scene) {
  const plain = world(scene);
  const zone: Zone = { id: "zone-000001", kind: "burgage", strokes: [scene.burgageStroke], membership: rasterizeZoneStroke(scene.burgageStroke, plain), createdOrdinal: 1 };
  const before = deriveParcels(zone, plain);
  const roads = new Set(scene.roadCells.map(key));
  const degree = (cell: TileCoordinate) => [[0, -1], [1, 0], [0, 1], [-1, 0]].filter(([dx, dy]) => roads.has(`${cell.tx + dx!},${cell.ty + dy!}`)).length;
  const branches = scene.roadCells.flatMap(base => [-1, 1].map(direction => ({ base, direction, cells: [1, 2, 3].map(step => ({ tx: base.tx, ty: base.ty + direction * step })) })))
    .filter(branch => branch.cells.every(cell => cell.ty >= 0 && cell.ty < scene.height && !roads.has(key(cell))))
    .map(branch => {
      const kind = degree(branch.base) === 1 ? "extends-dead-end"
        : branch.cells.every((cell, index) => degree(cell) === (index === 0 ? 1 : 0)) ? "clean-T" : "forms-2x2-block";
      return { at: `${key(branch.base)}${branch.direction > 0 ? "S" : "N"}`, kind, ...effect(before, deriveParcels(zone, world(scene, branch.cells)), branch.cells) };
    });
  const summary = (kind: string) => {
    const rows = branches.filter(row => row.kind === kind);
    return { count: rows.length, maxCollateral: rows.length === 0 ? null : Math.max(...rows.map(row => row.collateral)),
      collateralHistogram: rows.reduce<Record<number, number>>((histogram, row) => ({ ...histogram, [row.collateral]: (histogram[row.collateral] ?? 0) + 1 }), {}) };
  };
  return {
    id: scene.id,
    members: zone.membership.length,
    strips: frontageStrips(zone, plain).length,
    parcels: before.length,
    widths: before.map(parcel => parcel.width),
    probeSpur: scene.probeSpur === undefined ? null : effect(before, deriveParcels(zone, world(scene, scene.probeSpur)), scene.probeSpur),
    branchSummary: { cleanT: summary("clean-T"), formsBlock: summary("forms-2x2-block"), extendsDeadEnd: summary("extends-dead-end") },
    branches,
  };
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const scenes = ["fixtures/zones/curved-road-12x12.json", "fixtures/zones/v3a-probe-p5.json"]
    .map(file => JSON.parse(readFileSync(resolve(ROOT, file), "utf8")) as Scene);
  process.stdout.write(`${JSON.stringify({ scenes: scenes.map(sceneReport) }, null, 1)}\n`);
}
