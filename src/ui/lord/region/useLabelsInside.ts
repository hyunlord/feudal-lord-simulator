import { useLayoutEffect, type RefObject } from "react";

// LM-R2 region: keep every marker's label on the map. A label hangs under its marker toward the map's middle
// (data-label-side), but a marker near an edge (or a long name) can still put it past the map's edge, where the map
// clips it (geometry audit: text clipped by the map). After layout, each label that crosses the bounds — the canvas,
// and at fit zoom also the map's own box — is nudged back inside (--label-nudge-x / -y, CSS px). Measured again when
// the map's size changes and whenever `deps` change (the estates, the zoom, the picture).

export function useLabelsInside(map: RefObject<HTMLElement | null>, canvas: RefObject<HTMLElement | null>, fit: boolean, deps: readonly unknown[]): void {
  useLayoutEffect(() => {
    const box = map.current;
    const area = canvas.current;
    if (box === null || area === null) return;
    const place = () => {
      const canvasRect = area.getBoundingClientRect();
      const mapRect = box.getBoundingClientRect();
      const bounds = fit
        ? { left: Math.max(canvasRect.left, mapRect.left), right: Math.min(canvasRect.right, mapRect.right), top: Math.max(canvasRect.top, mapRect.top), bottom: Math.min(canvasRect.bottom, mapRect.bottom) }
        : canvasRect;
      for (const label of area.querySelectorAll<HTMLElement>(".lord-region-label")) {
        label.style.setProperty("--label-nudge-x", "0px");
        label.style.setProperty("--label-nudge-y", "0px");
        const rect = label.getBoundingClientRect();
        const dx = rect.left < bounds.left ? bounds.left - rect.left : rect.right > bounds.right ? Math.max(bounds.left - rect.left, bounds.right - rect.right) : 0;
        const dy = rect.top < bounds.top ? bounds.top - rect.top : rect.bottom > bounds.bottom ? Math.max(bounds.top - rect.top, bounds.bottom - rect.bottom) : 0;
        label.style.setProperty("--label-nudge-x", `${Math.round(dx)}px`);
        label.style.setProperty("--label-nudge-y", `${Math.round(dy)}px`);
      }
    };
    place();
    if (typeof ResizeObserver === "undefined") return;
    const watch = new ResizeObserver(place);
    watch.observe(box);
    return () => watch.disconnect();
  // why: the caller names what moves the labels (estates, zoom, picture); the refs are stable
  }, [fit, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps
}
