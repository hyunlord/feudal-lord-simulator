import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type RefObject } from "react";

import { SAVE_COPY } from "../content/saveCopy.ko";
import type { GameState } from "../engine/engine.types";
import { openPlatformSaveStorage } from "../platform/saveStoragePlatform";
import { shouldAutosave, type SaveReason } from "../save/autosavePolicy";
import { createSaveService, PREVIOUS_SAVE_SLOT, type SaveService } from "../save/saveService";
import type { SaveMeta } from "../save/saveTypes";

const RECENT_SAVE_COUNT = 3;
const INTERVAL_CHECK_MS = 5_000;
const METRIC_CAPACITY = 32;

export interface SaveMetricSample {
  readonly reason: SaveReason;
  readonly slotId: string;
  readonly tick: number;
  readonly byteLength: number;
  readonly saveSerializeMs: number;
  readonly writeMs: number;
  /** Synchronous main-thread work of the save task, i.e. what the save adds to its frame. */
  readonly frameWorkMs: number;
  /** Longest gap between animation frames from the request until two frames after the save; ~16.7 ms means no drop. */
  readonly frameIntervalMs: number | null;
}

export interface SaveSystemValue {
  readonly ready: boolean;
  readonly persistent: boolean;
  readonly latest: SaveMeta | null;
  readonly recent: readonly SaveMeta[];
  /** True until the player picks continue or new game on the first screen of this page load. */
  readonly offerContinue: boolean;
  readonly busy: boolean;
  readonly notice: string | null;
  readonly saveNow: () => void;
  readonly load: (slotId: string) => void;
  readonly continueLatest: () => void;
  /** Ends the continue offer and starts a fresh session (settlement restart). */
  readonly declineContinue: () => void;
  /** New game from the first screen: archives the newest autosave as the previous city first. */
  readonly startNewGame: () => void;
}

export const SaveSystemContext = createContext<SaveSystemValue | null>(null);

export function useSaveSystemContext(): SaveSystemValue {
  const value = useContext(SaveSystemContext);
  if (value === null) throw new Error("GameProvider is missing");
  return value;
}

declare global {
  interface Window {
    __FLS_SAVE_METRICS__?: SaveMetricSample[];
  }
}

function afterIdle(callback: () => void): void {
  if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(callback, { timeout: 1_000 });
  else window.setTimeout(callback, 0);
}

/** Samples requestAnimationFrame timestamps until stopped and reports the longest frame-to-frame gap. */
function sampleFrameGaps(): { readonly stop: () => Promise<number | null> } {
  if (typeof window.requestAnimationFrame !== "function") return { stop: async () => null };
  let previous: number | null = null;
  let longest: number | null = null;
  let framesAfterStop = -1;
  let finish: ((value: number | null) => void) | null = null;
  const frame = (timestamp: number) => {
    if (previous !== null) longest = Math.max(longest ?? 0, timestamp - previous);
    previous = timestamp;
    if (framesAfterStop >= 0 && (framesAfterStop += 1) > 2) { finish?.(longest); return; }
    window.requestAnimationFrame(frame);
  };
  window.requestAnimationFrame(frame);
  return { stop: () => new Promise(resolve => { finish = resolve; framesAfterStop = 0; }) };
}

function recordMetric(sample: SaveMetricSample): void {
  const samples = window.__FLS_SAVE_METRICS__ ?? [];
  samples.push(sample);
  if (samples.length > METRIC_CAPACITY) samples.splice(0, samples.length - METRIC_CAPACITY);
  window.__FLS_SAVE_METRICS__ = samples;
}

export function useSaveSystem(input: {
  readonly stateRef: RefObject<GameState>;
  readonly onLoaded: (state: GameState) => void;
}): { readonly value: SaveSystemValue; readonly requestSave: (reason: SaveReason) => void } {
  const { stateRef, onLoaded } = input;
  const serviceRef = useRef<SaveService | null>(null);
  const queueRef = useRef<Promise<unknown>>(Promise.resolve());
  const lastSavedStateRef = useRef<GameState | null>(stateRef.current);
  const lastSavedAtMsRef = useRef(Date.now());
  const [ready, setReady] = useState(false);
  const [persistent, setPersistent] = useState(true);
  const [saves, setSaves] = useState<readonly SaveMeta[]>([]);
  const [offerContinue, setOfferContinue] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const enqueue = useCallback((task: (service: SaveService) => Promise<void>) => {
    const service = serviceRef.current;
    if (service === null) return;
    queueRef.current = queueRef.current.then(() => task(service)).catch(() => undefined);
  }, []);

  const refreshSaves = useCallback(async (service: SaveService) => {
    setSaves(await service.playerSaves());
  }, []);

  useEffect(() => {
    let cancelled = false;
    void openPlatformSaveStorage().then(async platform => {
      const service = createSaveService({ storage: platform.storage });
      const found = await service.playerSaves().catch(() => []);
      if (cancelled) return;
      serviceRef.current = service;
      setPersistent(platform.persistent);
      if (!platform.persistent) setNotice(SAVE_COPY.storageUnavailable);
      setSaves(found);
      if (found.length === 0) setOfferContinue(false);
      setReady(true);
    });
    return () => { cancelled = true; };
  }, []);

  const requestSave = useCallback((reason: SaveReason) => {
    if (serviceRef.current === null) return;
    // Captured now, at a tick boundary; the immutable state is serialised when the main thread is idle.
    const state = stateRef.current;
    if (!shouldAutosave({ reason, state, lastSavedState: lastSavedStateRef.current,
      lastSavedAtMs: lastSavedAtMsRef.current, nowMs: Date.now() })) return;
    lastSavedStateRef.current = state;
    lastSavedAtMsRef.current = Date.now();
    if (reason === "manual") setBusy(true);
    enqueue(service => new Promise<void>(resolve => {
      const frames = sampleFrameGaps();
      const run = () => {
        const taskStartedAt = performance.now();
        const pending = reason === "manual" ? service.saveManual(state) : service.autosave(state);
        const frameWorkMs = performance.now() - taskStartedAt;
        void pending.then(async result => {
          recordMetric({ reason, slotId: result.meta.slotId, tick: result.meta.tick, byteLength: result.byteLength,
            saveSerializeMs: result.saveSerializeMs, writeMs: result.writeMs, frameWorkMs, frameIntervalMs: await frames.stop() });
          if (reason === "manual") setNotice(SAVE_COPY.saved);
          await refreshSaves(service);
        }, () => {
          void frames.stop();
          setNotice(SAVE_COPY.saveFailed);
        }).finally(() => {
          if (reason === "manual") setBusy(false);
          resolve();
        });
      };
      if (reason === "hidden") run();
      else afterIdle(run);
    }));
  }, [enqueue, refreshSaves, stateRef]);

  const finishLoad = useCallback((loadedSlot: () => ReturnType<SaveService["load"]>) => {
    setBusy(true);
    enqueue(async service => {
      const result = await loadedSlot().catch(() => null);
      setBusy(false);
      if (result === null) { setNotice(SAVE_COPY.loadFailed); return; }
      lastSavedStateRef.current = result.state;
      lastSavedAtMsRef.current = Date.now();
      setOfferContinue(false);
      setNotice(result.rejected.some(item => item.checksum) ? SAVE_COPY.checksumFallback : null);
      onLoaded(result.state);
      await refreshSaves(service);
    });
  }, [enqueue, onLoaded, refreshSaves]);

  useEffect(() => {
    const interval = window.setInterval(() => requestSave("interval"), INTERVAL_CHECK_MS);
    const visibility = () => { if (document.visibilityState === "hidden") requestSave("hidden"); };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [requestSave]);

  const startNewGame = useCallback(() => {
    setOfferContinue(false);
    enqueue(async service => {
      await service.archivePrevious().catch(() => null);
      service.startNewSession();
      await refreshSaves(service);
    });
  }, [enqueue, refreshSaves]);

  const { current, previous } = useMemo(() => ({
    current: saves.filter(meta => meta.slotId !== PREVIOUS_SAVE_SLOT),
    previous: saves.find(meta => meta.slotId === PREVIOUS_SAVE_SLOT),
  }), [saves]);
  const latest = current[0] ?? null;
  const value = useMemo<SaveSystemValue>(() => ({
    ready,
    persistent,
    latest,
    recent: [...current.slice(0, RECENT_SAVE_COUNT), ...(previous === undefined ? [] : [previous])],
    offerContinue: ready && offerContinue && latest !== null,
    busy,
    notice,
    saveNow: () => requestSave("manual"),
    load: slotId => finishLoad(() => serviceRef.current!.load(slotId)),
    continueLatest: () => {
      const slotId = latest?.slotId;
      if (slotId !== undefined) finishLoad(() => serviceRef.current!.load(slotId));
    },
    declineContinue: () => {
      setOfferContinue(false);
      serviceRef.current?.startNewSession();
    },
    startNewGame,
  }), [busy, current, finishLoad, latest, notice, offerContinue, persistent, previous, ready, requestSave, startNewGame]);

  return { value, requestSave };
}

