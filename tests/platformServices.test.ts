import assert from "node:assert/strict";
import test from "node:test";

import type { InputIntent } from "../src/input/inputIntent";
import { createMemoryPlatformServices } from "../src/platform/memoryPlatform";
import { parseRenderScale, RENDER_SCALE_PREFERENCE_KEY } from "../src/platform/PlatformServices";
import { platformServices, setPlatformServicesForTest } from "../src/platform/platform";
import { createWebPlatformServices, webPlatformServices } from "../src/platform/webPlatform";
import { RENDER_BOUNDARY_V2_STORAGE_KEY, setBoundaryV2Enabled } from "../src/render/renderBoundaryFlag";

// B9 platform layer: the web implementation over a fake window, and the accessor tests use.

function fakeWindow(options: { readonly store?: Map<string, string> | "blocked"; readonly language?: string; readonly dpr?: number } = {}) {
  const events: string[] = [];
  const store = options.store ?? new Map<string, string>();
  const view = {
    devicePixelRatio: options.dpr ?? 2, innerWidth: 1280, innerHeight: 800,
    navigator: { language: options.language ?? "" },
    document: { fullscreenElement: null, documentElement: {} },
    dispatchEvent: (event: Event) => { events.push(event.type); return true; },
    get localStorage() {
      if (store === "blocked") throw new Error("SecurityError");
      return { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => { store.set(key, value); } };
    },
  };
  return { view: view as unknown as Window & typeof globalThis, events, store };
}

test("Given a browser window When the web platform is built Then preferences, window, locale and input answer through it", async () => {
  const { view, events, store } = fakeWindow({ language: "en-US", dpr: 2 });
  const platform = createWebPlatformServices({ window: view });
  platform.preferences.set("feudal.test", "1");
  assert.equal(platform.preferences.get("feudal.test"), "1");
  assert.equal(store instanceof Map && store.get("feudal.test"), "1");
  assert.equal(platform.window.devicePixelRatio(), 2);
  assert.deepEqual(platform.window.size(), { width: 1280, height: 800 });
  assert.equal(platform.window.isFullscreen(), false);
  assert.equal(await platform.window.requestFullscreen(), false, "no fullscreen API: reported, not thrown");
  assert.equal(platform.locale.language(), "en-US");
  const seen: InputIntent[] = [];
  const stop = platform.input.subscribe(intent => { seen.push(intent); return "handled"; });
  assert.equal(platform.input.emit({ kind: "undo" }), true);
  stop();
  platform.input.emit({ kind: "cancel" });
  assert.deepEqual(seen, [{ kind: "undo" }]);
  // No IndexedDB here: saves fall back to memory, as B8 did.
  assert.deepEqual(await platform.storage.ready(), { kind: "memory", persistent: false });
  assert.deepEqual(events, []);
});

test("Given blocked site data When preferences are used Then they read empty and never throw, and the locale defaults to Korean", () => {
  const { view } = fakeWindow({ store: "blocked" });
  const platform = createWebPlatformServices({ window: view });
  assert.doesNotThrow(() => platform.preferences.set("feudal.test", "1"));
  assert.equal(platform.preferences.get("feudal.test"), null);
  assert.equal(platform.locale.language(), "ko");
  assert.equal(platform.window.renderScale(), 1);
});

test("Given a render scale choice When it is set Then it is kept in the preferences, announced and the canvas is told to resize", () => {
  const { view, events, store } = fakeWindow();
  const platform = createWebPlatformServices({ window: view });
  const heard: number[] = [];
  platform.window.subscribeRenderScale(value => heard.push(value));
  platform.window.setRenderScale(1.25);
  assert.equal(platform.window.renderScale(), 1.25);
  assert.equal(store instanceof Map && store.get(RENDER_SCALE_PREFERENCE_KEY), "1.25");
  assert.deepEqual(heard, [1.25]);
  assert.deepEqual(events, ["resize"]);
  assert.equal(createWebPlatformServices({ window: view }).window.renderScale(), 1.25, "a new session reads the stored scale");
  assert.deepEqual([parseRenderScale("0.75"), parseRenderScale("2"), parseRenderScale(null)], [0.75, 1, 1]);
});

test("Given a test platform When the game asks for its services Then it gets that platform, and the web one otherwise", () => {
  const memory = createMemoryPlatformServices();
  setPlatformServicesForTest(memory);
  try {
    assert.equal(platformServices(), memory);
    setBoundaryV2Enabled(false, true);
    assert.equal(memory.values.get(RENDER_BOUNDARY_V2_STORAGE_KEY), "0", "the settings toggle stores its choice in the platform preferences");
    setBoundaryV2Enabled(false);
  } finally {
    setPlatformServicesForTest(null);
  }
  assert.equal(platformServices(), webPlatformServices());
});
