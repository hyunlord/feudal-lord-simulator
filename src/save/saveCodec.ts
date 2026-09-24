import type { GameState } from "../engine/engine.types";
import { GAME_VERSION } from "./gameVersion";
import { migrateSaveToLatest, saveSchemaVersionOf } from "./migrations";
import { createSaveSummary } from "./saveSummary";
import {
  DEFAULT_SCENARIO_ID,
  SAVE_SCHEMA_VERSION,
  type GameStateSnapshot,
  type SaveEnvelope,
  type SaveHeader,
  type SaveMeta,
} from "./saveTypes";

// The state is always the last member so headers can be read without parsing the whole city.
const STATE_MARKER = ',"state":';
const HEADER_PROBE_BYTES = 16_384;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export class SaveFormatError extends Error {}
export class SaveChecksumError extends SaveFormatError {}

export interface EncodeSaveInput {
  readonly state: GameState;
  readonly createdAt: string;
  readonly savedAt: string;
  readonly scenarioId?: string;
  readonly gameVersion?: string;
}

export interface EncodedSave {
  readonly bytes: Uint8Array;
  readonly header: SaveHeader;
  readonly saveSerializeMs: number;
}

export function toSnapshot(state: GameState): GameStateSnapshot {
  return state;
}

export function encodeSave(input: EncodeSaveInput): EncodedSave {
  const startedAt = performance.now();
  const stateJson = JSON.stringify(toSnapshot(input.state));
  const header: SaveHeader = {
    schemaVersion: SAVE_SCHEMA_VERSION,
    gameVersion: input.gameVersion ?? GAME_VERSION,
    createdAt: input.createdAt,
    savedAt: input.savedAt,
    scenarioId: input.scenarioId ?? DEFAULT_SCENARIO_ID,
    seed: String(input.state.seed),
    tick: input.state.tick,
    rngState: { kind: "derived", algorithm: "mulberry32/fnv1a-roaming-junction-v1", seed: input.state.seed },
    summary: createSaveSummary(input.state),
    checksum: stateChecksum(stateJson),
  };
  const headerJson = JSON.stringify(header);
  const bytes = encoder.encode(`${headerJson.slice(0, -1)}${STATE_MARKER}${stateJson}}`);
  return { bytes, header, saveSerializeMs: performance.now() - startedAt };
}

export interface DecodedSave {
  readonly envelope: SaveEnvelope;
  readonly migratedFrom: number;
}

export function decodeSave(bytes: Uint8Array): DecodedSave {
  const text = decoder.decode(bytes);
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    throw new SaveFormatError(`Save is not valid JSON: ${(error as Error).message}`);
  }
  if (typeof raw === "object" && raw !== null && "checksum" in raw) {
    if (typeof raw.checksum !== "string") throw new SaveFormatError("Save checksum must be a string");
    if (!("state" in raw)) throw new SaveFormatError("Save checksum requires state");
    const markerAt = text.indexOf(STATE_MARKER);
    const stateJson = markerAt < 0 ? JSON.stringify(raw.state) : text.slice(markerAt + STATE_MARKER.length, -1);
    const actual = stateChecksum(stateJson);
    if (actual !== raw.checksum) {
      throw new SaveChecksumError(`Save checksum mismatch: expected ${raw.checksum}, got ${actual}`);
    }
  }
  const { value, fromVersion } = migrateSaveToLatest(raw);
  const envelope = validateEnvelope(value);
  return { envelope, migratedFrom: fromVersion };
}

/** Reads only the envelope header; falls back to a full decode for older or reordered files. */
export function readSaveHeader(bytes: Uint8Array): SaveHeader | null {
  const probe = decoder.decode(bytes.subarray(0, HEADER_PROBE_BYTES));
  const markerAt = probe.indexOf(STATE_MARKER);
  if (markerAt >= 0) {
    try {
      const header = JSON.parse(`${probe.slice(0, markerAt)}}`) as SaveHeader;
      if (typeof header.schemaVersion === "number") return header;
    } catch (_error) {
      // fall through to a full decode
    }
  }
  try {
    const { state: _state, ...header } = decodeSave(bytes).envelope;
    return header;
  } catch (_error) {
    return null;
  }
}

/** The schema a file was written with, before any migration; null when it is not a save at all. */
export function readStoredSchemaVersion(bytes: Uint8Array): number | null {
  const probe = decoder.decode(bytes.subarray(0, HEADER_PROBE_BYTES));
  const markerAt = probe.indexOf(STATE_MARKER);
  if (markerAt >= 0) {
    try {
      const header = JSON.parse(`${probe.slice(0, markerAt)}}`) as Partial<SaveHeader>;
      if (typeof header.schemaVersion === "number") return header.schemaVersion;
    } catch (_error) {
      // fall through to a full parse
    }
  }
  try {
    return saveSchemaVersionOf(JSON.parse(decoder.decode(bytes)));
  } catch (_error) {
    return null;
  }
}

export function saveMetaFor(slotId: string, bytes: Uint8Array): SaveMeta | null {
  const header = readSaveHeader(bytes);
  if (header === null) return null;
  return {
    slotId,
    schemaVersion: header.schemaVersion,
    savedAt: header.savedAt,
    createdAt: header.createdAt,
    tick: header.tick,
    summary: header.summary ?? null,
    byteLength: bytes.byteLength,
  };
}

/** 53-bit cyrb53 over the state JSON; synchronous so saving never awaits crypto. */
export function stateChecksum(text: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    h1 = Math.imul(h1 ^ code, 2_654_435_761);
    h2 = Math.imul(h2 ^ code, 1_597_334_677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2_246_822_507) ^ Math.imul(h2 ^ (h2 >>> 13), 3_266_489_909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2_246_822_507) ^ Math.imul(h1 ^ (h1 >>> 13), 3_266_489_909);
  const value = 4_294_967_296 * (2_097_151 & h2) + (h1 >>> 0);
  return `cyrb53:${value.toString(16).padStart(14, "0")}`;
}

function validateEnvelope(value: unknown): SaveEnvelope {
  if (typeof value !== "object" || value === null) throw new SaveFormatError("Save envelope is not an object");
  const envelope = value as Partial<SaveEnvelope>;
  if (envelope.schemaVersion !== SAVE_SCHEMA_VERSION) {
    throw new SaveFormatError(`Unsupported save schema ${String(envelope.schemaVersion)}`);
  }
  for (const key of ["gameVersion", "createdAt", "savedAt", "scenarioId", "seed"] as const) {
    if (typeof envelope[key] !== "string") throw new SaveFormatError(`Save envelope ${key} must be a string`);
  }
  if (typeof envelope.tick !== "number") throw new SaveFormatError("Save envelope tick must be a number");
  assertGameStateSnapshot(envelope.state);
  if (envelope.state.tick !== envelope.tick) throw new SaveFormatError("Save envelope tick does not match its state");
  return envelope as SaveEnvelope;
}

const REQUIRED_ARRAYS = ["tiles", "buildings", "constructionSites", "houses", "walkers", "forestHarvests"] as const;
const REQUIRED_NUMBERS = [
  "tick", "seed", "width", "height", "population", "idleWorkers", "treasuryTimber", "treasuryCoin",
  "wallTick", "nextConstructionOrdinal", "roadRevision",
] as const;

export function assertGameStateSnapshot(value: unknown): asserts value is GameStateSnapshot {
  if (typeof value !== "object" || value === null) throw new SaveFormatError("Save state is not an object");
  const state = value as Record<string, unknown>;
  for (const key of REQUIRED_ARRAYS) {
    if (!Array.isArray(state[key])) throw new SaveFormatError(`Save state ${key} must be an array`);
  }
  for (const key of REQUIRED_NUMBERS) {
    if (typeof state[key] !== "number" || !Number.isFinite(state[key])) {
      throw new SaveFormatError(`Save state ${key} must be a finite number`);
    }
  }
  if (!["hamlet", "palisade", "stone_town"].includes(state.era as string)) throw new SaveFormatError("Save state era is unknown");
  if (typeof state.pathCache !== "object" || state.pathCache === null) throw new SaveFormatError("Save state pathCache must be an object");
  if ((state.tiles as unknown[]).length !== (state.width as number) * (state.height as number)) {
    throw new SaveFormatError("Save state tiles do not cover the map");
  }
}

/** Lists every value JSON cannot carry faithfully (undefined, NaN, ±Infinity, -0, Map, Set, class instances, holes). */
export function jsonSafetyIssues(value: unknown, path = "$", issues: string[] = [], limit = 50): string[] {
  if (issues.length >= limit) return issues;
  if (value === undefined) issues.push(`${path}: undefined`);
  else if (typeof value === "number") {
    if (!Number.isFinite(value)) issues.push(`${path}: ${value}`);
    else if (Object.is(value, -0)) issues.push(`${path}: -0`);
  } else if (typeof value === "function" || typeof value === "symbol" || typeof value === "bigint") {
    issues.push(`${path}: ${typeof value}`);
  } else if (typeof value === "object" && value !== null) {
    const prototype = Object.getPrototypeOf(value) as object | null;
    if (prototype !== Object.prototype && prototype !== Array.prototype && prototype !== null) {
      issues.push(`${path}: ${(prototype as { constructor?: { name?: string } }).constructor?.name ?? "object"} instance`);
      return issues;
    }
    if (Array.isArray(value)) {
      for (let index = 0; index < value.length; index += 1) {
        if (!(index in value)) issues.push(`${path}[${index}]: hole`);
        else jsonSafetyIssues(value[index], `${path}[${index}]`, issues, limit);
      }
    } else {
      for (const [key, item] of Object.entries(value)) jsonSafetyIssues(item, `${path}.${key}`, issues, limit);
    }
  }
  return issues;
}
