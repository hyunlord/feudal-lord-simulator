import { MemorySaveStorage, type SaveStorage } from "../save/saveStorage";
import { IndexedDbSaveStorage, openSaveDatabase } from "./indexedDbSaveStorage";

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

/** The only place that picks a save adapter. */
export async function openPlatformSaveStorage(
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
