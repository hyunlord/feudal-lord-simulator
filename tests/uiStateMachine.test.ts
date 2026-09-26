import assert from "node:assert/strict";
import { test } from "node:test";

import { escapeOnce, hudVisibility, INITIAL_UI_STATE, panelSlot, reduceUi, timeStopped, topModal, type UiEvent, type UiState } from "../src/ui/uiStateMachine";

const run = (events: readonly UiEvent[], from: UiState = INITIAL_UI_STATE) => events.reduce(reduceUi, from);

test("UX-3 S-30: one panel slot — opening the ledger, an inspector or the build drawer closes the one before", () => {
  const build = run([{ type: "open_build" }]);
  assert.equal(panelSlot(build), "build");
  assert.equal(panelSlot(reduceUi(build, { type: "open_ledger" })), "ledger");
  assert.equal(panelSlot(run([{ type: "open_ledger" }, { type: "select" }])), "inspector");
  assert.equal(panelSlot(run([{ type: "select" }, { type: "open_build" }])), "build");
  assert.equal(panelSlot(run([{ type: "open_build" }, { type: "pick_tool", line: false }])), null, "picking a building closes the drawer");
});

test("UX-3 S-31: Esc goes back one step — placement, build drawer, idle, pause menu; and back out of the menu", () => {
  const placing = run([{ type: "open_build" }, { type: "pick_tool", line: false }]);
  assert.equal(placing.mode, "placement");
  const one = escapeOnce(placing); assert.equal(one.mode, "build");
  const two = escapeOnce(one); assert.equal(two.mode, "idle");
  const three = escapeOnce(two); assert.equal(topModal(three), "pause_menu"); assert.equal(timeStopped(three), true);
  const four = escapeOnce(three); assert.equal(topModal(four), null); assert.equal(four.mode, "idle");
  assert.equal(escapeOnce(run([{ type: "open_build" }, { type: "pick_tool", line: true }])).mode, "build", "a line tool too");
  assert.equal(escapeOnce(run([{ type: "select" }])).mode, "idle");
  assert.equal(escapeOnce(run([{ type: "zone_on" }])).mode, "idle");
  assert.equal(run([{ type: "pick_tool", line: false }, { type: "tool_cleared" }]).mode, "build", "a right-click cancel is one step too");
});

test("UX-3 S-32: a modal pushes over placement and pops back to it; nothing under a modal changes; time stops while one is up", () => {
  const placing = run([{ type: "open_build" }, { type: "pick_tool", line: false }]);
  const modal = reduceUi(placing, { type: "push_modal", modal: "event" });
  assert.equal(timeStopped(modal), true);
  assert.equal(reduceUi(modal, { type: "open_ledger" }), modal, "the ledger does not open under a modal");
  const back = reduceUi(modal, { type: "pop_modal" });
  assert.equal(back.mode, "placement"); assert.equal(timeStopped(back), false);
  const stacked = run([{ type: "push_modal", modal: "event" }, { type: "push_modal", modal: "season_ledger" }], placing);
  assert.equal(topModal(stacked), "season_ledger");
  assert.equal(escapeOnce(stacked).modals.length, 1);
});

test("UX-3 HUD: placement hides the dock and the layer switch; zone keeps the layers only; ] hides the HUD", () => {
  const placing = hudVisibility(run([{ type: "pick_tool", line: false }]));
  assert.deepEqual([placing.statusPill, placing.speed, placing.layers, placing.dock, placing.goalCard], [true, true, false, false, false]);
  const zone = hudVisibility(run([{ type: "zone_on" }]));
  assert.deepEqual([zone.layers, zone.dock, zone.goalCard], [true, false, false]);
  assert.equal(hudVisibility(run([{ type: "pick_tool", line: false }]), { tutorialRunning: true }).goalCard, true, "the tutorial's card stays with its step");
  assert.equal(hudVisibility(run([{ type: "open_ledger" }]), { tutorialRunning: true }).goalCard, false);
  const hidden = hudVisibility(run([{ type: "toggle_hud" }]));
  assert.deepEqual(Object.values(hidden).filter(Boolean), []);
});
