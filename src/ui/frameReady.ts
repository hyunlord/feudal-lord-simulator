import { useEffect, useState } from "react";

import { frameArtUrl } from "./frameBox";
import type { FrameKind } from "./frameTokens.generated";

// LS1-19 (render-VIS-checkup33-ae3dee1: the 1313 year card's first frame had no parchment — its text over the map — the
// frame's picture not yet painted): a framed card stays hidden until its frame's picture is decoded. Pictures once ready
// are kept, so the next card shows at once; a picture that fails or takes longer than FRAME_WAIT_MS shows the card anyway.

export const FRAME_WAIT_MS = 1_500;
const ready = new Set<string>();

/** Whether the frame's picture is decoded (or there is nothing to wait on: no image, as on the server). */
export function frameArtReady(kind: FrameKind): boolean {
  return typeof Image === "undefined" || ready.has(frameArtUrl(kind));
}

/** The card's frame is ready to show. */
export function useFrameReady(kind: FrameKind): boolean {
  const [shown, setShown] = useState(() => frameArtReady(kind));
  useEffect(() => {
    if (shown) return undefined;
    const src = frameArtUrl(kind);
    let live = true;
    const done = () => { ready.add(src); if (live) setShown(true); };
    const image = new Image();
    image.src = src;
    if (typeof image.decode === "function") image.decode().then(done, done);
    else { image.onload = done; image.onerror = done; }
    const timer = setTimeout(done, FRAME_WAIT_MS);
    return () => { live = false; clearTimeout(timer); };
  }, [kind, shown]);
  return shown;
}

/** Tests: forget the decoded pictures. */
export function clearFrameReady(): void {
  ready.clear();
}
