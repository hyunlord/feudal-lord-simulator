/**
 * LS1-7 (lord-screen-v1.md; the user's ruling 2026-10-15, ID 056's follow-up card hid the result chip): a receipt's close
 * returns to the map — its own card and every card beneath it that can be put off are popped as 나중에 would; a card
 * that cannot be put off (the house's change, the year card) shows next. The cards put off keep their chips on the rail by
 * their engine deadlines (home petitions and registry offers as well as the engine's matters due).
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { LORD_SLICE_SCENARIO_ID } from "../src/content/lordSliceConfig";
import { HOME_PETITION_KINDS } from "../src/content/stewardshipConfig";
import type { GameState } from "../src/engine/engine.types";
import type { RegistryOccurrence } from "../src/engine/registry.types";
import type { EstatePetition } from "../src/engine/stewardship.types";
import { HOME_ESTATE_ID } from "../src/content/estateConfig";
import { stewardshipOf } from "../src/engine/stewardship";
import { advanceTick } from "../src/engine/tick";
import { newGameState } from "../src/state/newGame";
import type { StoryBeat } from "../src/ui/eventStory";
import { receiptPops } from "../src/ui/decisionCard/receiptClose";
import { storyChips } from "../src/ui/hud/useStoryPresentation";
import { heldChipIds } from "../src/ui/lord/decisions/heldChips";
import type { UiModal } from "../src/ui/stateMachine/uiStateMachine";

const stack = (...modals: UiModal[]) => ({ modals: modals.map(modal => ({ modal, under: "idle" as const })) });

test("a receipt's close pops its card and every card beneath it that can be put off, and stops at one that cannot", () => {
  assert.equal(receiptPops(stack("estate_petition")), 1, "one card: back to the map");
  assert.equal(receiptPops(stack("registry_offer", "estate_petition")), 2, "ID 056 over 092: both go, 092 to its chip");
  assert.equal(receiptPops(stack("audit_decision", "petition", "registry_offer", "estate_petition")), 4);
  assert.equal(receiptPops(stack("house_change", "estate_petition")), 1, "the house's change cannot be put off: it shows next");
  assert.equal(receiptPops(stack("year_review", "registry_offer", "estate_petition")), 2, "stops at the year card");
  assert.equal(receiptPops(stack("pause_menu", "decision")), 1);
});

const lord = advanceTick(newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed: 1 })!);
const home: EstatePetition = { id: "held-home", estateId: HOME_ESTATE_ID, kind: Object.keys(HOME_PETITION_KINDS)[0] as EstatePetition["kind"], group: "tenants",
  amount: 20, rights: false, marriage: false, tick: 0, deadline: lord.tick + 1_000, status: "open" } as EstatePetition;
const offer = { id: "registry:ck_evt_005:held:0", entryId: "ck_evt_005", boundId: "", offeredTick: 0, deadline: lord.tick + 1_000, status: "offered",
  receipt: { draw: 1, chancePermille: 500, conditions: [] }, source: "v4", bound: {}, key: "ck_evt_005", context: "" } as unknown as RegistryOccurrence;
const withBoth: GameState = { ...lord, stewardship: { ...stewardshipOf(lord), petitions: [home] },
  registry: { ...lord.registry!, occurrences: [...(lord.registry?.occurrences ?? []), offer] } };

test("held on the rail by their engine deadlines: the home petition's and the registry offer's chips", () => {
  const held = heldChipIds(withBoth);
  assert.ok(held.has("home-petition:held-home"), "the home petition");
  assert.ok(held.has(`registry:${offer.id}`), "the registry offer");
  const past = { ...withBoth, tick: lord.tick + 1_001 };
  assert.ok(!heldChipIds(past).has("home-petition:held-home"), "past its deadline: no longer held");
});

test("a held chip is not pushed off the rail by newer chips", () => {
  const chip = (id: string, kind = "fire") => ({ id, kind, illustration: null, tile: null, decision: null, title: id, line: "", facts: [], advice: "" }) as unknown as StoryBeat;
  const beats = [chip(`registry:${offer.id}`, "registry_event"), chip("a"), chip("b"), chip("c")];
  const entries = beats.map((beat, index) => ({ beat, firstSeenMs: 1_000 + index, lastSeenMs: 9_000, dismissed: index === 0 }));
  const shown = storyChips(entries, new Set(beats.map(beat => beat.id)), 10_000, 500, () => false, heldChipIds(withBoth)).map(beat => beat.id);
  assert.ok(shown.includes(`registry:${offer.id}`), "put off (its card closed) yet kept, ahead of the newer chips");
  assert.equal(shown.length, 3);
});
