import { useEffect, useRef, useState } from "react";

import type { GameState } from "../../engine/engine.types";
import type { ChapterEnd } from "../../engine/politics.types";
import { famineStatus, openPetitions } from "../../engine/politics";
import { presentationPreference } from "../../render/presentationPreferences";
import { eventWorldFirstMs, storyBeats, type StoryBeat } from "../eventStory";
import type { UiModal } from "../stateMachine/uiStateMachine";
import { latestChapterEnd } from "../chronicleModel";

// UI-4 world before UI: a beat's chip appears EVENT_WORLD_FIRST_MS after the beat is first seen (the world has shown
// it by then: the burning roof, the blighted fields, the petitioners at the gate) and stays until dismissed or a
// minute after the beat is over (its facts as last seen). A decision beat also opens its modal once, on the same
// delay (the famine's answer, the petition); the chapter's end opens the chronicle page once. With the setting on,
// a new chip stops time (UI-4: cards are not modal by default). storyBeats reads the state only (0.01–0.02 ms).
const LINGER_MS = 60_000;
const MAX_CHIPS = 3;

type Seen = { beat: StoryBeat; firstSeenMs: number; lastSeenMs: number; dismissed: boolean };

/** A chapter's page opens only this long after its end (one season). */
const CHAPTER_PAGE_TICKS = 1_000;

/**
 * UI-6 / QA-032: the chapter end whose page is due — the latest, within its season, and not seen yet. The seen mark is
 * the engine's (`seenTick`, kept in the save; v38 saves have their earlier ends marked by the v39 migration), so a load
 * does not open the page again; the hook's refs are only the in-session guard until the mark comes back.
 */
export function chapterPageDue(state: GameState): ChapterEnd | null {
  const latest = latestChapterEnd(state);
  return latest !== null && latest.seenTick === undefined && state.tick - latest.tick < CHAPTER_PAGE_TICKS ? latest : null;
}

export function useStoryPresentation(input: {
  readonly state: GameState; readonly nowMs: number; readonly blocked: boolean; readonly topModal: UiModal | null;
  readonly pushModal: (modal: UiModal) => void; readonly pause: () => void;
  /** QA-032: the chapter's page opened — the engine marks it seen (`mark_chapter_page_seen`). */
  readonly markChapterSeen: (chapter: number) => void;
}) {
  const { state, nowMs, blocked, topModal, pushModal, pause, markChapterSeen } = input;
  const seenRef = useRef(new Map<string, Seen>());
  const openedRef = useRef(new Set<string>());
  const announcedRef = useRef(new Set<string>());
  const chapterSeenRef = useRef(new Map<string, number>());
  const [, setRevision] = useState(0);
  const [delayMs] = useState(eventWorldFirstMs);
  const beats = storyBeats(state);
  // UI-6: a chapter's page opens when the chapter ends (within its season), not again on every later load of the town.
  const end = chapterPageDue(state);
  // why: every render on purpose: it records what the model shows now and re-renders only when a beat is new
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const seen = seenRef.current; const now = Date.now(); let changed = false;
    for (const beat of beats) {
      const entry = seen.get(beat.id);
      if (entry === undefined) { seen.set(beat.id, { beat, firstSeenMs: now, lastSeenMs: now, dismissed: false }); changed = true; }
      else { entry.beat = beat; entry.lastSeenMs = now; }
    }
    // A chapter's end first seen: its page is due `delayMs` on. CODE-1c follow-up: the wake timer below is computed at
    // render, so a first sighting re-renders to set it (a paused game, the presentation clock resting, would otherwise
    // never open the chapter's page).
    const chapterKey = end === null ? null : `chapter:${end.chapter}`;
    if (chapterKey !== null && !openedRef.current.has(chapterKey) && !chapterSeenRef.current.has(chapterKey)) {
      chapterSeenRef.current.set(chapterKey, now); changed = true;
    }
    if (changed) setRevision(revision => revision + 1);
  });
  const current = new Set(beats.map(beat => beat.id));
  const visible = [...seenRef.current.values()]
    .filter(entry => !entry.dismissed && nowMs - entry.firstSeenMs >= delayMs && (current.has(entry.beat.id) || nowMs - entry.lastSeenMs < LINGER_MS))
    .map(entry => entry.beat).slice(-MAX_CHIPS);
  const visibleKey = visible.map(beat => beat.id).join("|");
  // A new chip: stop time if the setting asks for it.
  useEffect(() => {
    let fresh = false;
    for (const beat of visible) if (!announcedRef.current.has(beat.id)) { announcedRef.current.add(beat.id); fresh = true; }
    if (fresh && !blocked && presentationPreference("eventPause")) pause();
  // why: keyed by the visible beats' ids (a new list each render); the pause setting is read when one is new
  }, [visibleKey]); // eslint-disable-line react-hooks/exhaustive-deps
  // Decisions and the chronicle open once, after the world first.
  const famine = famineStatus(state); const petition = openPetitions(state)[0];
  const ready = (id: string) => { const entry = seenRef.current.get(id); return entry !== undefined && nowMs - entry.firstSeenMs >= delayMs; };
  useEffect(() => {
    if (blocked || topModal !== null) return;
    if (famine !== null && famine.choices.length > 0 && !openedRef.current.has(famine.eventId) && ready(`famine:${famine.eventId}`)) {
      openedRef.current.add(famine.eventId); pushModal("decision"); return;
    }
    if (petition !== undefined && !openedRef.current.has(petition.id) && ready(`petition:${petition.id}`)) {
      openedRef.current.add(petition.id); pushModal("petition"); return;
    }
    const chapterKey = end === null ? null : `chapter:${end.chapter}`;
    const since = chapterKey === null || openedRef.current.has(chapterKey) ? undefined : chapterSeenRef.current.get(chapterKey);
    // QA-032: marked seen as it opens (as the refs did), so the "pause" autosave the page's modal pause writes already
    // holds the mark, and a save with the page still open does not show it again.
    if (end !== null && chapterKey !== null && since !== undefined && nowMs - since >= delayMs) { openedRef.current.add(chapterKey); pushModal("chronicle"); markChapterSeen(end.chapter); }
  });
  // CODE-1c: no presentation clock for the story — one timer wakes this hook when the next chip is due (its delay out),
  // a lingering chip goes, or a chapter end's chronicle may open. App's 100 ms clock stops when nothing else needs it.
  const wakes: number[] = [];
  for (const entry of seenRef.current.values()) {
    if (entry.dismissed) continue;
    if (nowMs - entry.firstSeenMs < delayMs) wakes.push(entry.firstSeenMs + delayMs);
    else if (!current.has(entry.beat.id) && nowMs - entry.lastSeenMs < LINGER_MS) wakes.push(entry.lastSeenMs + LINGER_MS);
  }
  const chapterSince = end === null || openedRef.current.has(`chapter:${end.chapter}`) ? undefined : chapterSeenRef.current.get(`chapter:${end.chapter}`);
  if (chapterSince !== undefined) wakes.push(chapterSince + delayMs);
  const nextWakeMs = wakes.length === 0 ? null : Math.min(...wakes);
  useEffect(() => {
    if (nextWakeMs === null) return undefined;
    const timer = window.setTimeout(() => setRevision(revision => revision + 1), Math.max(0, nextWakeMs - Date.now()) + 1);
    return () => window.clearTimeout(timer);
  }, [nextWakeMs]);
  return {
    visible,
    dismiss: (id: string) => { const entry = seenRef.current.get(id); if (entry !== undefined) { entry.dismissed = true; setRevision(revision => revision + 1); } },
  };
}
