import { saveMetaFor } from "./saveCodec";
import type { SaveMeta } from "./saveTypes";

/** Platform save adapter. Game code only sees this; adapters are chosen in src/platform/. */
export interface SaveStorage {
  list(): Promise<SaveMeta[]>;
  read(slotId: string): Promise<Uint8Array | null>;
  write(slotId: string, bytes: Uint8Array): Promise<void>;
  remove(slotId: string): Promise<void>;
}

export class MemorySaveStorage implements SaveStorage {
  private readonly slots = new Map<string, Uint8Array>();

  async list(): Promise<SaveMeta[]> {
    return [...this.slots].flatMap(([slotId, bytes]) => {
      const meta = saveMetaFor(slotId, bytes);
      return meta === null ? [] : [meta];
    });
  }

  async read(slotId: string): Promise<Uint8Array | null> {
    const bytes = this.slots.get(slotId);
    return bytes === undefined ? null : bytes.slice();
  }

  async write(slotId: string, bytes: Uint8Array): Promise<void> {
    this.slots.set(slotId, bytes.slice());
  }

  async remove(slotId: string): Promise<void> {
    this.slots.delete(slotId);
  }
}
