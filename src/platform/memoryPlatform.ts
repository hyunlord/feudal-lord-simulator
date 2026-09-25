import { createIntentBus } from "../input/intentBus";
import { MemorySaveStorage } from "../save/saveStorage";
import { lazyPlatformStorage, type PlatformServices, type RenderScale } from "./PlatformServices";

/** In-memory PlatformServices for tests: memory saves, a Map for preferences, a fixed window. */
export function createMemoryPlatformServices(options: { readonly devicePixelRatio?: number; readonly language?: string } = {}): PlatformServices & { readonly values: Map<string, string> } {
  const values = new Map<string, string>();
  let renderScale: RenderScale = 1;
  const listeners = new Set<(value: RenderScale) => void>();
  const storage = new MemorySaveStorage();
  return {
    values,
    storage: lazyPlatformStorage(async () => ({ storage, kind: "memory", persistent: false })),
    preferences: { get: key => values.get(key) ?? null, set: (key, value) => { values.set(key, value); } },
    window: {
      devicePixelRatio: () => Math.max(1, options.devicePixelRatio ?? 1),
      size: () => ({ width: 1280, height: 800 }),
      isFullscreen: () => false,
      requestFullscreen: async () => false,
      exitFullscreen: async () => undefined,
      renderScale: () => renderScale,
      setRenderScale: value => { if (value === renderScale) return; renderScale = value; for (const listener of [...listeners]) listener(value); },
      subscribeRenderScale: listener => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    },
    locale: { language: () => options.language ?? "ko" },
    input: createIntentBus(),
  };
}
