import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { CONTROLLER_ACTIONS } from "../src/input/controllerActions";
import { lastInputDevice, reportInputDevice, subscribeInputDevice } from "../src/input/inputDevice";
import { WAVE23_IMAGES } from "../src/render/wave23ArtManifest.generated";
import { DEFAULT_GAME_STATE } from "../src/state/gameStore";
import { BuildSeals } from "../src/ui/BuildMenu";
import { SettlementStatusLine } from "../src/ui/InfoPanel";
import { INPUT_HINT_COPY, PAD_GLYPH_NAMES, PAD_HINT_COPY } from "../src/ui/inputHintCopy.ko";
import { PadGlyph, PadHint } from "../src/ui/PadGlyph";
import { ACTION_GLYPHS, glyphsOf, padGlyphStyle, type PadGlyphId } from "../src/ui/padGlyphs";
import { PauseVeil } from "../src/ui/tutorial/TutorialShell";
import { TUTORIAL_COPY } from "../src/ui/tutorial/tutorialCopy.ko";

// INSTALL-23 ⑤ pad glyphs: the glyph of each controller action (as gamepadTranslator.ts binds it), the Wave 23 art
// behind each glyph, the hints switching between glyphs (gamepad) and key names (keyboard / mouse) on a device change,
// and the glyph's accessible name in the markup.

test("INSTALL-23 every controller action has its pad glyphs, as the translator binds the buttons", () => {
  const expected: Readonly<Record<string, readonly PadGlyphId[]>> = {
    cursor: ["stick_l", "dpad"], camera: ["stick_r"], select: ["a"], confirm: ["a"], cancel: ["b"], tool_prev: ["shoulder_l"], tool_next: ["shoulder_r"],
    zone_tool: ["x"], zoom_in: ["trigger_r"], zoom_out: ["trigger_l"], pause: ["y", "menu"], problem_view: ["view"], menu: ["menu"],
  };
  for (const action of CONTROLLER_ACTIONS) assert.deepEqual(ACTION_GLYPHS[action.id], expected[action.id], action.id);
  assert.equal(Object.keys(ACTION_GLYPHS).length, CONTROLLER_ACTIONS.length);
  // The binding words name the same buttons (A, B, X, Y, LB / RB, the triggers, view, the sticks).
  const binding = (id: string) => CONTROLLER_ACTIONS.find(action => action.id === id)!.gamepad;
  assert.match(binding("select"), /^A\b/); assert.match(binding("cancel"), /^B$/); assert.match(binding("zone_tool"), /^X$/);
  assert.match(binding("tool_prev"), /LB/); assert.match(binding("tool_next"), /RB/); assert.match(binding("zoom_in"), /right trigger/);
  assert.match(binding("zoom_out"), /left trigger/); assert.match(binding("pause"), /Y .*menu/); assert.match(binding("problem_view"), /view/);
  assert.match(binding("cursor"), /left stick.*d-pad/); assert.match(binding("camera"), /right stick/);
  assert.deepEqual(glyphsOf(["zoom_out", "zoom_in", "select", "confirm"]), ["trigger_l", "trigger_r", "a"], "each glyph once");
});

test("INSTALL-23 each glyph is Wave 23 art (32 px 1x and 48 px 2x); the L / R sheets show their own cell", () => {
  for (const glyph of Object.keys(PAD_GLYPH_NAMES) as PadGlyphId[]) {
    const style = padGlyphStyle(glyph, 24);
    const urls = [...String(style.backgroundImage).matchAll(/url\("\/(assets\/wave23\/pad\/[a-z_]+_(32|48)\.png)"\)/g)].map(match => match[1]!);
    assert.equal(urls.length, 2, glyph);
    for (const url of urls) assert.ok(existsSync(`public/${url}`), url);
  }
  assert.equal(WAVE23_IMAGES.pad_shoulder_48.frames.cellWidth * 2, WAVE23_IMAGES.pad_shoulder_48.width);
  assert.deepEqual([padGlyphStyle("shoulder_l", 24).backgroundPosition, padGlyphStyle("shoulder_r", 24).backgroundPosition], ["0px 0", "-24px 0"]);
  assert.deepEqual([padGlyphStyle("trigger_r", 48).backgroundSize, padGlyphStyle("trigger_r", 48).backgroundPosition], ["96px 48px", "-48px 0"]);
  assert.equal(padGlyphStyle("a", 24).backgroundSize, "24px 24px");
  assert.match(String(padGlyphStyle("a", 48).backgroundImage), /^url\("\/assets\/wave23\/pad\/pad_a_48\.png"\)$/);
});

test("INSTALL-23 a glyph is an image with its name; a hint line is glyphs then words", () => {
  const glyph = renderToStaticMarkup(createElement(PadGlyph, { glyph: "a" }));
  assert.match(glyph, /^<span class="pad-glyph" role="img" aria-label="A 버튼" data-pad-glyph="a" style="[^"]*pad_a_32\.png/);
  const hint = renderToStaticMarkup(createElement(PadHint, { parts: PAD_HINT_COPY.build }));
  for (const name of ["A 버튼", "B 버튼", "왼쪽 스틱", "십자키", "오른쪽 스틱", "왼쪽 트리거", "오른쪽 트리거", "왼쪽 어깨 버튼", "오른쪽 어깨 버튼", "X 버튼", "보기 버튼"]) {
    assert.match(hint, new RegExp(`role="img" aria-label="${name}"`), name);
  }
  assert.match(hint, /data-pad-glyph="a"[^>]*><\/span><span class="pad-hint-text">확정<\/span>/);
});

test("INSTALL-23 the hints switch with the device: pad glyphs with a gamepad, key names with the keyboard and mouse", () => {
  const seen: string[] = [];
  const unsubscribe = subscribeInputDevice(device => seen.push(device));
  const render = () => ({
    pause: renderToStaticMarkup(createElement(PauseVeil, { paused: true })),
    build: renderToStaticMarkup(createElement(BuildSeals, { state: DEFAULT_GAME_STATE, selectedTool: null, onSelect: () => undefined })),
    status: renderToStaticMarkup(createElement(SettlementStatusLine, { state: DEFAULT_GAME_STATE, selectedTool: "house" })),
  });
  try {
    assert.equal(lastInputDevice(), "mouse");
    const keyboard = render();
    assert.match(keyboard.pause, new RegExp(TUTORIAL_COPY.paused));
    assert.match(keyboard.build, new RegExp(INPUT_HINT_COPY.mouse));
    assert.match(keyboard.status, /취소하려면 Esc/);
    for (const markup of Object.values(keyboard)) assert.doesNotMatch(markup, /pad-glyph/);

    reportInputDevice("gamepad");
    const pad = render();
    assert.match(pad.pause, /data-input-device="gamepad"/);
    assert.match(pad.pause, /일시정지 중[\s\S]*aria-label="Y 버튼"[\s\S]*aria-label="메뉴 버튼"/);
    assert.doesNotMatch(pad.pause, /Space/);
    assert.match(pad.build, /class="build-menu-instruction" data-input-device="gamepad"><span class="pad-hint/);
    assert.doesNotMatch(pad.build, /Esc\/우클릭/);
    assert.match(pad.status, /aria-label="A 버튼"[\s\S]*지을 곳 정하기 — [^<]+<[\s\S]*aria-label="B 버튼"[\s\S]*취소/);
    assert.doesNotMatch(pad.status, /Esc/);

    reportInputDevice("mouse");
    assert.doesNotMatch(render().build, /pad-glyph/, "back to key names");
    assert.deepEqual(seen, ["gamepad", "mouse"]);
  } finally {
    reportInputDevice("mouse");
    unsubscribe();
  }
});
