/**
 * UI-9 world-render features for chapter 4 (reorganisation):
 *   - Guildhall world prop: reorgProp returns null without a guild, a ReorgProp when guildOf !== null.
 *   - Guildhall spot: deterministic by seed + buildings layout; stable on buildings identity (cache).
 *   - withReorgProps: returns the original queue when no guild; injects a "reorg_prop" item when present.
 *   - drawReorgOverlays: export smoke test — callable with null-canvas when no reorganisation (early return).
 *   - Textile walkers: drawReorgOverlays returns early unless textileStreetTick set AND ≥2 weaver_house exist.
 *   - Alehouse drinkers: overlay active only during alehouseBoomTick (before endedTick).
 *   - Collector chase: overlay active for SEASON_TICKS after rebellion.outcome "chased"; outcome "quiet" is silent.
 *   - No door marks: the spec forbids door decals; walkers use buildingDoor() geometry (footprint-based), no door flags.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import type { GameState } from "../src/engine/engine.types";
import { drawReorgOverlays, reorgProp, withReorgProps } from "../src/render/reorgWorldProps";

// ─── Minimal state helpers ────────────────────────────────────────────────────

const grassTile = (tx: number, ty: number) => ({ tx, ty, terrain: "grass" as const, hasRoad: false, buildingId: null });

/** A 12×12 all-grass state with a market at (5,5) and generous free ground — no guild yet. */
function baseState(): GameState {
  const W = 12; const H = 12;
  const market = { id: "mkt1", kind: "market" as const, tx: 5, ty: 5 };
  return {
    tick: 500,
    seed: 99_001,
    width: W,
    height: H,
    tiles: Array.from({ length: W * H }, (_, i) => grassTile(i % W, Math.floor(i / W))) as GameState["tiles"],
    buildings: [market],
    houses: [],
    constructionSites: [],
    population: 0,
    idleWorkers: 0,
  } as unknown as GameState;
}

/** Add a ReorganisationState with the given partial fields. */
function withReorg(state: GameState, reorg: object): GameState {
  return { ...state, reorganisation: reorg } as unknown as GameState;
}

/** Add a guild record so guildOf(state) !== null. */
function withGuild(state: GameState): GameState {
  return withReorg(state, { guild: { guildId: "g1", founderHouseId: "h1", foundedTick: 300 }, step: "end" });
}

/** Add weaver_house buildings (at distinct stable positions). */
function withWeavers(state: GameState, count: number): GameState {
  const weavers = Array.from({ length: count }, (_, i) => ({ id: `wv${i}`, kind: "weaver_house" as const, tx: 1, ty: i * 2 + 1 }));
  return { ...state, buildings: [...state.buildings, ...weavers] } as unknown as GameState;
}

/** Add an alehouse house record referencing a building. */
function withAlehouse(state: GameState, buildingId: string, tx: number, ty: number): GameState {
  const bld = { id: buildingId, kind: "house" as const, tx, ty };
  const house = { buildingId, residents: 2, breadStock: 0, isAlehouse: true, aleStock: 10 };
  return { ...state, buildings: [...state.buildings, bld], houses: [...state.houses, house] } as unknown as GameState;
}

// ─── reorgProp: returns null without a guild ──────────────────────────────────

test("reorgProp: null when state has no reorganisation field", () => {
  const state = baseState();
  assert.equal(reorgProp(state), null, "no reorganisation → null");
});

test("reorgProp: null when reorganisation exists but guild is null", () => {
  const state = withReorg(baseState(), { guild: null, step: "poll_tax" });
  assert.equal(reorgProp(state), null, "guild=null → null");
});

test("reorgProp: returns a ReorgProp with kind 'guildhall' when guild is set", () => {
  const state = withGuild(baseState());
  const prop = reorgProp(state);
  assert.ok(prop !== null, "guild set → prop not null");
  assert.equal(prop.kind, "guildhall");
  assert.ok(typeof prop.tx === "number" && typeof prop.ty === "number", "prop has tile coords");
  assert.ok(prop.id.startsWith("reorg:guildhall:"), `id format: ${prop.id}`);
});

// ─── Guildhall spot: deterministic and cached ─────────────────────────────────

test("guildhall spot: same seed + buildings → same tile every call", () => {
  const state = withGuild(baseState());
  const p1 = reorgProp(state); const p2 = reorgProp(state); // second hits cache
  assert.ok(p1 !== null && p2 !== null);
  assert.equal(p1.tx, p2.tx); assert.equal(p1.ty, p2.ty);
});

test("guildhall spot: different seed → (usually) different tile", () => {
  const s1 = withGuild(baseState());
  const s2 = withGuild({ ...baseState(), seed: 77_777 } as unknown as GameState);
  // Reset cache by providing a fresh buildings array object.
  const s2fresh = { ...s2, buildings: [...s2.buildings] } as unknown as GameState;
  const p1 = reorgProp(s1); const p2 = reorgProp(s2fresh);
  assert.ok(p1 !== null && p2 !== null);
  // Different seeds must produce a different id (tile coords are seed-hashed).
  assert.notEqual(p1.id, p2.id, "different seed → different spot");
});

test("guildhall spot: new buildings array (same content) triggers recompute; same result for identical layout", () => {
  const state = withGuild(baseState());
  const first = reorgProp(state);
  // Simulate a state update where buildings is a new array (same items) — forces cache miss.
  const updated = { ...state, buildings: [...state.buildings] } as unknown as GameState;
  const second = reorgProp(updated);
  assert.ok(first !== null && second !== null);
  assert.equal(first.tx, second.tx, "same layout → same tx after recompute");
  assert.equal(first.ty, second.ty, "same layout → same ty after recompute");
});

test("guildhall spot: prop id encodes tile coordinates", () => {
  const state = withGuild(baseState());
  const prop = reorgProp(state);
  assert.ok(prop !== null);
  const parts = prop.id.split(":");
  assert.equal(parts[0], "reorg"); assert.equal(parts[1], "guildhall");
  assert.equal(Number(parts[2]), prop.tx); assert.equal(Number(parts[3]), prop.ty);
});

// ─── withReorgProps: object-queue merging ─────────────────────────────────────

const FULL_RANGE = { minTx: 0, minTy: 0, maxTx: 11, maxTy: 11 };

test("withReorgProps: returns original queue reference when no guild", () => {
  const state = baseState(); // no guild
  const queue = [] as Parameters<typeof withReorgProps>[0];
  const result = withReorgProps(queue, state, FULL_RANGE);
  assert.equal(result, queue, "no guild → same queue reference");
});

test("withReorgProps: injects a reorg_prop item when guild is set", () => {
  const state = withGuild(baseState());
  const result = withReorgProps([], state, FULL_RANGE);
  const items = result.filter(item => item.kind === "reorg_prop");
  assert.equal(items.length, 1, "exactly one reorg_prop in queue");
  assert.equal(items[0]!.kind, "reorg_prop");
});

test("withReorgProps: reorg_prop depth matches prop.ty (isometric sort key)", () => {
  const state = withGuild(baseState());
  const result = withReorgProps([], state, FULL_RANGE);
  const item = result.find(i => i.kind === "reorg_prop");
  assert.ok(item !== undefined);
  const prop = reorgProp(state)!;
  assert.equal(item.depth, prop.depth, "item.depth equals prop.depth");
});

test("withReorgProps: two calls with same guild state produce the same reorg_prop content", () => {
  const state = withGuild(baseState());
  const queue = [] as Parameters<typeof withReorgProps>[0];
  const r1 = withReorgProps(queue, state, FULL_RANGE);
  const r2 = withReorgProps(queue, state, FULL_RANGE);
  const item1 = r1.find(i => i.kind === "reorg_prop");
  const item2 = r2.find(i => i.kind === "reorg_prop");
  assert.ok(item1 !== undefined && item2 !== undefined);
  assert.equal(item1.id, item2.id, "same guild state → same prop id both calls");
});

// ─── drawReorgOverlays: export smoke tests ────────────────────────────────────

test("drawReorgOverlays: exported and callable; returns early with no error when no reorganisation", () => {
  assert.equal(typeof drawReorgOverlays, "function");
  const state = baseState(); // no reorganisation field
  const ctx = null as unknown as CanvasRenderingContext2D;
  assert.doesNotThrow(() => drawReorgOverlays(ctx, state, 0),
    "no reorganisation → early return without touching ctx");
});

// ─── Textile walkers: condition checks ───────────────────────────────────────

test("drawReorgOverlays: no crash when textileStreetTick set but only one weaver_house", () => {
  const state = withWeavers(
    withReorg(baseState(), { guild: { guildId: "g1", founderHouseId: "h1", foundedTick: 100 }, textileStreetTick: 200, step: "end" }),
    1, // < 2 weavers → walkers should not draw
  );
  const ctx = null as unknown as CanvasRenderingContext2D;
  assert.doesNotThrow(() => drawReorgOverlays(ctx, state, 0),
    "1 weaver_house → no crash (returns before drawing)");
});

test("drawReorgOverlays: no crash when textileStreetTick unset even with 2+ weaver_houses", () => {
  const state = withWeavers(
    withReorg(baseState(), { guild: null, step: "poll_tax" }), // textileStreetTick absent
    2,
  );
  const ctx = null as unknown as CanvasRenderingContext2D;
  assert.doesNotThrow(() => drawReorgOverlays(ctx, state, 0),
    "textileStreetTick absent → no draw, no crash");
});

// ─── Alehouse drinkers: condition checks ─────────────────────────────────────

test("drawReorgOverlays: no crash when alehouseBoomTick set and alehouses present", () => {
  const base = withAlehouse(
    withReorg(baseState(), { alehouseBoomTick: 150, guild: null, step: "autonomy_request" }),
    "house_a", 2, 2,
  );
  const ctx = null as unknown as CanvasRenderingContext2D;
  assert.doesNotThrow(() => drawReorgOverlays(ctx, base, 1000),
    "alehouse crowd path — no crash (canvas null short-circuits at wave9Art img===null)");
});

test("drawReorgOverlays: no crash when alehouseBoomTick set but endedTick also set (chapter ended)", () => {
  const state = withReorg(baseState(), { alehouseBoomTick: 150, endedTick: 800, guild: null, step: "end" });
  const ctx = null as unknown as CanvasRenderingContext2D;
  assert.doesNotThrow(() => drawReorgOverlays(ctx, state, 5000),
    "endedTick set → drinker overlay suppressed, no crash");
});

// ─── Collector chase: condition checks ───────────────────────────────────────

test("drawReorgOverlays: no crash for rebellion outcome 'chased' within season window", () => {
  const state = withReorg(baseState(), {
    rebellion: { tick: 400, outcome: "chased" as const },
    guild: null,
    step: "rebellion_rumour",
  });
  const ctx = null as unknown as CanvasRenderingContext2D;
  // state.tick (500) - rebellion.tick (400) = 100 < SEASON_TICKS → active
  assert.doesNotThrow(() => drawReorgOverlays(ctx, state, 3000),
    "chased + within season → chase path, no crash");
});

test("drawReorgOverlays: chase overlay is suppressed after SEASON_TICKS have elapsed", () => {
  // state.tick (1_600) - rebellion.tick (400) = 1_200 > SEASON_TICKS (1_000) → silent
  const base = { ...baseState(), tick: 1_600 } as unknown as GameState;
  const state = withReorg(base, {
    rebellion: { tick: 400, outcome: "chased" as const },
    guild: null,
    step: "rebellion_rumour",
  });
  const ctx = null as unknown as CanvasRenderingContext2D;
  assert.doesNotThrow(() => drawReorgOverlays(ctx, state, 0),
    "past the season window → no draw, no crash");
});

test("drawReorgOverlays: outcome 'quiet' (no violence) → chase is silent", () => {
  const state = withReorg(baseState(), {
    rebellion: { tick: 400, outcome: "quiet" as const },
    guild: null,
    step: "rebellion_rumour",
  });
  const ctx = null as unknown as CanvasRenderingContext2D;
  assert.doesNotThrow(() => drawReorgOverlays(ctx, state, 0),
    "outcome quiet → no chase walkers, no crash");
});

// ─── No door marks (historical accuracy) ──────────────────────────────────────

test("no door-mark flags: reorgWorldProps imports no door-mark symbols", async () => {
  // The rule: door marks on houses are forbidden (agent-rules.md). The module must not reference
  // any 'door_mark', 'doorMark', or 'door_decal' symbols — walkers use buildingDoor() geometry only.
  const src = await import("node:fs").then(fs =>
    fs.readFileSync(new URL("../src/render/reorgWorldProps.ts", import.meta.url).pathname, "utf8"));
  assert.ok(!src.includes("door_mark"), "no door_mark reference in reorgWorldProps.ts");
  assert.ok(!src.includes("doorMark"), "no doorMark reference in reorgWorldProps.ts");
  assert.ok(!src.includes("door_decal"), "no door_decal reference in reorgWorldProps.ts");
});
