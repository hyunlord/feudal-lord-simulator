/**
 * UI-8 world-render features for chapter 3 (Black Death):
 *   - Fresh grave decals grow with plague.first.dead, one per forty dead, capped at 8 (plagueWorldProps.ts plagueProps).
 *   - Funeral walker: drawFuneralProcession is exported and well-typed (smoke test only; canvas draw).
 *   - Plague-vacant houses: worldSigns suppresses `abandoned_house` for vacantHouseIds members.
 *   - Church with vacant curacy: worldSigns emits `curacy_vacant` instead of `idle_latch`.
 *   - Inspector cause: buildingProblemCause returns Korean curacy-vacant text for that church.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import type { GameState } from "../src/engine/engine.types";
import type { House } from "../src/population/population.types";
import { plagueProps, drawFuneralProcession, withPlagueProps } from "../src/render/plagueWorldProps";
import { worldSigns } from "../src/render/worldSigns";
import { buildingProblemCause } from "../src/ui/problemCauseModel";
import { PLAGUE_UI_COPY } from "../src/ui/plagueUiCopy.ko";

// --- Minimal state helpers ---

/** A minimal tile: grass, no road. */
const grassTile = () => ({ terrain: "grass" as const, hasRoad: false });

/** A 10×10 all-grass state skeleton with a single church at (4,4) and no houses. */
function baseState(): GameState {
  const WIDTH = 10;
  const HEIGHT = 10;
  const church = { id: "ch1", kind: "church" as const, tx: 4, ty: 4 };
  return {
    tick: 500,
    seed: 12345,
    width: WIDTH,
    height: HEIGHT,
    tiles: Array.from({ length: WIDTH * HEIGHT }, grassTile) as GameState["tiles"],
    buildings: [church],
    houses: [],
    constructionSites: [],
    population: 0,
    idleWorkers: 0,
  } as unknown as GameState;
}

/** Add a plague record to a state (rumour-only, no first wave). */
function withPlagueEra(state: GameState): GameState {
  return { ...state, plague: { eraTick: 100, answers: {}, vacantHouseIds: [], resettled: 0, recovered: 0, fled: 0 } } as unknown as GameState;
}

/** Add a first plague wave with `dead` deaths arriving at tick 200. */
function withFirstPlague(state: GameState, dead: number): GameState {
  const plague = (state as unknown as { plague?: object }).plague as Record<string, unknown> | undefined ?? { eraTick: 100, answers: {}, vacantHouseIds: [], resettled: 0, recovered: 0, fled: 0 };
  return {
    ...state,
    plague: {
      ...plague,
      first: {
        arrivalTick: 200,
        dead,
        populationAtArrival: 100,
        deathPermille: 300,
        endTick: 4200,
      },
    },
  } as unknown as GameState;
}

/** Add a house building and a house record with abandonedTick set (pressure "abandoned"). */
function withAbandonedHouse(state: GameState, houseId: string, tx: number, ty: number, inVacantList: boolean): GameState {
  const houseBuilding = { id: houseId, kind: "house" as const, tx, ty };
  const houseRecord: Partial<House> = { buildingId: houseId, residents: 0, abandonedTick: 100, breadStock: 0 };
  const existingPlague = (state as unknown as { plague?: Record<string, unknown> }).plague;
  const plague = existingPlague !== undefined ? {
    ...existingPlague,
    vacantHouseIds: inVacantList
      ? [...((existingPlague.vacantHouseIds ?? []) as string[]), houseId].sort()
      : (existingPlague.vacantHouseIds as string[]),
  } : undefined;
  return {
    ...state,
    buildings: [...state.buildings, houseBuilding],
    houses: [...state.houses, houseRecord as House],
    ...(plague !== undefined ? { plague } : {}),
  } as unknown as GameState;
}

/** Make the church have curacyVacant and the state have a plague.curacy that is vacant. */
function withCuracyVacant(state: GameState): GameState {
  const updated = state.buildings.map(b => b.kind === "church" ? { ...b, curacyVacant: true as const, operationPaused: undefined, upkeepUnpaid: undefined } : b);
  const existingPlague = (state as unknown as { plague?: Record<string, unknown> }).plague;
  return {
    ...state,
    buildings: updated,
    plague: {
      ...(existingPlague ?? { eraTick: 100, answers: {}, vacantHouseIds: [], resettled: 0, recovered: 0, fled: 0 }),
      curacy: { vacantTick: 300 }, // no filledTick → still vacant
    },
  } as unknown as GameState;
}

// --- Grave count tests ---

test("graves: 0 graves when no plague first wave", () => {
  const state = withPlagueEra(baseState());
  const graves = plagueProps(state);
  assert.equal(graves.length, 0, "no first wave → no graves");
});

test("graves: 0 graves when dead = 0", () => {
  const state = withFirstPlague(baseState(), 0);
  const graves = plagueProps(state);
  assert.equal(graves.length, 0, "dead=0 → no graves");
});

test("graves: one decal per forty dead (at least one), capped at MAX_GRAVES=8", () => {
  for (const [dead, expected] of [[1, 1], [40, 1], [41, 2], [120, 3], [186, 5], [320, 8], [1000, 8]] as [number, number][]) {
    const state = withFirstPlague(baseState(), dead);
    const graves = plagueProps(state);
    assert.equal(graves.length, expected, `dead=${dead} → ${expected} grave(s)`);
  }
});

test("graves: deterministic by seed + arrivalTick — same state yields same positions", () => {
  const state = withFirstPlague(baseState(), 120);
  const first = plagueProps(state);
  const second = plagueProps(state); // hits cache
  assert.deepEqual(first, second);
  assert.equal(first.length, 3);
  // Kinds alternate a/b
  assert.equal(first[0]?.kind, "grave_a");
  assert.equal(first[1]?.kind, "grave_b");
  assert.equal(first[2]?.kind, "grave_a");
});

test("graves: grave ids encode their tile coordinates", () => {
  const state = withFirstPlague(baseState(), 3);
  const graves = plagueProps(state);
  assert.equal(graves.length, 1);
  const [g] = graves;
  assert.ok(g!.id.startsWith("plague:grave:"), `id: ${g!.id}`);
});

// --- withPlagueProps: object queue merging ---

test("withPlagueProps: returns original queue when no plague first wave", () => {
  const state = withPlagueEra(baseState());
  const range = { minTx: 0, minTy: 0, maxTx: 9, maxTy: 9 };
  const queue = [] as Parameters<typeof withPlagueProps>[0];
  const result = withPlagueProps(queue, state, range);
  assert.equal(result, queue, "no first wave → unchanged queue reference");
});

test("withPlagueProps: injects plague_prop items for each grave", () => {
  const state = withFirstPlague(baseState(), 160); // 4 graves
  const range = { minTx: 0, minTy: 0, maxTx: 9, maxTy: 9 };
  const result = withPlagueProps([], state, range);
  const plagueItems = result.filter(item => item.kind === "plague_prop");
  assert.equal(plagueItems.length, 4);
  for (const item of plagueItems) assert.equal(item.kind, "plague_prop");
});

// --- drawFuneralProcession: export smoke test ---

test("drawFuneralProcession is exported and callable (no crash on canvas-less call via null guard)", () => {
  // We can't draw without a real canvas, but we can verify the export exists and has the right signature.
  assert.equal(typeof drawFuneralProcession, "function");
  // Call with a state where plagueStage !== "arrival": should return early with no error.
  const state = withPlagueEra(baseState()); // no first wave → plagueStage returns null
  // Build a mock context (only called if stage is "arrival", so this never actually draws).
  const ctx = null as unknown as CanvasRenderingContext2D;
  assert.doesNotThrow(() => drawFuneralProcession(ctx, state, 0));
});

// --- worldSigns: abandoned_house suppression for plague-vacant houses ---

test("worldSigns: abandoned house NOT in vacantHouseIds → abandoned_house sign emitted", () => {
  const state = withAbandonedHouse(withPlagueEra(baseState()), "h1", 1, 1, false);
  const signs = worldSigns(state);
  const kinds = signs.map(s => s.kind);
  assert.ok(kinds.includes("abandoned_house"), `expected abandoned_house in [${kinds.join(", ")}]`);
});

test("worldSigns: abandoned house IN vacantHouseIds → abandoned_house sign suppressed", () => {
  const state = withAbandonedHouse(withPlagueEra(baseState()), "h1", 1, 1, true);
  const signs = worldSigns(state);
  const kinds = signs.map(s => s.kind);
  assert.ok(!kinds.includes("abandoned_house"), `expected no abandoned_house in [${kinds.join(", ")}]`);
});

// --- worldSigns: curacy_vacant instead of idle_latch for church with vacant priest ---

test("worldSigns: church with operationPaused (no curacyVacant) → idle_latch", () => {
  const s = baseState();
  const stateWithPausedChurch = {
    ...s,
    buildings: s.buildings.map(b => b.kind === "church" ? { ...b, operationPaused: true } : b),
  } as unknown as GameState;
  const stateWithPlague = withPlagueEra(stateWithPausedChurch);
  const signs = worldSigns(stateWithPlague);
  const kinds = signs.map(s => s.kind);
  assert.ok(kinds.includes("idle_latch"), `expected idle_latch in [${kinds.join(", ")}]`);
  assert.ok(!kinds.includes("curacy_vacant"), "should not be curacy_vacant when curacyVacant flag absent");
});

test("worldSigns: church with curacyVacant=true and plague.curacy → curacy_vacant sign, no idle_latch", () => {
  const state = withCuracyVacant(withPlagueEra(baseState()));
  const signs = worldSigns(state);
  const kinds = signs.map(s => s.kind);
  assert.ok(kinds.includes("curacy_vacant"), `expected curacy_vacant in [${kinds.join(", ")}]`);
  assert.ok(!kinds.includes("idle_latch"), `expected no idle_latch in [${kinds.join(", ")}]`);
});

// --- buildingProblemCause: Korean curacy vacant inspector line ---

test("buildingProblemCause: church with curacyVacant → Korean curacy-vacant reason string", () => {
  const state = withCuracyVacant(withPlagueEra(baseState()));
  const church = state.buildings.find(b => b.kind === "church");
  assert.ok(church !== undefined, "test setup: church must exist");
  const cause = buildingProblemCause(state, church.id);
  assert.equal(cause, PLAGUE_UI_COPY.curacyVacant, `expected "${PLAGUE_UI_COPY.curacyVacant}" got "${cause}"`);
});

test("PLAGUE_UI_COPY.curacyVacant is a non-empty Korean string", () => {
  assert.ok(PLAGUE_UI_COPY.curacyVacant.length > 0);
  // Should contain Korean characters (Hangul range U+AC00–U+D7A3 or Jamo)
  assert.ok(/[가-힣ᄀ-ᇿ㄰-㆏]/.test(PLAGUE_UI_COPY.curacyVacant),
    `expected Korean text, got: "${PLAGUE_UI_COPY.curacyVacant}"`);
});

test("graves: a town's felled forest is open ground for them; standing forest and roads are not", () => {
  const town = withFirstPlague(baseState(), 40);
  const forest = { ...town, tiles: town.tiles.map(tile => ({ ...tile, terrain: "forest" as const })), forestHarvests: [] } as GameState;
  assert.equal(plagueProps(forest).length, 0, "standing forest");
  const felled = { ...forest, forestHarvests: forest.tiles.map((_, index) => ({ tx: index % forest.width, ty: Math.floor(index / forest.width), harvestedAtTick: 0 })) } as unknown as GameState;
  assert.equal(plagueProps(felled).length, 1, "felled forest");
  const roads = { ...town, tiles: town.tiles.map(tile => ({ ...tile, hasRoad: true })) } as GameState;
  assert.equal(plagueProps(roads).length, 0, "roads");
});
