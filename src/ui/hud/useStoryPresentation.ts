import { useEffect, useRef, useState } from "react";

import type { GameState } from "../../engine/engine.types";
import { chapterEnd, famineStatus, openPetitions } from "../../engine/politics";
import { presentationPreference } from "../../render/presentationPreferences";
import { eventWorldFirstMs, storyBeats, type StoryBeat } from "../eventStory";
import type { UiModal } from "../uiStateMachine";

// UI-4 world before UI: a beat's chip appears EVENT_WORLD_FIRST_MS after the beat is first seen (the world has shown
// it by then: the burning roof, the blighted fields, the petitioners at the gate) and stays until dismissed or a
// minute after the beat is over (its facts as last seen). A decision beat also opens its modal once, on the same
// delay (the famine's answer, the petition); the chapter's end opens the chronicle page once. With the setting on,
// a new chip stops time (UI-4: cards are not modal by default). storyBeats reads the state only (0.01–0.02 ms).
const LINGER_MS = 60_000;
const MAX_CHIPS = 3;

type Seen = { beat: StoryBeat; firstSeenMs: number; lastSeenMs: number; dismissed: boolean };

export function useStoryPresentation(input: {
  readonly state: GameState; readonly nowMs: number; readonly blocked: boolean; readonly topModal: UiModal | null;
  readonly pushModal: (modal: UiModal) => void; readonly pause: () => void;
}) {
  const { state, nowMs, blocked, topModal, pushModal, pause } = input;
  const seenRef = useRef(new Map<string, Seen>());
  const openedRef = useRef(new Set<string>());
  const announcedRef = useRef(new Set<string>());
  const chapterSeenRef = useRef(new Map<string, number>());
  const [, setRevision] = useState(0);
  const [delayMs] = useState(eventWorldFirstMs);
  const beats = storyBeats(state);
  useEffect(() => {
    const seen = seenRef.current; const now = Date.now(); let changed = false;
    for (const beat of beats) {
      const entry = seen.get(beat.id);
      if (entry === undefined) { seen.set(beat.id, { beat, firstSeenMs: now, lastSeenMs: now, dismissed: false }); changed = true; }
      else { entry.beat = beat; entry.lastSeenMs = now; }
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
  }, [visibleKey]); // eslint-disable-line react-hooks/exhaustive-deps
  // Decisions and the chronicle open once, after the world first.
  const famine = famineStatus(state); const petition = openPetitions(state)[0]; const end = chapterEnd(state);
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
    if (chapterKey !== null && !openedRef.current.has(chapterKey)) {
      const since = chapterSeenRef.current.get(chapterKey) ?? Date.now();
      chapterSeenRef.current.set(chapterKey, since);
      if (nowMs - since >= delayMs) { openedRef.current.add(chapterKey); pushModal("chronicle"); }
    }
  });
  return {
    visible,
    dismiss: (id: string) => { const entry = seenRef.current.get(id); if (entry !== undefined) { entry.dismissed = true; setRevision(revision => revision + 1); } },
  };
}
