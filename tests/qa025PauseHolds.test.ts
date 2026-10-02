/**
 * QA-025 (docs/qa/round03-14, triage 2026-10-01): while paused, "목표 보기" let time run. The user's rule: every modal,
 * popover and drawer that can open while paused keeps the pause when it opens and when it closes.
 *  - the goal cards' buttons (`goalCardPress`): only the tutorial's "시작하기" starts time;
 *  - every modal (`UiModal`) through the modal pause (`modalPauseStep`), alone and stacked, from each speed;
 *  - every drawer / slot event (`reduceUi`): no modal, so the speed stands;
 *  - the popovers (local state) and everything else: a source guard — only the listed files may set the speed.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { GameSpeed } from "../src/engine/engine.types";
import { CHAPTER_COPY } from "../src/ui/chapterCopy.ko";
import { ChapterTwoPreview } from "../src/ui/hud/StoryModals";
import { INITIAL_UI_STATE, reduceUi, timeStopped, type UiEvent, type UiModal, type UiState } from "../src/ui/stateMachine/uiStateMachine";
import { modalPauseStep } from "../src/ui/stateMachine/useUiStateMachine";
import type { TutorialAction } from "../src/ui/tutorial/tutorialModel";
import { goalCardPress } from "../src/ui/tutorial/useTutorialController";

const MODALS: readonly UiModal[] = ["pause_menu", "event", "season_ledger", "decision", "petition", "chronicle", "chapter_preview",
  "history", "person_card", "legacy_ending", "chronicle_book"];
const SPEEDS: readonly GameSpeed[] = [0, 1, 3, 5, 10];

/** The app's store and its modal pause effect, replayed over the UI states React commits (batched events = one step). */
function session(speed: GameSpeed) {
  let ui: UiState = INITIAL_UI_STATE; let saved: GameSpeed | null = null; let current = speed; const sets: GameSpeed[] = [];
  const commit = (...events: readonly UiEvent[]) => {
    ui = events.reduce(reduceUi, ui);
    const step = modalPauseStep(saved, timeStopped(ui), current);
    saved = step.saved;
    if (step.setSpeed !== null) { current = step.setSpeed; sets.push(step.setSpeed); }
  };
  return { commit, speed: () => current, sets, ui: () => ui };
}

test("QA-025 the goal cards: 목표 보기 opens the chapter's goals and the settlement card the drawer, neither starts time", () => {
  const none = new Map<string, TutorialAction>();
  assert.deepEqual(goalCardPress("chapter", { stepId: null, action: null, generalActions: none }), { resume: false, run: null, open: "chapter" });
  assert.deepEqual(goalCardPress("settlement", { stepId: null, action: null, generalActions: none }), { resume: false, run: null, open: "goals" });
  const arm: TutorialAction = { kind: "arm", tool: "chapel" };
  const zone: TutorialAction = { kind: "armZone", target: "arable" };
  const general = new Map<string, TutorialAction>([["wrap", arm], ["lean_season", zone]]);
  assert.deepEqual(goalCardPress("wrap", { stepId: null, action: null, generalActions: general }), { resume: false, run: arm, open: null });
  assert.deepEqual(goalCardPress("lean_season", { stepId: null, action: null, generalActions: general }), { resume: false, run: zone, open: null });
  assert.deepEqual(goalCardPress("gone", { stepId: null, action: null, generalActions: general }), { resume: false, run: null, open: null });
});

test("QA-025 목표 보기's screen: the chapter's goals with a close button (no play icon, no \"제N장 시작\"); after a chapter page it still starts the chapter", () => {
  const goals = ["1450년 마지막 장날까지 도시와 가문의 유산을 남긴다"];
  const fromCard = renderToStaticMarkup(createElement(ChapterTwoPreview, { onContinue: () => undefined, chapter: 5, goals, closeLabel: CHAPTER_COPY.goalsClose }));
  assert.match(fromCard, /chapter-preview-goals/);
  assert.match(fromCard, new RegExp(`chapter-preview-continue[^>]*>${CHAPTER_COPY.goalsClose}</button>`));
  assert.doesNotMatch(fromCard, /제5장 시작/);
  const afterPage = renderToStaticMarkup(createElement(ChapterTwoPreview, { onContinue: () => undefined, chapter: 5, goals }));
  assert.match(afterPage, /제5장 시작/);
});

test("QA-025 the tutorial's cards: only 시작하기 (greet, a `resume` acknowledgement) starts time; a step that arms or places keeps the pause", () => {
  const none = new Map<string, TutorialAction>();
  const greet: TutorialAction = { kind: "ack", step: "greet", resume: true };
  assert.equal(goalCardPress("greet", { stepId: "greet", action: greet, generalActions: none }).resume, true);
  for (const [stepId, action] of [
    ["well", { kind: "arm", tool: "well" }], ["house", { kind: "place", tool: "house", tile: { tx: 4, ty: 5 } }],
    ["burgage", { kind: "armZone", target: "burgage" }], ["well_done", { kind: "ack", step: "well_done" }],
  ] as const) {
    const press = goalCardPress(stepId, { stepId, action, generalActions: none });
    assert.equal(press.resume, false, stepId); assert.deepEqual(press.run, action, stepId); assert.equal(press.open, null, stepId);
  }
  // A step card pressed under another key (a card that just changed) does nothing to the step.
  assert.deepEqual(goalCardPress("chapter", { stepId: "well", action: { kind: "arm", tool: "well" }, generalActions: none }).open, "chapter");
});

test("QA-025 every modal, from every speed: open and close put the speed back; paused, the speed is never set (no extra pause autosave)", () => {
  for (const modal of MODALS) for (const speed of SPEEDS) {
    const run = session(speed);
    run.commit({ type: "push_modal", modal });
    assert.equal(run.speed(), 0, `${modal} stops time from ${speed}`);
    run.commit({ type: "pop_modal" });
    assert.equal(run.speed(), speed, `${modal} closed: back to ${speed}`);
    assert.deepEqual(run.sets, speed === 0 ? [] : [0, speed], `${modal} from ${speed}`);
  }
});

test("QA-025 stacked modals (the chapter page's chain, the pause menu's book, a person's biography, Esc out): the speed before the first comes back", () => {
  const chains: readonly (readonly (readonly UiEvent[])[])[] = [
    // The chapter page → [다음 장] (pop and push in one handler) → the preview → close.
    [[{ type: "push_modal", modal: "chronicle" }], [{ type: "pop_modal" }, { type: "push_modal", modal: "chapter_preview" }], [{ type: "pop_modal" }]],
    // The chapter page → [전체 연대기] → close both.
    [[{ type: "push_modal", modal: "chronicle" }], [{ type: "push_modal", modal: "history" }], [{ type: "pop_modal" }], [{ type: "pop_modal" }]],
    // Chapter 5's page → the verdict → the book.
    [[{ type: "push_modal", modal: "chronicle" }], [{ type: "pop_modal" }, { type: "push_modal", modal: "legacy_ending" }], [{ type: "push_modal", modal: "chronicle_book" }], [{ type: "pop_modal" }], [{ type: "pop_modal" }]],
    // Esc → the pause menu → its book → Esc, Esc.
    [[{ type: "escape" }], [{ type: "push_modal", modal: "chronicle_book" }], [{ type: "escape" }], [{ type: "escape" }]],
    // A person card → the biography (pop and push) → close.
    [[{ type: "push_modal", modal: "person_card" }], [{ type: "pop_modal" }, { type: "push_modal", modal: "history" }], [{ type: "pop_modal" }]],
    // A petition → a petitioner's card → back → later.
    [[{ type: "push_modal", modal: "petition" }], [{ type: "push_modal", modal: "person_card" }], [{ type: "pop_modal" }], [{ type: "pop_modal" }]],
  ];
  for (const [index, chain] of chains.entries()) for (const speed of SPEEDS) {
    const run = session(speed);
    for (const [at, events] of chain.entries()) {
      run.commit(...events);
      if (at < chain.length - 1) assert.equal(run.speed(), 0, `chain ${index} step ${at} from ${speed}`);
    }
    assert.equal(run.ui().modals.length, 0, `chain ${index} closed`);
    assert.equal(run.speed(), speed, `chain ${index} from ${speed}`);
    assert.deepEqual(run.sets, speed === 0 ? [] : [0, speed], `chain ${index} from ${speed}: one stop, one restore`);
  }
});

test("QA-025 the drawers and the panel slot (build, ledger, inspector, population, goals, zone, HUD toggle): never the speed", () => {
  const events: readonly UiEvent[] = [
    { type: "open_build" }, { type: "toggle_build" }, { type: "pick_tool", line: false }, { type: "pick_tool", line: true }, { type: "tool_cleared" },
    { type: "zone_on" }, { type: "zone_off" }, { type: "select" }, { type: "deselect" }, { type: "open_ledger" }, { type: "toggle_ledger" },
    { type: "open_population" }, { type: "open_goals" }, { type: "toggle_goals" }, { type: "toggle_hud" },
  ];
  for (const speed of SPEEDS) {
    const run = session(speed);
    for (const event of events) { run.commit(event); run.commit({ type: "escape" }); if (run.ui().modals.length > 0) run.commit({ type: "escape" }); }
    assert.equal(run.speed(), speed, `from ${speed}`);
  }
  const paused = session(0);
  for (const event of events) paused.commit(event);
  assert.deepEqual(paused.sets, [], "paused: nothing sets the speed");
});

// The popovers keep their open state locally (the settings Disclosure, the season strip, the coin detail, the build
// menu's details, the goal card fold, the person views, the kit Select, the event cards, the steward bubble): none may
// set the speed. Only these files may: the input intents (Space, the speed seals, the pad), the store, the modal pause,
// App (the seals' handler, the story's event pause) and the tutorial's 시작하기 (inputIntent.ts: the intents' type).
const SPEED_SETTERS = new Set([
  "src/App.tsx", "src/input/inputIntent.ts", "src/input/useAppIntents.ts", "src/input/mouseKeyboardTranslator.ts", "src/input/gamepadTranslator.ts",
  "src/state/gameStore.ts", "src/ui/stateMachine/useUiStateMachine.ts", "src/ui/tutorial/useTutorialController.ts",
]);
const SETS_SPEED = /kind: "speed"|kind: "pauseToggle"|\bsetSpeed\(|\.setSpeed\(/;

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

test("QA-025 source guard: no popover, drawer or screen sets the speed; the files that may are the listed ones", () => {
  const found = sources("src").filter(path => SETS_SPEED.test(readFileSync(path, "utf8"))).sort();
  assert.deepEqual(found.filter(path => !SPEED_SETTERS.has(path)), [], "a new speed setter: check it keeps a paused game paused, then list it here");
  // The tutorial's one speed write is its resume, and the card press calls it only when `goalCardPress` says so.
  const tutorial = readFileSync("src/ui/tutorial/useTutorialController.ts", "utf8");
  assert.equal(tutorial.match(/kind: "speed"/g)?.length, 1);
  assert.match(tutorial, /if \(decided\.resume\) resume\(\);/);
  // App: the seals (a speed the player chose), the story's event pause (pauses only), nothing else.
  const app = readFileSync("src/App.tsx", "utf8");
  assert.deepEqual(app.match(/kind: "speed"|setSpeed\([^)]*\)/g), ["setSpeed(0)", 'kind: "speed"']);
});
