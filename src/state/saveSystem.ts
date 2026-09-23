import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type RefObject } from "react";

import { SAVE_COPY } from "../content/saveCopy.ko";
import type { GameState } from "../engine/engine.types";
import { openPlatformSaveStorage } from "../platform/saveStoragePlatform";
import { shouldAutosave, type SaveReason } from "../save/autosavePolicy";
import { createSaveService, type SaveService } from "../save/saveService";
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
  /** requestAnimationFrame gap spanning the save, to see whether a frame was dropped. */
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
  readonly declineContinue: () => void;
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
      const run = () => {
        const frameBefore = performance.now();
        const taskStartedAt = performance.now();
        const pending = reason === "manual" ? service.saveManual(state) : service.autosave(state);
        const frameWorkMs = performance.now() - taskStartedAt;
        const frameAfter = new Promise<number | null>(done => {
          if (typeof window.requestAnimationFrame !== "function") done(null);
          else window.requestAnimationFrame(timestamp => done(Math.max(0, timestamp - frameBefore)));
        });
        void pending.then(async result => {
          recordMetric({ reason, slotId: result.meta.slotId, tick: result.meta.tick, byteLength: result.byteLength,
            saveSerializeMs: result.saveSerializeMs, writeMs: result.writeMs, frameWorkMs, frameIntervalMs: await frameAfter });
          if (reason === "manual") setNotice(SAVE_COPY.saved);
          await refreshSaves(service);
        }, () => {
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

  const value = useMemo<SaveSystemValue>(() => ({
    ready,
    persistent,
    latest: saves[0] ?? null,
    recent: saves.slice(0, RECENT_SAVE_COUNT),
    offerContinue: ready && offerContinue && saves.length > 0,
    busy,
    notice,
    saveNow: () => requestSave("manual"),
    load: slotId => finishLoad(() => serviceRef.current!.load(slotId)),
    continueLatest: () => {
      const slotId = saves[0]?.slotId;
      if (slotId !== undefined) finishLoad(() => serviceRef.current!.load(slotId));
    },
    declineContinue: () => {
      setOfferContinue(false);
      serviceRef.current?.startNewSession();
    },
  }), [busy, finishLoad, notice, offerContinue, persistent, ready, requestSave, saves]);

  return { value, requestSave };
}

