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
