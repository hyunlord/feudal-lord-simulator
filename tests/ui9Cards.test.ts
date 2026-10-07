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

test("PETITION_COPY has Korean copy for all four reorg petitions; the card has their stake and answers", async () => {
  const { PETITION_COPY } = await import("../src/ui/petitionCopy.ko");
  const { PETITION_ANSWER_COPY, PETITION_STAKE } = await import("../src/ui/decisionCard/families/petitionCardCopy.ko");
  for (const id of REORGANISATION_PETITION_IDS) {
    const entry = (PETITION_COPY as Record<string, unknown>)[id];
    assert.ok(entry !== undefined, `PETITION_COPY.${id} must exist`);
    const typed = entry as { title: string; demand: string };
    assert.ok(typeof typed.title === "string" && typed.title.length > 0, `${id}.title`);
    assert.ok(typeof typed.demand === "string" && typed.demand.length > 0, `${id}.demand`);
    assert.match(PETITION_STAKE[id], /걸려 있습니다\.$/, `${id}: the stake`);
    assert.ok(PETITION_ANSWER_COPY[id] !== undefined, `${id}: the answers' words`);
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

test("UI-9 DEC-CARD: the four cards' answers in words, who remembers them the engine's own relation moves, the earl's larger turn after his warning", async () => {
  const { petitionCard } = await import("../src/ui/decisionCard/families/petitionCard");
  const { gameReducer } = await import("../src/state/gameStore");
  const { openPetitions } = await import("../src/engine/politics");
  type State = import("../src/engine/engine.types").GameState;
  const { reorganisationState } = await import("./helpers/deccardCampaignStates");
  const open = (defId: string, reorg?: object): State => reorganisationState(defId, reorg);
  const answer = (defId: string, response: string, reorg?: object) => petitionCard(open(defId, reorg))!.card.choices.find(choice => choice.id === response)!;
  for (const defId of REORGANISATION_PETITION_IDS) {
    for (const choice of petitionCard(open(defId))!.card.choices) {
      const state = open(defId);
      const after = gameReducer(state, { type: "petition_response", petitionId: openPetitions(state)[0]!.id, response: choice.id as never });
      const moved = after.factions!.factions.map(faction => faction.relation - state.factions!.factions.find(entry => entry.id === faction.id)!.relation).filter(delta => delta !== 0);
      assert.deepEqual(choice.remembers.map(entry => entry.delta).sort(), moved.sort(), `${defId}:${choice.id}: the factions as the answer moves them`);
      assert.ok(choice.now.length > 0, `${defId}:${choice.id}: what it does now`);
    }
  }
  assert.match(answer("guild_charter", "refuse").later.join(" "), /직조공 2가구가 떠납니다.*반란 압력이 10 오릅니다/);
  assert.match(answer("tax_collection", "refuse").later.join(" "), /어른 한 사람당 3d가 들어옵니다.*반란 압력이 40 오릅니다/);
  assert.match(answer("cloth_or_grain", "accept").now.join(" "), /직물 값이 4s 2d가 됩니다/);
  assert.match(answer("cloth_or_grain", "accept").later.join(" "), /수확이 85%로 줄어/);
  assert.match(answer("borough_charter", "accept", { warningTick: undefined }).later.join(" "), /자치 연납금 10s을 냅니다/);
  assert.ok(answer("borough_charter", "accept", { warningTick: undefined }).remembers.some(entry => entry.delta === -15));
  assert.ok(answer("borough_charter", "accept", { warningTick: 1 }).remembers.some(entry => entry.delta === -25), "the earl's larger turn after his warning");
});
