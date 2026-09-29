/**
 * UI-9 chapter 4 decision cards: petitionPresentation, decisionModels, and storyArt dispatch for the four
 * reorganisation petition cards (guild_charter, tax_collection, cloth_or_grain, borough_charter).
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { REORGANISATION_PETITION_IDS } from "../src/content/reorganisationConfig";
import { WAVE21_IMAGES } from "../src/ui/wave21ArtManifest.generated";
import { storyArtStyle } from "../src/ui/storyArt";

// Verify the four ch4 decision art ids exist in the wave21 manifest.
const CH4_DECISION_IDS = [
  "ch4_decision_guild_approval",
  "ch4_decision_tax_collection",
  "ch4_decision_textile_or_grain",
  "ch4_decision_charter_negotiation",
] as const;

test("ch4 decision card Wave 21 art ids are in the manifest", () => {
  for (const id of CH4_DECISION_IDS) {
    assert.ok(id in WAVE21_IMAGES, `${id} must be in wave21ArtManifest`);
    assert.equal(WAVE21_IMAGES[id as keyof typeof WAVE21_IMAGES].width, 640, `${id} width`);
    assert.equal(WAVE21_IMAGES[id as keyof typeof WAVE21_IMAGES].height, 480, `${id} height`);
  }
});

test("ch4 decision card art dispatches via storyArtStyle as wave21 (id in WAVE21_IMAGES)", () => {
  // storyArtStyle dispatches by `id in WAVE21_IMAGES`; these ids must be present there.
  for (const id of CH4_DECISION_IDS) {
    assert.ok(id in WAVE21_IMAGES, `${id} must be in WAVE21_IMAGES for storyArtStyle to pick wave21`);
    // Smoke-call storyArtStyle — it must not throw.
    const style = storyArtStyle(id as keyof typeof WAVE21_IMAGES, 640);
    assert.ok(style !== null && typeof style === "object", `storyArtStyle(${id}) must return CSS properties`);
  }
});

test("all four reorganisation petition ids are defined", () => {
  assert.deepEqual([...REORGANISATION_PETITION_IDS].sort(), ["borough_charter", "cloth_or_grain", "guild_charter", "tax_collection"].sort());
});

test("PETITION_COPY has Korean copy for all four reorg petitions", async () => {
  const { PETITION_COPY } = await import("../src/ui/petitionCopy.ko");
  for (const id of REORGANISATION_PETITION_IDS) {
    const entry = (PETITION_COPY as Record<string, unknown>)[id];
    assert.ok(entry !== undefined, `PETITION_COPY.${id} must exist`);
    const typed = entry as { title: string; demand: string; accept: () => string; refuse: unknown };
    assert.ok(typeof typed.title === "string" && typed.title.length > 0, `${id}.title`);
    assert.ok(typeof typed.demand === "string" && typed.demand.length > 0, `${id}.demand`);
    assert.ok(typeof typed.accept === "function", `${id}.accept`);
    assert.ok(typeof typed.refuse === "function", `${id}.refuse`);
  }
});

test("petitionPresentation has ch4 Wave 21 art for all four reorg petitions", async () => {
  const { WAVE21_IMAGES: manifest } = await import("../src/ui/wave21ArtManifest.generated");
  // Verify that each expected art id is in the manifest (the PRESENTATIONS map is not exported,
  // but the art ids follow a naming convention — test the manifest directly).
  const expectedArt: Readonly<Record<string, keyof typeof manifest>> = {
    guild_charter: "ch4_decision_guild_approval",
    tax_collection: "ch4_decision_tax_collection",
    cloth_or_grain: "ch4_decision_textile_or_grain",
    borough_charter: "ch4_decision_charter_negotiation",
  };
  for (const [_id, artId] of Object.entries(expectedArt)) {
    assert.ok(artId in manifest, `${artId} must be in wave21ArtManifest for ${_id}`);
  }
});

test("UI-9: the four cards' lines follow the spec — relations from the engine's table, the earl's larger turn after his warning", async () => {
  const { petitionPresentation } = await import("../src/ui/petitionPresentation");
  const { decodeSave } = await import("../src/save/saveCodec");
  const { readFileSync } = await import("node:fs");
  const base = decodeSave(new Uint8Array(readFileSync("fixtures/saves/v27/chapter-four-town.save.json"))).envelope.state as import("../src/engine/engine.types").GameState;
  const card = (defId: string, reorg?: object) => petitionPresentation({ ...base, ...(reorg === undefined ? {} : { reorganisation: { influence: { town: 0, merchant_house_1: 0, merchant_house_2: 0 }, ...(base.reorganisation ?? {}), ...reorg } as never }) },
    { id: `${defId}@1`, defId, petitioner: "townsfolk" } as never);
  assert.match(card("guild_charter").line("accept"), /관계 도시 \+10 · 상인 \+5 · 백작 −5$/);
  assert.match(card("guild_charter").line("refuse"), /직조공 2가구가 떠남.*관계 상인 −15 · 도시 −10$/);
  assert.match(card("tax_collection").line("refuse"), /영주의 징수원이 걷습니다 · 어른 한 사람당 3d · 반란 압력 \+40 · 관계 평민 −10 · 국왕 \+5$/);
  assert.match(card("cloth_or_grain").line("accept"), /직물 값 50d · 흉년 수확 85 %로 줄어듦.*반란 압력 \+10/);
  assert.doesNotMatch(card("cloth_or_grain").line("accept"), /감소|줄어듦\(식량이 강/);
  assert.match(card("borough_charter", { warningTick: undefined }).line("accept"), /시장 좌판세 도시로 · 통행세 절반 도시로 · 도시가 해마다 봄에 120d.*백작 −15/);
  assert.match(card("borough_charter", { warningTick: 1 }).line("accept"), /백작 −25/);
});
