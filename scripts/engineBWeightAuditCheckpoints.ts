import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import type { GameState } from '../src/engine/engine.types';
import type { HistoryRecord } from '../src/engine/history.types';
import { TRACE_LIVE_TICKS } from '../src/engine/decisionTrace';
import { encodeSave } from '../src/save/saveCodec';

interface CheckpointOptions {
  readonly directory: string;
  readonly sourceRevision: string;
  readonly dirtyPaths: string;
  readonly enabledIds: readonly string[];
  readonly endTickExclusive: number;
}
interface SavedCheckpoint {
  readonly file: string;
  readonly fileSha256: string;
  readonly encodedSaveSha256: string;
  readonly observedTick: number;
  readonly bytes: number;
}
interface DecisionPair {
  readonly entryId: string;
  readonly decisionId: string;
  readonly decisionTick: number;
  readonly source: string;
  readonly answer: SavedCheckpoint;
  readonly consequence?: SavedCheckpoint & { readonly historyId: string; readonly historyTick: number; readonly because: NonNullable<HistoryRecord['because']> };
}

/** Actual states only: observer runs after every command and tick, never reconstructs a historical state. */
export function createRegistryCheckpointObserver(options: CheckpointOptions) {
  if (options.dirtyPaths !== '' || !/^[a-f0-9]{40}$/.test(options.sourceRevision)) throw new Error('Checkpoints require a clean source revision');
  mkdirSync(options.directory, { recursive: true });
  const enabled = new Set(options.enabledIds);
  const pairs = new Map<string, DecisionPair>();
  const startedAt = new Date().toISOString();
  let previousTrace: GameState['trace'];
  let previousHistory: GameState['history'];
  let lastTick = 0;
  const save = (name: string, state: GameState): SavedCheckpoint => {
    const bytes = encodeSave({ state, createdAt: startedAt, savedAt: new Date().toISOString() }).bytes;
    const compressed = gzipSync(bytes);
    const file = `${name}.save.json.gz`;
    writeFileSync(join(options.directory, file), compressed, { flag: 'wx' });
    const sha = (value: Uint8Array) => createHash('sha256').update(value).digest('hex');
    return { file, fileSha256: sha(compressed), encodedSaveSha256: sha(bytes), observedTick: state.tick, bytes: compressed.byteLength };
  };
  const manifest = (finalSave: SavedCheckpoint | null = null) => ({ schemaVersion: 1, sourceRevision: options.sourceRevision,
    dirtyPaths: options.dirtyPaths, endTickExclusive: options.endTickExclusive, lastObservedTick: lastTick,
    pairs: [...pairs.values()].map(pair => ({ ...pair, status: pair.consequence !== undefined ? 'paired'
      : lastTick - pair.decisionTick >= TRACE_LIVE_TICKS ? 'mature_without_observed_future_link' : 'censored_without_observed_future_link' })),
    enabledWithoutAnsweredCheckpoint: options.enabledIds.filter(id => !pairs.has(id)), finalSave,
    limits: ['States are actual post-command/tick observations, not browser visibility proof.',
      'Only the first answered lord registry decision per enabled entry and its first linked later history record within three years are captured.'] });
  const writeManifest = (finalSave: SavedCheckpoint | null = null) => {
    const value = manifest(finalSave);
    writeFileSync(join(options.directory, 'manifest.json'), `${JSON.stringify(value, null, 2)}\n`);
    return value;
  };
  return {
    observe(state: GameState): void {
      lastTick = state.tick;
      let captured = false;
      if (previousTrace !== state.trace) {
        for (const decision of state.trace?.decisions ?? []) {
          const match = /^registry:(ck_evt_\d{3}):/.exec(decision.source);
          const entryId = match?.[1];
          if (decision.kind !== 'registry' || decision.by !== 'lord' || decision.lapsed === true || decision.tick !== state.tick
            || decision.tick >= options.endTickExclusive || entryId === undefined || !enabled.has(entryId) || pairs.has(entryId)) continue;
          const own = state.history?.records.find(record => record.id === decision.id);
          if (own?.kind !== 'decision' || own.decision === undefined || own.template === 'decision.lapsed') continue;
          pairs.set(entryId, { entryId, decisionId: decision.id, decisionTick: decision.tick, source: decision.source,
            answer: save(`${entryId}-answer-${decision.id}`, state) });
          captured = true;
        }
        previousTrace = state.trace;
      }
      if (previousHistory !== state.history) {
        for (const pair of pairs.values()) {
          if (pair.consequence !== undefined || state.tick > pair.decisionTick + TRACE_LIVE_TICKS) continue;
          const first = (state.history?.records ?? []).filter(record => record.kind !== 'decision' && record.tick > pair.decisionTick
            && record.tick <= pair.decisionTick + TRACE_LIVE_TICKS && record.because?.some(cause => cause.decisionId === pair.decisionId))
            .sort((a, b) => a.tick - b.tick || a.id.localeCompare(b.id))[0];
          if (first?.because === undefined) continue;
          pairs.set(pair.entryId, { ...pair, consequence: { ...save(`${pair.entryId}-consequence-${first.id}`, state),
            historyId: first.id, historyTick: first.tick, because: first.because } });
          captured = true;
        }
        previousHistory = state.history;
      }
      if (captured) writeManifest();
    },
    finish(state: GameState) {
      lastTick = state.tick;
      return writeManifest(save('final', state));
    },
  };
}
