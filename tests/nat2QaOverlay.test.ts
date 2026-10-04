import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import type { GameState } from "../src/engine/engine.types";
import { calendarLabel } from "../src/engine/scenarioState";
import { createMouseKeyboardTranslator } from "../src/input/mouseKeyboardTranslator";
import type { InputIntent } from "../src/input/inputIntent";
import { pickTile } from "../src/render/picking";
import { decodeSave } from "../src/save/saveCodec";
import { walkerHeadline } from "../src/ui/persons/personModels";
import { qaOverlayLines, qaOverlayText, qaReading, qaSelectionLines, viewCenter } from "../src/ui/qa/qaOverlayModel";
import { qaProbe, registerQaProbe } from "../src/ui/qa/qaProbe";
import { walkerDiagnosisModel } from "../src/ui/walkerDiagnosisModel";

// NAT-2 QA tool: the QA info overlay's lines (tick, calendar, speed, camera, the last click, the selection), its key and
// the probe the canvas registers. The town: the chapter-5 fixture (1382, 41 walkers).
const town = decodeSave(new Uint8Array(readFileSync("fixtures/saves/v32/chapter-five-town.save.json"))).envelope.state as GameState;
const camera = { zoom: 0.605, panX: -1234.4, panY: -567.6 };
const viewport = { width: 1600, height: 1100 };
const value = (lines: readonly { key: string; value: string }[], key: string) => lines.find(entry => entry.key === key)?.value;

test("NAT-2 QA overlay: the tick, the calendar, the speed and the camera as a report writes them", () => {
  // Given
  const reading = qaReading(town, { speed: 5, camera, viewport, click: { tx: 48, ty: 37 }, selection: null });

  // When
  const lines = qaOverlayLines(reading);

  // Then
  const center = viewCenter(camera, viewport);
  assert.equal(value(lines, "tick"), String(town.tick));
  assert.equal(value(lines, "calendar"), calendarLabel(town));
  assert.equal(value(lines, "speed"), "5배속");
  assert.equal(value(lines, "zoom"), "0.605");
  assert.equal(value(lines, "pan"), "(-1234, -568)");
  assert.equal(value(lines, "center"), `(${Math.round(center.x)}, ${Math.round(center.y)})`);
  const tile = pickTile(center)!;
  assert.equal(value(lines, "centerTile"), `(${tile.tx}, ${tile.ty})`);
  assert.equal(value(lines, "click"), "(48, 37)");
  assert.equal(value(lines, "selection"), "없음");
  assert.equal(value(qaOverlayLines(qaReading(town, { speed: 0, camera, viewport, click: null, selection: null })), "speed"), "멈춤");
  assert.equal(value(qaOverlayLines(qaReading(town, { speed: 0, camera, viewport, click: null, selection: null })), "click"), "없음");
  // canvas = world × zoom + pan: the centre's world point maps back onto the canvas centre.
  assert.ok(Math.abs(center.x * camera.zoom + camera.panX - 800) < 1e-9 && Math.abs(center.y * camera.zoom + camera.panY - 550) < 1e-9);
});

test("NAT-2 QA overlay: a selected carter — who, what they are doing, what is left of their way; a building its cause line", () => {
  // Given
  const carter = town.walkers.find(walker => walker.kind === "carter")!;
  const diagnosis = walkerDiagnosisModel(town, carter.id)!;
  const headline = walkerHeadline(town, carter.id);
  const house = town.buildings.find(building => building.kind === "house")!;

  // When
  const walker = qaSelectionLines(town, { kind: "walker", walkerId: carter.id });
  const building = qaSelectionLines(town, { kind: "building", buildingId: house.id });
  const gone = qaSelectionLines(town, { kind: "walker", walkerId: "walker:gone" });

  // Then
  assert.equal(value(walker, "selection"), `운반꾼 ${headline?.name ?? "이름 없음"} · ${carter.id}`);
  assert.equal(value(walker, "state"), headline === null ? diagnosis.statusLabel : `${diagnosis.statusLabel} · ${headline.line}`);
  assert.equal(value(walker, "way"), diagnosis.cancellationLabel ?? `남은 길 ${diagnosis.remainingDistance.toFixed(1)}칸 · 도착까지 ${diagnosis.etaTicks}틱`);
  assert.match(value(building, "selection")!, new RegExp(`^.+ · ${house.id} · 칸 \\(${house.tx}, ${house.ty}\\)$`));
  assert.equal(value(gone, "selection"), "사라짐 · walker:gone");
  assert.equal(value(qaSelectionLines(town, { kind: "wall_segment", segmentId: "wall-1" }), "selection"), "성벽 구간 · wall-1");
});

test("NAT-2 QA overlay: the copied text is one 'label: value' a line", () => {
  const lines = qaOverlayLines(qaReading(town, { speed: 1, camera, viewport, click: null, selection: null }));
  const text = qaOverlayText(lines).split("\n");
  assert.equal(text.length, lines.length);
  assert.equal(text[0], `틱: ${town.tick}`);
});

test("NAT-2 QA overlay: ` (Backquote) is the overlay's panel key, taken by no other key; a held key toggles once", () => {
  // Given
  const emitted: InputIntent[] = [];
  const translator = createMouseKeyboardTranslator({ bounds: () => ({ left: 0, top: 0, width: 100, height: 100 }) as DOMRect, camera: () => camera,
    world: () => ({ minX: 0, minY: 0, maxX: 1, maxY: 1 }), armed: () => ({ zone: false, zonePolygon: false, palisade: false, road: false, tool: false, building: false }),
    emit: intent => { emitted.push(intent); return true; } });

  // When
  translator.keyDown({ code: "Backquote", key: "`", target: null });
  translator.keyDown({ code: "Backquote", key: "`", target: null, repeat: true });

  // Then
  assert.deepEqual(emitted.filter(intent => intent.kind === "panel"), [{ kind: "panel", panel: "qa" }]);
  const source = readFileSync("src/input/mouseKeyboardTranslator.ts", "utf8");
  assert.equal(source.match(/Backquote/g)?.length, 2, "the comment and the one binding");
});

test("NAT-2 QA overlay: the canvas's probe is read only while registered (the unmounted canvas takes it back)", () => {
  const probe = { camera: () => camera, viewport: () => viewport, selection: () => null };
  const dispose = registerQaProbe(probe);
  assert.equal(qaProbe(), probe);
  dispose();
  assert.equal(qaProbe(), null);
});
