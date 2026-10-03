/**
 * LM-R1 RUN-01 the manor house (src/render/manorHouseArt.ts, manifest by scripts/installManorHouse.py): the six pictures
 * on one canvas with Astra's pivots, A / B fixed by the seed and the building id, the empty manor only from the
 * lordship's real state (never while the lord lives there), the activity overlay while a petition waits, and the
 * native-pivot rect (the pivot on the footprint's front vertex, not the facility rect's centring).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { GameState } from "../src/engine/engine.types";
import { historicalFacilitySpriteRect } from "../src/render/historicalFacilityAssets";
import { tileToScreen } from "../src/render/iso";
import { lordInResidence, MANOR_ART_WIDTH, MANOR_FILL, manorHousePictures, manorHouseRect, manorHouseScale, manorHouseVariant } from "../src/render/manorHouseArt";
import { MANOR_HOUSE_IMAGES } from "../src/render/manorHouseManifest.generated";
import { decodeSave } from "../src/save/saveCodec";

const load = (name: string) => decodeSave(new Uint8Array(readFileSync(`fixtures/saves/v47/${name}.save.json`))).envelope.state as GameState;
const manorOf = (state: GameState) => state.buildings.find(building => building.kind === "manor_house")!;
const isFamily = (tags: readonly string[]) => tags.includes("lord-house:1");
/** The town with the ruling family moved out of the manor's people into the past (dead), the steward left behind. */
const familyGone = (state: GameState): GameState => ({ ...state, persons: { ...state.persons!,
  people: state.persons!.people.filter(person => !isFamily(person.tags)),
  past: [...state.persons!.past, ...state.persons!.people.filter(person => isFamily(person.tags)).map(person => ({ ...person, alive: false }))] } });

test("Given the manifest When its six pictures are read Then one 416 x 328 canvas, A's pivot (249, 319), B's (251, 319), B empty only v2", () => {
  assert.deepEqual(Object.keys(MANOR_HOUSE_IMAGES).sort(), ["manor_a", "manor_a_active", "manor_a_empty", "manor_b", "manor_b_active", "manor_b_empty"]);
  for (const [key, meta] of Object.entries(MANOR_HOUSE_IMAGES)) {
    assert.deepEqual([meta.width, meta.height], [416, 328], key);
    assert.deepEqual(meta.pivot, key.startsWith("manor_a") ? { x: 249, y: 319 } : { x: 251, y: 319 }, key);
  }
  assert.equal(MANOR_HOUSE_IMAGES.manor_b_empty.url, "assets/endings-manors/manors/manor_house_b_empty-v2.png");
});

test("Given seeds and ids When the manor's picture is chosen Then A or B is fixed by them and both occur", () => {
  const picks = Array.from({ length: 30 }, (_, seed) => manorHouseVariant(seed, "manor-house-34-41-0"));
  assert.deepEqual(new Set(picks), new Set(["a", "b"]));
  for (let seed = 0; seed < 30; seed += 1) assert.equal(manorHouseVariant(seed, "manor-house-34-41-0"), picks[seed]);
});

test("Given the lordship When it is read Then the manor is empty only once the lord is gone, never while the lord lives there", () => {
  const town = load("chapter-four-town");
  assert.equal(lordInResidence(town), true);
  assert.equal(manorHousePictures(town, manorOf(town)).body, `manor_${manorHouseVariant(town.seed, manorOf(town).id)}`);
  // A new game: the engine has not made the ruling family yet (only the steward lives there) — the lord is not gone.
  const opening = load("new-game");
  assert.equal(opening.persons!.people.some(person => isFamily(person.tags)), false);
  assert.equal(lordInResidence(opening), true);
  assert.equal(lordInResidence({ ...town, persons: undefined }), true, "no persons yet: the occupied manor");
  // A widowed lady keeps the house (chapter five's town: the head died, the spouse lives on): still in residence.
  assert.equal(lordInResidence(load("chapter-five-town")), true);
  // The family died out (the steward stays): empty.
  const gone = familyGone(town);
  assert.equal(lordInResidence(gone), false);
  assert.equal(manorHousePictures(gone, manorOf(gone)).body, `manor_${manorHouseVariant(town.seed, manorOf(town).id)}_empty`);
  assert.equal(manorHousePictures(gone, manorOf(gone)).active, null);
  // F5-A LG-1: the family left for its country seat.
  const departed = { ...town, legacy: { ...(town.legacy ?? {}), family: "departed" } } as GameState;
  assert.equal(lordInResidence(departed), false);
  assert.equal(lordInResidence({ ...town, legacy: { ...(town.legacy ?? {}), family: "stayed" } } as GameState), true);
});

test("Given a petition waiting When the occupied manor draws Then its activity overlay joins, on the same canvas", () => {
  const town = load("chapter-four-town");
  const quiet = { ...town, politics: { ...town.politics!, petitions: (town.politics?.petitions ?? []).filter(petition => petition.response !== undefined) } };
  const variant = manorHouseVariant(town.seed, manorOf(town).id);
  assert.equal(manorHousePictures(quiet, manorOf(quiet)).active, null);
  const waiting = { ...quiet, politics: { ...quiet.politics, petitions: [...quiet.politics.petitions, { id: "test@1", defId: "test", petitioner: "townsfolk", arrivedTick: 1 }] } } as GameState;
  assert.equal(manorHousePictures(waiting, manorOf(waiting)).active, `manor_${variant}_active`);
});

test("Given the manor's footprint When its rect is read Then Astra's pivot lies on the front vertex, at the houses' fill — not centred", () => {
  const town = load("chapter-four-town");
  const manor = manorOf(town);
  const scale = manorHouseScale(manor);
  assert.equal(scale, MANOR_FILL * 128 / MANOR_ART_WIDTH);
  const rect = manorHouseRect(manor, town.seed);
  const meta = MANOR_HOUSE_IMAGES[`manor_${manorHouseVariant(town.seed, manor.id)}`];
  const front = tileToScreen(manor.tx + 1.5, manor.ty + 1.5);
  assert.ok(Math.abs(rect.x + meta.pivot.x * scale - front.sx) < 1e-9 && Math.abs(rect.y + meta.pivot.y * scale - front.sy) < 1e-9);
  assert.ok(Math.abs(rect.x + rect.width / 2 - front.sx) > 10, "the canvas middle is not on the footprint's middle");
  assert.deepEqual(historicalFacilitySpriteRect(manor, town), rect, "the occlusion outline uses the same rect");
});
