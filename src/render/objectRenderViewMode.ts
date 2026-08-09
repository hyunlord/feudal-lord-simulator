export type ObjectRenderViewMode = "normal" | "outlines";

let objectRenderViewMode: ObjectRenderViewMode = "normal";

export function getObjectRenderViewMode(): ObjectRenderViewMode {
  return objectRenderViewMode;
}

export function toggleObjectRenderViewMode(enabled: boolean): ObjectRenderViewMode {
  if (enabled) {
    objectRenderViewMode = objectRenderViewMode === "normal" ? "outlines" : "normal";
  }
  return objectRenderViewMode;
}
