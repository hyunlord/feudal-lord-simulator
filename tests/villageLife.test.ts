/**
 * INSTALL-23 ③ village life in the world (src/render/villageLife.ts, drawn by villageLifeDraw.ts): deterministic from
 * the state, at most eight animals in any view, the small animals alone drawn 1.6 x their display scale, toys only at
 * houses with a child, washing lines only at houses with a woman, fewer in winter, nothing without houses, and the
 * items in the object queue.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { GameState } from "../src/engine/engine.types";
import { ageBandOf, ageOf, currentYear } from "../src/engine/persons";
import { objectRenderItemsForFrame } from "../src/render/renderObjectFrameCache";
import { FLYING_DEPTH, MAX_ANIMALS, SMALL_ANIMAL_LEGIBILITY, TOY_MIN_ZOOM, TOYS, villageLife, villageLifeAnimalCount, type VillageLifeItem } from "../src/render/villageLife";
import { villageLifeDrawnAt } from "../src/render/villageLifeDraw";
import { WAVE23_IMAGES } from "../src/render/wave23ArtManifest.generated";
import { decodeSave } from "../src/save/saveCodec";

const load = (name: string) => decodeSave(new Uint8Array(readFileSync(`fixtures/saves/v19/${name}.save.json`))).envelope.state as GameState;
/** The town in a calendar season (1 summer, 3 winter), 500 ticks into it. */
const inSeason = (state: GameState, season: number): GameState => ({ ...state, tick: Math.floor(state.tick / 4_000) * 4_000 + season * 1_000 + 500 });
const full = (state: GameState) => ({ minTx: 0, minTy: 0, maxTx: state.width - 1, maxTy: state.height - 1 });
const TOWNS = ["palisade-construction", "four-farms", "population-176", "timber-shortage"] as const;
const PLAY: ReadonlySet<string> = new Set(["child_ball", "child_hoop", "child_wooden_sword"]);
const LINES: ReadonlySet<string> = new Set(["clothesline_a", "clothesline_b"]);

function household(state: GameState, buildingId: string) {
  const year = currentYear(state);
  const members = (state.persons?.people ?? []).filter(person => person.alive && person.householdId === buildingId);
  return { child: members.some(person => ageBandOf(ageOf(person, year)) === "child"),
    woman: members.some(person => person.sex === "female" && ageBandOf(ageOf(person, year)) !== "child") };
}

test("Given the same town When village life is asked twice, and of a copy Then the list is the same (no randomness)", () => {
  for (const name of TOWNS) {
    const state = inSeason(load(name), 1);
    const first = villageLife(state, { range: full(state) });
    const copy = structuredClone(state) as GameState;
    assert.deepEqual(villageLife(copy, { range: full(copy) }), first, `${name}: a copy gives the same list`);
    assert.deepEqual(villageLife(state, { range: { ...full(state) } }), first, `${name}: asked again`);
    assert.ok(first.length > 0, `${name}: the town has village life`);
  }
});

test("Given any view of any town in any season When village life is chosen Then it holds at most eight animals (four in winter)", () => {
  let views = 0;
  for (const name of TOWNS) for (const season of [0, 1, 2, 3]) {
    const state = inSeason(load(name), season);
    const cap = season === 3 ? MAX_ANIMALS.winter : MAX_ANIMALS.summer;
    assert.equal(MAX_ANIMALS.summer, 8);
    for (const size of [12, 24, 40, 64]) for (let tx = 0; tx < state.width; tx += 6) for (let ty = 0; ty < state.height; ty += 6) {
      const items = villageLife(state, { range: { minTx: tx, minTy: ty, maxTx: tx + size, maxTy: ty + size } });
      assert.ok(villageLifeAnimalCount(items) <= cap, `${name} season ${season} at ${tx},${ty} (${size}): ${villageLifeAnimalCount(items)} animals`);
      views += 1;
    }
    assert.ok(villageLifeAnimalCount(villageLife(state, { range: full(state) })) <= cap);
  }
  assert.ok(views > 1_000);
});

// INSTALL-23b: the chair, the well's bucket and the washing lines are drawn 1.6 x too; the toys and the barrel keep Astra's scale.
const LEGIBLE_PROPS = new Set(["doorstep_chair", "well_bucket", "clothesline_a", "clothesline_b"]);

test("Given village life When its scales are read Then the small animals, the chair, the bucket and the washing lines are drawn 1.6 x their display scale and the rest at it", () => {
  const seen = new Set<string>();
  for (const name of TOWNS) for (const season of [1, 3]) {
    for (const item of villageLife(inSeason(load(name), season), { range: full(load(name)) })) {
      const small = item.species !== null;
      assert.equal(small, item.animals > 0);
      assert.equal(item.scale, WAVE23_IMAGES[item.kind].displayScale * (small || LEGIBLE_PROPS.has(item.kind) ? SMALL_ANIMAL_LEGIBILITY : 1), item.kind);
      seen.add(`${small ? "animal" : "prop"}:${item.kind}`);
    }
  }
  assert.equal(SMALL_ANIMAL_LEGIBILITY, 1.6);
  assert.ok([...seen].some(kind => kind.startsWith("animal:")) && [...seen].some(kind => kind.startsWith("prop:")), [...seen].join(" "));
});

test("Given households with and without children and women When toys and washing lines are placed Then they stand only at such houses", () => {
  let toys = 0, lines = 0;
  for (const name of TOWNS) {
    const town = inSeason(load(name), 1);
    // Half the houses lose their children, the other half their women: both rules are tested against a mixed town.
    const houses = town.houses.map(house => house.buildingId).sort();
    const noChildren = new Set(houses.filter((_, index) => index % 2 === 0));
    const year = currentYear(town);
    const people = (town.persons?.people ?? []).filter(person => !(noChildren.has(person.householdId) && ageBandOf(ageOf(person, year)) === "child")
      && !(!noChildren.has(person.householdId) && person.sex === "female" && ageBandOf(ageOf(person, year)) !== "child" && houses.indexOf(person.householdId) % 4 === 1));
    for (const state of [town, { ...town, persons: { ...town.persons!, people } }]) {
      for (const item of villageLife(state, { range: full(state) })) {
        if (PLAY.has(item.kind)) { toys += 1; assert.ok(household(state, item.buildingId!).child, `${name}: ${item.id} at a house with a child`); }
        if (LINES.has(item.kind)) { lines += 1; assert.ok(household(state, item.buildingId!).woman, `${name}: ${item.id} at a house with a woman`); }
      }
    }
  }
  assert.ok(toys > 0 && lines > 0, `toys ${toys}, lines ${lines}`);
});

test("Given the same town in summer and in winter When village life is chosen Then winter has fewer items and animals, and no washing", () => {
  for (const name of TOWNS) {
    const summer = villageLife(inSeason(load(name), 1), { range: full(load(name)) });
    const winter = villageLife(inSeason(load(name), 3), { range: full(load(name)) });
    assert.ok(winter.length < summer.length, `${name}: ${winter.length} < ${summer.length}`);
    assert.ok(villageLifeAnimalCount(winter) < villageLifeAnimalCount(summer), `${name}: animals`);
    assert.equal(winter.filter(item => LINES.has(item.kind) || item.kind === "sparrow_flight_sheet").length, 0, `${name}: no washing or sparrows in winter`);
  }
});

test("Given no lived-in house When village life is chosen Then nothing appears", () => {
  const state = inSeason(load("four-farms"), 1);
  assert.deepEqual(villageLife({ ...state, houses: [] }, { range: full(state) }), []);
  assert.deepEqual(villageLife({ ...state, houses: state.houses.map(house => ({ ...house, residents: 0 })) }, { range: full(state) }), []);
  assert.deepEqual(villageLife({ ...state, buildings: state.buildings.filter(building => building.kind !== "house") }, { range: full(state) }), []);
  // A view with no house in it has no birds either.
  const houses = state.buildings.filter(building => building.kind === "house");
  const empty = { minTx: 0, minTy: 0, maxTx: 3, maxTy: 3 };
  assert.ok(houses.every(house => house.tx > 3 || house.ty > 3));
  assert.deepEqual(villageLife(state, { range: empty }), []);
});

test("Given a town When the object queue is built Then village life joins it by depth, flying birds last, and the town scan is cached", () => {
  const state = inSeason(load("four-farms"), 1);
  const range = full(state);
  const queue = objectRenderItemsForFrame({ state, visibleTiles: state.tiles, range, includeGroundCover: false, renderWalkers: [] });
  const life = queue.filter((item): item is Extract<typeof item, { kind: "village_life" }> => item.kind === "village_life");
  const items: readonly VillageLifeItem[] = villageLife(state, { range });
  assert.deepEqual(life.map(item => item.id).sort(), items.map(item => item.id).sort());
  for (let index = 1; index < queue.length; index += 1) assert.ok(queue[index - 1]!.depth <= queue[index]!.depth, "sorted by depth");
  assert.ok(life.filter(item => item.life.motion === "flight").every(item => item.depth >= FLYING_DEPTH));
  // AGENTS rule 10: the town scan once, then cached per state arrays and season.
  const fresh = structuredClone(inSeason(load("palisade-construction"), 1)) as GameState;
  const started = performance.now();
  villageLife(fresh, { range: full(fresh) });
  const scanMs = performance.now() - started;
  const cachedStart = performance.now();
  villageLife(fresh, { range: full(fresh) });
  const cachedMs = performance.now() - cachedStart;
  console.log(`village life: town scan ${scanMs.toFixed(2)} ms, cached ${cachedMs.toFixed(4)} ms (24-house fixture, ${fresh.persons?.people.length ?? 0} people)`);
  assert.ok(cachedMs <= scanMs);
});

test("Given the zoom When village life is drawn Then full detail draws all but the toys (from 1.35), 0.6 only washing lines and flying birds, blocks none", () => {
  const items = villageLife(inSeason(load("four-farms"), 1), { range: full(load("four-farms")) });
  assert.ok(items.some(item => TOYS.has(item.kind)), "the fixture has a toy");
  assert.ok(items.every(item => villageLifeDrawnAt(item, 1) === !TOYS.has(item.kind)));
  assert.ok(items.every(item => villageLifeDrawnAt(item, TOY_MIN_ZOOM)));
  assert.ok(items.every(item => villageLifeDrawnAt(item, 1.34) === !TOYS.has(item.kind)));
  assert.ok(items.every(item => !villageLifeDrawnAt(item, 0.35))); // NAT-2: block detail at zoom <= 0.35
  const simplified = items.filter(item => villageLifeDrawnAt(item, 0.6));
  assert.ok(simplified.length > 0 && simplified.every(item => item.motion === "flight" || LINES.has(item.kind)), simplified.map(item => item.kind).join(" "));
});
