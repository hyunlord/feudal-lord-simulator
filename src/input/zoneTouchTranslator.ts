import { canvasToWorld, type CameraState, type Point } from "../render/camera";
import type { InputIntent, WorldPoint } from "./inputIntent";
import type { ArmedTools, Outcome } from "./mouseKeyboardTranslator";

// Touch -> input intents while the zone brush is armed (C1b behaviour, B9 moved here): one finger paints (or adds a
// polygon vertex), two fingers pan the camera and drop a brush stroke in progress. Without a zone tool touches are
// left to the browser. The full touch contract (13.1 rule 3: one-finger pan without a tool, pinch zoom, tap to
// place) is the next step; this keeps exactly what touch did before.

type TouchPoint = { readonly clientX: number; readonly clientY: number };
type CanvasRect = { readonly left: number; readonly top: number };

export type TouchTranslatorContext = {
  readonly bounds: () => CanvasRect;
  readonly camera: () => CameraState;
  readonly armed: () => ArmedTools;
  readonly emit: (intent: InputIntent) => boolean;
};

const NONE: Outcome = { preventDefault: false };
const PREVENT: Outcome = { preventDefault: true };

export function createZoneTouchTranslator(context: TouchTranslatorContext) {
  let pan: { readonly start: Point; readonly camera: CameraState } | null = null;
  /** A one-finger brush stroke is in progress (a polygon vertex is a single tap). */
  let painting = false;
  let last: WorldPoint | null = null;
  const local = (touch: TouchPoint): Point => { const rect = context.bounds(); return { x: touch.clientX - rect.left, y: touch.clientY - rect.top }; };
  const midpoint = (touches: readonly TouchPoint[]): Point => {
    const a = local(touches[0] as TouchPoint); const b = local(touches[1] as TouchPoint);
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  };
  const worldOf = (touch: TouchPoint): WorldPoint => canvasToWorld(local(touch), context.camera());

  return {
    start(touches: readonly TouchPoint[]): Outcome {
      const armed = context.armed();
      if (!armed.zone) return NONE;
      if (touches.length >= 2) {
        if (painting) { context.emit({ kind: "cancel", world: canvasToWorld(midpoint(touches), context.camera()) }); painting = false; }
        pan = { start: midpoint(touches), camera: context.camera() };
        return PREVENT;
      }
      last = worldOf(touches[0] as TouchPoint);
      context.emit({ kind: "strokeBegin", toolId: "zone", world: last, polygon: armed.zonePolygon });
      painting = !armed.zonePolygon;
      return PREVENT;
    },
    move(touches: readonly TouchPoint[]): Outcome {
      if (!context.armed().zone) return NONE;
      if (pan !== null && touches.length >= 2) {
        const now = midpoint(touches); const camera = context.camera();
        context.emit({ kind: "pan", dx: pan.camera.panX + now.x - pan.start.x - camera.panX, dy: pan.camera.panY + now.y - pan.start.y - camera.panY });
        return PREVENT;
      }
      if (touches.length === 1 && pan === null) {
        last = worldOf(touches[0] as TouchPoint);
        context.emit({ kind: "strokeMove", world: last });
      }
      return PREVENT;
    },
    end(remaining: number): Outcome {
      if (!context.armed().zone) return NONE;
      if (pan !== null) { if (remaining === 0) pan = null; return PREVENT; }
      if (remaining === 0 && painting && last !== null) context.emit({ kind: "strokeEnd", world: last });
      if (remaining === 0) painting = false;
      return PREVENT;
    },
  };
}
