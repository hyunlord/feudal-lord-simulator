import type { IntentBus } from "../input/intentBus";
import type { SaveStorage } from "../save/saveStorage";
import type { SaveStorageKind } from "./saveStoragePlatform";

// Platform layer (B9, design master 13.3): everything the game asks of its host — saves, small preferences, the
// window, the locale and the input intent stream — sits behind this interface. The web build has one implementation
// (webPlatform.ts); Electron / Capacitor / Steam implementations come later and game code does not change.
// Achievements and cloud (13.3) are left out until a platform provides them.

/** Canvas backing-store multiplier on top of the device pixel ratio (performance knob for high-DPI PC, Deck, tablet). */
export type RenderScale = 0.75 | 1 | 1.25;
export const RENDER_SCALES: readonly RenderScale[] = [0.75, 1, 1.25];

export interface PlatformStorage extends SaveStorage {
  /** Resolves once the save adapter is open: which one, and whether saves outlive the tab. */
  ready(): Promise<{ readonly kind: SaveStorageKind; readonly persistent: boolean }>;
}

/** Small per-install string settings (never throws; a blocked store reads as empty). */
export interface PlatformPreferences {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

export interface PlatformWindow {
  /** Device pixel ratio, at least 1. */
  devicePixelRatio(): number;
  size(): { readonly width: number; readonly height: number };
  isFullscreen(): boolean;
  /** false when the host has no fullscreen API. */
  requestFullscreen(): Promise<boolean>;
  exitFullscreen(): Promise<void>;
  renderScale(): RenderScale;
  setRenderScale(value: RenderScale): void;
  subscribeRenderScale(listener: (value: RenderScale) => void): () => void;
}

export interface PlatformLocale {
  /** BCP 47 tag of the player's language; the game ships Korean, so "ko" when the host says nothing. */
  language(): string;
}

export interface PlatformServices {
  readonly storage: PlatformStorage;
  readonly preferences: PlatformPreferences;
  readonly window: PlatformWindow;
  readonly locale: PlatformLocale;
  /** The input intent stream (src/input/intentBus.ts): translators emit, game and UI handlers subscribe. */
  readonly input: IntentBus;
}

export const RENDER_SCALE_PREFERENCE_KEY = "feudal.renderScale";

export function parseRenderScale(value: string | null): RenderScale {
  const number = value === null ? Number.NaN : Number(value);
  return RENDER_SCALES.find(scale => scale === number) ?? 1;
}

/** A SaveStorage whose calls wait for the adapter `open` resolves to (opened once, on first use). */
export function lazyPlatformStorage(open: () => Promise<{ readonly storage: SaveStorage; readonly kind: SaveStorageKind; readonly persistent: boolean }>): PlatformStorage {
  let opened: ReturnType<typeof open> | null = null;
  const adapter = () => (opened ??= open());
  return {
    ready: async () => { const { kind, persistent } = await adapter(); return { kind, persistent }; },
    list: async () => (await adapter()).storage.list(),
    read: async slotId => (await adapter()).storage.read(slotId),
    write: async (slotId, bytes) => (await adapter()).storage.write(slotId, bytes),
    remove: async slotId => (await adapter()).storage.remove(slotId),
  };
}
