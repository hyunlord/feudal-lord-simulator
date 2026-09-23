// B8 gate ①: advancing state S by N ticks must equal saving S, loading it in a fresh
// process, and advancing N ticks. Also proves autosave does not change the simulation.
//
// Usage: tsx scripts/verifySaveDeterminism.ts [--ticks 24000] [--newgame-ticks 10000]
//        [--cases seed1,seed2,seed3,seed4,seed5,newgame] [--out docs/verification/b8-save/determinism.json]
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { BALANCE } from "../src/content/balanceConfig";
import type { GameState } from "../src/engine/engine.types";
import { advanceTick } from "../src/engine/tick";
import { decodeSave, encodeSave, jsonSafetyIssues } from "../src/save/saveCodec";
import { createSaveService } from "../src/save/saveService";
import { MemorySaveStorage } from "../src/save/saveStorage";
import { DEFAULT_GAME_STATE } from "../src/state/gameStore";
import { createAutoplayTraceDriver } from "./economyHarnessAutoplay";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const SCRIPT = fileURLToPath(import.meta.url);
const SEED_STATE = (seed: number) => resolve(ROOT, `output/playtest-a-double-prime/seeds/final-689bda7/seed${seed}/final-state.json`);
/** 60 s of game time at 1× speed: the browser autosave cadence. */
const AUTOSAVE_EVERY_TICKS = 60 * BALANCE.TICKS_PER_SECOND;
const CHECKPOINT_EVERY_TICKS = 2_000;
const FIXED_TIME = "2026-09-24T00:00:00.000Z";

type Variant = "straight" | "reload" | "autosave" | "reload-chain";
interface WorkerInput {
  readonly caseId: string;
  readonly variant: Variant;
  readonly ticks: number;
  readonly newgameTicks: number;
  readonly savePath: string;
}
interface WorkerResult {
  readonly caseId: string;
  readonly variant: Variant;
  readonly startTick: number;
  readonly startHash: string;
  readonly finalTick: number;
  readonly finalHash: string;
  readonly checkpoints: readonly { readonly tick: number; readonly hash: string }[];
  readonly autosaves: number;
  readonly autosaveRoundTripMismatches: number;
  readonly deferredSerializationStable: boolean | null;
  readonly jsonSafetyIssues: readonly string[];
  readonly saveBytes: number | null;
  readonly saveSerializeMs: number | null;
  readonly elapsedSeconds: number;
}

/** sha256 of JSON with sorted keys, so property insertion order cannot hide or fake a difference. */
export function canonicalStateHash(state: unknown): string {
  return createHash("sha256").update(canonicalJson(state)).digest("hex");
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(item => item === undefined ? "null" : canonicalJson(item)).join(",")}]`;
  if (typeof value === "object" && value !== null) {
    const entries = Object.entries(value).filter(([, item]) => item !== undefined).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function newGameState(ticks: number): GameState {
  const driver = createAutoplayTraceDriver({ id: "b8-newgame", source: "DEFAULT_GAME_STATE", policy: { maxHousingLots: 24 } });
  let state: GameState = structuredClone(DEFAULT_GAME_STATE);
  while (state.tick < ticks) state = advanceTick(driver.apply(state));
  return state;
}

/** State S for a case, exactly as a running game would hold it in memory. */
function startState(input: WorkerInput): GameState {
  if (input.caseId === "newgame") return newGameState(input.newgameTicks);
  const seed = Number(input.caseId.replace("seed", ""));
  return JSON.parse(readFileSync(SEED_STATE(seed), "utf8")) as GameState;
}

async function runWorker(input: WorkerInput): Promise<WorkerResult> {
  const started = performance.now();
  let saveBytes: number | null = null;
  let saveSerializeMs: number | null = null;
  let state: GameState;
  if (input.variant === "reload") {
    state = decodeSave(new Uint8Array(readFileSync(input.savePath))).envelope.state;
  } else {
    state = startState(input);
    if (input.variant === "straight") {
      const encoded = encodeSave({ state, createdAt: FIXED_TIME, savedAt: FIXED_TIME });
      writeFileSync(input.savePath, encoded.bytes);
      saveBytes = encoded.bytes.byteLength;
      saveSerializeMs = encoded.saveSerializeMs;
    }
  }
  const startTick = state.tick;
  const startHash = canonicalStateHash(state);
  const service = createSaveService({ storage: new MemorySaveStorage(), now: () => new Date(FIXED_TIME) });
  const checkpoints: { tick: number; hash: string }[] = [];
  let autosaves = 0;
  let autosaveRoundTripMismatches = 0;
  let deferred: { readonly state: GameState; readonly checksum: string | undefined; readonly atTick: number } | null = null;
  let deferredSerializationStable: boolean | null = null;
  const autosaving = input.variant === "autosave" || input.variant === "reload-chain";
  for (let step = 1; step <= input.ticks; step += 1) {
    state = advanceTick(state);
    if (autosaving && step % AUTOSAVE_EVERY_TICKS === 0) {
      const result = await service.autosave(state);
      autosaves += 1;
      const loaded = await service.load(result.meta.slotId);
      if (loaded === null || canonicalStateHash(loaded.state) !== canonicalStateHash(state)) autosaveRoundTripMismatches += 1;
      if (deferred === null) {
        deferred = { state, checksum: encodeSave({ state, createdAt: FIXED_TIME, savedAt: FIXED_TIME }).header.checksum, atTick: state.tick };
      } else if (deferredSerializationStable === null && state.tick - deferred.atTick >= AUTOSAVE_EVERY_TICKS) {
        // The browser captures the state at a tick boundary and serialises it later; the captured object must not change.
        deferredSerializationStable = encodeSave({ state: deferred.state, createdAt: FIXED_TIME, savedAt: FIXED_TIME }).header.checksum === deferred.checksum;
      }
      if (input.variant === "reload-chain" && loaded !== null) state = loaded.state;
    }
    if (step % CHECKPOINT_EVERY_TICKS === 0) checkpoints.push({ tick: state.tick, hash: canonicalStateHash(state) });
  }
  return {
    caseId: input.caseId, variant: input.variant, startTick, startHash, finalTick: state.tick, finalHash: canonicalStateHash(state),
    checkpoints, autosaves, autosaveRoundTripMismatches, deferredSerializationStable,
    jsonSafetyIssues: jsonSafetyIssues(state, "$", [], 10), saveBytes, saveSerializeMs,
    elapsedSeconds: (performance.now() - started) / 1000,
  };
}

function spawnWorker(input: WorkerInput): Promise<WorkerResult> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, ["--import", "tsx", SCRIPT, "--worker", JSON.stringify(input)], {
      cwd: ROOT, stdio: ["ignore", "pipe", "inherit"],
    });
    let stdout = "";
    child.stdout.on("data", chunk => { stdout += String(chunk); });
    child.on("error", reject);
    child.on("close", code => {
      if (code !== 0) { reject(new Error(`${input.caseId}/${input.variant} worker exited ${code}`)); return; }
      const line = stdout.trim().split("\n").at(-1) ?? "";
      resolvePromise(JSON.parse(line) as WorkerResult);
    });
  });
}

function option(args: readonly string[], name: string, fallback: string): string {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] ?? fallback : fallback;
}

export async function verifySaveDeterminism(args: readonly string[]) {
  const ticks = Number(option(args, "--ticks", "24000"));
  const newgameTicks = Number(option(args, "--newgame-ticks", "10000"));
  const cases = option(args, "--cases", "seed1,seed2,seed3,seed4,seed5,newgame").split(",");
  const scratch = mkdtempSync(join(tmpdir(), "b8-save-determinism-"));
  const started = performance.now();
  try {
    const job = (caseId: string, variant: Variant): WorkerInput =>
      ({ caseId, variant, ticks, newgameTicks, savePath: join(scratch, `${caseId}.save.json`) });
    // Phase 1 writes each case's save at S and continues in the same process (a warm, uninterrupted game).
    const straight = await Promise.all(cases.map(caseId => spawnWorker(job(caseId, "straight"))));
    // Phase 2 opens those saves in fresh processes (cold module caches, like a page reload), plus autosave runs.
    const later = await Promise.all(cases.flatMap(caseId =>
      (["reload", "autosave", "reload-chain"] as const).map(variant => spawnWorker(job(caseId, variant)))));
    const rows = cases.map(caseId => {
      const find = (variant: Variant) => [...straight, ...later].find(row => row.caseId === caseId && row.variant === variant)!;
      const base = find("straight");
      const reload = find("reload");
      const autosave = find("autosave");
      const chain = find("reload-chain");
      const firstDivergence = reload.checkpoints.find((checkpoint, index) => checkpoint.hash !== base.checkpoints[index]?.hash)?.tick ?? null;
      return {
        caseId, startTick: base.startTick, finalTick: base.finalTick, ticks,
        saveBytes: base.saveBytes, saveSerializeMs: base.saveSerializeMs,
        startHashMatches: reload.startHash === base.startHash,
        reloadMatches: reload.finalHash === base.finalHash, firstDivergence,
        autosaveMatches: autosave.finalHash === base.finalHash && autosave.startHash === base.startHash,
        reloadChainMatches: chain.finalHash === base.finalHash,
        autosaves: autosave.autosaves, autosaveRoundTripMismatches: autosave.autosaveRoundTripMismatches + chain.autosaveRoundTripMismatches,
        deferredSerializationStable: autosave.deferredSerializationStable,
        jsonSafetyIssues: base.jsonSafetyIssues, finalHash: base.finalHash,
        elapsedSeconds: Math.max(base.elapsedSeconds, reload.elapsedSeconds, autosave.elapsedSeconds, chain.elapsedSeconds),
      };
    });
    const gateMatches = rows.filter(row => row.startHashMatches && row.reloadMatches).length;
    const passed = rows.every(row => row.startHashMatches && row.reloadMatches && row.autosaveMatches && row.reloadChainMatches
      && row.autosaveRoundTripMismatches === 0 && row.deferredSerializationStable !== false && row.jsonSafetyIssues.length === 0);
    return { schemaVersion: 1, gate: "B8 gate 1: save/load determinism", ticks, newgameTicks, autosaveEveryTicks: AUTOSAVE_EVERY_TICKS,
      hash: "sha256 of canonical (sorted-key) JSON of GameState", gateMatches, gateCases: rows.length, passed, rows,
      elapsedSeconds: (performance.now() - started) / 1000 };
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === SCRIPT) {
  const args = process.argv.slice(2);
  if (args[0] === "--worker") {
    const result = await runWorker(JSON.parse(args[1] ?? "{}") as WorkerInput);
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } else {
    const report = await verifySaveDeterminism(args);
    const out = option(args, "--out", "");
    if (out !== "") {
      mkdirSync(dirname(resolve(out)), { recursive: true });
      writeFileSync(resolve(out), `${JSON.stringify(report, null, 2)}\n`);
    }
    for (const row of report.rows) {
      process.stdout.write(`${row.caseId}: S@${row.startTick} → ${row.finalTick} reload=${row.reloadMatches} autosave=${row.autosaveMatches} ` +
        `chain=${row.reloadChainMatches} roundTripMismatches=${row.autosaveRoundTripMismatches} deferredStable=${row.deferredSerializationStable} ` +
        `bytes=${row.saveBytes} serializeMs=${row.saveSerializeMs?.toFixed(1)}\n`);
    }
    process.stdout.write(`determinism ${report.gateMatches}/${report.gateCases} · passed=${report.passed} · ${report.elapsedSeconds.toFixed(0)}s\n`);
    if (!report.passed) process.exitCode = 1;
  }
}
