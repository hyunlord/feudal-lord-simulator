import type { CameraState } from "../../render/camera";
import type { AnchoredWorldSelection } from "../../render/worldSelection";

// NAT-2 QA tool: what the QA info overlay reads from the map — the camera, the canvas box and the map's selection —
// registered once by the canvas runtime (readers of its refs: nothing is recorded, nothing runs per frame). The overlay
// calls them a few times a second while it is shown; with it off nobody calls them.
export type QaProbe = {
  readonly camera: () => CameraState;
  readonly viewport: () => { readonly width: number; readonly height: number };
  readonly selection: () => AnchoredWorldSelection | null;
};

let current: QaProbe | null = null;

/** The canvas runtime's readers; the returned function takes them back (the canvas unmounted). */
export function registerQaProbe(probe: QaProbe): () => void {
  current = probe;
  return () => { if (current === probe) current = null; };
}

export function qaProbe(): QaProbe | null {
  return current;
}
