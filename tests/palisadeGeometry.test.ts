import assert from "node:assert/strict";
import test from "node:test";

import type { TerrainType } from "../src/content/terrainConfig";
import { getTile, type Grid } from "../src/world/grid";
import {
  clockwisePath,
  computePalisadeProposal,
  convexHull,
  dragPalisadeRun,
  footprintCorners,
  isPointInsidePalisade,
  palisadePerimeterSteps,
  validatePalisadeCandidate,
  type PalisadeFailureReason,
  type PalisadeFootprint,
  type PalisadePath,
  type TileEdgePoint,
} from "../src/world/palisadeGeometry";
import type { Tile } from "../src/world/world.types";

function tile(
  tx: number,
  ty: number,
  terrain: TerrainType = "grass",
): Tile {
  return { tx, ty, terrain, buildingId: null, hasRoad: false };
}

function grid(width: number, height: number, water: readonly string[] = []): Grid {
  const waterKeys = new Set(water);
  return {
    width,
    height,
    tiles: Array.from({ length: width * height }, (_unused, index) => {
      const tx = index % width;
      const ty = Math.floor(index / width);
      return tile(tx, ty, waterKeys.has(`${tx},${ty}`) ? "water" : "grass");
    }),
  };
}

function footprint(
  id: string,
  tx: number,
  ty: number,
  width = 1,
  height = 1,
): PalisadeFootprint {
  return { id, tx, ty, width, height };
}

function pointKey(point: TileEdgePoint): string {
  return `${point.x},${point.y}`;
}

function proposalPath(
  world: Grid,
  footprints: readonly PalisadeFootprint[],
): PalisadePath {
  const proposal = computePalisadeProposal(world, footprints);
  assert.equal(proposal.ok, true, proposal.ok ? undefined : proposal.reason);
  return proposal.path;
}

function failureReason(
  world: Grid,
  path: PalisadePath,
  footprints: readonly PalisadeFootprint[],
): PalisadeFailureReason | null {
  const result = validatePalisadeCandidate(world, path, footprints);
  return result.ok ? null : result.reason;
}

function assertAxisOrDiagonal(path: PalisadePath): void {
  for (let index = 1; index < path.length; index += 1) {
    const previous = path[index - 1];
    const current = path[index];
    assert.ok(previous !== undefined);
    assert.ok(current !== undefined);
    const dx = Math.abs(current.x - previous.x);
    const dy = Math.abs(current.y - previous.y);
    assert.ok(dx + dy > 0, `${pointKey(previous)} -> ${pointKey(current)}`);
    assert.ok(dx === 0 || dy === 0 || dx === dy, `${pointKey(previous)} -> ${pointKey(current)}`);
  }
}

test("palisade geometry relies on row-major integer grid bounds and water terrain", () => {
  // Given
  const world = grid(3, 2, ["1,0"]);

  // When / Then
  assert.deepEqual(getTile(world, { tx: 2, ty: 1 }), tile(2, 1));
  assert.equal(getTile(world, { tx: -1, ty: 0 }), null);
  assert.equal(getTile(world, { tx: 3, ty: 0 }), null);
  assert.equal(getTile(world, { tx: 1, ty: 0 })?.terrain, "water");
});

test("footprint corners and monotonic hull are stable under input permutation", () => {
  // Given
  const buildings = [
    footprint("storehouse", 8, 8, 2, 1),
    footprint("house", 3, 6),
    footprint("granary", 6, 3, 2, 2),
  ];
  const corners = buildings.flatMap(footprintCorners);
  const shuffled = [corners[4], corners[9], corners[1], corners[7], corners[0], corners[3], corners[6], corners[2], corners[5], corners[8], corners[10], corners[11]].filter(
    (point): point is TileEdgePoint => point !== undefined,
  );

  // When
  const hull = convexHull(corners);
  const reorderedHull = convexHull(shuffled);

  // Then
  assert.deepEqual(footprintCorners(footprint("workshop", 4, 5, 2, 3)), [
    { x: 4, y: 5 },
    { x: 6, y: 5 },
    { x: 6, y: 8 },
    { x: 4, y: 8 },
  ]);
  assert.deepEqual(reorderedHull, hull);
  assert.deepEqual(hull[0], { x: 3, y: 6 });
});

test("proposal encloses one and concave settlements with exact three-tile margin", () => {
  // Given
  const world = grid(24, 24);
  const settlement = [
    footprint("north", 10, 6),
    footprint("west", 6, 11),
    footprint("east", 14, 11),
    footprint("south", 10, 15),
  ];

  // When
  const single = proposalPath(world, [footprint("lone", 8, 8, 2, 2)]);
  const concave = proposalPath(world, settlement);

  // Then
  assertAxisOrDiagonal(single);
  assertAxisOrDiagonal(concave);
  assert.equal(single[0], single.at(-1));
  assert.equal(concave[0], concave.at(-1));
  assert.equal(failureReason(world, single, [footprint("lone", 8, 8, 2, 2)]), null);
  assert.equal(failureReason(world, concave, settlement), null);
  assert.ok(single.some((point) => point.x === 5));
  assert.ok(single.some((point) => point.x === 13));
  assert.ok(single.some((point) => point.y === 5));
  assert.ok(single.some((point) => point.y === 13));
  for (const building of settlement) {
    for (const corner of footprintCorners(building)) {
      assert.equal(isPointInsidePalisade(corner, concave), true, building.id);
    }
  }
});

test("proposal reports concrete failures for absent footprints and clipped margins", () => {
  // Given
  const empty = computePalisadeProposal(grid(12, 12), []);
  const clipped = computePalisadeProposal(grid(8, 8), [footprint("edge", 1, 1)]);

  // Then
  assert.deepEqual(empty, { ok: false, reason: "no_footprints" });
  assert.deepEqual(clipped, { ok: false, reason: "out_of_bounds" });
});

test("proposal detours deterministically around water and reports impossible enclosure", () => {
  // Given
  const lake = grid(24, 24, ["16,7"]);
  const dry = grid(24, 24);
  const blocked = grid(10, 10, ["3,3", "4,3", "5,3", "3,4", "5,4", "3,5", "4,5", "5,5"]);
  const buildings = [footprint("a", 8, 8), footprint("b", 14, 8), footprint("c", 11, 13)];

  // When
  const first = computePalisadeProposal(lake, buildings);
  const second = computePalisadeProposal(lake, [...buildings].reverse());
  const dryProposal = computePalisadeProposal(dry, buildings);
  const impossible = computePalisadeProposal(blocked, [footprint("trapped", 4, 4)]);

  // Then
  assert.equal(first.ok, true, first.ok ? undefined : first.reason);
  assert.equal(second.ok, true, second.ok ? undefined : second.reason);
  if (first.ok && second.ok) {
    assert.deepEqual(second.path, first.path);
    assert.equal(validatePalisadeCandidate(lake, first.path, buildings).ok, true);
  }
  assert.equal(dryProposal.ok, true);
  if (first.ok && dryProposal.ok) assert.notDeepEqual(first.path, dryProposal.path);
  assert.deepEqual(impossible, { ok: false, reason: "water_crossing" });
});

test("candidate validation rejects open, self-crossing, water, bounds, and enclosure below sixty percent", () => {
  // Given
  const world = grid(16, 16, ["5,5"]);
  const buildings = [
    footprint("a", 3, 3),
    footprint("b", 4, 3),
    footprint("c", 5, 3),
    footprint("d", 12, 12),
    footprint("e", 13, 12),
  ];
  const valid = clockwisePath([
    { x: 2, y: 2 },
    { x: 8, y: 2 },
    { x: 8, y: 8 },
    { x: 2, y: 8 },
  ]);

  // When / Then
  assert.equal(failureReason(world, valid.slice(0, -1), buildings), "open_polygon");
  assert.equal(
    failureReason(
      world,
      clockwisePath([
        { x: 2, y: 2 },
        { x: 8, y: 8 },
        { x: 8, y: 2 },
        { x: 2, y: 8 },
      ]),
      buildings,
    ),
    "self_intersection",
  );
  assert.equal(
    failureReason(world, clockwisePath([{ x: -1, y: 2 }, { x: 4, y: 2 }, { x: 4, y: 4 }, { x: -1, y: 4 }]), buildings),
    "out_of_bounds",
  );
  assert.equal(
    failureReason(world, clockwisePath([{ x: 3, y: 3 }, { x: 8, y: 8 }, { x: 3, y: 8 }]), buildings),
    "water_crossing",
  );
  assert.equal(failureReason(world, valid, buildings), null);
  assert.equal(failureReason(world, valid, [...buildings, footprint("f", 14, 13)]), "insufficient_enclosure");
});

test("validation accepts clockwise and counterclockwise paths at exactly sixty percent", () => {
  // Given
  const world = grid(20, 20);
  const buildings = [
    footprint("a", 3, 3),
    footprint("b", 5, 3),
    footprint("c", 7, 3),
    footprint("d", 15, 15),
    footprint("e", 16, 15),
  ];
  const candidate = clockwisePath([{ x: 2, y: 2 }, { x: 10, y: 2 }, { x: 10, y: 6 }, { x: 2, y: 6 }]);

  // When / Then
  assert.equal(validatePalisadeCandidate(world, candidate, buildings).ok, true);
  assert.equal(validatePalisadeCandidate(world, [...candidate].reverse(), buildings).ok, true);
  assert.equal(validatePalisadeCandidate(world, candidate, [...buildings, footprint("f", 17, 15)]).ok, false);
});

test("perimeter and run dragging use whole-step normals with last-valid rejection", () => {
  // Given
  const world = grid(18, 18, ["8,1", "8,2", "8,3"]);
  const buildings = [footprint("a", 5, 5), footprint("b", 10, 5)];
  const candidate = validatePalisadeCandidate(
    world,
    clockwisePath([{ x: 3, y: 3 }, { x: 13, y: 3 }, { x: 13, y: 8 }, { x: 3, y: 8 }]),
    buildings,
  );
  assert.equal(candidate.ok, true);
  if (!candidate.ok) return;

  // When
  const outward = dragPalisadeRun(world, candidate.candidate, 0, 2, buildings);
  const inward = dragPalisadeRun(world, candidate.candidate, 0, -3, buildings);
  const diagonal = validatePalisadeCandidate(world, clockwisePath([{ x: 4, y: 8 }, { x: 8, y: 4 }, { x: 12, y: 8 }, { x: 4, y: 8 }]), [
    footprint("d", 7, 6),
  ]);

  // Then
  assert.equal(palisadePerimeterSteps(candidate.candidate.path), 30);
  assert.equal(outward.ok, true, outward.ok ? undefined : outward.reason);
  assert.equal(inward.ok, false);
  if (outward.ok) {
    assert.equal(palisadePerimeterSteps(outward.candidate.path), 34);
    assert.equal(outward.candidate.runs.every((run) => run.steps > 0), true);
  }
  if (!inward.ok) {
    assert.equal(inward.reason, "insufficient_enclosure");
    assert.deepEqual(inward.lastValid.path, candidate.candidate.path);
  }
  assert.equal(diagonal.ok, true);
  if (diagonal.ok) {
    const moved = dragPalisadeRun(world, diagonal.candidate, 0, 1, [footprint("d", 7, 6)]);
    assert.equal(moved.ok, true, moved.ok ? undefined : moved.reason);
    if (moved.ok) assert.ok(moved.candidate.path.some((point) => point.x === 3 && point.y === 7));
  }
});
