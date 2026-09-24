import { saveMetaFor } from "../save/saveCodec";
import type { SaveStorage } from "../save/saveStorage";
import type { SaveMeta } from "../save/saveTypes";

const DATABASE_NAME = "feudal-lord-simulator-saves";
const DATABASE_VERSION = 1;
const BYTES_STORE = "slots";
const META_STORE = "meta";

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed"));
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
  });
}

export function openSaveDatabase(factory: IDBFactory, timeoutMs: number): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("IndexedDB open timed out")), timeoutMs);
    let request: IDBOpenDBRequest;
    try {
      request = factory.open(DATABASE_NAME, DATABASE_VERSION);
    } catch (error) {
      clearTimeout(timeout);
      reject(error);
      return;
    }
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(BYTES_STORE)) database.createObjectStore(BYTES_STORE);
      if (!database.objectStoreNames.contains(META_STORE)) database.createObjectStore(META_STORE);
    };
    request.onsuccess = () => { clearTimeout(timeout); resolve(request.result); };
    request.onerror = () => { clearTimeout(timeout); reject(request.error ?? new Error("IndexedDB open failed")); };
    request.onblocked = () => { clearTimeout(timeout); reject(new Error("IndexedDB open blocked")); };
  });
}

/** Bytes and their header metadata live in two stores so list() never reads whole cities. */
export class IndexedDbSaveStorage implements SaveStorage {
  constructor(private readonly database: IDBDatabase) {}

  async list(): Promise<SaveMeta[]> {
    const transaction = this.database.transaction(META_STORE, "readonly");
    return requestResult(transaction.objectStore(META_STORE).getAll() as IDBRequest<SaveMeta[]>);
  }

  async read(slotId: string): Promise<Uint8Array | null> {
    const transaction = this.database.transaction(BYTES_STORE, "readonly");
    const value = await requestResult(transaction.objectStore(BYTES_STORE).get(slotId) as IDBRequest<ArrayBuffer | undefined>);
    return value === undefined ? null : new Uint8Array(value);
  }

  async write(slotId: string, bytes: Uint8Array): Promise<void> {
    const meta = saveMetaFor(slotId, bytes);
    if (meta === null) throw new Error(`Refusing to store an unreadable save in ${slotId}`);
    const transaction = this.database.transaction([BYTES_STORE, META_STORE], "readwrite");
    const done = transactionDone(transaction);
    const copy = bytes.slice().buffer;
    transaction.objectStore(BYTES_STORE).put(copy, slotId);
    transaction.objectStore(META_STORE).put(meta, slotId);
    await done;
  }

  async remove(slotId: string): Promise<void> {
    const transaction = this.database.transaction([BYTES_STORE, META_STORE], "readwrite");
    const done = transactionDone(transaction);
    transaction.objectStore(BYTES_STORE).delete(slotId);
    transaction.objectStore(META_STORE).delete(slotId);
    await done;
  }
}
