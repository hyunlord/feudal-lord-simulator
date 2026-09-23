import type { GameState } from "../engine/engine.types";
import {
  decodeSave,
  encodeSave,
  readStoredSchemaVersion,
  SaveChecksumError,
  type DecodedSave,
  type EncodedSave,
} from "./saveCodec";
import type { SaveStorage } from "./saveStorage";
import { SAVE_SCHEMA_VERSION, type SaveEnvelope, type SaveMeta } from "./saveTypes";

export const AUTO_SAVE_SLOTS = ["auto-1", "auto-2", "auto-3"] as const;
export const MANUAL_SAVE_SLOT = "manual";
/** Holds the city the player left when starting a new game; outside the autosave rotation, replaced by the next new game. */
export const PREVIOUS_SAVE_SLOT = "previous";
export const PLAYER_SAVE_SLOTS: readonly string[] = [...AUTO_SAVE_SLOTS, MANUAL_SAVE_SLOT, PREVIOUS_SAVE_SLOT];

export interface SaveWriteResult {
  readonly meta: SaveMeta;
  readonly saveSerializeMs: number;
  readonly writeMs: number;
  readonly byteLength: number;
  readonly backupSlotId: string | null;
}

export interface SaveLoadResult {
  readonly slotId: string;
  readonly envelope: SaveEnvelope;
  readonly state: GameState;
  readonly migratedFrom: number;
  /** Slots that were skipped because they failed to decode or failed the checksum. */
  readonly rejected: readonly { readonly slotId: string; readonly reason: string; readonly checksum: boolean }[];
}

export interface SaveServiceOptions {
  readonly storage: SaveStorage;
  readonly now?: () => Date;
  readonly gameVersion?: string;
}

export function backupSlotIdFor(slotId: string, schemaVersion: number): string {
  return `backup-v${schemaVersion}-${slotId}`;
}

export function newestFirst(metas: readonly SaveMeta[]): SaveMeta[] {
  return [...metas].sort((left, right) => right.savedAt.localeCompare(left.savedAt) || right.tick - left.tick);
}

export function createSaveService(options: SaveServiceOptions) {
  const { storage } = options;
  const now = options.now ?? (() => new Date());
  const schemaCheckedSlots = new Set<string>();
  let sessionCreatedAt = now().toISOString();

  /** Before the first write of this schema into a slot, keep whatever older file was there. */
  async function backupOlderSchema(slotId: string): Promise<string | null> {
    if (schemaCheckedSlots.has(slotId)) return null;
    schemaCheckedSlots.add(slotId);
    const existing = await storage.read(slotId);
    if (existing === null) return null;
    const version = readStoredSchemaVersion(existing) ?? 0;
    if (version >= SAVE_SCHEMA_VERSION) return null;
    const backupSlotId = backupSlotIdFor(slotId, version);
    await storage.write(backupSlotId, existing);
    return backupSlotId;
  }

  /** Synchronous so a caller can bound the main-thread cost of a save to one task. */
  function encode(state: GameState): EncodedSave {
    return encodeSave({ state, createdAt: sessionCreatedAt, savedAt: now().toISOString(),
      ...(options.gameVersion === undefined ? {} : { gameVersion: options.gameVersion }) });
  }

  async function writeEncoded(slotId: string, encoded: EncodedSave): Promise<SaveWriteResult> {
    const writeStartedAt = performance.now();
    const backupSlotId = await backupOlderSchema(slotId);
    await storage.write(slotId, encoded.bytes);
    const writeMs = performance.now() - writeStartedAt;
    const meta: SaveMeta = {
      slotId,
      schemaVersion: encoded.header.schemaVersion,
      savedAt: encoded.header.savedAt,
      createdAt: encoded.header.createdAt,
      tick: encoded.header.tick,
      summary: encoded.header.summary,
      byteLength: encoded.bytes.byteLength,
    };
    return { meta, saveSerializeMs: encoded.saveSerializeMs, writeMs, byteLength: encoded.bytes.byteLength, backupSlotId };
  }

  function save(slotId: string, state: GameState): Promise<SaveWriteResult> {
    return writeEncoded(slotId, encode(state));
  }

  async function playerSaves(): Promise<SaveMeta[]> {
    return newestFirst((await storage.list()).filter(meta => PLAYER_SAVE_SLOTS.includes(meta.slotId)));
  }

  /** Rotates auto-1..3: an empty slot first, otherwise the oldest one. */
  async function nextAutoSlot(): Promise<string> {
    const metas = await storage.list();
    const bySlot = new Map(metas.map(meta => [meta.slotId, meta]));
    const empty = AUTO_SAVE_SLOTS.find(slotId => !bySlot.has(slotId));
    if (empty !== undefined) return empty;
    const oldest = [...AUTO_SAVE_SLOTS].sort((left, right) =>
      (bySlot.get(left)?.savedAt ?? "").localeCompare(bySlot.get(right)?.savedAt ?? ""))[0];
    return oldest ?? AUTO_SAVE_SLOTS[0];
  }

  async function decodeSlot(slotId: string): Promise<DecodedSave> {
    const bytes = await storage.read(slotId);
    if (bytes === null) throw new Error(`Save slot ${slotId} is empty`);
    return decodeSave(bytes);
  }

  /** Loads the first slot that decodes, trying `slotIds` in order; failures are reported, not thrown. */
  async function loadFirst(slotIds: readonly string[]): Promise<SaveLoadResult | null> {
    const rejected: { slotId: string; reason: string; checksum: boolean }[] = [];
    for (const slotId of slotIds) {
      try {
        const decoded = await decodeSlot(slotId);
        sessionCreatedAt = decoded.envelope.createdAt;
        return { slotId, envelope: decoded.envelope, state: decoded.envelope.state, migratedFrom: decoded.migratedFrom, rejected };
      } catch (error) {
        rejected.push({ slotId, reason: (error as Error).message, checksum: error instanceof SaveChecksumError });
      }
    }
    return null;
  }

  return {
    save,
    /** Encodes before choosing the slot, so serialisation happens in the caller's task. */
    autosave(state: GameState): Promise<SaveWriteResult> {
      const encoded = encode(state);
      return nextAutoSlot().then(slotId => writeEncoded(slotId, encoded));
    },
    saveManual(state: GameState): Promise<SaveWriteResult> {
      return save(MANUAL_SAVE_SLOT, state);
    },
    playerSaves,
    /** Newest save to continue; the archived previous city is offered only from the load list. */
    async latest(): Promise<SaveMeta | null> {
      return (await playerSaves()).find(meta => meta.slotId !== PREVIOUS_SAVE_SLOT) ?? null;
    },
    /** Copies the newest autosave into the previous-city slot so the autosave rotation cannot overwrite it. */
    async archivePrevious(): Promise<SaveMeta | null> {
      const newestAuto = (await playerSaves()).find(meta => (AUTO_SAVE_SLOTS as readonly string[]).includes(meta.slotId));
      if (newestAuto === undefined) return null;
      const bytes = await storage.read(newestAuto.slotId);
      if (bytes === null) return null;
      await storage.write(PREVIOUS_SAVE_SLOT, bytes);
      return { ...newestAuto, slotId: PREVIOUS_SAVE_SLOT };
    },
    /** Loads `slotId`; when it is corrupt, falls back to the remaining saves newest first. */
    async load(slotId: string): Promise<SaveLoadResult | null> {
      const others = (await playerSaves()).map(meta => meta.slotId).filter(id => id !== slotId);
      return loadFirst([slotId, ...others]);
    },
    async loadLatest(): Promise<SaveLoadResult | null> {
      return loadFirst((await playerSaves()).map(meta => meta.slotId).filter(id => id !== PREVIOUS_SAVE_SLOT));
    },
    startNewSession(): void {
      sessionCreatedAt = now().toISOString();
    },
  };
}

export type SaveService = ReturnType<typeof createSaveService>;
