import assert from "node:assert/strict";
import test from "node:test";

import { createMulberry32, createRoamingJunctionSeed } from "../src/engine/prng";

test("createMulberry32 repeats the same bounded sequence for the same seed", () => {
  // Given: two generators are created from the same signed seed.
  const first = createMulberry32(-1);
  const repeated = createMulberry32(-1);

  // When: each generator is advanced through the same number of draws.
  const firstValues = Array.from({ length: 6 }, () => first.next());
  const repeatedValues = Array.from({ length: 6 }, () => repeated.next());

  // Then: the sequence is deterministic and every value is in [0, 1).
  assert.deepEqual(firstValues, repeatedValues);
  assert.ok(firstValues.every((value) => value >= 0 && value < 1));
  assert.deepEqual(
    firstValues.map((value) => Number(value.toFixed(12))),
    [
      0.896422614111,
      0.18947825674,
      0.715652678162,
      0.944059909321,
      0.845236431574,
      0.539139998844,
    ],
  );
});

test("createMulberry32 derives range, int, and pick from the deterministic stream", () => {
  // Given: two generators with the same seed and a read-only candidate set.
  const first = createMulberry32(73);
  const repeated = createMulberry32(73);
  const candidates = ["north", "east", "south", "west"] as const;

  // When: helper methods consume the stream in order.
  const firstValues = [
    first.range(10, 20),
    first.int(4, 9),
    first.pick(candidates),
  ] as const;
  const repeatedValues = [
    repeated.range(10, 20),
    repeated.int(4, 9),
    repeated.pick(candidates),
  ] as const;

  // Then: each helper is deterministic and respects its output contract.
  assert.deepEqual(firstValues, repeatedValues);
  assert.ok(firstValues[0] >= 10 && firstValues[0] < 20);
  assert.ok(Number.isInteger(firstValues[1]));
  assert.ok(firstValues[1] >= 4 && firstValues[1] < 9);
  assert.ok(candidates.includes(firstValues[2]));
});

test("createRoamingJunctionSeed is stateless and sensitive to every roaming input", () => {
  // Given: a roaming junction choice input for one distributor visit.
  const input = {
    stateSeed: 73,
    walkerId: "distributor:granary-2:4",
    tick: 360,
    tx: 12,
    ty: 9,
    visitCount: 3,
  } as const;

  // When: the same input and one-field variants are hashed.
  const seed = createRoamingJunctionSeed(input);
  const repeated = createRoamingJunctionSeed(input);
  const variants = [
    createRoamingJunctionSeed({ ...input, stateSeed: 74 }),
    createRoamingJunctionSeed({ ...input, walkerId: "distributor:granary-2:5" }),
    createRoamingJunctionSeed({ ...input, tick: 361 }),
    createRoamingJunctionSeed({ ...input, tx: 13 }),
    createRoamingJunctionSeed({ ...input, ty: 10 }),
    createRoamingJunctionSeed({ ...input, visitCount: 4 }),
  ];

  // Then: the helper has no stored RNG state and every field participates.
  assert.equal(seed, repeated);
  assert.ok(Number.isInteger(seed));
  assert.ok(seed >= 0 && seed <= 0xffff_ffff);
  assert.equal(new Set(variants).size, variants.length);
  assert.ok(variants.every((variant) => variant !== seed));
});
