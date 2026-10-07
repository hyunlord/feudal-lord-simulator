import { contentStateProblem } from "../content/contentRegistry";
import { ledgerStateProblem } from "../ledger/ledgerValidation";
import { moneyStateProblem } from "../engine/moneyValidation";
import { zoneStateProblem } from "../zones/zoneValidation";
import { DEFAULT_SCENARIO_ID as CAMPAIGN_SCENARIO_ID } from "../content/scenario/coreScenarios";
import { SCENARIOS } from "../content/scenario/registry";
import type { GameState } from "../engine/engine.types";
import { GAME_VERSION } from "./gameVersion";
import { migrateSaveToLatest, saveSchemaVersionOf } from "./migrations";
import { createSaveSummary } from "./saveSummary";
import {
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
    scenarioId: input.scenarioId ?? input.state.scenarioId ?? CAMPAIGN_SCENARIO_ID,
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

/**
 * SMOOTH-2E: `encodeSave` in pieces — the same bytes, the same checksum — so a caller can spread a big city's save
 * (6.7 MB by 1440, ~50 ms in one task) over idle slices. Each `next()` does one piece; the generator returns the save.
 * The state is written as JSON.stringify would (key order, skipped undefined members, null for an array's undefined),
 * whole below the first levels and piece by piece above them; the checksum runs over the pieces in order.
 */
export function* encodeSaveInPieces(input: EncodeSaveInput): Generator<void, EncodedSave, void> {
  let workMs = 0;
  let resumedAt = performance.now();
  const checksum = createStateChecksum();
  const chunks: Uint8Array[] = [];
  let pending = "";
  const write = (text: string) => {
    checksum.update(text);
    pending += text;
    if (pending.length >= PIECE_FLUSH_CHARS) { chunks.push(encoder.encode(pending)); pending = ""; }
    return text.length;
  };
  for (const _piece of jsonPieces(toSnapshot(input.state), 0, write)) {
    workMs += performance.now() - resumedAt;
    yield;
    resumedAt = performance.now();
  }
  if (pending.length > 0) chunks.push(encoder.encode(pending));
  const header: SaveHeader = {
    schemaVersion: SAVE_SCHEMA_VERSION,
    gameVersion: input.gameVersion ?? GAME_VERSION,
    createdAt: input.createdAt,
    savedAt: input.savedAt,
    scenarioId: input.scenarioId ?? input.state.scenarioId ?? CAMPAIGN_SCENARIO_ID,
    seed: String(input.state.seed),
    tick: input.state.tick,
    rngState: { kind: "derived", algorithm: "mulberry32/fnv1a-roaming-junction-v1", seed: input.state.seed },
    summary: createSaveSummary(input.state),
    checksum: checksum.digest(),
  };
  const head = encoder.encode(`${JSON.stringify(header).slice(0, -1)}${STATE_MARKER}`);
  const bytes = new Uint8Array(head.byteLength + chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0) + 1);
  bytes.set(head, 0);
  let offset = head.byteLength;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  bytes[offset] = 0x7d; // "}"
  return { bytes, header, saveSerializeMs: workMs + performance.now() - resumedAt };
}

const PIECE_FLUSH_CHARS = 65_536;
/** A piece ends once it has written this many characters (or a run of `PIECE_RUN` members). */
const PIECE_CHARS = 16_384;
const PIECE_RUN = 128;
/** The first levels are always written member by member; deeper, only a large member (see `isLarge`). */
const PIECE_OPEN_DEPTH = 2;
const PIECE_MAX_DEPTH = 8;
const LARGE_ARRAY = 64;

function isContainer(value: unknown): value is object {
  return typeof value === "object" && value !== null && typeof (value as { toJSON?: unknown }).toJSON !== "function";
}

/** A long array, or an object holding one: worth writing member by member. */
function isLarge(value: object): boolean {
  if (Array.isArray(value)) return value.length > LARGE_ARRAY;
  for (const key in value) {
    const member: unknown = (value as Record<string, unknown>)[key];
    if (Array.isArray(member) && member.length > LARGE_ARRAY) return true;
  }
  return false;
}

function opens(value: unknown, depth: number): value is object {
  return isContainer(value) && depth < PIECE_MAX_DEPTH && (depth < PIECE_OPEN_DEPTH || isLarge(value));
}

/** Writes `value`'s JSON through `write`, yielding between pieces. */
function* jsonPieces(value: unknown, depth: number, write: (text: string) => number): Generator<void, void, void> {
  if (!opens(value, depth)) {
    write(JSON.stringify(value) ?? "null");
    return;
  }
  let written = 0;
  let members = 0;
  const piece = function* (chars: number) {
    written += chars;
    members += 1;
    if (written >= PIECE_CHARS || members >= PIECE_RUN) { written = 0; members = 0; yield; }
  };
  if (Array.isArray(value)) {
    write("[");
    for (let index = 0; index < value.length; index += 1) {
      if (index > 0) write(",");
      const member: unknown = value[index];
      if (opens(member, depth + 1)) { yield* jsonPieces(member, depth + 1, write); written = 0; members = 0; yield; }
      else yield* piece(write(JSON.stringify(member) ?? "null"));
    }
    write("]");
    return;
  }
  write("{");
  let first = true;
  for (const key of Object.keys(value)) {
    const member: unknown = (value as Record<string, unknown>)[key];
    if (opens(member, depth + 1)) {
      write(`${first ? "" : ","}${JSON.stringify(key)}:`);
      first = false;
      yield* jsonPieces(member, depth + 1, write);
      written = 0; members = 0;
      yield;
      continue;
    }
    const text = JSON.stringify(member);
    if (text === undefined) continue;
    yield* piece(write(`${first ? "" : ","}${JSON.stringify(key)}:${text}`));
    first = false;
  }
  write("}");
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
  const checksum = createStateChecksum();
  checksum.update(text);
  return checksum.digest();
}

/** `stateChecksum` over a text given in pieces, in order (SMOOTH-2E: the save written in slices). */
function createStateChecksum(): { readonly update: (text: string) => void; readonly digest: () => string } {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  return {
    update: (text) => {
      for (let index = 0; index < text.length; index += 1) {
        const code = text.charCodeAt(index);
        h1 = Math.imul(h1 ^ code, 2_654_435_761);
        h2 = Math.imul(h2 ^ code, 1_597_334_677);
      }
    },
    digest: () => {
      const m1 = Math.imul(h1 ^ (h1 >>> 16), 2_246_822_507) ^ Math.imul(h2 ^ (h2 >>> 13), 3_266_489_909);
      const m2 = Math.imul(h2 ^ (h2 >>> 16), 2_246_822_507) ^ Math.imul(m1 ^ (m1 >>> 13), 3_266_489_909);
      const value = 4_294_967_296 * (2_097_151 & m2) + (m1 >>> 0);
      return `cyrb53:${value.toString(16).padStart(14, "0")}`;
    },
  };
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
  if (Array.isArray(state.buildings)) for (const building of state.buildings) {
    if (typeof building === 'object' && building !== null && 'operationPaused' in building
      && typeof building.operationPaused !== 'boolean') {
      throw new SaveFormatError('Save building operationPaused must be a boolean');
    }
  }
  for (const key of REQUIRED_NUMBERS) {
    if (typeof state[key] !== "number" || !Number.isFinite(state[key])) {
      throw new SaveFormatError(`Save state ${key} must be a finite number`);
    }
  }
  const timberWindow = state.timberProductionWindow;
  if (typeof timberWindow === 'object' && timberWindow !== null && 'expansionShortageSinceTick' in timberWindow) {
    const tick = timberWindow.expansionShortageSinceTick;
    if (typeof tick !== 'number' || !Number.isSafeInteger(tick) || tick < 0 || tick > Number(state.tick)) {
      throw new SaveFormatError('Save expansionShortageSinceTick must be a nonnegative integer no later than the state tick');
    }
  }
  if (!["hamlet", "palisade", "stone_town"].includes(state.era as string)) throw new SaveFormatError("Save state era is unknown");
  if (state.scenarioId !== undefined && (typeof state.scenarioId !== "string" || SCENARIOS.get(state.scenarioId) === undefined)) {
    throw new SaveFormatError("Save state scenario is unknown");
  }
  if (typeof state.pathCache !== "object" || state.pathCache === null) throw new SaveFormatError("Save state pathCache must be an object");
  // EXT-1: every content id the state names is one the registry knows (a pack's kinds join it at EXT-3b).
  const contentProblem = contentStateProblem(state);
  if (contentProblem !== null) throw new SaveFormatError(`Save state ${contentProblem}`);
  const zoneProblem = zoneStateProblem(state);
  if (zoneProblem !== null) throw new SaveFormatError(`Save state ${zoneProblem}`);
  const ledgerProblem = ledgerStateProblem(state);
  if (ledgerProblem !== null) throw new SaveFormatError(`Save state ${ledgerProblem}`);
  const moneyProblem = moneyStateProblem(state);
  if (moneyProblem !== null) throw new SaveFormatError(`Save state ${moneyProblem}`);
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
