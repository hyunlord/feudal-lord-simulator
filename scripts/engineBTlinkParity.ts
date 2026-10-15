import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import type { GameState } from '../src/engine/engine.types';

export const TLINK_PARITY_EXCLUSIONS = ['history', 'trace.decisions', 'trace.answers'] as const;
export interface ParityObservation {
  readonly phase: 'initial' | 'command' | 'tick' | 'final';
  readonly commandOrdinal: number;
}
interface Checkpoint extends ParityObservation { readonly tick: number; readonly hash: string }

/** Canonical JSON-domain values; rejects unsupported values rather than silently dropping rule data. */
function canonical(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') { assert.ok(Number.isFinite(value), 'Nonfinite parity value'); return JSON.stringify(value); }
  assert.ok(typeof value === 'object', 'Unsupported parity value');
  if (Array.isArray(value)) return `[${value.map(item => canonical(item === undefined ? null : item)).join(',')}]`;
  assert.ok(Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null, 'Non-plain parity object');
  return `{${Object.entries(value).filter(([, item]) => item !== undefined).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`;
}
export function canonicalTlinkRuleState(state: GameState): string {
  const projected = Object.fromEntries(Object.entries(state).filter(([key]) => key !== 'history').map(([key, value]) => {
    if (key !== 'trace' || value === undefined) return [key, value];
    assert.ok(value !== null && typeof value === 'object' && !Array.isArray(value), 'Invalid trace');
    return [key, Object.fromEntries(Object.entries(value).filter(([field]) => field !== 'decisions' && field !== 'answers'))];
  }));
  return canonical(projected);
}

/** Observes every reduction/tick, but hashes only initial, commands, season boundaries and explicit final. */
export function createTlinkParityObserver(options: { readonly seasonLength?: number } = {}) {
  const seasonLength = options.seasonLength ?? 1000;
  assert.ok(Number.isSafeInteger(seasonLength) && seasonLength > 0, 'Invalid season length');
  const rolling = createHash('sha256'), checkpoints: Checkpoint[] = [];
  let observations = 0, lastTick: number | null = null, ordinal = 0, finalized = false;
  return {
    observe(state: GameState, observation: ParityObservation): void {
      assert.ok(!finalized, 'Parity already finalized');
      assert.ok(Number.isSafeInteger(state.tick) && state.tick >= 0, 'Invalid tick');
      assert.ok(Number.isSafeInteger(observation.commandOrdinal) && observation.commandOrdinal >= 0, 'Invalid ordinal');
      if (lastTick === null) assert.ok(observation.phase === 'initial' && observation.commandOrdinal === 0, 'Initial observation required');
      else {
        assert.notEqual(observation.phase, 'initial', 'Repeated initial');
        assert.equal(state.tick, lastTick + (observation.phase === 'tick' ? 1 : 0), 'Missing/reversed tick');
        assert.equal(observation.commandOrdinal, ordinal + (observation.phase === 'command' ? 1 : 0), 'Missing/repeated command');
      }
      const selected = observation.phase !== 'tick' || state.tick % seasonLength === 0;
      if (selected) {
        const checkpoint = { ...observation, tick: state.tick, hash: createHash('sha256').update(canonicalTlinkRuleState(state)).digest('hex') };
        rolling.update(`${canonical(checkpoint)}\n`); checkpoints.push(checkpoint);
      }
      observations += 1; lastTick = state.tick; ordinal = observation.commandOrdinal;
      finalized = observation.phase === 'final';
    },
    snapshot() {
      return { schemaVersion: 1, exclusions: [...TLINK_PARITY_EXCLUSIONS], seasonLength,
        hashScope: 'initial_each_command_season_boundaries_explicit_final', everyTickStateParity: false,
        finalized, observations, commandCount: ordinal, lastTick,
        initialHash: checkpoints[0]?.hash ?? null, finalHash: checkpoints.at(-1)?.hash ?? null,
        rollingHash: rolling.copy().digest('hex'), checkpoints: checkpoints.map(row => ({ ...row })) };
    },
  };
}
