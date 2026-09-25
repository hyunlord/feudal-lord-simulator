import assert from "node:assert/strict";
import { migrateStateV9ToV10 } from "../src/save/migrations/v9ToV10";
import { readFileSync } from "node:fs";
import test from "node:test";

import { formatNewGameArchiveNotice, formatSaveSummaryLine } from "../src/content/saveCopy.ko";
import type { GameState } from "../src/engine/engine.types";
import { advanceTick } from "../src/engine/tick";
import { openPlatformSaveStorage } from "../src/platform/saveStoragePlatform";
import { decisionSaveReason, shouldAutosave } from "../src/save/autosavePolicy";
import { migrateSaveToLatest, SaveMigrationError } from "../src/save/migrations";
import {
  decodeSave,
  encodeSave,
  jsonSafetyIssues,
  readSaveHeader,
  SaveChecksumError,
  SaveFormatError,
} from "../src/save/saveCodec";
import { AUTO_SAVE_SLOTS, backupSlotIdFor, createSaveService, PREVIOUS_SAVE_SLOT } from "../src/save/saveService";
import { MemorySaveStorage } from "../src/save/saveStorage";
import { SAVE_SCHEMA_VERSION } from "../src/save/saveTypes";
import { DEFAULT_GAME_STATE, gameReducer } from "../src/state/gameStore";

const TIME = "2026-09-24T00:00:00.000Z";
const V0_SEED1 = "fixtures/determinism/seed1/final-state.json";

function playedState(ticks: number): GameState {
  let state: GameState = structuredClone(DEFAULT_GAME_STATE);
  for (let index = 0; index < ticks; index += 1) state = advanceTick(state);
  return state;
}

function clock(start = Date.parse(TIME)) {
  let now = start;
  return () => new Date((now += 1_000));
}

test("save envelope round-trips the whole game state and keeps the state last", () => {
  const state = playedState(40);
  const encoded = encodeSave({ state, createdAt: TIME, savedAt: TIME, gameVersion: "test" });
  const text = new TextDecoder().decode(encoded.bytes);
  assert.ok(text.startsWith(`{"schemaVersion":${SAVE_SCHEMA_VERSION},`));
  assert.ok(text.includes(',"state":{"tick":40,'));
  const decoded = decodeSave(encoded.bytes);
  assert.equal(decoded.migratedFrom, SAVE_SCHEMA_VERSION);
  assert.deepEqual(decoded.envelope.state, state);
  assert.equal(decoded.envelope.tick, 40);
  assert.equal(decoded.envelope.seed, "1");
  assert.deepEqual(decoded.envelope.rngState, { kind: "derived", algorithm: "mulberry32/fnv1a-roaming-junction-v1", seed: 1 });
  assert.match(decoded.envelope.checksum ?? "", /^cyrb53:[0-9a-f]{14}$/);
  assert.ok(encoded.saveSerializeMs >= 0);
});

test("header reads without the state and matches the envelope", () => {
  const encoded = encodeSave({ state: playedState(5), createdAt: TIME, savedAt: TIME });
  const header = readSaveHeader(encoded.bytes);
  assert.ok(header !== null);
  assert.equal(header.tick, 5);
  assert.equal(header.summary.population, DEFAULT_GAME_STATE.population);
  assert.equal("state" in header, false);
});

test("game state stays JSON-safe after ticks and player actions", () => {
  let state = playedState(200);
  state = gameReducer(state, { type: "place_road_line", start: { tx: 30, ty: 30 }, destination: { tx: 34, ty: 30 } });
  for (let index = 0; index < 50; index += 1) state = advanceTick(state);
  assert.deepEqual(jsonSafetyIssues(state), []);
  assert.deepEqual(jsonSafetyIssues({ a: undefined, b: Number.NaN, c: -0, d: new Map(), e: [1, , 2] }).length, 5);
});

test("a corrupted state fails the checksum", () => {
  const encoded = encodeSave({ state: playedState(3), createdAt: TIME, savedAt: TIME });
  const text = new TextDecoder().decode(encoded.bytes).replace('"treasuryCoin":0', '"treasuryCoin":9');
  assert.throws(() => decodeSave(new TextEncoder().encode(text)), SaveChecksumError);
  assert.throws(() => decodeSave(new TextEncoder().encode("{not json")), SaveFormatError);
});

test("v0 bare states migrate to the latest envelope", () => {
  const raw = JSON.parse(readFileSync(V0_SEED1, "utf8")) as GameState;
  const decoded = decodeSave(new TextEncoder().encode(JSON.stringify(raw)));
  assert.equal(decoded.migratedFrom, 0);
  assert.equal(decoded.envelope.schemaVersion, SAVE_SCHEMA_VERSION);
  assert.equal(decoded.envelope.tick, raw.tick);
  assert.equal(decoded.envelope.gameVersion, "unknown (v0 bare state)");
  assert.equal(decoded.envelope.summary.era, "stone_town");
  // v4 -> v5 adds only the default scenario (spec SC-14); v5 -> v6 adds only empty zones (spec Z-1);
  // v6 -> v7 swaps the income window for a ledger holding the opening balance (spec L-9).
  const { coinLedger: _coinLedger, ...rawRest } = raw as GameState & { coinLedger?: unknown };
  // v9 -> v10 turns the city's wheat farms into arable fields and farmsteads (spec AF-12).
  assert.deepEqual(decoded.envelope.state, migrateStateV9ToV10({ ...rawRest, scenarioId: "core:campaign_market_town", zones: [], nextZoneOrdinal: 1,
    ledger: { entries: [{ id: "ledger-000001", tick: raw.tick, account: "cash", category: "opening_balance", amount: raw.treasuryCoin,
    sourceRefs: [{ type: "scenario", id: "core:campaign_market_town", detail: "save_v6" }] }], rollups: [], nextEntryOrdinal: 2 } }));
});

test("migration refuses newer or unknown files", () => {
  assert.throws(() => migrateSaveToLatest({ schemaVersion: SAVE_SCHEMA_VERSION + 1 }), SaveMigrationError);
  assert.throws(() => migrateSaveToLatest({ hello: "world" }), SaveMigrationError);
});

test("autosave rotates auto-1..3 by age and the manual slot is separate", async () => {
  const storage = new MemorySaveStorage();
  const service = createSaveService({ storage, now: clock() });
  const slots: string[] = [];
  for (let index = 0; index < 5; index += 1) slots.push((await service.autosave(playedState(index + 1))).meta.slotId);
  assert.deepEqual(slots, ["auto-1", "auto-2", "auto-3", "auto-1", "auto-2"]);
  await service.saveManual(playedState(9));
  const saves = await service.playerSaves();
  assert.deepEqual(saves.map(meta => meta.slotId), ["manual", "auto-2", "auto-1", "auto-3"]);
  assert.equal((await service.loadLatest())?.state.tick, 9);
  assert.equal(AUTO_SAVE_SLOTS.length, 3);
});

test("a corrupted newest save falls back to the next backup", async () => {
  const storage = new MemorySaveStorage();
  const service = createSaveService({ storage, now: clock() });
  await service.autosave(playedState(2));
  const newest = await service.autosave(playedState(4));
  const bytes = await storage.read(newest.meta.slotId);
  assert.ok(bytes !== null);
  const text = new TextDecoder().decode(bytes).replace('"tick":4,"seed"', '"tick":4,"seed":7,"x"');
  await storage.write(newest.meta.slotId, new TextEncoder().encode(text));
  const loaded = await service.loadLatest();
  assert.equal(loaded?.slotId, "auto-1");
  assert.equal(loaded?.state.tick, 2);
  assert.equal(loaded?.rejected[0]?.slotId, "auto-2");
  assert.equal(loaded?.rejected[0]?.checksum, true);
});

test("the first save under a newer schema keeps the older file as a backup", async () => {
  const storage = new MemorySaveStorage();
  const v0 = new TextEncoder().encode(JSON.stringify(playedState(1)));
  await storage.write("manual", v0);
  const service = createSaveService({ storage, now: clock() });
  const result = await service.saveManual(playedState(6));
  assert.equal(result.backupSlotId, backupSlotIdFor("manual", 0));
  assert.deepEqual(await storage.read("backup-v0-manual"), v0);
  assert.equal((await service.saveManual(playedState(7))).backupSlotId, null);
  assert.equal((await service.playerSaves()).some(meta => meta.slotId.startsWith("backup")), false);
});

test("platform storage falls back to memory when IndexedDB is missing or throws", async () => {
  const missing = await openPlatformSaveStorage({});
  assert.equal(missing.kind, "memory");
  assert.equal(missing.persistent, false);
  const throwing = await openPlatformSaveStorage({ indexedDB: { open: () => { throw new Error("SecurityError"); } } as unknown as IDBFactory });
  assert.equal(throwing.kind, "memory");
});

test("autosave only fires on change, and interval saves wait 60 seconds", () => {
  const state = playedState(1);
  const later = advanceTick(state);
  assert.equal(shouldAutosave({ reason: "pause", state, lastSavedState: state, lastSavedAtMs: 0, nowMs: 1 }), false);
  assert.equal(shouldAutosave({ reason: "hidden", state: later, lastSavedState: state, lastSavedAtMs: 0, nowMs: 1 }), true);
  assert.equal(shouldAutosave({ reason: "interval", state: later, lastSavedState: state, lastSavedAtMs: 0, nowMs: 59_999 }), false);
  assert.equal(shouldAutosave({ reason: "interval", state: later, lastSavedState: state, lastSavedAtMs: 0, nowMs: 60_000 }), true);
  assert.equal(shouldAutosave({ reason: "manual", state, lastSavedState: state, lastSavedAtMs: 0, nowMs: 0 }), true);
  assert.equal(decisionSaveReason(state, { ...state, era: "palisade" }), "era_changed");
  assert.equal(decisionSaveReason(state, later), null);
});

test("loading replaces the state even from an abandoned settlement", () => {
  const saved = playedState(12);
  const start = playedState(2);
  assert.ok(start.settlement !== undefined);
  const abandoned: GameState = { ...start, settlement: { ...start.settlement, outcome: "abandoned" } };
  assert.equal(gameReducer(abandoned, { type: "load_saved_state", state: saved }), saved);
});

test("continue summary reads like the first-screen line", () => {
  assert.equal(formatSaveSummaryLine({ elapsedMinutes: 24, population: 86, era: "palisade", problem: "food_shortage" }),
    "24분째 · 인구 86 · 목책 시대 · 현재 문제: 빵 배급 부족");
  assert.equal(formatSaveSummaryLine({ elapsedMinutes: 0, population: 12, era: "hamlet", problem: null }), "0분째 · 인구 12 · 촌락 시대");
});

test("starting a new game keeps the previous city outside the autosave rotation", async () => {
  const storage = new MemorySaveStorage();
  const service = createSaveService({ storage, now: clock() });
  for (const ticks of [10, 20, 30]) await service.autosave(playedState(ticks));
  const archived = await service.archivePrevious();
  assert.equal(archived?.slotId, PREVIOUS_SAVE_SLOT);
  assert.equal(archived?.tick, 30);
  service.startNewSession();
  for (let index = 1; index <= 4; index += 1) await service.autosave(playedState(index));
  const autos = (await service.playerSaves()).filter(meta => meta.slotId.startsWith("auto-"));
  assert.ok(autos.every(meta => meta.tick <= 4), "all three autosave slots now hold the new game");
  assert.equal((await service.load(PREVIOUS_SAVE_SLOT))?.state.tick, 30);
  assert.equal((await service.latest())?.slotId.startsWith("auto-"), true);
  assert.notEqual((await service.loadLatest())?.slotId, PREVIOUS_SAVE_SLOT);
  assert.equal(formatNewGameArchiveNotice({ elapsedMinutes: 24, population: 86 }),
    "새 게임을 시작하면 이어하던 도시(24분째 · 인구 86)는 '이전 도시' 칸에 보관됩니다.");
});
