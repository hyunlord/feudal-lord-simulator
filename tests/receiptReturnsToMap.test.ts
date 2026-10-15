/**
 * LS1-7 (lord-screen-v1.md; the user's rulings 2026-10-15, ID 056's follow-up card hid the result chip): a receipt's close
 * returns to the map — each card that then shows with 나중에 presses its own (no list of kinds: a card decides by having
 * 나중에); a card without 나중에 (the house's change, the year card) shows next. The cards put off keep their chips on the rail by
 * their engine deadlines (home petitions and registry offers as well as the engine's matters due).
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { GREAT_FAMINE_EVENT_ID } from "../src/content/eventConfig";
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
import { laterIfReturning, returningToMap, settleReturnToMap, startReturnToMap } from "../src/ui/decisionCard/receiptClose";
import { storyChips } from "../src/ui/hud/useStoryPresentation";
import { heldChipIds } from "../src/ui/lord/decisions/heldChips";

test("a receipt's close returns to the map: each card that shows with 나중에 presses its own, once (StrictMode), until the map", () => {
  const pressed: string[] = [];
  startReturnToMap();
  assert.equal(laterIfReturning(() => pressed.push("092"), "registry:092"), true, "092 shows: put off as 나중에 would");
  assert.equal(laterIfReturning(() => pressed.push("092 again"), "registry:092"), false, "StrictMode's second run: not twice");
  settleReturnToMap("registry_offer");
  assert.equal(returningToMap(), true, "it put itself off: the return goes on");
  assert.equal(laterIfReturning(() => pressed.push("audit"), "audit:a1"), true, "the next card with 나중에 too");
  settleReturnToMap("audit_decision");
  settleReturnToMap(null);
  assert.equal(returningToMap(), false, "the map: the return is over");
  assert.deepEqual(pressed, ["092", "audit"]);
  assert.equal(laterIfReturning(() => pressed.push("later"), "home:p1"), false, "a card opened afterwards is not put off");
});

test("a card without 나중에 (the house's change, the year card) is not put off: it shows next and the return ends there", () => {
  const pressed: string[] = [];
  startReturnToMap();
  settleReturnToMap("house_change");
  assert.equal(returningToMap(), false, "no card put itself off: the return ends at the house card");
  assert.equal(laterIfReturning(() => pressed.push("next"), "registry:092"), false, "the card under the house card is not put off either");
  assert.deepEqual(pressed, []);
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

test("the political petition while the engine keeps it open, the famine while it takes an answer (to its end)", () => {
  const petitions = { ...lord, politics: { ...lord.politics!, petitions: [{ id: "held-petition", defId: "test", arrivedTick: 0 }] } } as unknown as GameState;
  assert.ok(heldChipIds(petitions).has("petition:held-petition"));
  const answered = { ...petitions, politics: { ...petitions.politics!, petitions: [{ id: "held-petition", defId: "test", arrivedTick: 0, response: "expired" }] } } as unknown as GameState;
  assert.ok(!heldChipIds(answered).has("petition:held-petition"), "its family's silence rule ended it");
  const famine = (endTick: number, response?: unknown) => ({ ...lord, events: { ...lord.events!, records: [{ id: "held-famine", defId: GREAT_FAMINE_EVENT_ID, tick: 0, endTick,
    ...(response === undefined ? {} : { response }) }] } }) as unknown as GameState;
  assert.ok(heldChipIds(famine(lord.tick + 500)).has("famine:held-famine"), "arriving, no answer yet");
  assert.ok(!heldChipIds(famine(lord.tick)).has("famine:held-famine"), "past its end: the engine takes no answer");
  assert.ok(!heldChipIds(famine(lord.tick + 500, { choice: "relief" })).has("famine:held-famine"), "answered");
});

test("a held chip is not pushed off the rail by newer chips", () => {
  const chip = (id: string, kind = "fire") => ({ id, kind, illustration: null, tile: null, decision: null, title: id, line: "", facts: [], advice: "" }) as unknown as StoryBeat;
  const beats = [chip(`registry:${offer.id}`, "registry_event"), chip("a"), chip("b"), chip("c")];
  const entries = beats.map((beat, index) => ({ beat, firstSeenMs: 1_000 + index, lastSeenMs: 9_000, dismissed: index === 0 }));
  const shown = storyChips(entries, new Set(beats.map(beat => beat.id)), 10_000, 500, () => false, heldChipIds(withBoth)).map(beat => beat.id);
  assert.ok(shown.includes(`registry:${offer.id}`), "put off (its card closed) yet kept, ahead of the newer chips");
  assert.equal(shown.length, 3);
});
