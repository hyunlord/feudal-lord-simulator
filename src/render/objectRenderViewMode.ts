export type ObjectRenderViewMode = "normal" | "outlines";

let objectRenderViewMode: ObjectRenderViewMode = "normal";
const OBJECT_RENDER_VIEW_MODE_EVENT = "feudal:object-render-view-mode";

export function getObjectRenderViewMode(): ObjectRenderViewMode {
  return objectRenderViewMode;
}

export function toggleObjectRenderViewMode(enabled: boolean): ObjectRenderViewMode {
  if (enabled) {
    setObjectRenderViewMode(objectRenderViewMode === "normal" ? "outlines" : "normal");
  }
  return objectRenderViewMode;
}

export function setObjectRenderViewMode(mode: ObjectRenderViewMode): ObjectRenderViewMode {
  objectRenderViewMode = mode;
  publishObjectRenderViewMode(mode);
  return objectRenderViewMode;
}

export function subscribeObjectRenderViewMode(
  listener: (mode: ObjectRenderViewMode) => void,
): () => void {
  if (typeof window === "undefined") return () => undefined;
  const handleEvent = (event: Event) => {
    if (!(event instanceof CustomEvent) || !isObjectRenderViewMode(event.detail)) return;
    listener(event.detail);
  };
  window.addEventListener(OBJECT_RENDER_VIEW_MODE_EVENT, handleEvent);
  return () => window.removeEventListener(OBJECT_RENDER_VIEW_MODE_EVENT, handleEvent);
}

function publishObjectRenderViewMode(mode: ObjectRenderViewMode): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(OBJECT_RENDER_VIEW_MODE_EVENT, { detail: mode }));
}

function isObjectRenderViewMode(value: unknown): value is ObjectRenderViewMode {
  return value === "normal" || value === "outlines";
}
