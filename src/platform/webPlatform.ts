import { createIntentBus } from "../input/intentBus";
import { lazyPlatformStorage, parseRenderScale, RENDER_SCALE_PREFERENCE_KEY,
  type PlatformPreferences, type PlatformServices, type RenderScale } from "./PlatformServices";
import { openWebSaveAdapter } from "./saveStoragePlatform";

// Web implementation of PlatformServices (B9): IndexedDB saves (memory fallback), localStorage preferences, the
// browser window. The only module that touches localStorage, devicePixelRatio, fullscreen and navigator.language.

type WebEnvironment = {
  readonly window?: (Window & typeof globalThis) | undefined;
  readonly indexedDB?: IDBFactory | undefined;
};

function webPreferences(environment: WebEnvironment): PlatformPreferences {
  const store = (): Storage | null => {
    try { return environment.window?.localStorage ?? null; } catch { return null; }
  };
  return {
    get: key => { try { return store()?.getItem(key) ?? null; } catch { return null; } },
    set: (key, value) => { try { store()?.setItem(key, value); } catch { /* storage blocked */ } },
  };
}

export function createWebPlatformServices(environment: WebEnvironment): PlatformServices {
  const view = environment.window;
  const preferences = webPreferences(environment);
  let renderScale = parseRenderScale(preferences.get(RENDER_SCALE_PREFERENCE_KEY));
  const scaleListeners = new Set<(value: RenderScale) => void>();
  return {
    storage: lazyPlatformStorage(() => openWebSaveAdapter(environment.indexedDB === undefined ? {} : { indexedDB: environment.indexedDB })),
    preferences,
    window: {
      devicePixelRatio: () => Math.max(1, view?.devicePixelRatio ?? 1),
      size: () => ({ width: view?.innerWidth ?? 0, height: view?.innerHeight ?? 0 }),
      isFullscreen: () => view?.document.fullscreenElement != null,
      requestFullscreen: async () => {
        const root = view?.document.documentElement;
        if (root === undefined || typeof root.requestFullscreen !== "function") return false;
        try { await root.requestFullscreen(); return true; } catch { return false; }
      },
      exitFullscreen: async () => {
        if (view?.document.fullscreenElement == null) return;
        try { await view.document.exitFullscreen(); } catch { /* already left */ }
      },
      renderScale: () => renderScale,
      setRenderScale: value => {
        preferences.set(RENDER_SCALE_PREFERENCE_KEY, String(value));
        if (value === renderScale) return;
        renderScale = value;
        for (const listener of [...scaleListeners]) listener(value);
        // The canvas re-sizes its backing store on the window resize it already listens to.
        view?.dispatchEvent(new Event("resize"));
      },
      subscribeRenderScale: listener => { scaleListeners.add(listener); return () => { scaleListeners.delete(listener); }; },
    },
    locale: { language: () => view?.navigator.language || "ko" },
    input: createIntentBus(),
  };
}

let web: PlatformServices | null = null;

/** The browser's services, built once. In Node (tests) there is no window: memory saves, empty preferences. */
export function webPlatformServices(): PlatformServices {
  return web ??= createWebPlatformServices(typeof window === "undefined"
    ? { indexedDB: (globalThis as { indexedDB?: IDBFactory }).indexedDB }
    : { window, indexedDB: window.indexedDB });
}
