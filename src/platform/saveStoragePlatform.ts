import { MemorySaveStorage, type SaveStorage } from "../save/saveStorage";
import { IndexedDbSaveStorage, openSaveDatabase } from "./indexedDbSaveStorage";
import { platformServices } from "./platform";

/**
 * Reserved adapters (interface only, not implemented in B8):
 * - FileSaveStorage: Electron main process writes slot files under app.getPath("userData");
 *   the renderer reaches it through a preload bridge exposing exactly the SaveStorage methods.
 * - CapacitorSaveStorage: Capacitor Filesystem (Directory.Data) for iOS/Android builds.
 */
export type ReservedSaveStorageKind = "file" | "capacitor";
export type SaveStorageKind = "indexeddb" | "memory" | ReservedSaveStorageKind;

export interface PlatformSaveStorage {
  readonly storage: SaveStorage;
  readonly kind: SaveStorageKind;
  /** false when saves only live in memory and vanish with the tab. */
  readonly persistent: boolean;
}

const OPEN_TIMEOUT_MS = 3_000;

/** The only place that picks a web save adapter (used by the web platform's storage). */
export async function openWebSaveAdapter(
  environment: { readonly indexedDB?: IDBFactory } = globalThis,
): Promise<PlatformSaveStorage> {
  const factory = environment.indexedDB;
  if (factory !== undefined) {
    try {
      const database = await openSaveDatabase(factory, OPEN_TIMEOUT_MS);
      return { storage: new IndexedDbSaveStorage(database), kind: "indexeddb", persistent: true };
    } catch (_error) {
      // Private windows and blocked site data land here.
    }
  }
  return { storage: new MemorySaveStorage(), kind: "memory", persistent: false };
}

/**
 * Saves for the game (B9): the platform's storage (PlatformServices.storage) and how it was opened. With an explicit
 * `environment` (tests of the adapter choice) the web adapter is opened directly instead.
 */
export async function openPlatformSaveStorage(
  environment?: { readonly indexedDB?: IDBFactory },
): Promise<PlatformSaveStorage> {
  if (environment !== undefined) return openWebSaveAdapter(environment);
  const { storage } = platformServices();
  const { kind, persistent } = await storage.ready();
  return { storage, kind, persistent };
}
