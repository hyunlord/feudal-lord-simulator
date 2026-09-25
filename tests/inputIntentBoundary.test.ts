import assert from "node:assert/strict";
import test from "node:test";

import { checkSource, inputIntentViolations } from "../scripts/inputIntentBoundary";
import { CONTROLLER_ACTIONS } from "../src/input/controllerActions";
import type { InputIntent } from "../src/input/inputIntent";
import { createMouseKeyboardTranslator } from "../src/input/mouseKeyboardTranslator";

// B9 gate 1: player input reaches the game only as input intents (scripts/inputIntentBoundary.ts, rules R1-R4).

test("Given src/render, src/ui and App.tsx When they are scanned Then no DOM input listener, event hand-off or event-receiving handler reference is left", () => {
  assert.deepEqual(inputIntentViolations(), []);
});

test("Given the patterns the old canvas runtime used When they are checked Then each rule fires", () => {
  const found = checkSource("x.tsx", `
    canvas.addEventListener("mousedown", startDrag);
    const startDrag = (event: MouseEvent) => { zoneMouseDown(context, event, point); };
    const click = (event: MouseEvent) => handleCanvasClick({ event, canvas });
    const keep = (event: MouseEvent) => { event.stopPropagation(); };
    const ok = () => <button onClick={event => { keep(event); run(event.clientX); }} onPointerDown={keep}>a</button>;
    const bad = () => <button onClick={onClose} onKeyDown={event => handle(event)}>b</button>;
    const sink = () => <button onClick={() => setSpeed(3)}>c</button>;
    const component = () => <Menu onSelect={select} />;`).map(violation => `${violation.rule}:${violation.line}`);
  assert.deepEqual(found.sort(), ["R1:2", "R2:3", "R2:4", "R2:7", "R3:7", "R4:8"].sort());
});

test("Given the controller action table When its keyboard bindings are pressed Then each emits the action's intent", () => {
  for (const action of CONTROLLER_ACTIONS) {
    for (const code of action.keyboard) {
      const intents: InputIntent[] = [];
      const translator = createMouseKeyboardTranslator({ bounds: () => ({ left: 0, top: 0, width: 800, height: 600 }), camera: () => ({ zoom: 1, panX: 0, panY: 0 }),
        world: () => ({ minX: -10_000, minY: -10_000, maxX: 10_000, maxY: 10_000 }), armed: () => ({ zone: false, zonePolygon: false, palisade: false, road: false }),
        emit: intent => { intents.push(intent); return true; } });
      const key = code.startsWith("Key") ? code.slice(3).toLowerCase() : code === "Space" ? " " : code;
      translator.keyDown({ code, key, target: null });
      const now = performance.now();
      translator.frame(now + 50, now + 34, { width: 800, height: 600 });
      translator.keyUp({ code, key, target: null });
      assert.ok(intents.some(intent => intent.kind === action.intent), `${action.id} ${code} -> ${action.intent} (got ${intents.map(intent => intent.kind).join(",")})`);
    }
  }
});
